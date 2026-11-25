import { useEffect, useState, useSyncExternalStore } from "react";
import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import {
  Heart,
  Home,
  LogIn,
  Search,
  ShoppingCart,
  UserRound,
  Wallet,
  SlidersHorizontal,
  ArrowRight,
  Camera,
  BriefcaseBusiness,
  Mail,
  Settings2,
  WifiOff,
  ExternalLink,
} from "lucide-react";
import { api, auth, errorMessage } from "../lib/client";
import { realtime } from "../lib/realtime";
import type { ScenarioId } from "../lib/types";
import { scenarioIds } from "../lib/types";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { DemoInfo, Notices, useAuth, useCart, useNotice } from "./common";

function Header() {
  const user = useAuth(),
    cart = useCart(),
    location = useLocation(),
    [search, setSearch] = useState(false),
    [term, setTerm] = useState(""),
    navigate = useNavigate(),
    [info, setInfo] = useState("");
  const count =
    cart.data?.cart.items.reduce((sum, line) => sum + line.quantity, 0) ?? 0;
  return (
    <>
      <header className="site-header container">
        <Link to="/" className="wordmark" aria-label="Kurio, início">
          KURIO
        </Link>
        <nav aria-label="Navegação principal">
          <Link to="/" className={location.pathname === "/" ? "active" : ""}>
            Início
          </Link>
          <Link
            to="/"
            search={{ tab: "all" }}
            activeProps={{ className: "" }}
            className={
              ["/cart", "/checkout"].includes(location.pathname) ||
              location.pathname.startsWith("/nfts/")
                ? "active"
                : ""
            }
          >
            Mercado
          </Link>
          <button
            onClick={() =>
              setInfo(
                "As páginas de criadores não fazem parte desta demonstração. Explore as coleções no catálogo.",
              )
            }
          >
            Criadores
          </button>
          <button
            onClick={() =>
              setInfo(
                "Os artigos são referências visuais. A leitura completa não está disponível nesta demonstração.",
              )
            }
          >
            Aprenda
          </button>
        </nav>
        <div className="header-actions">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Buscar NFTs"
            onClick={() => setSearch((value) => !value)}
          >
            <Search size={23} />
          </Button>
          <Link
            to="/cart"
            className="cart-link"
            aria-label={`Carrinho, ${count} itens`}
          >
            <ShoppingCart size={23} />
            {count > 0 && <span>{count}</span>}
          </Link>
          {user ? (
            <Link to="/account/profile" className="account-link">
              <UserRound size={19} />
              {user.user.profile.displayName.split(" ")[0]}
            </Link>
          ) : (
            <Link
              to="/login"
              search={{ redirect: location.href }}
              className="button button-primary button-small"
            >
              <LogIn size={19} />
              Entrar
            </Link>
          )}
        </div>
      </header>
      {search && (
        <form
          className="header-search container"
          onSubmit={(event) => {
            event.preventDefault();
            void navigate({ to: "/", search: { q: term, page: 1 } });
            setSearch(false);
          }}
        >
          <label className="sr-only" htmlFor="header-q">
            Buscar no catálogo
          </label>
          <input
            id="header-q"
            value={term}
            onChange={(event) => setTerm(event.target.value)}
            placeholder="Nome, coleção ou atributo"
            autoFocus
          />
          <Button type="submit">Buscar</Button>
        </form>
      )}
      <DemoInfo open={!!info} onClose={() => setInfo("")} message={info} />
    </>
  );
}

function MobileNav() {
  const location = useLocation(),
    user = useAuth();
  return (
    <nav className="mobile-nav" aria-label="Navegação mobile">
      <Link
        to="/"
        aria-label="Início"
        className={location.pathname === "/" ? "active" : ""}
      >
        <Home size={21} />
      </Link>
      <Link
        to="/favorites"
        aria-label="Favoritos"
        className={location.pathname === "/favorites" ? "active" : ""}
      >
        <Heart size={22} />
      </Link>
      <Link
        to="/account/wallets"
        className="mobile-wallet"
        aria-label="Minhas carteiras"
      >
        <Wallet size={25} />
      </Link>
      <Link
        to="/cart"
        aria-label="Carrinho"
        className={location.pathname === "/cart" ? "active" : ""}
      >
        <ShoppingCart size={21} />
      </Link>
      <Link to={user ? "/account/profile" : "/login"} aria-label="Meu perfil">
        <UserRound size={21} />
      </Link>
    </nav>
  );
}

function Footer() {
  const [info, setInfo] = useState(""),
    navigate = useNavigate();
  const inform = (label: string) =>
    setInfo(
      `${label} não está disponível nesta demonstração. Você pode continuar explorando e simular uma compra no catálogo.`,
    );
  return (
    <footer className="site-footer container">
      <div className="footer-intro">
        <div>
          <span className="benefit-icon">W</span>
          <h3>Segurança da carteira</h3>
          <p>
            Proteja sua carteira e colecione arte digital verificada com
            confiança.
          </p>
        </div>
        <div>
          <span className="benefit-icon">C</span>
          <h3>Criadores em destaque</h3>
          <p>
            Conheça artistas, estúdios e comunidades que moldam a cultura
            digital na rede.
          </p>
        </div>
        <div>
          <span className="benefit-icon">D</span>
          <h3>Alertas de lançamentos</h3>
          <p>
            Receba calendários de cunhagem, novidades de listas de acesso e
            análises do mercado.
          </p>
        </div>
        <div>
          <h3>Antecipe-se ao próximo lançamento</h3>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              setInfo(
                "O envio de novidades não está ativo nesta demonstração. Nenhum e-mail foi cadastrado.",
              );
            }}
          >
            <label htmlFor="newsletter" className="sr-only">
              E-mail para novidades
            </label>
            <input
              id="newsletter"
              type="email"
              placeholder="digite seu e-mail…"
              required
            />
            <Button type="submit">Enviar</Button>
          </form>
          <p>
            Receba lançamentos selecionados, histórias de criadores e novidades
            do mercado.
          </p>
        </div>
      </div>
      <div className="footer-brand">
        <span className="wordmark">KURIO</span>
        <p>
          Feito para colecionadores,
          <br />
          criadores e cultura
        </p>
        <a href="mailto:contato@example.test">contato@example.test</a>
        <span>Uma coleção de novas ideias.</span>
      </div>
      <div className="footer-links">
        <div>
          <h3>Meu perfil</h3>
          <Link to="/account/profile">Meu perfil</Link>
          <Link to="/favorites">Lista de interesse</Link>
          {["Minha coleção", "Atividade", "Estúdio do criador"].map((label) => (
            <button key={label} onClick={() => inform(label)}>
              {label}
            </button>
          ))}
        </div>
        <div>
          <h3>Central de ajuda</h3>
          {[
            "Central de ajuda",
            "Como comprar NFTs",
            "Carteira e segurança",
            "Política do mercado",
            "Denunciar item",
          ].map((label) => (
            <button key={label} onClick={() => inform(label)}>
              {label}
            </button>
          ))}
        </div>
        <div>
          <h3>Coleções</h3>
          {["Arte digital", "Fotografia", "Música", "Arte 3D", "Utilidade"].map(
            (category) => (
              <button
                key={category}
                onClick={() =>
                  void navigate({
                    to: "/",
                    search: { categories: [category], page: 1 },
                  })
                }
              >
                {category}
              </button>
            ),
          )}
        </div>
        <div>
          <h3>Redes sociais</h3>
          <div className="social-links">
            {[Camera, BriefcaseBusiness, Mail, ExternalLink].map(
              (Icon, index) => (
                <Button
                  key={index}
                  size="icon"
                  variant="outline"
                  aria-label={
                    ["Instagram", "LinkedIn", "E-mail", "Outras redes"][index]
                  }
                  onClick={() => inform("Este link externo")}
                >
                  <Icon size={17} />
                </Button>
              ),
            )}
          </div>
          <h3>Carteiras compatíveis</h3>
          <span className="wallet-brands">
            METAMASK · WALLETCONNECT · COINBASE
          </span>
        </div>
      </div>
      <p className="copyright">
        © 2026 Kurio. Propriedade digital para todos.
        <br />
        <span>
          Ambiente de demonstração. NFTs, carteiras e compras são simulados.
        </span>
      </p>
      <DemoInfo open={!!info} onClose={() => setInfo("")} message={info} />
    </footer>
  );
}

const scenarioNames: Partial<Record<ScenarioId, string>> = {
  default: "Fluxo normal",
  empty: "Nenhum resultado",
  slow: "Carregamento lento",
  "out-of-order": "Respostas fora de ordem",
  offline: "Falha de conexão",
  "server-error": "Erro do servidor",
  forbidden: "Sem permissão",
  "price-change": "Preço alterado",
  "sold-out": "Edição esgotada",
  "order-timeout": "Timeout após criar pedido",
  "payment-declined": "Pagamento recusado",
  "favorite-error": "Falha ao favoritar",
  "quote-expired": "Cotação expirada",
  "wallet-refused": "Conexão de carteira recusada",
  "wallet-disconnected": "Carteira desconectada",
  validation: "Erro de validação",
  "last-unit": "Última unidade",
};
function DemoPanel() {
  const [open, setOpen] = useState(false),
    [scenario, setScenario] = useState<ScenarioId>("default"),
    [busy, setBusy] = useState(false),
    notice = useNotice(),
    cart = useCart(),
    navigate = useNavigate();
  const connection = useSyncExternalStore(
    realtime.subscribe,
    realtime.status,
    () => "connecting",
  );
  const run = async (
    fn: () => Promise<unknown>,
    success = "Cenário atualizado.",
  ) => {
    setBusy(true);
    try {
      await fn();
      notice(success);
    } catch (error) {
      notice(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Button
        className="demo-trigger"
        variant="outline"
        size="icon"
        aria-label="Abrir cenários da demonstração"
        onClick={() => setOpen(true)}
      >
        <Settings2 size={18} />
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Cenários da demonstração"
        description="Use os controles para reproduzir carregamentos, falhas e alterações. Todos os dados ficam neste navegador."
      >
        <div className="demo-status">
          Socket.IO: <strong data-testid="socket-status">{connection}</strong>
          <span>{realtime.count()} eventos recebidos</span>
        </div>
        <label className="field">
          Cenário
          <select
            value={scenario}
            onChange={(event) => setScenario(event.target.value as ScenarioId)}
          >
            {scenarioIds.map((id) => (
              <option key={id} value={id}>
                {scenarioNames[id] ?? id}
              </option>
            ))}
          </select>
        </label>
        <div className="demo-actions">
          <Button
            disabled={busy}
            onClick={() =>
              void run(() => api.action("scenario.set", { scenario }))
            }
          >
            Aplicar cenário
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api.reset(scenario);
                auth.clear();
                for (let i = sessionStorage.length - 1; i >= 0; i--) {
                  const key = sessionStorage.key(i)!;
                  if (
                    key.startsWith("kurio-attempt") ||
                    key.startsWith("kurio-checkout")
                  )
                    sessionStorage.removeItem(key);
                }
                await navigate({ to: "/" });
                setOpen(false);
              }, "Demonstração reiniciada.")
            }
          >
            Reiniciar dados
          </Button>
        </div>
        <h3>Alterações em tempo real</h3>
        <div className="demo-actions">
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() =>
                api.action("nft.change", {
                  nftId: cart.data?.cart.items[0]?.nftId,
                  editionId: cart.data?.cart.items[0]?.editionId,
                  priceEth: "1.29",
                }),
              )
            }
          >
            Alterar preço
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() =>
                api.action("nft.change", {
                  nftId: cart.data?.cart.items[0]?.nftId,
                  editionId: cart.data?.cart.items[0]?.editionId,
                  available: 0,
                }),
              )
            }
          >
            Esgotar edição
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() => api.action("nft.change", { duplicate: true }))
            }
          >
            Evento duplicado
          </Button>
          <Button
            variant="outline"
            disabled={busy}
            onClick={() =>
              void run(() => api.action("nft.change", { old: true }))
            }
          >
            Evento antigo
          </Button>
        </div>
        <h3>Sessão e conexão</h3>
        <div className="demo-actions">
          <Button
            variant="outline"
            onClick={() => void run(() => api.action("session.expire"))}
          >
            Expirar sessão
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void run(() => api.action("clock.advance", { ms: 61_000 }))
            }
          >
            Avançar 61 segundos
          </Button>
          <Button
            variant="outline"
            onClick={() => void run(() => api.action("socket.disconnect"))}
          >
            Interromper socket
          </Button>
          <Button
            variant="outline"
            onClick={() => void run(() => api.action("socket.reconnect"))}
          >
            Restabelecer socket
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void run(() =>
                api.action("order.resolve", { status: "confirmed" }),
              )
            }
          >
            Confirmar pedido pendente
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              void run(() =>
                api.action("order.resolve", { status: "declined" }),
              )
            }
          >
            Recusar pedido pendente
          </Button>
        </div>
        <p className="fine-print">
          Contas para teste: collector.a@example.test / CollectorDemoA!2026 e
          collector.b@example.test / CollectorDemoB!2026. Cupom válido:
          WELCOME10.
        </p>
      </Dialog>
    </>
  );
}

function LayoutContent() {
  const location = useLocation(),
    user = useAuth(),
    notice = useNotice(),
    connection = useSyncExternalStore(
      realtime.subscribe,
      realtime.status,
      () => "connecting",
    ),
    navigate = useNavigate();
  useEffect(() => realtime.start(), [user?.sessionId]);
  useEffect(() => realtime.notice(notice), [notice]);
  useEffect(() => {
    if (
      !user &&
      (location.pathname.startsWith("/account") ||
        location.pathname.startsWith("/orders") ||
        location.pathname === "/checkout" ||
        location.pathname === "/favorites")
    )
      void navigate({ to: "/login", search: { redirect: location.href } });
  }, [user, location.pathname, location.href, navigate]);
  useEffect(() => {
    window.scrollTo({ top: 0 });
    if (["/login", "/register"].includes(location.pathname)) return;
    document.getElementById("main-content")?.focus({ preventScroll: true });
  }, [location.pathname]);
  const noFooter =
    location.pathname.startsWith("/account") ||
    location.pathname.startsWith("/orders") ||
    location.pathname === "/login" ||
    location.pathname === "/register";
  return (
    <>
      <a className="skip-link" href="#main-content">
        Pular para o conteúdo
      </a>
      <Header />
      {connection === "disconnected" && (
        <div className="connection-notice" role="status">
          <WifiOff size={16} />
          Conexão interrompida. Seus dados serão atualizados ao reconectar.
        </div>
      )}
      <main id="main-content" data-connection={connection} tabIndex={-1}>
        <Outlet />
      </main>
      {!noFooter && <Footer />}
      {!/^\/(login|register|cart|checkout|nfts|orders)(\/|$)/.test(
        location.pathname,
      ) && <MobileNav />}
      {import.meta.env.VITE_DEMO_CONTROLS !== "false" && <DemoPanel />}
    </>
  );
}
export function RootLayout() {
  return (
    <Notices>
      <LayoutContent />
    </Notices>
  );
}
export function FilterIcon() {
  return <SlidersHorizontal size={22} />;
}
export function PromoBanners() {
  return (
    <section className="promo-banners container">
      <article>
        <img
          src="/assets/emerald.webp"
          alt="Emerald Ape"
          width="450"
          height="450"
          loading="lazy"
        />
        <div>
          <h2>
            Lançamentos gênesis
            <br />
            de edição limitada
          </h2>
          <p>
            Colecione edições escassas diretamente dos criadores antes da
            revelação pública.
          </p>
          <Link
            to="/"
            search={{ tab: "new" }}
            className="button button-primary"
          >
            Explorar <ArrowRight size={18} />
          </Link>
        </div>
      </article>
      <article>
        <img
          src="/assets/ivory.webp"
          alt="Ivory Baron"
          width="250"
          height="250"
          loading="lazy"
        />
        <div>
          <h2>
            Arte digital selecionada
            <br />e muito mais
          </h2>
          <p>
            Explore novos artistas, coleções verificadas e obras digitais que
            definem a cultura.
          </p>
          <Link
            to="/"
            search={{ tab: "trending" }}
            className="button button-primary"
          >
            Explorar <ArrowRight size={18} />
          </Link>
        </div>
      </article>
    </section>
  );
}
export function Editorial() {
  const [article, setArticle] = useState("");
  return (
    <section className="editorial container">
      <h2>Diário da Cunhagem</h2>
      <p>
        Histórias, guias e insights para colecionadores sobre o universo da
        propriedade digital.
      </p>
      <div className="editorial-grid">
        {[
          "Como funciona a propriedade de NFTs",
          "10 artistas digitais para acompanhar",
          "Raridade, atributos e procedência",
          "Como proteger sua carteira",
        ].map((title, index) => (
          <article key={title}>
            <img
              src={`/assets/${["ivory", "emerald", "violet", "golden"][index]}.webp`}
              width="250"
              height="250"
              alt=""
              loading="lazy"
            />
            <div>
              <small>
                {12 + index} de setembro · Leitura de {index + 2} min
              </small>
              <h3>{title}</h3>
              <p>
                {
                  [
                    "Aprenda a colecionar, negociar e verificar ativos digitais.",
                    "Conheça criadores que moldam a cultura digital.",
                    "Entenda raridade, procedência, direitos autorais e utilidade.",
                    "Proteja sua carteira, seus ativos e sua identidade.",
                  ][index]
                }
              </p>
              <button className="text-link" onClick={() => setArticle(title)}>
                Ler mais <ArrowRight size={14} />
              </button>
            </div>
          </article>
        ))}
      </div>
      <DemoInfo
        open={!!article}
        onClose={() => setArticle("")}
        title={article}
        message="Este artigo é uma referência visual do catálogo. A leitura completa não faz parte desta demonstração."
      />
    </section>
  );
}
