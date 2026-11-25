import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
  Link,
  lazyRouteComponent,
} from "@tanstack/react-router";
import { auth } from "./lib/client";
import { RootLayout } from "./components/layout";
import { CatalogPage } from "./pages/catalog";
import { EmptyState, ErrorState } from "./components/common";
import type { CatalogParams } from "./lib/types";

const DetailPage = lazyRouteComponent(
  () => import("./pages/detail"),
  "DetailPage",
);
const LoginPage = lazyRouteComponent(() => import("./pages/auth"), "LoginPage");
const RegisterPage = lazyRouteComponent(
  () => import("./pages/auth"),
  "RegisterPage",
);
const CartPage = lazyRouteComponent(() => import("./pages/cart"), "CartPage");
const FavoritesPage = lazyRouteComponent(
  () => import("./pages/account"),
  "FavoritesPage",
);
const ProfilePage = lazyRouteComponent(
  () => import("./pages/account"),
  "ProfilePage",
);
const WalletsPage = lazyRouteComponent(
  () => import("./pages/account"),
  "WalletsPage",
);
const CheckoutPage = lazyRouteComponent(
  () => import("./pages/checkout"),
  "CheckoutPage",
);
const OrderPage = lazyRouteComponent(
  () => import("./pages/checkout"),
  "OrderPage",
);

const root = createRootRoute({
  component: RootLayout,
  beforeLoad: async () => auth.bootstrap(),
  notFoundComponent: () => (
    <div className="container page">
      <EmptyState title="Página não encontrada">
        <Link to="/" className="button button-primary">
          Voltar ao início
        </Link>
      </EmptyState>
    </div>
  ),
  errorComponent: ({ error, reset }) => (
    <div className="container page">
      <ErrorState error={error} retry={reset} />
    </div>
  ),
});
const catalog = createRoute({
  getParentRoute: () => root,
  path: "/",
  component: CatalogPage,
  validateSearch: (search: Record<string, unknown>): CatalogParams => {
    const strings = (value: unknown) =>
      (Array.isArray(value) ? value : value ? [value] : []).map(String);
    const page = Number(search.page);
    return {
      q: typeof search.q === "string" ? search.q : undefined,
      categories: strings(search.categories),
      networks: strings(search.networks),
      minEth: typeof search.minEth === "string" ? search.minEth : undefined,
      maxEth: typeof search.maxEth === "string" ? search.maxEth : undefined,
      page: Number.isInteger(page) && page > 0 ? page : 1,
      sort: typeof search.sort === "string" ? search.sort : "recent",
      tab: typeof search.tab === "string" ? search.tab : "all",
    };
  },
});
const privateGuard = async ({ location }: { location: { href: string } }) => {
  await auth.bootstrap();
  if (!auth.get())
    throw redirect({ to: "/login", search: { redirect: location.href } });
};
const routes = [
  catalog,
  createRoute({
    getParentRoute: () => root,
    path: "/nfts/$nftId",
    component: DetailPage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/cart",
    component: CartPage,
  }),
  ...(["/login", "/register"] as const).map((path) =>
    createRoute({
      getParentRoute: () => root,
      path,
      validateSearch: (search: Record<string, unknown>) => ({
        redirect: typeof search.redirect === "string" ? search.redirect : "/",
      }),
      component: path === "/register" ? RegisterPage : LoginPage,
    }),
  ),
  createRoute({
    getParentRoute: () => root,
    path: "/account/profile",
    beforeLoad: privateGuard,
    component: ProfilePage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/account/wallets",
    beforeLoad: privateGuard,
    component: WalletsPage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/favorites",
    beforeLoad: privateGuard,
    component: FavoritesPage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/checkout",
    beforeLoad: privateGuard,
    component: CheckoutPage,
  }),
  createRoute({
    getParentRoute: () => root,
    path: "/orders/$orderId",
    beforeLoad: privateGuard,
    component: OrderPage,
  }),
];
export const router = createRouter({
  routeTree: root.addChildren(routes),
  defaultPreload: "intent",
  scrollRestoration: true,
});
