import { useEffect, useState } from "react";
import { markPublicPageReady } from "../lib/network-ready";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { Check, ChevronDown, ShoppingCart } from "lucide-react";
import {
  api,
  auth,
  errorMessage,
  isCanceled,
  queryClient,
  sessionKey,
} from "../lib/client";
import { formatEth } from "../lib/money";
import {
  Breadcrumb,
  ErrorState,
  FavoriteButton,
  DemoInfo,
  MobileTitle,
  Quantity,
  Related,
  Skeleton,
  useCart,
  useNotice,
} from "../components/common";
import { Button } from "../components/ui/button";

export function DetailPage() {
  useEffect(markPublicPageReady, []);
  const { nftId } = useParams({ strict: false }) as { nftId: string },
    query = useQuery({
      queryKey: ["nft", nftId],
      queryFn: ({ signal }) => api.nft(nftId, signal),
    }),
    [editionId, setEditionId] = useState("fifty"),
    [quantity, setQuantity] = useState(1),
    cart = useCart(),
    notice = useNotice(),
    navigate = useNavigate(),
    [thumb, setThumb] = useState(0),
    [tab, setTab] = useState("description"),
    [info, setInfo] = useState("");
  const add = useMutation({
    onMutate: () => auth.generation(),
    mutationFn: ({
      editionId,
      quantity,
    }: {
      editionId: string;
      quantity: number;
      checkout: boolean;
    }) => api.addItem(nftId, editionId, quantity, cart.data?.cart.version),
    onSuccess: (view, input, started) => {
      if (started !== auth.generation()) return;
      queryClient.setQueryData(["cart", ...sessionKey()], view);
      if (input.checkout) void navigate({ to: "/checkout" });
      else notice(`${query.data?.name} foi para o carrinho.`);
    },
    onError: (error, _input, started) => {
      if (started !== auth.generation() || isCanceled(error)) return;
      notice(errorMessage(error));
      void query.refetch();
      void cart.refetch();
    },
  });
  const busy = add.isPending;
  if (query.isPending)
    return (
      <div className="detail-page">
        <div className="container">
          <MobileTitle title="Detalhes" />
          <Breadcrumb current="Detalhes" />
          <Skeleton type="detail" />
        </div>
      </div>
    );
  if (query.isError)
    return (
      <div className="container page">
        <ErrorState error={query.error} retry={() => void query.refetch()} />
        <Link to="/">Voltar ao mercado</Link>
      </div>
    );
  const nft = query.data,
    edition =
      nft.editions.find((item) => item.id === editionId) ?? nft.editions[2],
    available = Math.max(0, edition.stock - edition.reserved),
    safeQuantity = Math.min(quantity, Math.max(1, available));
  return (
    <div className="detail-page">
      <div className="container">
        <MobileTitle title="Detalhes" />
        <Breadcrumb current={nft.name} />
        <section className="detail-grid">
          <div className="gallery">
            <div className="detail-art">
              <img
                src={nft.image}
                srcSet={`${nft.image} 450w, ${nft.image.replace(".webp", "-900.webp")} 900w`}
                sizes="(max-width: 600px) calc(100vw - 56px), (max-width: 900px) 40vw, 404px"
                width="450"
                height="450"
                alt={`${nft.name}${thumb ? " — visualização ampliada" : ""}`}
                style={
                  thumb
                    ? {
                        objectPosition: `${40 + thumb * 5}% center`,
                        transform: `scale(${1 + thumb * 0.025})`,
                      }
                    : undefined
                }
                fetchPriority="high"
              />
              <span className="rarity">{nft.rare ? "Raro" : "Coleção"}</span>
            </div>
            <div className="gallery-thumbs" aria-label="Visualizações da obra">
              {[0, 1, 2, 3].map((index) => (
                <button
                  aria-label={`Visualização ${index + 1}`}
                  aria-pressed={thumb === index}
                  key={index}
                  onClick={() => setThumb(index)}
                >
                  <img
                    src={nft.image.replace(".webp", "-thumb.webp")}
                    width="128"
                    height="128"
                    alt=""
                  />
                </button>
              ))}
            </div>
          </div>
          <div className="detail-info">
            <span className="eyebrow">KURIO EXCLUSIVE</span>
            <h1>{nft.name}</h1>
            <p className="collection">
              {nft.collection}{" "}
              <Check size={16} aria-label="Coleção verificada" />
            </p>
            <h2 className="detail-about">Sobre este NFT:</h2>
            <p className="detail-description">{nft.description}</p>
            <dl className="metadata">
              <div>
                <dt>ID do token</dt>
                <dd>
                  #{nft.tokenId} · {nft.network}
                </dd>
              </div>
              <div>
                <dt>Coleção</dt>
                <dd>{nft.collection}</dd>
              </div>
              <div>
                <dt>Atributos</dt>
                <dd>{nft.attributes.join(", ")}</dd>
              </div>
            </dl>
            <div className="edition-picker">
              <h2>Edição:</h2>
              <div>
                {nft.editions.map((item) => (
                  <button
                    key={item.id}
                    className={edition.id === item.id ? "selected" : ""}
                    aria-pressed={edition.id === item.id}
                    disabled={item.stock - item.reserved <= 0}
                    onClick={() => {
                      setEditionId(item.id);
                      setQuantity(1);
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
            <strong className="detail-price">
              {formatEth(edition.priceEth)}
            </strong>
            <p
              className={`stock-note ${available ? "sr-only" : ""}`}
              role="status"
            >
              {available
                ? `${available} ${available === 1 ? "unidade disponível" : "unidades disponíveis"}`
                : "Edição esgotada"}
            </p>
            <div className="detail-quantity">
              <span>Quantidade</span>
              <Quantity
                value={safeQuantity}
                onChange={setQuantity}
                max={available}
                disabled={!available || busy}
              />
            </div>
            <div className="detail-buttons">
              <Button
                disabled={!available || busy}
                onClick={() =>
                  add.mutate({
                    editionId: edition.id,
                    quantity: safeQuantity,
                    checkout: true,
                  })
                }
              >
                Comprar agora
              </Button>
              <Button
                variant="outline"
                disabled={!available || busy}
                onClick={() =>
                  add.mutate({
                    editionId: edition.id,
                    quantity: safeQuantity,
                    checkout: false,
                  })
                }
              >
                <ShoppingCart size={18} />
                <span className="add-cart-label">Adicionar ao carrinho</span>
              </Button>
              <FavoriteButton nftId={nft.id} compact />
            </div>
            <details>
              <summary>
                Detalhes da coleção <ChevronDown size={16} />
              </summary>
              <p>
                Uma seleção de retratos digitais com quatro opções de edição. A
                disponibilidade é atualizada durante a navegação. Nesta
                demonstração, nenhum ativo real é transferido.
              </p>
            </details>
          </div>
        </section>
        <section className="detail-tabs">
          <div role="tablist" aria-label="Sobre o NFT">
            {[
              ["description", "Descrição"],
              ["attributes", "Atributos"],
              ["reviews", "Avaliações"],
            ].map(([value, label]) => (
              <button
                key={value}
                id={`tab-${value}`}
                role="tab"
                aria-selected={tab === value}
                tabIndex={tab === value ? 0 : -1}
                onKeyDown={(event) => {
                  const values = ["description", "attributes", "reviews"];
                  const index = values.indexOf(value);
                  const next =
                    event.key === "ArrowRight"
                      ? (index + 1) % 3
                      : event.key === "ArrowLeft"
                        ? (index + 2) % 3
                        : event.key === "Home"
                          ? 0
                          : event.key === "End"
                            ? 2
                            : -1;
                  if (next >= 0) {
                    event.preventDefault();
                    setTab(values[next]);
                    document.getElementById(`tab-${values[next]}`)?.focus();
                  }
                }}
                aria-controls={`panel-${value}`}
                onClick={() => setTab(value)}
              >
                {label}
              </button>
            ))}
          </div>
          <div
            role="tabpanel"
            id={`panel-${tab}`}
            aria-labelledby={`tab-${tab}`}
            tabIndex={0}
          >
            {tab === "description" ? (
              <p>{nft.description}</p>
            ) : tab === "attributes" ? (
              <dl className="metadata">
                {nft.attributes.map((attribute, index) => (
                  <div key={attribute}>
                    <dt>Atributo {index + 1}</dt>
                    <dd>{attribute}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>Ainda não há avaliações nesta demonstração.</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              void navigator.clipboard
                .writeText(window.location.href)
                .then(() => notice("Link do NFT copiado."))
                .catch(() =>
                  setInfo(
                    "Copie o endereço desta página para compartilhar o NFT.",
                  ),
                );
            }}
          >
            Compartilhar NFT
          </Button>
          <DemoInfo open={!!info} onClose={() => setInfo("")} message={info} />
        </section>
        <Related title="Você também pode gostar" exclude={nft.id} />
      </div>
    </div>
  );
}
