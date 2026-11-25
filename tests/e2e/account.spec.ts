import { expect, test } from "@playwright/test";
import { action, add, api, boot, login } from "./helpers";
import type { Profile, Wallet } from "../../src/lib/types";

test.beforeEach(async ({ page }) => boot(page));
test("T019 delayed private response from A is discarded after login as B", async ({
  page,
}) => {
  await login(page);
  await action(page, "scenario.set", { scenario: "out-of-order" });
  await page.goto("/account/profile");
  await expect(page.locator(".skeleton-summary")).toBeVisible();
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await login(page, "b", "/account/profile");
  await expect(
    page.getByRole("textbox", { name: "E-mail", exact: true }),
  ).toHaveValue("collector.b@example.test");
  await expect(page.locator(".account-identity")).toContainText("Bia");
  await expect(page.locator(".account-content")).not.toContainText(
    "collector.a@example.test",
  );
});
test("T052 newly registered collector creates both wallets through the form", async ({
  page,
}) => {
  const result = await api(page, "POST", "/auth/register", {
    username: "wallet_new",
    email: "wallet.new@example.test",
    password: "WalletCollector!2026",
    confirmPassword: "WalletCollector!2026",
  });
  expect(result.status).toBe(201);
  await page.goto("/login?redirect=/account/wallets");
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("wallet.new@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("WalletCollector!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  for (const [role, nickname, address] of [
    ["principal", "Primeira", `0x${"c".repeat(40)}`],
    ["secundária", "Segunda", `0x${"d".repeat(40)}`],
  ]) {
    await page
      .getByRole("button", { name: new RegExp(`^Carteira ${role}`) })
      .click();
    await page
      .getByRole("textbox", { name: "Apelido da carteira", exact: true })
      .fill(nickname);
    await page
      .getByRole("textbox", { name: "Endereço da carteira", exact: true })
      .fill(address);
    await page.getByRole("button", { name: "Salvar carteira" }).click();
    await expect(page.locator(".toast")).toContainText("Carteira salva");
  }
  await page.reload();
  expect((await api<Wallet[]>(page, "GET", "/wallets")).data).toHaveLength(2);
});
test("T013 T014 T015 register, conflict, login and logout", async ({
  page,
}) => {
  await page.goto("/register");
  await page
    .getByRole("textbox", { name: "Nome de usuário", exact: true })
    .fill("new_collector");
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("new@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("NewCollector!2026");
  await page
    .getByLabel("Confirmar senha", { exact: true })
    .fill("NewCollector!2026");
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page).not.toHaveURL(/register/);
  await page.goto("/account/profile");
  await expect(
    page.getByRole("textbox", { name: "Nome de usuário", exact: true }),
  ).toHaveValue("new_collector");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  const conflict = await api(page, "POST", "/auth/register", {
    username: "new_collector",
    email: "new@example.test",
    password: "NewCollector!2026",
    confirmPassword: "NewCollector!2026",
  });
  expect(conflict.status).toBe(409);
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("new@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("wrong");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("não conferem");
  await page.getByLabel("Senha", { exact: true }).fill("NewCollector!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).not.toHaveURL(/login/);
});
test("T016 T018 T020 checkout session expiration preserves draft and return", async ({
  page,
}) => {
  await add(page);
  await page.goto("/checkout");
  await expect(page).toHaveURL(/login.*redirect/);
  await login(page, "a", "/checkout");
  await page
    .getByRole("textbox", { name: "Nome de exibição", exact: true })
    .fill("Contexto preservado");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Nome de exibição", exact: true }),
  ).toHaveValue("Contexto preservado");
  await action(page, "session.expire");
  await page.reload();
  await expect(page).toHaveURL(/login/);
  await login(page, "a", "/checkout");
  await expect(
    page.getByRole("textbox", { name: "Nome de exibição", exact: true }),
  ).toHaveValue("Contexto preservado");
  await expect(
    page.getByRole("button", { name: "Confirmar compra" }),
  ).toHaveCount(0);
});
test("T017 T019 T062 private state is isolated after account switch", async ({
  page,
}) => {
  await login(page);
  await page.goto("/nfts/emerald-042");
  await page
    .getByRole("button", { name: "Favoritar NFT", exact: true })
    .first()
    .click();
  await page.goto("/account/profile");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await login(page, "b", "/favorites");
  await expect(
    page.getByRole("heading", { name: "Sua lista ainda está vazia" }),
  ).toBeVisible();
  expect((await api<string[]>(page, "GET", "/favorites")).data).toEqual([]);
  await action(page, "session.expire");
  await page.goto("/account/profile");
  await expect(page).toHaveURL(/login/);
});
test("T022 T023 T024 optimistic favorite rollback and persistence", async ({
  page,
}) => {
  await login(page);
  await page.goto("/nfts/emerald-042");
  const favorite = page.locator(".detail-buttons .favorite");
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await expect(favorite).toBeEnabled();
  await page.reload();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await action(page, "scenario.set", { scenario: "favorite-error" });
  await favorite.click();
  await expect(page.locator(".toast")).toContainText("estado anterior");
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
  await action(page, "scenario.set", { scenario: "slow" });
  await favorite.dblclick();
  await expect(favorite).toHaveAttribute("aria-pressed", "false");
  await expect(favorite).toBeEnabled();
  await action(page, "scenario.set", { scenario: "default" });
  await favorite.click();
  await expect(favorite).toHaveAttribute("aria-pressed", "true");
});
test("T046 T047 profile persists and field errors retain input", async ({
  page,
}) => {
  await login(page, "a", "/account/profile");
  const name = page.getByRole("textbox", {
    name: "Nome de exibição",
    exact: true,
  });
  await name.fill("Alex Teste");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator(".toast")).toContainText("Perfil atualizado");
  await page.reload();
  await expect(name).toHaveValue("Alex Teste");
  await action(page, "scenario.set", { scenario: "validation" });
  await name.fill("Nome recusado");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(name).toHaveAttribute("aria-invalid", "true");
  await expect(name).toHaveValue("Nome recusado");
  await expect(name).toBeFocused();
  expect((await api<Profile>(page, "GET", "/profile")).data.displayName).toBe(
    "Alex Teste",
  );
});
test("T048 T049 avatar upload, replace, refresh, invalid upload and removal", async ({
  page,
}) => {
  await login(page, "a", "/account/profile");
  const input = page.locator("input[type=file]");
  await input.setInputFiles("public/assets/source/emerald.png");
  await expect(page.locator(".avatar-editor img")).toBeVisible();
  const first = await page.locator(".avatar-editor img").getAttribute("src");
  await input.setInputFiles("public/assets/source/violet.png");
  await expect(page.locator(".avatar-editor img")).not.toHaveAttribute(
    "src",
    first!,
  );
  await page.reload();
  await expect(page.locator(".avatar-editor img")).toBeVisible();
  const before = await page.locator(".avatar-editor img").getAttribute("src");
  await input.setInputFiles({
    name: "broken.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a png"),
  });
  await expect(page.locator(".toast")).toContainText("ler esta imagem");
  await expect(page.locator(".avatar-editor img")).toHaveAttribute(
    "src",
    before!,
  );
  await input.setInputFiles({
    name: "bad.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("invalid"),
  });
  await expect(page.locator(".toast")).toContainText("imagem");
  await expect(page.locator(".avatar-editor img")).toHaveAttribute(
    "src",
    before!,
  );
  await input.setInputFiles({
    name: "large.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(2 * 1024 * 1024 + 1),
  });
  await expect(page.locator(".toast")).toContainText("até 2 MB");
  await page.getByRole("button", { name: "Remover", exact: true }).click();
  await expect(page.locator(".avatar-editor img")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".avatar-editor img")).toHaveCount(0);
});
test("T050 T051 password confirmation, wrong current password and new login", async ({
  page,
}) => {
  await login(page, "a", "/account/profile");
  await page.getByLabel("Senha atual", { exact: true }).fill("wrong");
  await page
    .getByLabel("Nova senha", { exact: true })
    .fill("ChangedCollector!2026");
  await page.getByLabel("Confirmar nova senha").fill("mismatch");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("iguais");
  await page.getByLabel("Confirmar nova senha").fill("ChangedCollector!2026");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(page.getByRole("alert")).toContainText("atual não confere");
  await page
    .getByLabel("Senha atual", { exact: true })
    .fill("CollectorDemoA!2026");
  await page
    .getByRole("button", { name: "Alterar senha", exact: true })
    .click();
  await expect(page.locator(".toast")).toContainText("Senha alterada");
  await page.getByRole("button", { name: "Sair", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  expect(
    (
      await api(page, "POST", "/auth/login", {
        email: "collector.a@example.test",
        password: "CollectorDemoA!2026",
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await api(page, "POST", "/auth/login", {
        email: "collector.a@example.test",
        password: "ChangedCollector!2026",
      })
    ).status,
  ).toBe(200);
});
test("T052 T053 T054 wallets persist, validate network and copy primary data", async ({
  page,
}) => {
  await login(page, "a", "/account/wallets");
  await page
    .getByRole("textbox", { name: "Apelido da carteira", exact: true })
    .fill("Principal editada");
  await page.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(page.locator(".toast")).toContainText("Carteira salva");
  await page.reload();
  await expect(
    page.getByRole("textbox", { name: "Apelido da carteira", exact: true }),
  ).toHaveValue("Principal editada");
  await page
    .getByRole("textbox", { name: "Endereço da carteira", exact: true })
    .fill("0xinvalid");
  await page.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(
    page.getByRole("textbox", { name: "Endereço da carteira", exact: true }),
  ).toHaveAttribute("aria-invalid", "true");
  await page.getByRole("button", { name: /^Carteira secundária/ }).click();
  await page
    .getByRole("checkbox", {
      name: "Usar os mesmos dados da carteira principal",
    })
    .check();
  await page.getByRole("button", { name: "Salvar carteira" }).click();
  await expect(page.locator(".toast")).toContainText("Carteira salva");
  await page.reload();
  await page.getByRole("button", { name: /^Carteira secundária/ }).click();
  await expect(
    page.getByRole("textbox", { name: "Apelido da carteira", exact: true }),
  ).toHaveValue("Principal editada");
  const wallets = (await api<Wallet[]>(page, "GET", "/wallets")).data;
  expect(wallets[1].address).toBe(wallets[0].address);
  await page
    .getByRole("checkbox", {
      name: "Usar os mesmos dados da carteira principal",
    })
    .uncheck();
  await expect(
    page.getByRole("textbox", { name: "Apelido da carteira", exact: true }),
  ).toBeEnabled();
});
test("T084 direct login rejects external return destinations", async ({
  page,
}) => {
  await page.goto("/login?redirect=https%3A%2F%2Fevil.example");
  await page.reload();
  await page
    .getByRole("textbox", { name: "E-mail", exact: true })
    .fill("collector.a@example.test");
  await page.getByLabel("Senha", { exact: true }).fill("CollectorDemoA!2026");
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/");
  await expect(page.getByRole("heading", { name: /SEJA DONO/ })).toBeVisible();
});
