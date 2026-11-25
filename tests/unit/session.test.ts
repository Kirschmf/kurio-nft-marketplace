import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  AxiosError,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from "axios";
import type { AuthResult, Profile } from "../../src/lib/types";

let client: typeof import("../../src/lib/client");
let storage: Storage;
const profile: Profile = {
  displayName: "Conta de teste",
  username: "test",
  email: "test@example.test",
  ensName: "test.eth",
  walletNickname: "Principal",
  avatar: null,
  version: 1,
};
const account = (id: string): AuthResult => ({
  token: id,
  sessionId: id,
  expiresAt: 100000,
  user: { id, profile: { ...profile, email: `${id}@example.test` } },
});
const cart = {
  cart: {
    id: "cart",
    ownerId: "test",
    items: [],
    couponCode: null,
    version: 1,
    mergeIds: [],
  },
  lines: [],
  summary: {
    subtotalEth: "0",
    discountEth: "0",
    networkFeeEth: "0",
    totalEth: "0",
  },
  adjustments: [],
};
const response = (
  config: InternalAxiosRequestConfig,
  data: unknown,
): AxiosResponse => ({
  config,
  data: { data },
  status: 200,
  statusText: "OK",
  headers: {},
});

beforeEach(async () => {
  vi.resetModules();
  const values = new Map<string, string>();
  storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
    removeItem: (key) => {
      values.delete(key);
    },
    clear: () => values.clear(),
    key: (index) => [...values.keys()][index] ?? null,
    get length() {
      return values.size;
    },
  };
  vi.stubGlobal("window", { localStorage: storage, sessionStorage: storage });
  client = await import("../../src/lib/client");
  client.http.defaults.adapter = async (config) => response(config, cart);
});
afterEach(() => {
  client.queryClient.clear();
  vi.unstubAllGlobals();
});

it("an old logout response cannot clear a new account", async () => {
  await client.auth.accept(account("a"));
  let release!: () => void;
  let sent = false;
  client.http.defaults.adapter = (config) =>
    config.url === "/auth/logout"
      ? new Promise((resolve) => {
          sent = true;
          release = () => resolve(response(config, null));
        })
      : Promise.resolve(response(config, cart));
  const logout = client.auth.logout().catch((error) => error);
  await vi.waitFor(() => expect(sent).toBe(true));
  await client.auth.accept(account("b"));
  release();
  await logout;
  expect(client.auth.get()?.user.id).toBe("b");
  expect(client.auth.token()).toBe("b");
});

it("a delayed session bootstrap cannot replace a newer account", async () => {
  storage.setItem("kurio-session", "a");
  let release!: () => void;
  let sent = false;
  client.http.defaults.adapter = (config) =>
    config.url === "/auth/session"
      ? new Promise((resolve) => {
          sent = true;
          release = () =>
            resolve(
              response(config, {
                user: account("a").user,
                sessionId: "a",
                expiresAt: 100000,
              }),
            );
        })
      : Promise.resolve(response(config, cart));
  const boot = client.auth.bootstrap();
  await vi.waitFor(() => expect(sent).toBe(true));
  await client.auth.accept(account("b"));
  release();
  await boot;
  expect(client.auth.get()?.user.id).toBe("b");
});

it("an old rejected mutation cannot expire the current account", async () => {
  await client.auth.accept(account("a"));
  let reject!: () => void;
  let sent = false;
  client.http.defaults.adapter = (config) =>
    config.url === "/profile"
      ? new Promise((_resolve, fail) => {
          sent = true;
          reject = () =>
            fail(
              new AxiosError("Expired", "ERR_BAD_REQUEST", config, undefined, {
                ...response(config, null),
                status: 401,
                data: { error: { code: "SESSION_EXPIRED" } },
              }),
            );
        })
      : Promise.resolve(response(config, cart));
  const save = client.api
    .saveProfile({ ...profile, expectedVersion: profile.version })
    .catch((error) => error);
  await vi.waitFor(() => expect(sent).toBe(true));
  await client.auth.accept(account("b"));
  reject();
  expect(client.isCanceled(await save)).toBe(true);
  expect(client.auth.get()?.user.id).toBe("b");
});

it("a failed merge preserves the visitor identity and can be retried", async () => {
  const visitor = storage.getItem("kurio-guest");
  client.http.defaults.adapter = async (config) => {
    throw new AxiosError("Unavailable", "ERR_NETWORK", config);
  };
  await expect(client.auth.accept(account("a"))).rejects.toThrow("Unavailable");
  expect(client.auth.get()).toBeNull();
  expect(storage.getItem("kurio-guest")).toBe(visitor);
  client.http.defaults.adapter = async (config) => response(config, cart);
  await client.auth.accept(account("a"));
  expect(client.auth.get()?.user.id).toBe("a");
  expect(storage.getItem("kurio-guest")).not.toBe(visitor);
});

it("canceling an unfinished login discards its eventual response", async () => {
  let release!: () => void;
  let sent = false;
  client.http.defaults.adapter = (config) =>
    new Promise((resolve) => {
      sent = true;
      release = () => resolve(response(config, account("a")));
    });
  const login = client.api
    .login({ email: profile.email, password: "dummy" })
    .catch((error) => error);
  await vi.waitFor(() => expect(sent).toBe(true));
  client.auth.cancelAuthentication();
  release();
  expect(client.isCanceled(await login)).toBe(true);
  expect(client.auth.get()).toBeNull();
});
