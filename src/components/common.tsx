import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useState,
  useSyncExternalStore,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Heart,
  Minus,
  Plus,
  ShoppingCart,
  Eye,
  EyeOff,
  ArrowLeft,
  ChevronRight,
  LoaderCircle,
  Search,
  Check,
} from "lucide-react";
import {
  api,
  auth,
  errorMessage,
  queryClient,
  sessionKey,
} from "../lib/client";
import type { CartView, Nft, Totals } from "../lib/types";
import { formatEth } from "../lib/money";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";

const NoticeContext = createContext<(message: string) => void>(() => undefined);
export const useNotice = () => useContext(NoticeContext);
export function Notices({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState("");
  const notify = useCallback((next: string) => setMessage(next), []);
  useEffect(() => {
    if (!message) return;
    const timeout = setTimeout(() => setMessage(""), 6500);
    return () => clearTimeout(timeout);
  }, [message]);
  return (
    <NoticeContext.Provider value={notify}>
      {children}
      <div
        className={`toast ${message ? "toast-visible" : ""}`}
        role="status"
        aria-live="polite"
      >
        {message}
      </div>
    </NoticeContext.Provider>
  );
}
export function useAuth() {
  return useSyncExternalStore(auth.subscribe, auth.get);
}
export function useCart() {
  const [, generation] = sessionKey();
  return useQuery({
    queryKey: ["cart", ...sessionKey()],
    queryFn: ({ signal }) => api.cart(signal),
    staleTime: 0,
    meta: { generation },
  });
}
export function useFavorites() {
  const user = useAuth();
  return useQuery({
    queryKey: ["favorites", ...sessionKey()],
    queryFn: ({ signal }) => api.favorites(signal),
    enabled: !!user,
    staleTime: 0,
  });
}

export function ErrorState({
  error,
  retry,
  compact = false,
}: {
  error: unknown;
  retry?: () => void;
  compact?: boolean;
}) {
  return (
    <div role="alert" className={compact ? "inline-error" : "empty-state"}>
      <p>{errorMessage(error)}</p>
      {retry && (
        <Button variant="outline" onClick={retry}>
          Tentar novamente
        </Button>
      )}
    </div>
  );
}
export function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Skeleton({
  type = "cards",
}: {
  type?: "cards" | "detail" | "summary";
}) {
  return (
    <div
      role="status"
      aria-label="Carregando"
      className={`skeleton-group skeleton-${type}`}
    >
      {Array.from(
        { length: type === "cards" ? 9 : type === "detail" ? 2 : 4 },
        (_, i) => (
          <div className="skeleton" key={i} />
        ),
      )}
      <span className="sr-only">Carregando conteúdo.</span>
    </div>
  );
}
export function Busy({ label = "Salvando" }: { label?: string }) {
  return (
    <>
      <LoaderCircle className="spinner" size={17} aria-hidden="true" /> {label}…
    </>
  );
}

export function Field({
  label,
  error,
  hint,
  children,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string[];
  hint?: string;
  children?: ReactNode;
}) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>
        {label}
        {props.required && (
          <span className="required" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      {children ?? (
        <input
          {...props}
          id={id}
          aria-invalid={!!error}
          aria-describedby={
            error ? `${id}-error` : hint ? `${id}-hint` : undefined
          }
        />
      )}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error[0]}
        </span>
      )}
    </div>
  );
}
export function PasswordField({
  label,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string[];
}) {
  const [visible, setVisible] = useState(false),
    id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className="password-wrap">
        <input
          {...props}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : undefined}
        />
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
        >
          {visible ? <Eye size={18} /> : <EyeOff size={18} />}
        </button>
      </div>
      {error && (
        <span id={`${id}-error`} className="field-error">
          {error[0]}
        </span>
      )}
    </div>
  );
}
export function Quantity({
  value,
  onChange,
  max,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  max: number;
  disabled?: boolean;
}) {
  return (
    <div className="quantity" role="group" aria-label="Quantidade">
      <button
        aria-label="Diminuir quantidade"
        disabled={disabled || value <= 1}
        onClick={() => onChange(value - 1)}
      >
        <Minus size={17} />
      </button>
      <output aria-label="Quantidade selecionada">{value}</output>
      <button
        aria-label="Aumentar quantidade"
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus size={17} />
      </button>
    </div>
  );
}
export function Breadcrumb({ current }: { current?: string }) {
  return (
    <nav className="breadcrumb" aria-label="Caminho">
      <Link to="/">Início</Link>
      <span>/</span>
      <Link to="/">Mercado</Link>
      {current && (
        <>
          <span>/</span>
          <span aria-current="page">{current}</span>
        </>
      )}
    </nav>
  );
}
export function MobileTitle({ title }: { title: string }) {
  return (
    <div className="mobile-title">
      <Link to="/" className="circle-button" aria-label="Voltar ao início">
        <ArrowLeft size={19} />
      </Link>
      <h1>{title}</h1>
    </div>
  );
}

export function FavoriteButton({
  nftId,
  compact = false,
}: {
  nftId: string;
  compact?: boolean;
}) {
  const user = useAuth(),
    favorites = useFavorites(),
    notice = useNotice(),
    navigate = useNavigate(),
    location = useLocation();
  const selected = favorites.data?.includes(nftId) ?? false;
  const key = ["favorites", ...sessionKey()];
  const mutation = useMutation({
    mutationFn: (add: boolean) => api.favorite(nftId, add),
    onMutate: async (add) => {
      await queryClient.cancelQueries({ queryKey: key });
      const before = queryClient.getQueryData<string[]>(key) ?? [];
      queryClient.setQueryData(
        key,
        add
          ? [...new Set([...before, nftId])]
          : before.filter((id) => id !== nftId),
      );
      return { before, generation: auth.generation() };
    },
    onError: (error, _value, context) => {
      if (context?.generation === auth.generation())
        queryClient.setQueryData(key, context.before);
      notice(errorMessage(error));
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: key });
    },
  });
  return (
    <Button
      variant="outline"
      size={compact ? "icon" : "default"}
      className={`favorite ${selected ? "selected" : ""}`}
      aria-label={selected ? "Remover dos favoritos" : "Favoritar NFT"}
      aria-pressed={selected}
      disabled={mutation.isPending}
      onClick={() => {
        if (!user) {
          void navigate({ to: "/login", search: { redirect: location.href } });
          return;
        }
        mutation.mutate(!selected);
      }}
    >
      <Heart
        size={compact ? 19 : 21}
        fill={selected ? "currentColor" : "none"}
      />
      {!compact && (selected ? "Favoritado" : "Favoritar")}
    </Button>
  );
}
export function NftCard({
  nft,
  priority = false,
}: {
  nft: Nft;
  priority?: boolean;
}) {
  const notice = useNotice(),
    cart = useCart(),
    [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const result = await api.addItem(
        nft.id,
        "fifty",
        1,
        cart.data?.cart.version,
      );
      queryClient.setQueryData(["cart", ...sessionKey()], result);
      notice(`${nft.name} foi para o carrinho.`);
    } catch (error) {
      notice(errorMessage(error));
      void cart.refetch();
    } finally {
      setBusy(false);
    }
  };
  return (
    <article className="nft-card">
      <div className="nft-card-art">
        <Link
          to="/nfts/$nftId"
          params={{ nftId: nft.id }}
          aria-label={`Ver ${nft.name}`}
        >
          <img
            src={nft.image}
            alt={nft.name}
            width="450"
            height="450"
            loading={priority ? "eager" : "lazy"}
            fetchPriority={priority ? "high" : undefined}
            decoding={priority ? "auto" : "async"}
          />
        </Link>
        {nft.rare && <span className="rarity">Raro</span>}
        <div className="card-actions">
          <Button
            variant="outline"
            size="icon"
            aria-label={`Adicionar ${nft.name} ao carrinho`}
            onClick={() => void add()}
            disabled={busy}
          >
            {busy ? (
              <LoaderCircle className="spinner" size={18} />
            ) : (
              <ShoppingCart size={18} />
            )}
          </Button>
          <FavoriteButton nftId={nft.id} compact />
          <Link
            to="/nfts/$nftId"
            params={{ nftId: nft.id }}
            className="button button-outline button-icon"
            aria-label={`Abrir ${nft.name}`}
          >
            <Search size={18} />
          </Link>
        </div>
      </div>
      <Link
        to="/nfts/$nftId"
        params={{ nftId: nft.id }}
        className="nft-card-name"
      >
        {nft.name}
      </Link>
      <strong>{formatEth(nft.editions[2].priceEth)}</strong>
    </article>
  );
}
export function Related({
  title,
  exclude,
}: {
  title: string;
  exclude?: string;
}) {
  const query = useQuery({
    queryKey: ["catalog", "related"],
    queryFn: ({ signal }) => api.catalog({ page: 1 }, signal),
  });
  return (
    <section className="related">
      <h2>{title}</h2>
      {query.isPending ? (
        <Skeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      ) : (
        <div className="related-grid">
          {query.data.items
            .filter((nft) => nft.id !== exclude)
            .slice(0, 5)
            .map((nft) => (
              <NftCard nft={nft} key={nft.id} />
            ))}
        </div>
      )}
    </section>
  );
}
export function Summary({
  totals,
  coupon,
  children,
}: {
  totals: Totals;
  coupon?: string | null;
  children?: ReactNode;
}) {
  return (
    <div className="summary">
      <dl>
        <div>
          <dt>Subtotal</dt>
          <dd>{formatEth(totals.subtotalEth)}</dd>
        </div>
        <div>
          <dt>{coupon ? `Desconto · ${coupon}` : "Desconto do lançamento"}</dt>
          <dd>− {formatEth(totals.discountEth)}</dd>
        </div>
        <div>
          <dt>Taxa de rede</dt>
          <dd>{formatEth(totals.networkFeeEth)}</dd>
        </div>
      </dl>
      <small className="fee-note">Taxa estimada</small>
      <div className="summary-total">
        <strong>Total</strong>
        <strong>{formatEth(totals.totalEth)}</strong>
      </div>
      {children}
    </div>
  );
}
export function useCartMutation() {
  const notice = useNotice();
  return useMutation({
    mutationFn: (operation: () => Promise<CartView>) => operation(),
    onSuccess: (result) => {
      queryClient.setQueryData(["cart", ...sessionKey()], result);
    },
    onError: (error) => {
      notice(errorMessage(error));
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    },
  });
}
export function Coupon({ view }: { view: CartView }) {
  const [code, setCode] = useState(""),
    mutation = useCartMutation();
  return (
    <div className="coupon">
      <label htmlFor="coupon-code">Código promocional</label>
      {view.cart.couponCode ? (
        <div className="coupon-applied">
          <Check size={16} /> {view.cart.couponCode}
          <button
            onClick={() =>
              mutation.mutate(() => api.removeCoupon(view.cart.version))
            }
            disabled={mutation.isPending}
          >
            Remover
          </button>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate(() => api.coupon(code, view.cart.version));
          }}
        >
          <input
            id="coupon-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Digite o código promocional…"
            autoComplete="off"
          />
          <Button type="submit" disabled={mutation.isPending || !code.trim()}>
            Aplicar
          </Button>
        </form>
      )}
      {mutation.isError && (
        <p role="alert" className="field-error">
          {errorMessage(mutation.error)}
        </p>
      )}
    </div>
  );
}
export function DemoInfo({
  open,
  onClose,
  title = "Nesta demonstração",
  message,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message: string;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!value) onClose();
      }}
      title={title}
      description={message}
    >
      <Button onClick={onClose}>Entendi</Button>
    </Dialog>
  );
}
export function MoreLink({
  to = "/",
  children,
}: {
  to?: string;
  children: ReactNode;
}) {
  return (
    <Link to={to} className="text-link">
      {children}
      <ChevronRight size={16} />
    </Link>
  );
}
