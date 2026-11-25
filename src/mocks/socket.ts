import { ws } from "msw";
import { toSocketIo } from "@mswjs/socket.io-binding";
import { digest } from "./fixtures";
import { now, onDemoReset, onDomainEvent, snapshot } from "./store";

const events = ws.link("wss://events.kurio.test");

export const socketHandler = events.addEventListener(
  "connection",
  (connection) => {
    const socket = toSocketIo(connection);
    let tokenHash = "";
    let closed = false;
    socket.client.on(
      "subscribe",
      (_message, subscription: { token?: string }) => {
        void digest(subscription?.token ?? "").then((hash) => {
          if (!closed) tokenHash = hash;
        });
      },
    );
    void snapshot().then((state) => {
      if (!state.config.socketConnected)
        connection.client.close(1012, "Interrupção simulada");
    });

    // O binding publicado faz o handshake, mas o heartbeat fica a cargo do mock.
    const heartbeat = window.setInterval(
      () => connection.client.send("2"),
      20_000,
    );
    const unsubscribe = onDomainEvent(async (message) => {
      if (message.resourceId === "__disconnect") {
        connection.client.close(1012, "Interrupção simulada");
        return;
      }
      if (message.type === "nft.updated")
        socket.client.emit(message.type, message);
      else {
        const state = await snapshot();
        const session = state.sessions.find(
          (value) =>
            value.tokenHash === tokenHash && value.expiresAt > now(state),
        );
        if (!closed && session && session.userId === message.userId)
          socket.client.emit(message.type, message);
      }
    });
    const unsubscribeReset = onDemoReset(() =>
      connection.client.close(1012, "Cenário reiniciado"),
    );
    connection.client.addEventListener("close", () => {
      closed = true;
      window.clearInterval(heartbeat);
      unsubscribe();
      unsubscribeReset();
    });
  },
);
