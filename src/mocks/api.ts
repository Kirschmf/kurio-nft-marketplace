import { DomainError, fail } from "./domain-error";
import { listCatalog } from "./catalog";
import { HttpResponse, delay, http } from "msw";
import type { ZodType } from "zod";
import { fieldErrors } from "../lib/field-errors";
import { toWei } from "../lib/money";
import type { Database, DomainEvent, Nft, Quote } from "../lib/types";
import { scenarioIds } from "../lib/types";

import { credential, digest, networks } from "./fixtures";
import {
  cartView,
  event,
  getCart,
  now,
  reset,
  resolveOrder,
  snapshot,
  transact,
  holdOrderEvents,
  releaseOrderEvents,
} from "./store";

const heldRequests = new Map<
  string,
  { promise: Promise<void>; release: () => void }
>();
function releaseRequests() {
  for (const hold of heldRequests.values()) hold.release();
  heldRequests.clear();
}

const parse = <T>(schema: ZodType<T> | undefined, value: unknown): T => {
  if (!schema)
    throw new Error("Validation module unavailable for this resource");
  const result = schema.safeParse(value);
  return result.success
    ? result.data
    : fail(
        422,
        "VALIDATION_ERROR",
        "Revise os campos indicados.",
        fieldErrors(result.error),
      );
};
const text = (body: Record<string, unknown>, key: string) =>
  typeof body[key] === "string" ? (body[key] as string) : "";
const stable = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stable((value as Record<string, unknown>)[key])}`,
      )
      .join(",")}}`;
  return JSON.stringify(value);
};
function member(state: Database, tokenHash: string) {
  const session = state.sessions.find((value) => value.tokenHash === tokenHash);
  if (!session || session.expiresAt <= now(state))
    return fail(
      401,
      "SESSION_EXPIRED",
      "Sua sessão terminou. Entre novamente para continuar.",
    );
  const user = state.users.find((value) => value.id === session.userId)!;
  return { user, session };
}
function owner(state: Database, tokenHash: string, guest: string) {
  return tokenHash
    ? member(state, tokenHash).user.id
    : guest ||
        fail(401, "GUEST_REQUIRED", "Recarregue a página para continuar.");
}
function nftById(state: Database, id: string): Nft {
  return (
    state.nfts.find((value) => value.id === id) ??
    fail(404, "NFT_NOT_FOUND", "Este NFT não está disponível.")
  );
}
function validateQuantity(quantity: unknown, available: number) {
  if (!Number.isInteger(quantity) || (quantity as number) < 1)
    fail(
      422,
      "VALIDATION_ERROR",
      "Use uma quantidade inteira maior que zero.",
      { quantity: ["Use uma quantidade inteira maior que zero."] },
    );
  if ((quantity as number) > available)
    fail(
      409,
      "OUT_OF_STOCK",
      `Há ${available} edição${available === 1 ? "" : "ões"} disponível${available === 1 ? "" : "s"}.`,
    );
  return quantity as number;
}
function version(expected: unknown, actual: number) {
  if (expected !== undefined && expected !== actual)
    fail(
      409,
      "VERSION_CONFLICT",
      "Os dados mudaram. Atualize e tente novamente.",
    );
}

async function simulate(path: string, method: string, url: URL) {
  const status = await transact((state) => {
    const key = `${method}:${path}`;
    const count = (state.config.calls[key] ?? 0) + 1;
    state.config.calls[key] = count;
    return { scenario: state.config.scenario, count };
  });
  if (path.startsWith("/demo/")) return;
  await heldRequests.get(`request:${method}:${path}`)?.promise;
  if (status.scenario === "slow") await delay(1500);
  if (
    status.scenario === "out-of-order" &&
    path === "/profile" &&
    method === "GET"
  )
    await delay(3000);
  if (status.scenario === "out-of-order" && path === "/nfts")
    await delay((url.searchParams.get("q") ?? "").length < 3 ? 1200 : 100);
  if (status.scenario === "offline" && status.count === 1)
    return "network-error";
  if (
    status.scenario === "server-error" &&
    status.count <= 3 &&
    method === "GET"
  )
    fail(
      503,
      "SERVICE_UNAVAILABLE",
      "O catálogo está temporariamente indisponível. Tente novamente.",
    );
  if (
    status.scenario === "forbidden" &&
    ["/profile", "/wallets"].includes(path)
  )
    fail(
      403,
      "FORBIDDEN",
      "Esta conta não tem permissão para acessar estes dados.",
    );
  if (
    status.scenario === "favorite-error" &&
    path.startsWith("/favorites/") &&
    method !== "GET"
  )
    fail(
      503,
      "FAVORITE_FAILED",
      "Não foi possível atualizar seus favoritos. O estado anterior foi mantido.",
    );
}

async function dispatch(
  path: string,
  method: string,
  body: Record<string, unknown>,
  tokenHash: string,
  guest: string,
  url: URL,
  key: string,
  upload?: File,
) {
  if (path === "/demo/actions" && body.type === "events.release")
    return releaseOrderEvents();
  const validates =
    [
      "/auth/register",
      "/auth/login",
      "/profile/password",
      "/quotes",
      "/wallet-connections",
    ].includes(path) ||
    (path === "/profile" && method === "PATCH") ||
    (path.startsWith("/wallets") && ["POST", "PATCH"].includes(method));
  const {
    collectorSchema,
    loginSchema,
    passwordSchema,
    profileSchema,
    registerSchema,
    walletSchema,
    providerSchema,
  } = validates ? await import("../lib/validation") : {};
  if (path === "/demo/reset" && method === "POST") {
    releaseRequests();
    return reset(
      readScenario(body.scenario ?? "default"),
      typeof body.seed === "number" ? body.seed : 7,
    );
  }
  if (path === "/demo/scenarios")
    return { scenarios: scenarioIds, config: (await snapshot()).config };
  if (path === "/auth/register" && method === "POST") {
    const input = parse(registerSchema, body);
    const derived = await credential(input.password);
    const token = crypto.randomUUID();
    const tokenHashNew = await digest(token);
    return transact((state) => {
      if (
        state.users.some(
          (user) =>
            user.profile.email === input.email ||
            user.profile.username.toLowerCase() ===
              input.username.toLowerCase(),
        )
      )
        fail(
          409,
          "ACCOUNT_EXISTS",
          "Este e-mail ou nome de usuário já está em uso.",
          {
            email: ["Confira seu e-mail ou entre na sua conta."],
            username: ["Escolha outro nome de usuário."],
          },
        );
      const user = {
        id: crypto.randomUUID(),
        profile: {
          displayName: input.username,
          username: input.username,
          email: input.email,
          ensName: `${input.username.replaceAll("_", "-")}.eth`,
          walletNickname: "Principal",
          avatar: null,
          version: 1,
        },
        credential: derived,
      };
      state.users.push(user);
      state.favorites[user.id] = [];
      const session = {
        id: crypto.randomUUID(),
        userId: user.id,
        tokenHash: tokenHashNew,
        expiresAt: now(state) + 30 * 60_000,
      };
      state.sessions.push(session);
      return {
        token,
        user: { id: user.id, profile: user.profile },
        sessionId: session.id,
        expiresAt: session.expiresAt,
      };
    });
  }
  if (path === "/auth/login" && method === "POST") {
    const input = parse(loginSchema, body);
    const state = await snapshot();
    const user = state.users.find((user) => user.profile.email === input.email);
    if (
      !user ||
      (await credential(input.password, user.credential.salt)).hash !==
        user.credential.hash
    )
      fail(401, "INVALID_CREDENTIALS", "E-mail ou senha não conferem.");
    const token = crypto.randomUUID();
    const hash = await digest(token);
    return transact((current) => {
      const account = current.users.find((account) => account.id === user.id)!;
      if (account.credential.hash !== user.credential.hash)
        fail(401, "INVALID_CREDENTIALS", "A senha mudou. Entre novamente.");
      const session = {
        id: crypto.randomUUID(),
        userId: account.id,
        tokenHash: hash,
        expiresAt: now(current) + 30 * 60_000,
      };
      current.sessions.push(session);
      return {
        token,
        user: { id: account.id, profile: account.profile },
        sessionId: session.id,
        expiresAt: session.expiresAt,
      };
    });
  }
  if (path === "/profile/password" && method === "POST") {
    const input = parse(passwordSchema, body);
    const account = member(await snapshot(), tokenHash).user;
    if (
      (await credential(input.currentPassword, account.credential.salt))
        .hash !== account.credential.hash
    )
      fail(422, "PASSWORD_MISMATCH", "A senha atual não confere.", {
        currentPassword: ["A senha atual não confere."],
      });
    const next = await credential(input.newPassword);
    return transact((state) => {
      const { user, session } = member(state, tokenHash);
      if (user.credential.hash !== account.credential.hash)
        fail(409, "VERSION_CONFLICT", "A senha foi alterada em outra sessão.");
      user.credential = next;
      state.sessions = state.sessions.filter(
        (value) => value.userId !== user.id || value.id === session.id,
      );
      return null;
    });
  }
  let avatar: string | undefined;
  if (upload) {
    if (
      !["image/png", "image/jpeg", "image/webp"].includes(upload.type) ||
      upload.size > 2 * 1024 * 1024
    )
      fail(
        422,
        "AVATAR_INVALID",
        "Escolha uma imagem PNG, JPEG ou WebP de até 2 MB.",
        { avatar: ["Escolha uma imagem de até 2 MB."] },
      );
    try {
      const image = await createImageBitmap(upload);
      image.close();
    } catch {
      fail(
        422,
        "AVATAR_INVALID",
        "Não foi possível ler esta imagem. Escolha outro arquivo.",
        { avatar: ["O arquivo não contém uma imagem válida."] },
      );
    }
    avatar = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(upload);
    });
  }
  return transact((state, events) => {
    if (path === "/demo/actions" && method === "POST")
      return demoAction(state, events, body);
    if (path === "/nfts" && method === "GET") return listCatalog(state, url);
    if (path.startsWith("/nfts/") && method === "GET")
      return state.config.scenario === "not-found"
        ? fail(404, "NFT_NOT_FOUND", "Este NFT não está disponível.")
        : nftById(state, path.split("/")[2]);
    if (path === "/auth/session") {
      const { user, session } = member(state, tokenHash);
      return {
        user: { id: user.id, profile: user.profile },
        sessionId: session.id,
        expiresAt: session.expiresAt,
      };
    }
    if (path === "/auth/logout" && method === "POST") {
      state.sessions = state.sessions.filter(
        (session) => session.tokenHash !== tokenHash,
      );
      return null;
    }
    if (path.startsWith("/cart")) {
      const ownerId = owner(state, tokenHash, guest);
      const cart = getCart(state, ownerId);
      if (path === "/cart/merge" && method === "POST") {
        member(state, tokenHash);
        const mergeId = text(body, "mergeId"),
          guestId = text(body, "guestCartId");
        if (!mergeId || !guestId.startsWith("guest-"))
          fail(
            422,
            "MERGE_INVALID",
            "Não foi possível recuperar o carrinho de visitante.",
          );
        const adjustments: string[] = [];
        if (!cart.mergeIds.includes(mergeId)) {
          const visitor = state.carts.find(
            (value) => value.ownerId === guestId,
          );
          if (visitor)
            for (const line of visitor.items) {
              const nft = nftById(state, line.nftId),
                edition = nft.editions.find(
                  (value) => value.id === line.editionId,
                )!;
              const current = cart.items.find(
                (value) =>
                  value.nftId === line.nftId &&
                  value.editionId === line.editionId,
              );
              const requested = (current?.quantity ?? 0) + line.quantity;
              const quantity = Math.min(
                requested,
                Math.max(0, edition.stock - edition.reserved),
              );
              if (quantity < requested)
                adjustments.push(
                  `${nft.name}: quantidade ajustada à disponibilidade (${quantity}).`,
                );
              if (current) current.quantity = quantity;
              else if (quantity) cart.items.push({ ...line, quantity });
            }
          cart.items = cart.items.filter((line) => line.quantity > 0);
          cart.mergeIds.push(mergeId);
          cart.version++;
          if (visitor) {
            visitor.items = [];
            visitor.version++;
          }
        }
        return { ...cartView(state, cart), adjustments };
      }
      if (method !== "GET") version(body.expectedCartVersion, cart.version);
      if (path === "/cart/items" && method === "POST") {
        const nft = nftById(state, text(body, "nftId"));
        const edition =
          nft.editions.find((value) => value.id === body.editionId) ??
          fail(422, "EDITION_INVALID", "Escolha uma edição disponível.");
        const current = cart.items.find(
          (value) => value.nftId === nft.id && value.editionId === edition.id,
        );
        const quantity = validateQuantity(
          body.quantity,
          edition.stock - edition.reserved,
        );
        validateQuantity(
          quantity + (current?.quantity ?? 0),
          edition.stock - edition.reserved,
        );
        if (current) current.quantity += quantity;
        else
          cart.items.push({
            id: crypto.randomUUID(),
            nftId: nft.id,
            editionId: edition.id,
            quantity,
          });
        cart.version++;
      } else if (
        path.startsWith("/cart/items/") &&
        ["PATCH", "DELETE"].includes(method)
      ) {
        const line =
          cart.items.find((value) => value.id === path.split("/")[3]) ??
          fail(404, "LINE_NOT_FOUND", "Este item já saiu do carrinho.");
        if (method === "DELETE")
          cart.items = cart.items.filter((value) => value.id !== line.id);
        else {
          const edition = nftById(state, line.nftId).editions.find(
            (value) => value.id === line.editionId,
          )!;
          line.quantity = validateQuantity(
            body.quantity,
            edition.stock - edition.reserved,
          );
        }
        cart.version++;
      } else if (path === "/cart/coupon") {
        if (method === "DELETE") cart.couponCode = null;
        else {
          const code = text(body, "code").trim().toUpperCase();
          if (code !== "WELCOME10")
            fail(
              422,
              "COUPON_INVALID",
              code === "EXPIRED10"
                ? "Este cupom expirou."
                : "Não encontramos esse cupom.",
              {
                code: [
                  code === "EXPIRED10" ? "Cupom expirado." : "Cupom inválido.",
                ],
              },
            );
          cart.couponCode = code;
        }
        cart.version++;
      }
      return cartView(state, cart);
    }
    const { user, session } = member(state, tokenHash);
    if (path === "/profile/avatar") {
      if (method === "PUT") {
        if (!avatar) fail(422, "AVATAR_REQUIRED", "Escolha uma imagem.");
        user.profile.avatar = avatar;
      }
      if (method === "DELETE") user.profile.avatar = null;
      user.profile.version++;
      return user.profile;
    }
    if (path === "/profile") {
      if (method === "PATCH") {
        version(body.expectedVersion, user.profile.version);
        const input = parse(profileSchema, body);
        if (state.config.scenario === "validation")
          fail(422, "VALIDATION_ERROR", "Confira o nome de exibição.", {
            displayName: [
              "Este nome não está disponível no cenário de validação.",
            ],
          });
        if (
          state.users.some(
            (value) =>
              value.id !== user.id &&
              (value.profile.email === input.email ||
                value.profile.username.toLowerCase() ===
                  input.username.toLowerCase()),
          )
        )
          fail(409, "PROFILE_EXISTS", "E-mail ou nome de usuário em uso.", {
            username: ["Escolha outro nome de usuário."],
          });
        user.profile = {
          ...user.profile,
          ...input,
          version: user.profile.version + 1,
        };
      }
      return user.profile;
    }
    if (path.startsWith("/favorites")) {
      const favorites = (state.favorites[user.id] ??= []);
      const id = path.split("/")[2];
      if (id) {
        nftById(state, id);
        if (method === "PUT" && !favorites.includes(id)) favorites.push(id);
        if (method === "DELETE")
          state.favorites[user.id] = favorites.filter((value) => value !== id);
      }
      return state.favorites[user.id];
    }
    if (path.startsWith("/wallets")) {
      const id = path.split("/")[2];
      if (method === "GET")
        return state.wallets.filter((wallet) => wallet.userId === user.id);
      const input = parse(walletSchema, body);
      if (state.config.scenario === "validation")
        fail(422, "VALIDATION_ERROR", "Confira o endereço da carteira.", {
          address: ["Endereço recusado no cenário de validação."],
        });
      if (method === "POST") {
        if (
          state.wallets.some(
            (wallet) => wallet.userId === user.id && wallet.role === input.role,
          )
        )
          fail(
            409,
            "WALLET_EXISTS",
            "Esta carteira já existe. Edite os dados para continuar.",
          );
        const wallet = {
          ...input,
          id: crypto.randomUUID(),
          userId: user.id,
          version: 1,
        };
        state.wallets.push(wallet);
        return wallet;
      }
      const wallet =
        state.wallets.find(
          (wallet) => wallet.id === id && wallet.userId === user.id,
        ) ?? fail(404, "WALLET_NOT_FOUND", "Carteira não encontrada.");
      version(body.expectedVersion, wallet.version);
      if (input.role !== wallet.role)
        fail(
          422,
          "WALLET_ROLE_INVALID",
          "Edite a carteira no papel em que foi cadastrada.",
        );
      Object.assign(wallet, input, { version: wallet.version + 1 });
      return wallet;
    }
    if (path.startsWith("/wallet-connections")) {
      if (method === "DELETE") {
        state.connections = state.connections.filter(
          (value) => value.userId !== user.id,
        );
        return null;
      }
      if (state.config.scenario === "wallet-refused")
        fail(
          422,
          "WALLET_REFUSED",
          "A conexão foi recusada. Escolha uma carteira para tentar novamente.",
        );
      const wallet =
        state.wallets.find(
          (wallet) => wallet.id === body.walletId && wallet.userId === user.id,
        ) ?? fail(404, "WALLET_NOT_FOUND", "Escolha uma carteira cadastrada.");
      const provider = parse(providerSchema, body.provider);
      if (wallet.network === "solana" && provider !== "walletconnect")
        fail(
          422,
          "NETWORK_MISMATCH",
          "Use WalletConnect para esta rede na demonstração.",
        );
      state.connections = state.connections.filter(
        (value) => value.userId !== user.id,
      );
      state.connections.push({
        userId: user.id,
        walletId: wallet.id,
        provider,
      });
      return { connected: true, walletId: wallet.id, provider };
    }
    if (path === "/quotes" && method === "POST") {
      const cart = getCart(state, user.id);
      version(body.cartVersion, cart.version);
      if (!cart.items.length)
        fail(422, "CART_EMPTY", "Seu carrinho está vazio.");
      const wallet =
        state.wallets.find(
          (wallet) => wallet.id === body.walletId && wallet.userId === user.id,
        ) ?? fail(422, "WALLET_REQUIRED", "Escolha uma carteira cadastrada.");
      const collector = parse(collectorSchema, body.collectorData);
      const view = cartView(state, cart);
      if (view.lines.some((line) => line.quantity > line.available))
        fail(
          409,
          "OUT_OF_STOCK",
          "A disponibilidade mudou. Revise o carrinho antes de continuar.",
        );
      if (
        view.lines.some(
          (line) => nftById(state, line.nftId).network !== wallet.network,
        )
      )
        fail(
          409,
          "NETWORK_MISMATCH",
          "Escolha uma carteira compatível com a rede dos NFTs. Separe compras de redes diferentes.",
        );
      if (state.config.scenario === "expired-coupon" && cart.couponCode)
        fail(
          422,
          "COUPON_EXPIRED",
          "O cupom expirou. Remova-o e revise o pedido.",
        );
      const quote: Quote = {
        id: crypto.randomUUID(),
        userId: user.id,
        cartId: cart.id,
        cartVersion: cart.version,
        lines: view.lines,
        wallet: {
          ...structuredClone(wallet),
          provider:
            state.connections.find(
              (connection) =>
                connection.userId === user.id &&
                connection.walletId === wallet.id,
            )?.provider ?? wallet.provider,
        },
        collector,
        couponCode: cart.couponCode,
        ...view.summary,
        expiresAt: now(state) + 60_000,
        fingerprint: stable({
          cart,
          walletVersion: wallet.version,
          editions: view.lines.map((line) => [
            line.nftId,
            line.editionId,
            line.resourceVersion,
          ]),
        }),
      };
      state.quotes.push(quote);
      return quote;
    }
    if (path === "/orders" && method === "POST") {
      if (!key)
        fail(
          422,
          "IDEMPOTENCY_REQUIRED",
          "Não foi possível identificar esta tentativa de compra.",
        );
      const fingerprint = stable(body);
      const previous = state.idempotency.find(
        (value) => value.key === key && value.userId === user.id,
      );
      if (previous) {
        if (previous.fingerprint !== fingerprint)
          fail(
            409,
            "IDEMPOTENCY_CONFLICT",
            "Esta tentativa já foi usada com outros dados.",
          );
        return state.orders.find((order) => order.id === previous.orderId)!;
      }
      const pending = state.orders.find(
        (order) => order.userId === user.id && order.status === "pending",
      );
      if (pending)
        fail(
          409,
          "ORDER_PENDING",
          "Você já tem uma compra em andamento.",
          undefined,
          { orderId: pending.id },
        );
      const quote =
        state.quotes.find(
          (value) => value.id === body.quoteId && value.userId === user.id,
        ) ??
        fail(404, "QUOTE_NOT_FOUND", "Revise os valores antes de confirmar.");
      const cart = getCart(state, user.id),
        wallet = state.wallets.find(
          (value) => value.id === body.walletId && value.userId === user.id,
        );
      if (
        quote.expiresAt <= now(state) ||
        state.config.scenario === "quote-expired"
      )
        fail(
          409,
          "QUOTE_EXPIRED",
          "A cotação expirou. Confira os valores novamente.",
        );
      if (
        !wallet ||
        wallet.id !== quote.wallet.id ||
        wallet.version !== quote.wallet.version ||
        cart.version !== quote.cartVersion ||
        stable(body.collectorData) !== stable(quote.collector)
      )
        fail(
          409,
          "QUOTE_CHANGED",
          "Os dados mudaram. Revise e confirme novamente.",
        );
      if (quote.networkFeeEth !== state.config.networkFeeEth)
        fail(
          409,
          "QUOTE_CHANGED",
          "A taxa mudou. Revise e confirme novamente.",
        );
      if (quote.couponCode && state.config.scenario === "expired-coupon")
        fail(
          422,
          "COUPON_EXPIRED",
          "O cupom expirou. Remova-o e revise o pedido.",
        );
      if (
        !state.connections.some(
          (value) => value.userId === user.id && value.walletId === wallet.id,
        ) ||
        state.config.scenario === "wallet-disconnected"
      )
        fail(
          422,
          "WALLET_DISCONNECTED",
          "Conecte a carteira antes de confirmar.",
        );
      if (
        !state.connections.some(
          (connection) =>
            connection.userId === user.id &&
            connection.walletId === wallet.id &&
            connection.provider === quote.wallet.provider,
        )
      )
        fail(
          409,
          "QUOTE_CHANGED",
          "A conexão da carteira mudou. Revise e confirme novamente.",
        );
      for (const line of quote.lines) {
        const edition = nftById(state, line.nftId).editions.find(
          (value) => value.id === line.editionId,
        )!;
        if (
          edition.version !== line.resourceVersion ||
          edition.stock - edition.reserved < line.quantity
        )
          fail(
            409,
            "QUOTE_CHANGED",
            "Preço ou disponibilidade mudou. Revise e confirme novamente.",
          );
      }
      for (const line of quote.lines) {
        const nft = nftById(state, line.nftId);
        const edition = nft.editions.find(
          (value) => value.id === line.editionId,
        )!;
        edition.reserved += line.quantity;
        edition.version++;
        nft.version++;
        events.push(
          event(state, "nft.updated", nft.id, nft.version, {
            editionId: edition.id,
            priceEth: edition.priceEth,
            available: edition.stock - edition.reserved,
          }),
        );
      }
      const order = {
        id: crypto.randomUUID(),
        userId: user.id,
        status: "pending" as const,
        quote: structuredClone(quote),
        createdAt: now(state),
        resolveAt:
          now(state) +
          (state.config.scenario === "pending-disconnect" ? 120_000 : 2000),
        resolvedAt: null,
        transactionRef: null,
        version: 1,
        cartRemovalApplied: false,
      };
      state.orders.push(order);
      state.idempotency.push({
        userId: user.id,
        key,
        fingerprint,
        orderId: order.id,
      });
      return order;
    }
    if (path.startsWith("/orders/") && method === "GET") {
      const order =
        state.orders.find(
          (value) =>
            value.id === path.split("/")[2] && value.userId === user.id,
        ) ?? fail(404, "ORDER_NOT_FOUND", "Pedido não encontrado.");
      if (path.endsWith("/receipt") && order.status !== "confirmed")
        fail(
          409,
          "ORDER_NOT_CONFIRMED",
          "Este pedido ainda não foi confirmado.",
        );
      return order;
    }
    void session;
    return fail(404, "ROUTE_NOT_FOUND", "Este recurso não existe.");
  });
}

function demoAction(
  state: Database,
  events: DomainEvent[],
  body: Record<string, unknown>,
) {
  const type = text(body, "type"),
    payload = (body.payload ?? {}) as Record<string, unknown>;
  if (type === "events.hold") holdOrderEvents();
  else if (type === "network.hold" || type === "network.release") {
    const key = `${payload.phase === "response" ? "response" : "request"}:${String(payload.method ?? "GET").toUpperCase()}:${String(payload.path)}`;
    heldRequests.get(key)?.release();
    heldRequests.delete(key);
    if (type === "network.hold") {
      let release!: () => void;
      const promise = new Promise<void>((resolve) => {
        release = resolve;
      });
      heldRequests.set(key, { promise, release });
    }
  } else if (type === "clock.advance")
    state.config.offset += Number(payload.ms ?? 61_000);
  else if (type === "session.expire")
    state.sessions.forEach((session) => {
      session.expiresAt = now(state) - 1;
    });
  else if (type === "nft.change") {
    const nft = nftById(state, String(payload.nftId ?? state.nfts[0].id)),
      edition = nft.editions.find(
        (value) => value.id === (payload.editionId ?? "fifty"),
      )!;
    if (payload.priceEth !== undefined) {
      toWei(String(payload.priceEth));
      edition.priceEth = String(payload.priceEth);
    } else if (payload.available === undefined) edition.priceEth = "1.29";
    if (payload.available !== undefined)
      edition.stock = Math.max(
        edition.reserved,
        Number(payload.available) + edition.reserved,
      );
    edition.version++;
    nft.version++;
    const update = event(state, "nft.updated", nft.id, nft.version, {
      editionId: edition.id,
      priceEth: edition.priceEth,
      available: edition.stock - edition.reserved,
    });
    if (!payload.dropEvent) events.push(update);
    if (payload.duplicate) events.push(update);
    if (payload.old)
      events.push({
        ...update,
        eventId: `${update.eventId}-old`,
        version: update.version - 1,
        data: { ...update.data, priceEth: "0.01" },
      });
  } else if (type === "order.resolve") {
    const order =
      state.orders.find((value) => value.id === payload.orderId) ??
      state.orders.find((value) => value.status === "pending");
    if (order)
      resolveOrder(
        state,
        order,
        payload.status === "declined" ? "declined" : "confirmed",
        events,
      );
  } else if (type === "fee.change") {
    state.config.networkFeeEth = String(payload.feeEth ?? "0.02");
    toWei(state.config.networkFeeEth);
    events.push(
      event(state, "nft.updated", "__fees", state.config.eventSequence + 1, {
        feeEth: state.config.networkFeeEth,
      }),
    );
  } else if (type === "scenario.set") {
    state.config.scenario = readScenario(payload.scenario);
    state.config.calls = {};
  } else if (type === "socket.disconnect") {
    state.config.socketConnected = false;
    events.push(event(state, "nft.updated", "__disconnect", 1, {}));
  } else if (type === "socket.reconnect") state.config.socketConnected = true;
  else
    fail(422, "ACTION_INVALID", "Escolha uma ação disponível na demonstração.");
  return { config: state.config };
}

export const apiHandler = http.all("/api/*", async ({ request }) => {
  const url = new URL(request.url),
    path = url.pathname.slice(4),
    method = request.method;
  try {
    const fault = await simulate(path, method, url);
    if (fault === "network-error") return HttpResponse.error();
    const token =
      request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
    const tokenHash = token ? await digest(token) : "";
    let body: Record<string, unknown> = {},
      upload: File | undefined;
    if (!["GET", "HEAD"].includes(method)) {
      if (
        request.headers.get("content-type")?.includes("multipart/form-data")
      ) {
        const form = await request.formData();
        const file = form.get("file");
        if (file instanceof File) upload = file;
      } else {
        const raw = await request.text();
        if (raw) {
          try {
            body = JSON.parse(raw) as Record<string, unknown>;
          } catch {
            fail(400, "JSON_INVALID", "O pedido contém dados inválidos.");
          }
        }
      }
    }
    const result = await dispatch(
      path,
      method,
      body,
      tokenHash,
      request.headers.get("x-demo-guest-id") ?? "",
      url,
      request.headers.get("idempotency-key") ?? "",
      upload,
    );
    const state = await snapshot();
    await heldRequests.get(`response:${method}:${path}`)?.promise;
    if (
      path === "/orders" &&
      method === "POST" &&
      state.config.scenario === "order-timeout" &&
      (state.config.calls["POST:/orders"] ?? 0) === 1
    ) {
      await delay(6500);
      return HttpResponse.error();
    }
    return HttpResponse.json(
      { data: result },
      {
        status:
          method === "POST" &&
          ["/orders", "/quotes", "/auth/register", "/wallets"].includes(path)
            ? 201
            : 200,
      },
    );
  } catch (error) {
    const known =
      error instanceof DomainError
        ? error
        : new DomainError(
            500,
            "INTERNAL_ERROR",
            "Não foi possível concluir esta operação. Tente novamente.",
          );
    if (!(error instanceof DomainError))
      console.error("mock_request_failed", { path, error });
    return HttpResponse.json(
      {
        error: {
          code: known.code,
          message: known.message,
          fieldErrors: known.fields,
          retryable: known.status >= 500,
          requestId: crypto.randomUUID(),
          details: known.details,
        },
      },
      { status: known.status },
    );
  }
});

export { networks };

function readScenario(value: unknown) {
  if (
    typeof value !== "string" ||
    !scenarioIds.includes(value as (typeof scenarioIds)[number])
  )
    fail(422, "SCENARIO_INVALID", "Escolha um cenário disponível.");
  return value as (typeof scenarioIds)[number];
}
