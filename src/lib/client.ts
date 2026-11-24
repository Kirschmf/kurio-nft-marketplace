import axios from "axios";
import { QueryClient } from "@tanstack/react-query";
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
let guest =
  localStorage.getItem("kurio-guest") ?? `guest-${crypto.randomUUID()}`;
localStorage.setItem("kurio-guest", guest);
let generation = 0;
let current: Omit<AuthResult, "token"> | null = null;
const listeners = new Set<() => void>();
let bootstrapPromise: Promise<void> | undefined;
export const http = axios.create({ baseURL: "/api", timeout: 5000 });
http.interceptors.request.use((config) => {
  const token = sessionStorage.getItem("kurio-session");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-Demo-Guest-Id"] = guest;
  return config;
});
http.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      axios.isAxiosError<ApiErrorBody>(error) &&
      error.response?.status === 401 &&
      error.response.data.error.code === "SESSION_EXPIRED" &&
      current
    )
      auth.clear();
    return Promise.reject(error);
  },
);

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
  const response = await http.request<{ data: T }>({
    method,
    url: path,
    data: body,
    signal: options?.signal,
    params: options?.params,
    paramsSerializer: { indexes: null },
    headers: options?.key ? { "Idempotency-Key": options.key } : undefined,
  });
  if (started !== generation && !path.startsWith("/auth/"))
    throw new axios.CanceledError("A sessão mudou.");
  return response.data.data;
}
const notify = () => listeners.forEach((fn) => fn());
export const auth = {
  get: () => current,
  generation: () => generation,
  token: () => sessionStorage.getItem("kurio-session") ?? "",
  subscribe: (fn: () => void) => {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  async bootstrap() {
    bootstrapPromise ??= (async () => {
      if (!auth.token()) return;
      try {
        current = await request<Omit<AuthResult, "token">>(
          "GET",
          "/auth/session",
        );
        notify();
      } catch (error) {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          sessionStorage.removeItem("kurio-session");
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
    sessionStorage.setItem("kurio-session", result.token);
    current = {
      user: result.user,
      sessionId: result.sessionId,
      expiresAt: result.expiresAt,
    };
    bootstrapPromise = Promise.resolve();
    notify();
    const merge = await api.mergeCart(guest, guest);
    queryClient.setQueryData(["cart", result.user.id, generation], merge);
    guest = `guest-${crypto.randomUUID()}`;
    localStorage.setItem("kurio-guest", guest);
    return merge.adjustments;
  },
  clear() {
    generation++;
    void queryClient.cancelQueries();
    queryClient.clear();
    sessionStorage.removeItem("kurio-session");
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
    try {
      await request("POST", "/auth/logout");
    } finally {
      auth.clear();
    }
  },
};
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
  register: (body: unknown) =>
    request<AuthResult>("POST", "/auth/register", body),
  login: (body: unknown) => request<AuthResult>("POST", "/auth/login", body),
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
  saveProfile: (body: unknown) => request<Profile>("PATCH", "/profile", body),
  avatar: (file?: File) => {
    const form = new FormData();
    if (file) form.append("file", file);
    return request<Profile>(
      file ? "PUT" : "DELETE",
      "/profile/avatar",
      file ? form : undefined,
    );
  },
  changePassword: (body: unknown) =>
    request<null>("POST", "/profile/password", body),
  wallets: (signal?: AbortSignal) =>
    request<Wallet[]>("GET", "/wallets", undefined, { signal }),
  saveWallet: (body: unknown, id?: string) =>
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
