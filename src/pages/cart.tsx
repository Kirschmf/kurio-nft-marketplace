import { Link } from "@tanstack/react-router";
import { Trash2, ShoppingCart, ShieldCheck } from "lucide-react";
import { api } from "../lib/client";
import { formatEth } from "../lib/money";
import {
  Breadcrumb,
  Coupon,
  EmptyState,
  ErrorState,
  MobileTitle,
  Quantity,
  Related,
  Skeleton,
  Summary,
  useCart,
  useCartMutation,
} from "../components/common";
import { Button } from "../components/ui/button";

export function CartPage() {
  const query = useCart(),
    mutation = useCartMutation();
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
  const view = query.data,
    invalid = view.lines.some((line) => line.available < line.quantity);
  return (
    <div className="container page cart-page">
      <MobileTitle title="Carrinho" />
      <Breadcrumb current="Carrinho" />
      <h1 className="desktop-page-title">Carrinho</h1>
      {!view.lines.length ? (
        <EmptyState title="Seu carrinho está vazio">
          <ShoppingCart size={40} />
          <p>Escolha uma obra para começar sua coleção.</p>
          <Link to="/" className="button button-primary">
            Explorar NFTs
          </Link>
        </EmptyState>
      ) : (
        <div className="purchase-layout">
          <section className="cart-items" aria-label="Itens do carrinho">
            <div className="cart-table-heading">
              <span>Produto</span>
              <span>Quantidade</span>
              <span>Subtotal</span>
            </div>
            {view.lines.map((line) => (
              <article className="cart-row" key={line.lineId}>
                <Link to="/nfts/$nftId" params={{ nftId: line.nftId }}>
                  <img
                    src={line.image}
                    width="128"
                    height="128"
                    alt={line.name}
                  />
                </Link>
                <div className="cart-product">
                  <Link to="/nfts/$nftId" params={{ nftId: line.nftId }}>
                    {line.name}
                  </Link>
                  <small>
                    Edição {line.editionLabel} · Token #{line.tokenId}
                  </small>
                  <span>{formatEth(line.unitPriceEth)}</span>
                  {line.quantity > line.available && (
                    <p className="field-error" role="alert">
                      {line.available
                        ? `Restam ${line.available} unidades. Ajuste a quantidade.`
                        : "Edição esgotada. Remova este item."}
                    </p>
                  )}
                </div>
                <Quantity
                  value={line.quantity}
                  max={line.available}
                  disabled={mutation.isPending}
                  onChange={(quantity) =>
                    mutation.mutate(() =>
                      api.updateItem(line.lineId, quantity, view.cart.version),
                    )
                  }
                />
                <strong className="cart-line-total">
                  {formatEth(line.lineTotalEth)}
                </strong>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remover ${line.name}`}
                  disabled={mutation.isPending}
                  onClick={() =>
                    mutation.mutate(() =>
                      api.removeItem(line.lineId, view.cart.version),
                    )
                  }
                >
                  <Trash2 size={18} />
                </Button>
              </article>
            ))}
            <Coupon view={view} />
            <Link to="/" className="text-link">
              ← Continuar explorando
            </Link>
          </section>
          <aside className="order-summary">
            <h2>Resumo do pedido</h2>
            <Summary totals={view.summary} coupon={view.cart.couponCode}>
              {invalid ? (
                <p role="alert" className="field-error">
                  Revise a disponibilidade dos itens antes de continuar.
                </p>
              ) : (
                <Link to="/checkout" className="button button-primary">
                  Finalizar compra
                </Link>
              )}
              <p className="secure-note">
                <ShieldCheck size={16} />
                Compra simulada e sem cobrança real
              </p>
            </Summary>
          </aside>
        </div>
      )}
      <Related title="Explore mais NFTs" />
    </div>
  );
}
