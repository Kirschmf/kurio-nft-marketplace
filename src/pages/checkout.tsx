import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  Check,
  CircleCheck,
  Clock3,
  Copy,
  Download,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import axios from "axios";
import {
  api,
  auth,
  errorMessage,
  errorsFrom,
  queryClient,
  sessionKey,
} from "../lib/client";
import type {
  ApiErrorBody,
  Collector,
  Order,
  Provider,
  PurchaseAttempt,
  Quote,
} from "../lib/types";
import { collectorSchema, fieldErrors } from "../lib/validation";
import { useFormErrors } from "../lib/use-form-errors";
import { formatEth } from "../lib/money";
import {
  Breadcrumb,
  Busy,
  Coupon,
  DemoInfo,
  EmptyState,
  ErrorState,
  Field,
  MobileTitle,
  Skeleton,
  Summary,
  useAuth,
  useCart,
  useNotice,
} from "../components/common";
import { Button } from "../components/ui/button";

const attemptKey = (userId: string) => `kurio-attempt:${userId}`;
function readAttempt(userId: string): PurchaseAttempt | null {
  try {
    const value = JSON.parse(
      sessionStorage.getItem(attemptKey(userId)) ?? "null",
    ) as PurchaseAttempt | null;
    return value?.userId === userId ? value : null;
  } catch {
    return null;
  }
}
export function CheckoutPage() {
  const user = useAuth(),
    cart = useCart(),
    wallets = useQuery({
      queryKey: ["wallets", ...sessionKey()],
      queryFn: ({ signal }) => api.wallets(signal),
      staleTime: 0,
    }),
    navigate = useNavigate(),
    notice = useNotice(),
    userId = user?.user.id ?? "";
  const profile = user?.user.profile,
    draftKey = `kurio-checkout:${userId}`;
  const [collector, setCollector] = useState<Collector>(() => {
    try {
      const draft = JSON.parse(
        sessionStorage.getItem(draftKey) ?? "null",
      ) as Collector | null;
      if (draft) return draft;
    } catch {
      /* An interrupted draft can be discarded without affecting the cart. */
    }
    return {
      displayName: profile?.displayName ?? "",
      username: profile?.username ?? "",
      email: profile?.email ?? "",
      ensName: profile?.ensName ?? "",
      profileName: profile?.username ?? "",
      referralCode: "KURIO",
      secondaryIdentifier: "",
      collectorNote: "",
    };
  });
  const [walletId, setWalletId] = useState(""),
    [provider, setProvider] = useState<Provider>("walletconnect"),
    [connected, setConnected] = useState(false),
    [quote, setQuote] = useState<Quote | null>(null),
    [attempt, setAttempt] = useState<PurchaseAttempt | null>(() =>
      readAttempt(userId),
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [errors, setErrors] = useState<Record<string, string[]>>({}),
    lock = useRef(false),
    [step, setStep] = useState(readAttempt(userId) ? 3 : 1);
  useFormErrors(errors);
  const selectedWallet = wallets.data?.find((wallet) => wallet.id === walletId);
  useEffect(() => {
    sessionStorage.setItem(draftKey, JSON.stringify(collector));
  }, [collector, draftKey]);
  useEffect(() => {
    if (!walletId && wallets.data?.[0]) {
      setWalletId(wallets.data[0].id);
      setProvider(wallets.data[0].provider);
    }
  }, [wallets.data, walletId]);
  useEffect(() => {
    if (attempt?.orderId)
      void navigate({
        to: "/orders/$orderId",
        params: { orderId: attempt.orderId },
      });
  }, [attempt?.orderId, navigate]);
  useEffect(() => {
    if (!quote || !cart.data || attempt) return;
    const changed =
      quote.cartVersion !== cart.data.cart.version ||
      quote.networkFeeEth !== cart.data.summary.networkFeeEth ||
      quote.couponCode !== cart.data.cart.couponCode ||
      quote.lines.some((line) => {
        const current = cart.data.lines.find(
          (item) => item.lineId === line.lineId,
        );
        return (
          !current ||
          current.resourceVersion !== line.resourceVersion ||
          current.quantity !== line.quantity
        );
      });
    if (changed) {
      setQuote(null);
      setStep(2);
      setError(
        "Preço, disponibilidade ou carrinho mudou. Revise os valores novamente antes de confirmar.",
      );
    }
  }, [cart.data, quote, attempt]);
  const update = (key: keyof Collector, value: string) => {
    setCollector((current) => ({ ...current, [key]: value }));
    setQuote(null);
  };
  const connect = async () => {
    setBusy(true);
    setError("");
    try {
      await api.connectWallet(walletId, provider);
      setConnected(true);
      notice("Carteira conectada na simulação.");
    } catch (error) {
      setConnected(false);
      setError(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  const review = async () => {
    const parsed = collectorSchema.safeParse(collector);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      setError("Confira os campos do perfil do colecionador.");
      return;
    }
    if (!cart.data || !walletId || !connected) {
      setError("Selecione e conecte uma carteira para continuar.");
      return;
    }
    setBusy(true);
    setErrors({});
    setError("");
    try {
      const fresh = await api.cart();
      queryClient.setQueryData(["cart", ...sessionKey()], fresh);
      const next = await api.quote(fresh.cart.version, walletId, parsed.data);
      setQuote(next);
      setStep(3);
      document.getElementById("quote-review")?.focus();
    } catch (error) {
      setError(errorMessage(error));
      setErrors(errorsFrom(error));
      void cart.refetch();
    } finally {
      setBusy(false);
    }
  };
  const confirm = async () => {
    if (lock.current || (!quote && !attempt)) return;
    lock.current = true;
    setBusy(true);
    setError("");
    const next = attempt ?? {
      key: crypto.randomUUID(),
      quoteId: quote!.id,
      walletId,
      collector: quote!.collector,
      userId,
    };
    setAttempt(next);
    sessionStorage.setItem(attemptKey(userId), JSON.stringify(next));
    const generation = auth.generation();
    try {
      const order = await api.order(
        next.quoteId,
        next.walletId,
        next.collector,
        next.key,
      );
      if (generation !== auth.generation()) return;
      const saved = { ...next, orderId: order.id };
      sessionStorage.setItem(attemptKey(userId), JSON.stringify(saved));
      setAttempt(saved);
      queryClient.setQueryData(["order", order.id, ...sessionKey()], order);
      await navigate({ to: "/orders/$orderId", params: { orderId: order.id } });
    } catch (error) {
      if (generation !== auth.generation()) return;
      const response = axios.isAxiosError<ApiErrorBody>(error)
        ? error.response
        : undefined;
      const existing = response?.data.error.details as
        { orderId?: string } | undefined;
      if (response?.data.error.code === "ORDER_PENDING" && existing?.orderId) {
        const saved = { ...next, orderId: existing.orderId };
        sessionStorage.setItem(attemptKey(userId), JSON.stringify(saved));
        await navigate({
          to: "/orders/$orderId",
          params: { orderId: existing.orderId },
        });
        return;
      }
      if (response && response.status < 500 && response.status !== 401) {
        sessionStorage.removeItem(attemptKey(userId));
        setAttempt(null);
        setQuote(null);
        setStep(2);
        void cart.refetch();
      }
      setError(
        response
          ? errorMessage(error)
          : "A resposta foi interrompida. Recupere esta mesma tentativa para verificar o pedido sem duplicá-lo.",
      );
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  if (!user) return null;
  if (cart.isPending || wallets.isPending)
    return (
      <div className="container page">
        <Skeleton type="summary" />
      </div>
    );
  if (cart.isError || wallets.isError)
    return (
      <div className="container page">
        <ErrorState
          error={cart.error ?? wallets.error}
          retry={() => {
            void cart.refetch();
            void wallets.refetch();
          }}
        />
      </div>
    );
  if (!cart.data.lines.length && !attempt)
    return (
      <div className="container page">
        <EmptyState title="Seu carrinho está vazio">
          <Link to="/" className="button button-primary">
            Explorar NFTs
          </Link>
        </EmptyState>
      </div>
    );
  const field = (key: keyof Collector, label: string, required = true) => (
    <Field
      key={key}
      label={label}
      required={required}
      value={collector[key]}
      error={errors[key]}
      disabled={busy || !!attempt}
      onChange={(event) => update(key, event.target.value)}
      type={key === "email" ? "email" : "text"}
    />
  );
  return (
    <div className={`container page checkout-page checkout-step-${step}`}>
      <MobileTitle title="Pagamento" />
      <Breadcrumb current="Pagamento" />
      <nav className="checkout-steps" aria-label="Etapas do pagamento">
        {["Dados", "Carteira e rede", "Revisão"].map((label, index) => (
          <button
            key={label}
            aria-current={step === index + 1 ? "step" : undefined}
            disabled={busy || !!attempt || (index === 2 && !quote)}
            onClick={() => setStep(index + 1)}
          >
            {index + 1}. {label}
          </button>
        ))}
      </nav>
      <div className="purchase-layout checkout-layout">
        <section>
          <h1>Perfil do colecionador</h1>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void review();
            }}
            noValidate
          >
            <div className="form-grid">
              {field("displayName", "Nome de exibição")}
              {field("username", "Nome de usuário")}
              <label className="field">
                <span>
                  Carteira e rede{" "}
                  <span className="required" aria-hidden="true">
                    *
                  </span>
                </span>
                <select
                  aria-label="Carteira e rede"
                  value={walletId}
                  disabled={busy || !!attempt}
                  onChange={(event) => {
                    const value = wallets.data.find(
                      (wallet) => wallet.id === event.target.value,
                    );
                    setWalletId(event.target.value);
                    if (value) setProvider(value.provider);
                    setConnected(false);
                    setQuote(null);
                  }}
                >
                  <option value="" disabled>
                    Selecione uma carteira
                  </option>
                  {wallets.data.map((wallet) => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.role === "primary" ? "Principal" : "Secundária"} ·{" "}
                      {wallet.network} · {wallet.nickname}
                    </option>
                  ))}
                </select>
              </label>
              {field("profileName", "Nome do perfil")}
              <Field
                label="Endereço da carteira"
                value={selectedWallet?.address ?? ""}
                readOnly
                hint="Dados da carteira selecionada."
              />
              {field(
                "secondaryIdentifier",
                "ENS ou carteira secundária (opcional)",
                false,
              )}
              <Field
                label="Rede"
                value={selectedWallet?.network ?? ""}
                readOnly
              />
              {field("referralCode", "Código de indicação")}
              {field("email", "E-mail")}
              {field("ensName", "Nome ENS")}
            </div>
            <Link to="/account/wallets" className="text-link">
              Usar ou cadastrar outra carteira →
            </Link>
            <label className="field collector-note">
              Observação do colecionador (opcional)
              <textarea
                value={collector.collectorNote}
                maxLength={1000}
                disabled={busy || !!attempt}
                onChange={(event) =>
                  update("collectorNote", event.target.value)
                }
              />
            </label>
            <Button
              className="mobile-next-step"
              type="button"
              onClick={() => {
                const parsed = collectorSchema.safeParse(collector);
                if (!parsed.success) {
                  setErrors(fieldErrors(parsed.error));
                  return;
                }
                setErrors({});
                setStep(2);
                window.scrollTo({ top: 0 });
              }}
            >
              Continuar para carteira
            </Button>
          </form>
        </section>
        <aside className="checkout-summary">
          <h2>Seus NFTs</h2>
          <div className="mini-lines">
            {(quote?.lines ?? cart.data.lines).map((line) => (
              <div className="mini-line" key={line.lineId}>
                <img src={line.image} width="72" height="72" alt={line.name} />
                <div>
                  <strong>{line.name}</strong>
                  <small>
                    Edição {line.editionLabel} · #{line.tokenId} (×{" "}
                    {line.quantity})
                  </small>
                </div>
                <strong>{formatEth(line.lineTotalEth)}</strong>
              </div>
            ))}
          </div>
          {!attempt && <Coupon view={cart.data} />}
          <Summary
            totals={quote ?? cart.data.summary}
            coupon={quote?.couponCode ?? cart.data.cart.couponCode}
          />
          <fieldset className="provider-picker" disabled={busy || !!attempt}>
            <legend>Carteira e rede</legend>
            {(
              [
                ["walletconnect", "WalletConnect"],
                ["metamask", "MetaMask"],
                ["coinbase", "Coinbase Wallet"],
              ] as const
            ).map(([value, label]) => (
              <label
                key={value}
                className={provider === value ? "selected" : ""}
              >
                <input
                  type="radio"
                  name="provider"
                  value={value}
                  checked={provider === value}
                  onChange={() => {
                    setProvider(value);
                    setConnected(false);
                    setQuote(null);
                  }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          {!attempt && (
            <Button
              variant="outline"
              disabled={busy || !walletId}
              onClick={() => void connect()}
            >
              {connected ? (
                <>
                  <Check size={17} />
                  Carteira conectada
                </>
              ) : (
                "Conectar carteira"
              )}
            </Button>
          )}
          {quote && !attempt && (
            <section className="quote-review" id="quote-review" tabIndex={-1}>
              <h2>Revise e confirme</h2>
              <p>
                Total da cotação: <strong>{formatEth(quote.totalEth)}</strong>
              </p>
              <p>
                {quote.lines.reduce((sum, line) => sum + line.quantity, 0)} NFTs
                · {quote.wallet.network} · {quote.wallet.nickname}
              </p>
              <small>
                A cotação vale por 60 segundos. Uma alteração exige nova
                revisão.
              </small>
            </section>
          )}
          {error && (
            <p role="alert" className="field-error checkout-error">
              {error}
            </p>
          )}
          {attempt ? (
            <div className="recovery-box">
              <p>
                Existe uma tentativa de compra salva. Recupere o resultado antes
                de iniciar outra.
              </p>
              <Button disabled={busy} onClick={() => void confirm()}>
                {busy ? (
                  <Busy label="Recuperando pedido" />
                ) : (
                  "Recuperar tentativa de compra"
                )}
              </Button>
            </div>
          ) : quote ? (
            <Button
              key="confirm"
              disabled={busy}
              onClick={() => void confirm()}
            >
              {busy ? <Busy label="Confirmando" /> : "Confirmar compra"}
            </Button>
          ) : (
            <Button
              key="review"
              disabled={busy || !connected}
              onClick={() => void review()}
            >
              {busy ? <Busy label="Revalidando" /> : "Revisar compra"}
            </Button>
          )}
          <p className="secure-note">
            <ShieldCheck size={16} />
            Simulação. Nenhuma cobrança ou assinatura real.
          </p>
        </aside>
      </div>
    </div>
  );
}

export function OrderPage() {
  const { orderId } = useParams({ strict: false }) as { orderId: string },
    user = useAuth(),
    query = useQuery({
      queryKey: ["order", orderId, ...sessionKey()],
      queryFn: ({ signal }) => api.getOrder(orderId, signal),
      refetchInterval: (query) =>
        query.state.data?.status === "pending" ? 1500 : false,
      staleTime: 0,
    }),
    notice = useNotice(),
    [downloading, setDownloading] = useState(false),
    [explorer, setExplorer] = useState(false);
  useEffect(() => {
    if (query.data && query.data.status !== "pending" && user) {
      const saved = readAttempt(user.user.id);
      if (saved?.orderId === query.data.id)
        sessionStorage.removeItem(attemptKey(user.user.id));
      if (query.data.status === "confirmed")
        sessionStorage.removeItem(`kurio-checkout:${user.user.id}`);
      void queryClient.invalidateQueries({ queryKey: ["cart"] });
    }
  }, [query.data?.status, query.data?.id, user]);
  if (query.isPending)
    return (
      <div className="container page">
        <Skeleton type="summary" />
      </div>
    );
  if (query.isError)
    return (
      <div className="container page">
        <ErrorState error={query.error} retry={() => void query.refetch()} />
      </div>
    );
  const order = query.data,
    confirmed = order.status === "confirmed",
    pending = order.status === "pending";
  const download = async () => {
    setDownloading(true);
    try {
      const receipt: Order = await api.receipt(order.id);
      const blob = new Blob([JSON.stringify(receipt, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        link = document.createElement("a");
      link.href = url;
      link.download = `kurio-${order.id}.json`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      notice(errorMessage(error));
    } finally {
      setDownloading(false);
    }
  };
  return (
    <div className="container page order-page">
      <div className={`order-state order-${order.status}`} role="status">
        {pending ? (
          <Clock3 size={54} />
        ) : confirmed ? (
          <CircleCheck size={54} />
        ) : (
          <XCircle size={54} />
        )}
        <h1>
          {pending
            ? "Compra em processamento"
            : confirmed
              ? "Compra confirmada!"
              : "Pagamento recusado"}
        </h1>
        <p>
          {pending
            ? "Aguardando a confirmação da simulação. Você pode recarregar esta página com segurança."
            : confirmed
              ? "Seus NFTs já fazem parte da sua coleção."
              : "Não foi possível concluir esta compra. Seus itens continuam no carrinho."}
        </p>
        <small>Pedido {order.id}</small>
      </div>
      <section className="receipt">
        <h2>{confirmed ? "Resumo da compra" : "Resumo do pedido"}</h2>
        <div className="mini-lines">
          {order.quote.lines.map((line) => (
            <div className="mini-line" key={line.lineId}>
              <img src={line.image} width="72" height="72" alt={line.name} />
              <div>
                <strong>{line.name}</strong>
                <small>
                  Edição {line.editionLabel} · #{line.tokenId} (×{" "}
                  {line.quantity})
                </small>
              </div>
              <strong>{formatEth(line.lineTotalEth)}</strong>
            </div>
          ))}
        </div>
        <Summary totals={order.quote} coupon={order.quote.couponCode} />
        <dl className="receipt-details">
          <div>
            <dt>Carteira</dt>
            <dd>{order.quote.wallet.address}</dd>
          </div>
          <div>
            <dt>Rede</dt>
            <dd>{order.quote.wallet.network}</dd>
          </div>
          <div>
            <dt>Provedor conectado</dt>
            <dd>{order.quote.wallet.provider}</dd>
          </div>
          <div>
            <dt>Colecionador</dt>
            <dd>{order.quote.collector.displayName}</dd>
          </div>
          <div>
            <dt>E-mail</dt>
            <dd>{order.quote.collector.email}</dd>
          </div>
          {order.transactionRef && (
            <div>
              <dt>Transação simulada</dt>
              <dd>
                {order.transactionRef}
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Copiar transação"
                  onClick={() => {
                    void navigator.clipboard
                      .writeText(order.transactionRef!)
                      .then(() => notice("Referência copiada."))
                      .catch(() =>
                        notice(
                          "Não foi possível copiar. Selecione o texto da referência.",
                        ),
                      );
                  }}
                >
                  <Copy size={16} />
                </Button>
              </dd>
            </div>
          )}
        </dl>
        <div className="receipt-actions">
          {confirmed && (
            <Button variant="outline" onClick={() => setExplorer(true)}>
              Ver transação simulada
            </Button>
          )}
          {confirmed && (
            <Button
              variant="outline"
              disabled={downloading}
              onClick={() => void download()}
            >
              <Download size={17} />
              Baixar comprovante
            </Button>
          )}
          {!pending && (
            <Link
              to={confirmed ? "/" : "/cart"}
              className="button button-primary"
            >
              {confirmed ? "Continuar explorando" : "Voltar ao carrinho"}
            </Link>
          )}
          {pending && (
            <Button variant="outline" onClick={() => void query.refetch()}>
              Verificar status
            </Button>
          )}
        </div>
      </section>
      <DemoInfo
        open={explorer}
        onClose={() => setExplorer(false)}
        title="Referência simulada"
        message="Esta transação pertence à demonstração e não existe em um explorador de blockchain. Nenhum ativo real foi transferido."
      />
    </div>
  );
}
