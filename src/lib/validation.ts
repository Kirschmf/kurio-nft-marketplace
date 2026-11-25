import { z } from "zod";

export const username = z
  .string()
  .trim()
  .min(3, "Use pelo menos 3 caracteres.")
  .max(30)
  .regex(/^[a-zA-Z0-9_]+$/, "Use letras, números e sublinhado.");
export const email = z
  .email("Confira o e-mail.")
  .transform((value) => value.trim().toLowerCase());
export const password = z
  .string()
  .min(12, "Use pelo menos 12 caracteres.")
  .max(128);
export const registerSchema = z
  .object({ username, email, password, confirmPassword: z.string() })
  .refine((value) => value.password === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas precisam ser iguais.",
  });
export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ["confirmPassword"],
    message: "As senhas precisam ser iguais.",
  });
export const loginSchema = z.object({
  email,
  password: z.string().min(1, "Informe sua senha."),
});
export const profileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Informe seu nome de exibição.")
    .max(60),
  username,
  email,
  ensName: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9-]+\.eth$/, "Use um nome terminado em .eth."),
  walletNickname: z
    .string()
    .trim()
    .min(1, "Informe o apelido da carteira.")
    .max(120),
});
export const walletSchema = z
  .object({
    role: z.enum(["primary", "secondary"]),
    displayName: z.string().trim().min(2).max(60),
    nickname: z.string().trim().min(1).max(120),
    network: z.enum(["ethereum", "polygon", "solana"]),
    address: z.string().trim(),
    provider: z.enum(["walletconnect", "metamask", "coinbase"]),
    profileName: z.string().trim().min(1).max(120),
    secondaryIdentifier: z.string().max(120).default(""),
    referralCode: z.string().trim().min(1).max(120),
    email,
    ensName: z
      .string()
      .trim()
      .regex(/^[a-zA-Z0-9-]+\.eth$/, "Use um nome terminado em .eth."),
    sameAsPrimary: z.boolean().optional(),
  })
  .superRefine((wallet, ctx) => {
    const valid =
      wallet.network === "solana"
        ? isSolanaAddress(wallet.address)
        : /^0x[a-fA-F0-9]{40}$/.test(wallet.address);
    if (!valid)
      ctx.addIssue({
        code: "custom",
        path: ["address"],
        message: "O endereço não corresponde à rede selecionada.",
      });
    if (wallet.network === "solana" && wallet.provider !== "walletconnect")
      ctx.addIssue({
        code: "custom",
        path: ["provider"],
        message: "Nesta demonstração, use WalletConnect para Solana.",
      });
  });
function isSolanaAddress(address: string) {
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) return false;
  const alphabet = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let value = 0n;
  for (const character of address)
    value = value * 58n + BigInt(alphabet.indexOf(character));
  const leadingZeroes = address.match(/^1*/)?.[0].length ?? 0;
  let bytes = 0;
  while (value > 0n) {
    bytes++;
    value >>= 8n;
  }
  return bytes + leadingZeroes === 32;
}
export const collectorSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Informe seu nome de exibição.")
    .max(60),
  username,
  email,
  profileName: z.string().trim().min(1, "Informe o nome do perfil.").max(120),
  ensName: z
    .string()
    .regex(/^[a-zA-Z0-9-]+\.eth$/, "Use um nome terminado em .eth."),
  referralCode: z.string().min(1, "Informe o código de indicação."),
  secondaryIdentifier: z.string().max(120).default(""),
  collectorNote: z.string().max(1000).default(""),
});
export { fieldErrors } from "./field-errors";
export const providerSchema = z.enum(["walletconnect", "metamask", "coinbase"]);
