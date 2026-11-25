import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
import { waitForNetwork } from "./network-ready";
import type {
  ApiErrorBody,
  AuthResult,
  CartView,
  CatalogParams,
  CatalogResult,
  Collector,
  Nft,
  Order,
  Profile,
  Quote,
  Wallet,
  LoginInput,
  RegisterInput,
  ProfileInput,
  PasswordInput,
  WalletInput,
} from "./types";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 300_000,
      retry: (count, error) =>
        count < 2 &&
        (!axios.isAxiosError(error) ||
          !error.response ||
          error.response.status >= 500),
      retryDelay: (attempt) => Math.min(250 * 2 ** attempt, 2000),
    },
    mutations: { retry: false },
  },
});
const local = typeof window === "undefined" ? undefined : window.localStorage;
const session =
  typeof window === "undefined" ? undefined : window.sessionStorage;
let guest =
  local?.getItem("kurio-guest") ??
  (typeof window === "undefined"
    ? "guest-prerender"
    : `guest-${crypto.randomUUID()}`);
local?.setItem("kurio-guest", guest);
let generation = 0;
let authenticationAttempt = 0;
let current: Omit<AuthResult, "token"> | null = null;
const listeners = new Set<() => void>();
let bootstrapPromise: Promise<void> | undefined;
export const http = axios.create({ baseURL: "/api", timeout: 5000 });

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options?: {
    signal?: AbortSignal;
    key?: string;
    params?: Record<string, unknown>;
  },
) {
  const started = generation;
  const token = session?.getItem("kurio-session") ?? null;
  const stillCurrent = () =>
    started === generation &&
    token === (session?.getItem("kurio-session") ?? null);
  let response;
  try {
    await waitForNetwork();
    if (!stillCurrent()) throw new axios.CanceledError("A sessão mudou.");
    response = await http.request<{ data: T }>({
      method,
      url: path,
      data: body,
      signal: options?.signal,
      params: options?.params,
      paramsSerializer: { indexes: null },
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        "X-Demo-Guest-Id": guest,
        ...(options?.key ? { "Idempotency-Key": options.key } : {}),
      },
    });
  } catch (error) {
    // Even rejected requests belong to the session that sent them.
    if (!stillCurrent()) throw new axios.CanceledError("A sessão mudou.");
    if (
      axios.isAxiosError<ApiErrorBody>(error) &&
      error.response?.status === 401 &&
      error.response.data.error?.code === "SESSION_EXPIRED" &&
      current
    )
      auth.clear();
    throw error;
  }
  if (!stillCurrent()) throw new axios.CanceledError("A sessão mudou.");
  return response.data.data;
}
const notify = () => listeners.forEach((fn) => fn());
export const auth = {
  get: () => current,
  generation: () => generation,
  assertGeneration(expected: number) {
    if (expected !== generation)
      throw new axios.CanceledError("A sessão mudou.");
  },
  token: () => session?.getItem("kurio-session") ?? "",
  cancelAuthentication: () => {
    authenticationAttempt++;
  },
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  async bootstrap() {
    bootstrapPromise ??= (async () => {
      if (!auth.token()) return;
      const started = generation;
      try {
        current = await request<Omit<AuthResult, "token">>(
          "GET",
          "/auth/session",
        );
        notify();
      } catch (error) {
        if (started !== generation || axios.isCancel(error)) return;
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          session?.removeItem("kurio-session");
          current = null;
          notify();
        } else {
          bootstrapPromise = undefined;
          throw error;
        }
      }
    })();
    return bootstrapPromise;
  },
  async accept(result: AuthResult) {
    auth.clear();
    session?.setItem("kurio-session", result.token);
    current = {
      user: result.user,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
    };
    bootstrapPromise = Promise.resolve();
    notify();
    const started = generation;
    const visitor = guest;
    let merge: CartView;
    try {
      merge = await api.mergeCart(visitor, visitor);
    } catch (error) {
      if (started !== generation || axios.isCancel(error)) throw error;
      // Keep the visitor identity so the same merge can be retried after login.
      auth.clear();
      throw error;
    }
    if (started !== generation)
      throw new axios.CanceledError("A sessão mudou.");
    queryClient.setQueryData(["cart", result.user.id, started], merge);
    guest = `guest-${crypto.randomUUID()}`;
    local?.setItem("kurio-guest", guest);
    return { adjustments: merge.adjustments, generation: started };
  },
  clear() {
    generation++;
    authenticationAttempt++;
    void queryClient.cancelQueries();
    queryClient.clear();
    session?.removeItem("kurio-session");
    current = null;
    bootstrapPromise = Promise.resolve();
    notify();
  },
  updateProfile(profile: Profile) {
    if (current) {
      current = { ...current, user: { ...current.user, profile } };
      notify();
    }
  },
  async logout() {
    const started = generation;
    try {
      await request("POST", "/auth/logout");
    } finally {
      if (started === generation) auth.clear();
    }
  },
};
async function authenticate(path: string, body: unknown) {
  const attempt = ++authenticationAttempt;
  const result = await request<AuthResult>("POST", path, body);
  if (attempt !== authenticationAttempt)
    throw new axios.CanceledError("Outra autenticação foi iniciada.");
  return result;
}
export const isCanceled = axios.isCancel;
export const sessionKey = () =>
  [current?.user.id ?? guest, generation] as const;

export const api = {
  catalog: (params: CatalogParams, signal?: AbortSignal) =>
    request<CatalogResult>("GET", "/nfts", undefined, {
      params: params as Record<string, unknown>,
      signal,
    }),
  nft: (id: string, signal?: AbortSignal) =>
    request<Nft>("GET", `/nfts/${id}`, undefined, { signal }),
  register: (body: RegisterInput) => authenticate("/auth/register", body),
  login: (body: LoginInput) => authenticate("/auth/login", body),
  cart: (signal?: AbortSignal) =>
    request<CartView>("GET", "/cart", undefined, { signal }),
  addItem: (
    nftId: string,
    editionId: string,
    quantity: number,
    expectedCartVersion?: number,
  ) =>
    request<CartView>("POST", "/cart/items", {
      nftId,
      editionId,
      quantity,
      expectedCartVersion,
    }),
  updateItem: (lineId: string, quantity: number, expectedCartVersion: number) =>
    request<CartView>("PATCH", `/cart/items/${lineId}`, {
      quantity,
      expectedCartVersion,
    }),
  removeItem: (lineId: string, expectedCartVersion: number) =>
    request<CartView>("DELETE", `/cart/items/${lineId}`, {
      expectedCartVersion,
    }),
  coupon: (code: string, expectedCartVersion: number) =>
    request<CartView>("PUT", "/cart/coupon", { code, expectedCartVersion }),
  removeCoupon: (expectedCartVersion: number) =>
    request<CartView>("DELETE", "/cart/coupon", { expectedCartVersion }),
  mergeCart: (guestCartId: string, mergeId: string) =>
    request<CartView>("POST", "/cart/merge", { guestCartId, mergeId }),
  favorites: (signal?: AbortSignal) =>
    request<string[]>("GET", "/favorites", undefined, { signal }),
  favorite: (id: string, add: boolean) =>
    request<string[]>(add ? "PUT" : "DELETE", `/favorites/${id}`),
  profile: () => request<Profile>("GET", "/profile"),
  saveProfile: (body: ProfileInput) =>
    request<Profile>("PATCH", "/profile", body),
  avatar: (file?: File) => {
    const form = new FormData();
    if (file) form.append("file", file);
    return request<Profile>(
      file ? "PUT" : "DELETE",
      "/profile/avatar",
      file ? form : undefined,
    );
  },
  changePassword: (body: PasswordInput) =>
    request<null>("POST", "/profile/password", body),
  wallets: (signal?: AbortSignal) =>
    request<Wallet[]>("GET", "/wallets", undefined, { signal }),
  saveWallet: (body: WalletInput, id?: string) =>
    request<Wallet>(
      id ? "PATCH" : "POST",
      id ? `/wallets/${id}` : "/wallets",
      body,
    ),
  connectWallet: (walletId: string, provider: string) =>
    request<{ connected: boolean }>("POST", "/wallet-connections", {
      walletId,
      provider,
    }),
  disconnectWallet: () => request("DELETE", "/wallet-connections/current"),
  quote: (cartVersion: number, walletId: string, collectorData: Collector) =>
    request<Quote>("POST", "/quotes", { cartVersion, walletId, collectorData }),
  order: (
    quoteId: string,
    walletId: string,
    collectorData: Collector,
    key: string,
  ) =>
    request<Order>(
      "POST",
      "/orders",
      { quoteId, walletId, collectorData },
      { key },
    ),
  getOrder: (id: string, signal?: AbortSignal) =>
    request<Order>("GET", `/orders/${id}`, undefined, { signal }),
  receipt: (id: string) => request<Order>("GET", `/orders/${id}/receipt`),
  demo: () =>
    request<{ scenarios: string[]; config: { scenario: string } }>(
      "GET",
      "/demo/scenarios",
    ),
  reset: (scenario: string) => request("POST", "/demo/reset", { scenario }),
  action: (type: string, payload: Record<string, unknown> = {}) =>
    request("POST", "/demo/actions", { type, payload }),
};

export function errorMessage(error: unknown) {
  if (axios.isAxiosError<ApiErrorBody>(error))
    return (
      error.response?.data.error?.message ??
      (error.code === "ECONNABORTED"
        ? "A resposta demorou mais que o esperado. Você pode tentar novamente."
        : "A conexão foi interrompida. Confira sua conexão e tente novamente.")
    );
  return error instanceof Error
    ? error.message
    : "Não foi possível concluir esta ação.";
}
export function errorsFrom(error: unknown): Record<string, string[]> {
  return axios.isAxiosError<ApiErrorBody>(error)
    ? (error.response?.data.error?.fieldErrors ?? {})
    : {};
}
