export type Network = "ethereum" | "polygon" | "solana";
export type Provider = "walletconnect" | "metamask" | "coinbase";
export type OrderStatus = "pending" | "confirmed" | "declined";
export interface Edition {
  id: string;
  label: string;
  priceEth: string;
  stock: number;
  reserved: number;
  version: number;
}
export interface Nft {
  id: string;
  tokenId: string;
  name: string;
  collection: string;
  category: string;
  network: Network;
  image: string;
  description: string;
  attributes: string[];
  editions: Edition[];
  version: number;
  createdAt: string;
  popularity: number;
  rare: boolean;
}
export interface Profile {
  displayName: string;
  username: string;
  email: string;
  ensName: string;
  walletNickname: string;
  avatar: string | null;
  version: number;
}
export interface User {
  id: string;
  profile: Profile;
  credential: { salt: string; hash: string };
}
export interface Session {
  id: string;
  userId: string;
  tokenHash: string;
  expiresAt: number;
}
export interface Wallet {
  id: string;
  userId: string;
  role: "primary" | "secondary";
  displayName: string;
  nickname: string;
  network: Network;
  address: string;
  provider: Provider;
  profileName: string;
  secondaryIdentifier: string;
  referralCode: string;
  email: string;
  ensName: string;
  version: number;
  sameAsPrimary?: boolean;
}
export interface CartLine {
  id: string;
  nftId: string;
  editionId: string;
  quantity: number;
}
export interface Cart {
  id: string;
  ownerId: string;
  items: CartLine[];
  couponCode: string | null;
  version: number;
  mergeIds: string[];
}
export interface Totals {
  subtotalEth: string;
  discountEth: string;
  networkFeeEth: string;
  totalEth: string;
}
export interface LineSnapshot {
  lineId: string;
  nftId: string;
  tokenId: string;
  name: string;
  image: string;
  editionId: string;
  editionLabel: string;
  quantity: number;
  available: number;
  unitPriceEth: string;
  lineTotalEth: string;
  resourceVersion: number;
}
export interface CartView {
  cart: Cart;
  lines: LineSnapshot[];
  summary: Totals;
  adjustments: string[];
}
export interface Collector {
  displayName: string;
  username: string;
  email: string;
  profileName: string;
  ensName: string;
  referralCode: string;
  secondaryIdentifier: string;
  collectorNote: string;
}
export interface Quote extends Totals {
  id: string;
  userId: string;
  cartId: string;
  cartVersion: number;
  lines: LineSnapshot[];
  wallet: Wallet;
  collector: Collector;
  couponCode: string | null;
  expiresAt: number;
  fingerprint: string;
}
export interface Order {
  id: string;
  userId: string;
  status: OrderStatus;
  quote: Quote;
  createdAt: number;
  resolvedAt: number | null;
  resolveAt: number;
  transactionRef: string | null;
  version: number;
  cartRemovalApplied: boolean;
}
export interface PurchaseAttempt {
  key: string;
  quoteId: string;
  walletId: string;
  collector: Collector;
  userId: string;
  orderId?: string;
}
export interface DomainEvent {
  eventId: string;
  type: "nft.updated" | "order.updated";
  resourceId: string;
  version: number;
  occurredAt: number;
  userId?: string;
  data: Record<string, unknown>;
}
export type ScenarioId = (typeof scenarioIds)[number];
export const scenarioIds = [
  "default",
  "empty",
  "slow",
  "out-of-order",
  "offline",
  "server-error",
  "forbidden",
  "session-expired",
  "checkout-expired",
  "duplicate-account",
  "validation",
  "invalid-coupon",
  "expired-coupon",
  "price-change",
  "sold-out",
  "order-timeout",
  "payment-declined",
  "pending-disconnect",
  "duplicate-event",
  "old-event",
  "user-switch",
  "concurrent-order",
  "idempotency-conflict",
  "last-unit",
  "wallet-refused",
  "wallet-disconnected",
  "quote-expired",
  "favorite-error",
  "partial-cart",
  "immutable-receipt",
  "not-found",
  "network-conflict",
  "repeat-merge",
  "terminal-order",
] as const;
export interface DemoConfig {
  networkFeeEth: string;
  scenario: ScenarioId;
  seed: number;
  clockStart: number;
  wallStart: number;
  offset: number;
  calls: Record<string, number>;
  socketConnected: boolean;
  eventSequence: number;
}
export interface Database {
  schema: number;
  users: User[];
  sessions: Session[];
  nfts: Nft[];
  wallets: Wallet[];
  carts: Cart[];
  quotes: Quote[];
  orders: Order[];
  favorites: Record<string, string[]>;
  idempotency: {
    userId: string;
    key: string;
    fingerprint: string;
    orderId: string;
  }[];
  connections: { userId: string; walletId: string; provider: Provider }[];
  config: DemoConfig;
}
export interface CatalogParams {
  q?: string;
  categories?: string[];
  networks?: string[];
  minEth?: string;
  maxEth?: string;
  sort?: string;
  page?: number;
  tab?: string;
}
export interface CatalogResult {
  items: Nft[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  facets: {
    categories: Record<string, number>;
    networks: Record<string, number>;
  };
}
export interface AuthResult {
  token: string;
  user: { id: string; profile: Profile };
  sessionId: string;
  expiresAt: number;
}
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fieldErrors?: Record<string, string[]>;
    retryable: boolean;
    requestId: string;
    details?: unknown;
  };
}
