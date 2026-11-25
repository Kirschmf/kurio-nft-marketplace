import { useEffect, useRef, useState, type ReactNode } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Heart,
  LogOut,
  UserRound,
  Wallet as WalletIcon,
  Camera,
  Activity,
  Tag,
  Download,
  LifeBuoy,
} from "lucide-react";
import {
  api,
  auth,
  errorMessage,
  errorsFrom,
  isCanceled,
  queryClient,
  sessionKey,
} from "../lib/client";
import type { Profile, Wallet, WalletInput } from "../lib/types";
import {
  fieldErrors,
  profileSchema,
  passwordSchema,
  walletSchema,
} from "../lib/validation";
import { useFormErrors } from "../lib/use-form-errors";
import { Button } from "../components/ui/button";
import {
  Busy,
  EmptyState,
  DemoInfo,
  ErrorState,
  Field,
  NftCard,
  PasswordField,
  SelectField,
  Skeleton,
  useAuth,
  useFavorites,
  useNotice,
} from "../components/common";

export function AccountShell({
  children,
  title,
}: {
  children: ReactNode;
  title: string;
}) {
  const user = useAuth(),
    navigate = useNavigate(),
    notice = useNotice();
  const [info, setInfo] = useState("");
  const logout = useMutation({
    mutationFn: () => auth.logout(),
    onSuccess: () => navigate({ to: "/" }),
    onError: (error) => {
      if (!isCanceled(error))
        notice(
          "Você saiu neste navegador. Não foi possível avisar o servidor; a sessão remota expira automaticamente.",
        );
      if (!auth.get()) void navigate({ to: "/" });
    },
  });
  return (
    <div className="account-layout container">
      <aside className="account-sidebar">
        <h2>Meu perfil</h2>
        <div className="account-identity">
          {user?.user.profile.avatar ? (
            <img
              src={user.user.profile.avatar}
              width="64"
              height="64"
              alt="Sua foto de perfil"
            />
          ) : (
            <span className="avatar-placeholder">
              <UserRound size={30} />
            </span>
          )}
          <strong>{user?.user.profile.displayName}</strong>
          <small>@{user?.user.profile.username}</small>
        </div>
        <nav aria-label="Minha conta">
          <Link to="/account/profile" activeProps={{ className: "active" }}>
            <UserRound size={20} />
            Detalhes do perfil
          </Link>
          <Link to="/account/wallets" activeProps={{ className: "active" }}>
            <WalletIcon size={20} />
            Minhas carteiras
          </Link>
          <button
            onClick={() =>
              setInfo(
                "Atividade não está incluída nesta demonstração. Os pedidos podem ser acompanhados pelo endereço exibido ao concluir a compra.",
              )
            }
          >
            <Activity size={20} />
            Atividade
          </button>
          <Link to="/favorites" activeProps={{ className: "active" }}>
            <Heart size={20} />
            Lista de interesse
          </Link>
          <button
            onClick={() =>
              setInfo(
                "Ofertas entre colecionadores não estão disponíveis na demonstração. A compra usa o preço e a disponibilidade informados no catálogo.",
              )
            }
          >
            <Tag size={20} />
            Ofertas
          </button>
          <button
            onClick={() =>
              setInfo(
                "O download das obras não faz parte do desafio. O comprovante JSON fica disponível em um pedido confirmado.",
              )
            }
          >
            <Download size={20} />
            Arquivos baixados
          </button>
          <button
            onClick={() =>
              setInfo(
                "O atendimento não está ativo nesta demonstração. Use os cenários para reproduzir falhas de sessão, conexão e compra.",
              )
            }
          >
            <LifeBuoy size={20} />
            Suporte
          </button>
          <button
            className="logout-button"
            disabled={logout.isPending}
            onClick={() => logout.mutate()}
          >
            <LogOut size={20} />
            Sair
          </button>
        </nav>
      </aside>
      <section className="account-content">
        <h1>{title}</h1>
        {children}
      </section>
      <DemoInfo open={!!info} onClose={() => setInfo("")} message={info} />
    </div>
  );
}

export function ProfilePage() {
  const query = useQuery({
    queryKey: ["profile", ...sessionKey()],
    queryFn: api.profile,
    staleTime: 0,
  });
  return (
    <AccountShell title="Detalhes do perfil">
      {query.isPending ? (
        <Skeleton type="summary" />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <ProfileForm profile={query.data} />
      )}
    </AccountShell>
  );
}
function ProfileForm({ profile }: { profile: Profile }) {
  const [form, setForm] = useState(profile),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    [error, setError] = useState(""),
    [password, setPassword] = useState({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }),
    [passwordError, setPasswordError] = useState(""),
    [passwordErrors, setPasswordErrors] = useState<Record<string, string[]>>(
      {},
    ),
    notice = useNotice();
  const profileRef = useRef<HTMLFormElement>(null);
  const passwordRef = useRef<HTMLFormElement>(null);
  useFormErrors(errors, profileRef);
  useFormErrors(passwordErrors, passwordRef);
  useEffect(() => setForm(profile), [profile]);
  const update = (key: keyof Profile, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const saved = (next: Profile) => {
    queryClient.setQueryData(["profile", ...sessionKey()], next);
    auth.updateProfile(next);
  };
  const save = useMutation({
    onMutate: () => auth.generation(),
    mutationFn: api.saveProfile,
    onSuccess: (next, _body, started) => {
      if (started !== auth.generation()) return;
      saved(next);
      notice("Perfil atualizado.");
    },
    onError: (error, _body, started) => {
      if (started !== auth.generation() || isCanceled(error)) return;
      setError(errorMessage(error));
      setErrors(errorsFrom(error));
    },
  });
  const avatar = useMutation({
    onMutate: () => auth.generation(),
    mutationFn: api.avatar,
    onSuccess: (next, file, started) => {
      if (started !== auth.generation()) return;
      saved(next);
      notice(file ? "Foto atualizada." : "Foto removida.");
    },
    onError: (error, _file, started) => {
      if (started !== auth.generation()) return;
      if (!isCanceled(error)) notice(errorMessage(error));
    },
  });
  const changePassword = useMutation({
    onMutate: () => auth.generation(),
    mutationFn: api.changePassword,
    onSuccess: (_data, _body, started) => {
      if (started !== auth.generation()) return;
      setPassword({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      notice("Senha alterada. Outras sessões foram encerradas.");
    },
    onError: (error, _body, started) => {
      if (started !== auth.generation() || isCanceled(error)) return;
      setPasswordError(errorMessage(error));
      setPasswordErrors(errorsFrom(error));
    },
  });
  const busy = save.isPending || avatar.isPending || changePassword.isPending;
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setError("");
    setErrors({});
    save.mutate({
      ...parsed.data,
      expectedVersion: form.version,
    });
  };
  return (
    <>
      <form ref={profileRef} onSubmit={submit} noValidate>
        <div className="form-grid">
          <Field
            label="Nome de exibição"
            value={form.displayName}
            onChange={(event) => update("displayName", event.target.value)}
            error={errors.displayName}
            required
            autoComplete="name"
          />
          <Field
            label="Nome de usuário"
            value={form.username}
            onChange={(event) => update("username", event.target.value)}
            error={errors.username}
            required
            autoComplete="username"
          />
          <Field
            label="E-mail"
            type="email"
            value={form.email}
            onChange={(event) => update("email", event.target.value)}
            error={errors.email}
            required
            autoComplete="email"
          />
          <Field
            label="Nome ENS"
            value={form.ensName}
            onChange={(event) => update("ensName", event.target.value)}
            error={errors.ensName}
            required
            placeholder="seunome.eth"
          />
          <Field
            label="Apelido da carteira"
            value={form.walletNickname}
            onChange={(event) => update("walletNickname", event.target.value)}
            error={errors.walletNickname}
            required
          />
          <div className="avatar-editor">
            {profile.avatar ? (
              <img
                src={profile.avatar}
                width="90"
                height="90"
                alt="Sua foto de perfil"
              />
            ) : (
              <span className="avatar-placeholder">
                <UserRound size={40} />
              </span>
            )}
            <div>
              <label className="button button-outline button-small">
                <Camera size={16} />
                Alterar foto
                <input
                  className="sr-only"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  disabled={busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) avatar.mutate(file);
                    event.target.value = "";
                  }}
                />
              </label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => avatar.mutate(undefined)}
                disabled={busy || !profile.avatar}
              >
                Remover
              </Button>
              <small>PNG, JPG ou WebP. Até 2 MB.</small>
            </div>
          </div>
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy}>
          {busy ? <Busy /> : "Salvar alterações"}
        </Button>
      </form>
      <section className="password-section">
        <h2>Alterar senha</h2>
        <form
          ref={passwordRef}
          onSubmit={(event) => {
            event.preventDefault();
            if (busy) return;
            setPasswordErrors({});
            const parsed = passwordSchema.safeParse(password);
            if (!parsed.success) {
              setPasswordErrors(fieldErrors(parsed.error));
              setPasswordError(parsed.error.issues[0].message);
              return;
            }
            setPasswordError("");
            changePassword.mutate(parsed.data);
          }}
        >
          <div className="form-grid">
            <PasswordField
              label="Senha atual"
              error={passwordErrors.currentPassword}
              value={password.currentPassword}
              onChange={(event) =>
                setPassword({
                  ...password,
                  currentPassword: event.target.value,
                })
              }
              autoComplete="current-password"
              required
            />
            <PasswordField
              label="Nova senha"
              error={passwordErrors.newPassword}
              value={password.newPassword}
              onChange={(event) =>
                setPassword({ ...password, newPassword: event.target.value })
              }
              autoComplete="new-password"
              minLength={12}
              required
            />
            <PasswordField
              label="Confirmar nova senha"
              error={passwordErrors.confirmPassword}
              value={password.confirmPassword}
              onChange={(event) =>
                setPassword({
                  ...password,
                  confirmPassword: event.target.value,
                })
              }
              autoComplete="new-password"
              required
            />
          </div>
          {passwordError && (
            <p role="alert" className="field-error">
              {passwordError}
            </p>
          )}
          <Button variant="outline" type="submit" disabled={busy}>
            Alterar senha
          </Button>
        </form>
      </section>
    </>
  );
}

export function WalletsPage() {
  const query = useQuery({
      queryKey: ["wallets", ...sessionKey()],
      queryFn: ({ signal }) => api.wallets(signal),
      staleTime: 0,
    }),
    [tab, setTab] = useState<"primary" | "secondary">("primary"),
    user = useAuth();
  const initial = {
    role: tab,
    displayName: user?.user.profile.displayName ?? "",
    nickname: "",
    network: "ethereum",
    address: "",
    provider: "walletconnect",
    profileName: user?.user.profile.username ?? "",
    secondaryIdentifier: "",
    referralCode: "KURIO",
    email: user?.user.profile.email ?? "",
    ensName: user?.user.profile.ensName ?? "",
    version: 0,
  } as Wallet;
  const current = query.data?.find((wallet) => wallet.role === tab);
  return (
    <AccountShell title="Minhas carteiras">
      <div className="wallet-sections">
        {(["primary", "secondary"] as const).map((role) => (
          <section key={role}>
            <button
              className="wallet-section-heading"
              aria-expanded={tab === role}
              onClick={() => setTab(role)}
            >
              {role === "primary"
                ? "Carteira principal"
                : "Carteira secundária"}{" "}
              <span>{tab === role ? "Editando" : "Alterar"}</span>
            </button>
            {tab === role && (
              <>
                {query.isPending ? (
                  <Skeleton type="summary" />
                ) : query.isError ? (
                  <ErrorState
                    error={query.error}
                    retry={() => void query.refetch()}
                  />
                ) : (
                  <WalletForm
                    key={`${tab}-${current?.version ?? 0}`}
                    wallet={current ?? initial}
                    primary={query.data.find(
                      (wallet) => wallet.role === "primary",
                    )}
                  />
                )}
              </>
            )}
          </section>
        ))}
      </div>
    </AccountShell>
  );
}

function WalletForm({ wallet, primary }: { wallet: Wallet; primary?: Wallet }) {
  const [form, setForm] = useState(wallet),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    [error, setError] = useState(""),
    notice = useNotice();
  useFormErrors(errors);
  const save = useMutation({
    onMutate: () => auth.generation(),
    mutationFn: (body: WalletInput) => api.saveWallet(body, wallet.id),
    onSuccess: (_data, _body, started) => {
      if (started !== auth.generation()) return;
      void queryClient.invalidateQueries({ queryKey: ["wallets"] });
      notice("Carteira salva.");
    },
    onError: (error, _body, started) => {
      if (started !== auth.generation() || isCanceled(error)) return;
      setError(errorMessage(error));
      setErrors(errorsFrom(error));
    },
  });
  const busy = save.isPending;
  const field = (key: keyof Wallet, label: string, required = true) => (
    <Field
      label={label}
      value={String(form[key] ?? "")}
      onChange={(event) => setForm({ ...form, [key]: event.target.value })}
      error={errors[key]}
      required={required}
      disabled={form.sameAsPrimary}
    />
  );
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        if (busy) return;
        const parsed = walletSchema.safeParse(form);
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          return;
        }
        setError("");
        setErrors({});
        save.mutate({ ...parsed.data, expectedVersion: wallet.version });
      }}
    >
      {wallet.role === "secondary" && (
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={form.sameAsPrimary ?? false}
            disabled={!primary}
            onChange={(event) => {
              const checked = event.target.checked;
              setForm(
                checked && primary
                  ? {
                      ...primary,
                      role: "secondary",
                      id: wallet.id,
                      version: wallet.version,
                      sameAsPrimary: true,
                    }
                  : { ...wallet, sameAsPrimary: false },
              );
            }}
          />
          Usar os mesmos dados da carteira principal
        </label>
      )}
      <div className="form-grid">
        {field("displayName", "Nome de exibição")}
        {field("nickname", "Apelido da carteira")}
        <SelectField
          label="Rede"
          error={errors.network}
          required
          value={form.network}
          disabled={form.sameAsPrimary}
          onChange={(event) =>
            setForm({
              ...form,
              network: event.target.value as Wallet["network"],
            })
          }
        >
          <option value="ethereum">Ethereum</option>
          <option value="polygon">Polygon</option>
          <option value="solana">Solana</option>
        </SelectField>
        {field("profileName", "Nome do perfil")}
        {field("address", "Endereço da carteira")}
        {field("secondaryIdentifier", "ENS ou carteira secundária", false)}
        <SelectField
          label="Tipo de carteira"
          error={errors.provider}
          required
          value={form.provider}
          disabled={form.sameAsPrimary}
          onChange={(event) =>
            setForm({
              ...form,
              provider: event.target.value as Wallet["provider"],
            })
          }
        >
          <option value="walletconnect">WalletConnect</option>
          <option value="metamask">MetaMask</option>
          <option value="coinbase">Coinbase Wallet</option>
        </SelectField>
        {field("referralCode", "Código de indicação")}
        {field("email", "E-mail")}
        {field("ensName", "Nome ENS")}
      </div>
      {error && (
        <p role="alert" className="field-error">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy}>
        {busy ? <Busy /> : "Salvar carteira"}
      </Button>
    </form>
  );
}

export function FavoritesPage() {
  const favorites = useFavorites(),
    catalog = useQuery({
      queryKey: ["catalog", "favorites", favorites.data],
      queryFn: async ({ signal }) => {
        const ids = favorites.data ?? [];
        return Promise.all(ids.map((id) => api.nft(id, signal)));
      },
      enabled: favorites.isSuccess,
    });
  return (
    <AccountShell title="Lista de interesse">
      {favorites.isError || catalog.isError ? (
        <ErrorState
          error={favorites.error ?? catalog.error}
          retry={() => {
            if (favorites.isError) void favorites.refetch();
            else void catalog.refetch();
          }}
        />
      ) : favorites.isPending || catalog.isPending ? (
        <Skeleton />
      ) : !catalog.data.length ? (
        <EmptyState title="Sua lista ainda está vazia">
          <p>Toque no coração de uma obra para guardá-la aqui.</p>
          <Link to="/" className="button button-primary">
            Explorar NFTs
          </Link>
        </EmptyState>
      ) : (
        <div className="nft-grid">
          {catalog.data.map((nft) => (
            <NftCard key={nft.id} nft={nft} />
          ))}
        </div>
      )}
    </AccountShell>
  );
}
