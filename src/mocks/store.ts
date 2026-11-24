import { openDB } from "idb";
import { calculateTotals, fromWei, toWei } from "../lib/money";
import { scenarioIds } from "../lib/types";
import type {
  Cart,
  CartView,
  Database,
  DomainEvent,
  LineSnapshot,
  Order,
  ScenarioId,
} from "../lib/types";
import { seed } from "./fixtures";

const database = openDB("kurio-demo", 1, {
  upgrade(db) {
    db.createObjectStore("state");
  },
});
const subscribers = new Set<(event: DomainEvent) => void>();
const resetSubscribers = new Set<() => void>();
const channel = new BroadcastChannel("kurio-domain");
channel.addEventListener(
  "message",
  ({ data }: MessageEvent<{ event?: DomainEvent; reset?: boolean }>) => {
    if (data.event) for (const listener of subscribers) listener(data.event);
    if (data.reset) for (const listener of resetSubscribers) listener();
  },
);
export const onDomainEvent = (fn: (event: DomainEvent) => void) => {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
};
export const onDemoReset = (fn: () => void) => {
  resetSubscribers.add(fn);
  return () => {
    resetSubscribers.delete(fn);
  };
};
export const now = (state: Database) =>
  state.config.clockStart +
  Date.now() -
  state.config.wallStart +
  state.config.offset;

let ready: Promise<void> | undefined;
export function initialize() {
  ready ??= (async () => {
    const db = await database;
    const existing = (await db.get("state", "current")) as Database | undefined;
    if (existing && !existing.config.networkFeeEth) {
      const migration = db.transaction("state", "readwrite");
      const current = (await migration.store.get("current")) as Database;
      current.config.networkFeeEth ??= "0.016";
      await migration.store.put(current, "current");
      await migration.done;
    }
    if (!(await db.get("state", "current"))) {
      const configured = import.meta.env.VITE_SCENARIO;
      const initial = await seed(
        scenarioIds.includes(configured) ? configured : "default",
      );
      const tx = db.transaction("state", "readwrite");
      if (!(await tx.store.get("current")))
        await tx.store.put(initial, "current");
      await tx.done;
    }
  })();
  return ready;
}

export function event(
  state: Database,
  type: DomainEvent["type"],
  resourceId: string,
  version: number,
  data: Record<string, unknown>,
  userId?: string,
): DomainEvent {
  return {
    eventId: `event-${state.config.seed}-${++state.config.eventSequence}`,
    type,
    resourceId,
    version,
    occurredAt: now(state),
    data,
    ...(userId ? { userId } : {}),
  };
}

export function getCart(state: Database, ownerId: string): Cart {
  let cart = state.carts.find((value) => value.ownerId === ownerId);
  if (!cart) {
    cart = {
      id: `cart-${ownerId}`,
      ownerId,
      items: [],
      couponCode: null,
      version: 1,
      mergeIds: [],
    };
    state.carts.push(cart);
  }
  return cart;
}

export function cartView(state: Database, cart: Cart): CartView {
  const lines: LineSnapshot[] = cart.items.map((line) => {
    const nft = state.nfts.find((value) => value.id === line.nftId)!;
    const edition = nft.editions.find((value) => value.id === line.editionId)!;
    return {
      lineId: line.id,
      nftId: nft.id,
      tokenId: nft.tokenId,
      name: nft.name,
      image: nft.image,
      editionId: edition.id,
      editionLabel: edition.label,
      quantity: line.quantity,
      available: Math.max(0, edition.stock - edition.reserved),
      unitPriceEth: edition.priceEth,
      lineTotalEth: fromWei(toWei(edition.priceEth) * BigInt(line.quantity)),
      resourceVersion: edition.version,
    };
  });
  const discount = cart.couponCode === "WELCOME10" ? 1000 : 0;
  return {
    cart,
    lines,
    summary: calculateTotals(lines, discount, state.config.networkFeeEth),
    adjustments: [],
  };
}

export function resolveOrder(
  state: Database,
  order: Order,
  status: "confirmed" | "declined",
  events: DomainEvent[],
) {
  if (order.status !== "pending") return;
  order.status = status;
  order.version++;
  order.resolvedAt = now(state);
  order.transactionRef =
    status === "confirmed" ? `DEMO-${order.id.slice(-8).toUpperCase()}` : null;
  for (const line of order.quote.lines) {
    const nft = state.nfts.find((value) => value.id === line.nftId)!;
    const edition = nft.editions.find((value) => value.id === line.editionId)!;
    edition.reserved -= line.quantity;
    if (status === "confirmed") edition.stock -= line.quantity;
    edition.version++;
    nft.version++;
    events.push(
      event(state, "nft.updated", nft.id, nft.version, {
        editionId: edition.id,
        priceEth: edition.priceEth,
        available: Math.max(0, edition.stock - edition.reserved),
      }),
    );
  }
  if (status === "confirmed" && !order.cartRemovalApplied) {
    const cart = getCart(state, order.userId);
    for (const bought of order.quote.lines) {
      const current = cart.items.find(
        (line) =>
          line.nftId === bought.nftId && line.editionId === bought.editionId,
      );
      if (current)
        current.quantity = Math.max(0, current.quantity - bought.quantity);
    }
    cart.items = cart.items.filter((line) => line.quantity > 0);
    cart.version++;
    order.cartRemovalApplied = true;
  }
  events.push(
    event(
      state,
      "order.updated",
      order.id,
      order.version,
      { status },
      order.userId,
    ),
  );
}

function settle(state: Database, events: DomainEvent[]) {
  for (const order of state.orders)
    if (order.status === "pending" && order.resolveAt <= now(state))
      resolveOrder(
        state,
        order,
        state.config.scenario === "payment-declined" ? "declined" : "confirmed",
        events,
      );
}

export async function transact<T>(
  change: (state: Database, events: DomainEvent[]) => T,
): Promise<T> {
  await initialize();
  const db = await database;
  const tx = db.transaction("state", "readwrite");
  const events: DomainEvent[] = [];
  try {
    const state = (await tx.store.get("current")) as Database;
    settle(state, events);
    const result = change(state, events);
    await tx.store.put(state, "current");
    await tx.done;
    for (const message of events) {
      for (const listener of subscribers) listener(message);
      channel.postMessage({ event: message });
    }
    return structuredClone(result);
  } catch (error) {
    try {
      tx.abort();
    } catch {
      /* A committed transaction cannot be aborted. */
    }
    await tx.done.catch(() => undefined);
    throw error;
  }
}

export async function snapshot() {
  await initialize();
  return (await (await database).get("state", "current")) as Database;
}
export async function reset(scenario: ScenarioId = "default", seedNumber = 7) {
  const initial = await seed(scenario, seedNumber);
  if (scenario === "last-unit")
    initial.nfts[0].editions.forEach((edition) => {
      edition.stock = 1;
    });
  await (await database).put("state", initial, "current");
  for (const fn of resetSubscribers) fn();
  channel.postMessage({ reset: true });
  return { scenario, seed: seedNumber };
}

export function startOrderClock() {
  const timer = window.setInterval(() => {
    void transact(() => null).catch(() => undefined);
  }, 300);
  return () => window.clearInterval(timer);
}
