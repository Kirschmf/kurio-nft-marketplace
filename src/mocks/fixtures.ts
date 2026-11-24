import type { Database, Nft, ScenarioId, Wallet } from "../lib/types";

import { categories } from "../lib/catalog-options";
export { networks } from "../lib/catalog-options";
const artworks = [
  ["Emerald Ape", "0042", "emerald", "1.19"],
  ["Violet Nomad", "0314", "violet", "1.39"],
  ["Ivory Baron", "0088", "ivory", "1.79"],
  ["Golden Beat", "0207", "golden", "0.99"],
  ["Cosmic Bloom", "0118", "violet", "1.29"],
  ["Sage Nomad", "0009", "violet", "1.69"],
  ["Neon Vessel", "0552", "ivory", "1.99"],
  ["Golden Frequency", "0071", "golden", "0.59"],
  ["Golden Signal", "0160", "golden", "0.39"],
];

export function catalog(): Nft[] {
  return Array.from({ length: 36 }, (_, index) => {
    const [name, originalToken, image, price] =
      artworks[index % artworks.length];
    const token =
      index < 9 ? originalToken : String(600 + index).padStart(4, "0");
    return {
      id: index === 0 ? "emerald-042" : `${image}-${token}`,
      tokenId: token,
      name: `${name} #${token.replace(/^0+(?=\d)/, "").padStart(3, "0")}`,
      collection: image === "golden" ? "Kurio Frequencies" : "Kurio Apes",
      category: categories[index % 9],
      network: index < 18 ? "ethereum" : index < 27 ? "polygon" : "solana",
      image: `/assets/${image}.webp`,
      description:
        "Um colecionável digital da coleção Kurio Editions. Arte, identidade e novos encontros para quem gosta de descobrir o próximo detalhe.",
      attributes:
        image === "emerald"
          ? ["Óculos", "Esmeralda", "Raro"]
          : image === "violet"
            ? ["Chapéu", "Violeta", "Edição limitada"]
            : image === "ivory"
              ? ["Marfim", "Clássico", "Retrato"]
              : ["Música", "Dourado", "Frequência"],
      editions: [
        {
          id: "single",
          label: "1/1",
          priceEth: price,
          stock: 1,
          reserved: 0,
          version: 1,
        },
        {
          id: "ten",
          label: "1/10",
          priceEth: price,
          stock: 10,
          reserved: 0,
          version: 1,
        },
        {
          id: "fifty",
          label: "1/50",
          priceEth: price,
          stock: index === 35 ? 0 : 50,
          reserved: 0,
          version: 1,
        },
        {
          id: "open",
          label: "Aberta",
          priceEth: price,
          stock: 1000,
          reserved: 0,
          version: 1,
        },
      ],
      version: 1,
      createdAt: new Date(Date.UTC(2026, 8, 24 - index)).toISOString(),
      popularity: (index * 17 + 43) % 100,
      rare: index % 3 === 0,
    };
  });
}

export function demoWallet(
  userId: string,
  role: "primary" | "secondary" = "primary",
): Wallet {
  return {
    id: `${userId}-${role}`,
    userId,
    role,
    displayName: role === "primary" ? "Principal" : "Reserva",
    nickname: role === "primary" ? "Minha carteira" : "Reserva",
    network: "ethereum",
    address: `0x${userId === "collector-a" ? "a" : "b"}`.padEnd(42, "1"),
    provider: role === "primary" ? "metamask" : "walletconnect",
    profileName: "Colecionador Kurio",
    secondaryIdentifier: "",
    referralCode: "DEMO2026",
    email: `${userId}@example.test`,
    ensName: role === "primary" ? "colecionador.eth" : "reserva.eth",
    version: 1,
  };
}

export async function credential(
  password: string,
  salt: string = crypto.randomUUID(),
) {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      salt: new TextEncoder().encode(salt),
      iterations: 100_000,
      hash: "SHA-256",
    },
    material,
    256,
  );
  return {
    salt,
    hash: Array.from(new Uint8Array(bits), (byte) =>
      byte.toString(16).padStart(2, "0"),
    ).join(""),
  };
}
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}

export async function seed(
  scenario: ScenarioId = "default",
  seedNumber = 7,
): Promise<Database> {
  const users = await Promise.all(
    ["a", "b"].map(async (letter) => ({
      id: `collector-${letter}`,
      profile: {
        displayName: letter === "a" ? "Alex Colecionador" : "Bia Colecionadora",
        username: `collector_${letter}`,
        email: `collector.${letter}@example.test`,
        ensName: `${letter === "a" ? "alex" : "bia"}.eth`,
        walletNickname: "Principal",
        avatar: null,
        version: 1,
      },
      credential: await credential(
        `CollectorDemo${letter.toUpperCase()}!2026`,
        `kurio-fixture-${letter}`,
      ),
    })),
  );
  return {
    schema: 1,
    users,
    sessions: [],
    nfts: catalog(),
    wallets: users.flatMap((user) => [
      demoWallet(user.id),
      demoWallet(user.id, "secondary"),
    ]),
    carts: [],
    quotes: [],
    orders: [],
    favorites: { "collector-a": [], "collector-b": [] },
    idempotency: [],
    connections: [],
    config: {
      networkFeeEth: "0.016",
      scenario,
      seed: seedNumber,
      clockStart: Date.UTC(2026, 10, 24, 12),
      wallStart: Date.now(),
      offset: 0,
      calls: {},
      socketConnected: true,
      eventSequence: 0,
    },
  };
}
