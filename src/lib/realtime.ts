import type { Socket } from "socket.io-client";
import { waitForReconciliation } from "./network-ready";
import { auth, queryClient } from "./client";
import type { DomainEvent } from "./types";

export type ConnectionState =
  "connecting" | "connected" | "reconciling" | "disconnected";
let status: ConnectionState = "connecting";
const listeners = new Set<() => void>();
const versions = new Map<string, number>();
const seen = new Set<string>();
const notices = new Set<(message: string) => void>();
let receivedEvents = 0;
let stopSocket: (() => void) | undefined;
const update = (next: ConnectionState) => {
  status = next;
  listeners.forEach((fn) => fn());
};

export const realtime = {
  status: () => status,
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  notice: (fn: (message: string) => void) => {
    notices.add(fn);
    return () => {
      notices.delete(fn);
    };
  },
  count: () => receivedEvents,
  start() {
    stopSocket?.();
    versions.clear();
    seen.clear();
    const generation = auth.generation();
    let disposed = false;
    let active: Socket | undefined;
    const stop = () => {
      disposed = true;
      active?.removeAllListeners();
      active?.disconnect();
    };
    stopSocket = stop;
    void waitForReconciliation()
      .then(async () => {
        // Engine.IO captures WebSocket at import time; MSW must be installed first.
        const { io } = await import("socket.io-client");
        if (disposed || generation !== auth.generation()) return;
        const socket = (active = io("https://events.kurio.test", {
          transports: ["websocket"],
          autoConnect: false,
          reconnectionDelay: 250,
          reconnectionDelayMax: 2000,
        }));
        socket.on("connect", () => {
          socket.emit("subscribe", { token: auth.token() });
          update("reconciling");
          void queryClient.invalidateQueries().then(() => {
            if (generation === auth.generation() && socket.connected)
              update("connected");
          });
        });
        socket.on("disconnect", () => update("disconnected"));
        socket.on("connect_error", () => update("disconnected"));
        const receive = (message: DomainEvent) => {
          if (
            generation !== auth.generation() ||
            (message.userId && message.userId !== auth.get()?.user.id)
          )
            return;
          const resource = `${message.type}:${message.resourceId}`;
          if (
            seen.has(message.eventId) ||
            message.version <= (versions.get(resource) ?? 0)
          )
            return;
          seen.add(message.eventId);
          versions.set(resource, message.version);
          receivedEvents++;
          if (seen.size > 1000) seen.delete(seen.values().next().value!);
          const keys =
            message.type === "nft.updated"
              ? ["catalog", "nft", "cart"]
              : ["order", "cart", "catalog", "nft"];
          for (const key of keys)
            void queryClient.invalidateQueries({ queryKey: [key] });
          if (message.type === "nft.updated")
            notices.forEach((fn) =>
              fn(
                "Preço ou disponibilidade atualizado. Revise os valores antes de comprar.",
              ),
            );
        };
        socket.on("nft.updated", receive);
        socket.on("order.updated", receive);
        socket.connect();
      })
      .catch(() => {
        if (!disposed) update("disconnected");
      });
    return stop;
  },
};
