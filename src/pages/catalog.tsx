import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ArrowRight, ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import { toWei } from "../lib/money";
import { api } from "../lib/client";
import type { CatalogParams, CatalogResult } from "../lib/types";
import { categories, networks } from "../lib/catalog-options";
import { Button } from "../components/ui/button";
import { Dialog } from "../components/ui/dialog";
import {
  EmptyState,
  ErrorState,
  NftCard,
  Skeleton,
} from "../components/common";
import { Editorial, FilterIcon, PromoBanners } from "../components/layout";

function Filters({
  params,
  result,
  update,
}: {
  params: CatalogParams;
  result?: CatalogResult;
  update: (next: Partial<CatalogParams>) => void;
}) {
  const [min, setMin] = useState(params.minEth ?? ""),
    [max, setMax] = useState(params.maxEth ?? ""),
    [error, setError] = useState("");
  useEffect(() => {
    setMin(params.minEth ?? "");
    setMax(params.maxEth ?? "");
  }, [params.minEth, params.maxEth]);
  const toggle = (key: "categories" | "networks", value: string) =>
    update({
      [key]: params[key]?.includes(value)
        ? params[key]!.filter((item) => item !== value)
        : [...(params[key] ?? []), value],
    });
  return (
    <div className="filters">
      <fieldset>
        <legend>Coleções</legend>
        {categories.map((category) => (
          <label className="filter-check" key={category}>
            <input
              type="checkbox"
              checked={params.categories?.includes(category) ?? false}
              onChange={() => toggle("categories", category)}
            />
            <span>{category}</span>
            <span>({result?.facets.categories[category] ?? 0})</span>
          </label>
        ))}
      </fieldset>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const valid = (value: string) =>
            !value || /^\d+(\.\d{1,18})?$/.test(value);
          if (
            !valid(min) ||
            !valid(max) ||
            (min && max && toWei(min) > toWei(max))
          ) {
            setError("Confira os preços mínimo e máximo.");
            return;
          }
          setError("");
          update({ minEth: min || undefined, maxEth: max || undefined });
        }}
      >
        <h2>Faixa de preço</h2>
        <div className="price-inputs">
          <label>
            Mín. ETH
            <input
              aria-label="Preço mínimo em ETH"
              value={min}
              inputMode="decimal"
              placeholder="0"
              onChange={(event) => setMin(event.target.value)}
            />
          </label>
          <span>–</span>
          <label>
            Máx. ETH
            <input
              aria-label="Preço máximo em ETH"
              value={max}
              inputMode="decimal"
              placeholder="12,30"
              onChange={(event) => setMax(event.target.value)}
            />
          </label>
        </div>
        {error && (
          <p role="alert" className="field-error">
            {error}
          </p>
        )}
        <Button type="submit" size="sm">
          Aplicar
        </Button>
      </form>
      <fieldset>
        <legend>Rede</legend>
        {Object.entries(networks).map(([id, label]) => (
          <label className="filter-check" key={id}>
            <input
              type="checkbox"
              checked={params.networks?.includes(id) ?? false}
              onChange={() => toggle("networks", id)}
            />
            <span>{label}</span>
            <span>({result?.facets.networks[id] ?? 0})</span>
          </label>
        ))}
      </fieldset>
    </div>
  );
}

export function CatalogPage() {
  const params = useSearch({ strict: false }) as CatalogParams,
    navigate = useNavigate(),
    [filterOpen, setFilterOpen] = useState(false),
    [search, setSearch] = useState(params.q ?? "");
  useEffect(() => {
    setSearch(params.q ?? "");
  }, [params.q]);
  const update = (next: Partial<CatalogParams>) => {
    void navigate({
      to: "/",
      search: { ...params, ...next, page: next.page ?? 1 },
      resetScroll: false,
    });
  };
  const query = useQuery({
    queryKey: ["catalog", params],
    queryFn: ({ signal }) => api.catalog(params, signal),
  });
  const hasFilters = !!(
    params.q ||
    params.categories?.length ||
    params.networks?.length ||
    params.minEth ||
    params.maxEth
  );
  return (
    <>
      <section className="hero container">
        <div className="hero-copy">
          <p className="eyebrow">Bem-vindo à Kurio</p>
          <h1>
            <span className="hero-title-mobile">
              SEJA DONO DA
              <br />
              CULTURA DIGITAL
            </span>
            <span className="hero-title-desktop">
              SEJA DONO DO FUTURO
              <br />
              DA ARTE DIGITAL
            </span>
          </h1>
          <p className="hero-description-desktop">
            Descubra NFTs selecionados de criadores emergentes e consagrados.
            Colecione arte digital rara, apoie artistas e tenha uma parte da
            cultura da internet.
          </p>
          <p className="hero-description-mobile">
            Descubra NFTs selecionados de criadores do mundo todo.
          </p>
          <a href="#catalog" className="button button-primary">
            EXPLORAR
          </a>
          <div className="hero-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
        </div>
        <img
          className="hero-art"
          src="/assets/emerald.webp"
          width="450"
          height="450"
          fetchPriority="high"
          alt="Emerald Ape, macaco de jaqueta verde e óculos"
        />
        <img
          className="hero-secondary-art"
          src="/assets/violet-thumb.webp"
          width="128"
          height="128"
          alt=""
        />
      </section>
      <section id="catalog" className="catalog container">
        <aside className="catalog-sidebar">
          <Filters params={params} result={query.data} update={update} />
          <Link
            to="/nfts/$nftId"
            params={{ nftId: "violet-0314" }}
            className="featured"
          >
            <h2>NFT EM DESTAQUE</h2>
            <h3>OFERTA LIMITADA</h3>
            <img
              src="/assets/violet.webp"
              alt="Violet Nomad"
              width="250"
              height="250"
              loading="lazy"
            />
          </Link>
        </aside>
        <div className="catalog-content">
          <span className="background-status sr-only" role="status">
            {query.isFetching && !query.isPending
              ? "Atualizando resultados…"
              : ""}
          </span>
          <div className="catalog-toolbar">
            <div
              className="catalog-tabs"
              role="group"
              aria-label="Seleção do catálogo"
            >
              {[
                ["all", "Todos os NFTs"],
                ["new", "Novos lançamentos"],
                ["trending", "Em alta"],
              ].map(([value, label]) => (
                <button
                  className={(params.tab ?? "all") === value ? "active" : ""}
                  aria-pressed={(params.tab ?? "all") === value}
                  key={value}
                  onClick={() => update({ tab: value })}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="catalog-sort">
              Ordenar por:
              <select
                aria-label="Ordenar NFTs"
                value={params.sort ?? "recent"}
                onChange={(event) => update({ sort: event.target.value })}
              >
                <option value="recent">Listados recentemente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="popular">Mais populares</option>
              </select>
            </label>
          </div>
          <div className="catalog-search">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                update({ q: search.trim() || undefined });
              }}
            >
              <Search size={18} />
              <input
                aria-label="Buscar nome, coleção ou atributo"
                placeholder="Buscar NFTs"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button type="submit" variant="ghost" size="sm">
                Buscar
              </Button>
            </form>
            <Button
              className="mobile-filter-trigger"
              variant="outline"
              onClick={() => setFilterOpen(true)}
            >
              <FilterIcon />
              Filtros
            </Button>
          </div>
          {hasFilters && (
            <div className="active-filters">
              <span>{query.data?.total ?? "…"} resultados</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  void navigate({
                    to: "/",
                    search: { tab: params.tab, sort: params.sort, page: 1 },
                    resetScroll: false,
                  })
                }
              >
                Limpar filtros <X size={15} />
              </Button>
            </div>
          )}
          {query.isPending ? (
            <Skeleton />
          ) : query.isError ? (
            <ErrorState
              error={query.error}
              retry={() => void query.refetch()}
            />
          ) : query.data.items.length ? (
            <>
              <div className="nft-grid" aria-busy={query.isFetching}>
                {query.data.items.map((nft, index) => (
                  <NftCard key={nft.id} nft={nft} priority={index < 3} />
                ))}
              </div>
              <nav className="pagination" aria-label="Páginas do catálogo">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Página anterior"
                  disabled={query.data.page <= 1}
                  onClick={() => update({ page: query.data!.page - 1 })}
                >
                  <ChevronLeft size={18} />
                </Button>
                {Array.from(
                  { length: query.data.totalPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <Button
                    variant={page === query.data.page ? "primary" : "outline"}
                    size="icon"
                    aria-current={page === query.data.page ? "page" : undefined}
                    key={page}
                    onClick={() => update({ page })}
                  >
                    {page}
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Próxima página"
                  disabled={query.data.page >= query.data.totalPages}
                  onClick={() => update({ page: query.data!.page + 1 })}
                >
                  <ChevronRight size={18} />
                </Button>
              </nav>
            </>
          ) : (
            <EmptyState title="Nenhum NFT encontrado">
              <p>Tente outro termo ou ajuste os filtros.</p>
              <Button
                variant="outline"
                onClick={() => void navigate({ to: "/", search: { page: 1 } })}
              >
                Ver todos os NFTs <ArrowRight size={16} />
              </Button>
            </EmptyState>
          )}
        </div>
      </section>
      <PromoBanners />
      <Editorial />
      <Dialog
        open={filterOpen}
        onOpenChange={setFilterOpen}
        title="Filtrar NFTs"
      >
        <Filters params={params} result={query.data} update={update} />
        <Button onClick={() => setFilterOpen(false)}>Ver resultados</Button>
      </Dialog>
    </>
  );
}
