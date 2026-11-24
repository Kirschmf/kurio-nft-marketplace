import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Heart,
  LogOut,
  UserRound,
  Wallet as WalletIcon,
  Camera,
} from "lucide-react";
import {
  api,
  auth,
  errorMessage,
  errorsFrom,
  queryClient,
  sessionKey,
} from "../lib/client";
import type { Profile, Wallet } from "../lib/types";
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
  ErrorState,
  Field,
  NftCard,
  PasswordField,
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
    navigate = useNavigate();
  return (
    <div className="account-layout container">
      <aside className="account-sidebar">
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
          <Link to="/favorites" activeProps={{ className: "active" }}>
            <Heart size={20} />
            Lista de interesse
          </Link>
          <button
            onClick={() => {
              void auth.logout().finally(() => navigate({ to: "/" }));
            }}
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
    [busy, setBusy] = useState(false),
    [password, setPassword] = useState({
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    }),
    [passwordError, setPasswordError] = useState(""),
    notice = useNotice();
  useFormErrors(errors);
  useEffect(() => setForm(profile), [profile]);
  const update = (key: keyof Profile, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));
  const saved = (next: Profile) => {
    queryClient.setQueryData(["profile", ...sessionKey()], next);
    auth.updateProfile(next);
  };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const parsed = profileSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setBusy(true);
    setError("");
    setErrors({});
    try {
      saved(
        await api.saveProfile({
          ...parsed.data,
          expectedVersion: form.version,
        }),
      );
      notice("Perfil atualizado.");
    } catch (error) {
      setError(errorMessage(error));
      setErrors(errorsFrom(error));
    } finally {
      setBusy(false);
    }
  };
  const avatar = async (file?: File) => {
    setBusy(true);
    try {
      saved(await api.avatar(file));
      notice(file ? "Foto atualizada." : "Foto removida.");
    } catch (error) {
      notice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
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
                if (file) void avatar(file);
                event.target.value = "";
              }}
            />
          </label>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void avatar()}
            disabled={busy || !profile.avatar}
          >
            Remover
          </Button>
          <small>PNG, JPG ou WebP. Até 2 MB.</small>
        </div>
      </div>
      <form onSubmit={submit} noValidate>
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
          onSubmit={(event) => {
            event.preventDefault();
            const parsed = passwordSchema.safeParse(password);
            if (!parsed.success) {
              setPasswordError(parsed.error.issues[0].message);
              return;
            }
            setBusy(true);
            setPasswordError("");
            void api
              .changePassword(parsed.data)
              .then(() => {
                setPassword({
                  currentPassword: "",
                  newPassword: "",
                  confirmPassword: "",
                });
                notice("Senha alterada. Outras sessões foram encerradas.");
              })
              .catch((error) => setPasswordError(errorMessage(error)))
              .finally(() => setBusy(false));
          }}
        >
          <div className="form-grid">
            <PasswordField
              label="Senha atual"
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
      <div className="account-tabs">
        <button
          className={tab === "primary" ? "active" : ""}
          onClick={() => setTab("primary")}
        >
          Carteira principal
        </button>
        <button
          className={tab === "secondary" ? "active" : ""}
          onClick={() => setTab("secondary")}
        >
          Carteira secundária
        </button>
      </div>
      {query.isPending ? (
        <Skeleton type="summary" />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <WalletForm
          key={`${tab}-${current?.version ?? 0}`}
          wallet={current ?? initial}
          primary={query.data.find((wallet) => wallet.role === "primary")}
        />
      )}
    </AccountShell>
  );
}
function WalletForm({ wallet, primary }: { wallet: Wallet; primary?: Wallet }) {
  const [form, setForm] = useState(wallet),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    notice = useNotice();
  useFormErrors(errors);
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
        const parsed = walletSchema.safeParse(form);
        if (!parsed.success) {
          setErrors(fieldErrors(parsed.error));
          return;
        }
        setBusy(true);
        setError("");
        setErrors({});
        void api
          .saveWallet(
            { ...parsed.data, expectedVersion: wallet.version },
            wallet.id,
          )
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: ["wallets"] });
            notice("Carteira salva.");
          })
          .catch((error) => {
            setError(errorMessage(error));
            setErrors(errorsFrom(error));
          })
          .finally(() => setBusy(false));
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
        <label className="field">
          Rede <span className="required">*</span>
          <select
            aria-label="Rede"
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
          </select>
        </label>
        {field("profileName", "Nome do perfil")}
        {field("address", "Endereço da carteira")}
        {field("secondaryIdentifier", "ENS ou carteira secundária", false)}
        <label className="field">
          Tipo de carteira <span className="required">*</span>
          <select
            aria-label="Tipo de carteira"
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
          </select>
          {errors.provider && (
            <span className="field-error">{errors.provider[0]}</span>
          )}
        </label>
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
      {favorites.isPending || catalog.isPending ? (
        <Skeleton />
      ) : favorites.isError || catalog.isError ? (
        <ErrorState
          error={favorites.error ?? catalog.error}
          retry={() => {
            void favorites.refetch();
            void catalog.refetch();
          }}
        />
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
