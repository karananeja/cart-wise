import { Navigate, useParams, useSearchParams, type RouteObject } from 'react-router';
import { normalizeQuery } from '@store/shared';
import { NotFound } from '@/components/NotFound';
import { HomePage } from '@/features/catalog/pages/HomePage';
import { ListingPage } from '@/features/catalog/pages/ListingPage';
import { ProductPage } from '@/features/catalog/pages/ProductPage';
import { CartPage } from '@/features/cart/CartPage';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';
import { RouteLoading } from './RouteLoading';

/**
 * Browsing pages (home, listing, product, cart) ship in the main bundle; everything else loads
 * on first visit, so a shopper's first page downloads less. The router keeps the current page
 * on screen while the next one loads.
 */
const loaders: (() => Promise<unknown>)[] = [];
const page = <T extends Record<string, unknown>>(load: () => Promise<T>, name: keyof T) => {
  loaders.push(load);
  return async () => ({ Component: (await load())[name] as React.ComponentType });
};

/** Loads every lazy page's code now (tests call this once, so pages render without waiting). */
export const preloadRoutes = () => Promise.all(loaders.map((load) => load()));

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    // Shown only on a first visit straight to a lazily loaded page.
    hydrateFallbackElement: <RouteLoading />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ListingPage /> },
      { path: 'c/:categorySlug', element: <CategoryListingPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'checkout', lazy: page(() => import('@/features/checkout/CheckoutPage'), 'CheckoutPage') },
      { path: 'checkout/pay/:orderId', lazy: page(() => import('@/features/payment/PaymentPage'), 'PaymentPage') },
      { path: 'orders/:orderId/confirmation', lazy: page(() => import('@/features/orders/ConfirmationPage'), 'ConfirmationPage') },
      { path: 'wishlist', lazy: page(() => import('@/features/wishlist/WishlistPage'), 'WishlistPage') },
      { path: 'login', lazy: page(() => import('@/features/auth/LoginPage'), 'LoginPage') },
      { path: 'signup', lazy: page(() => import('@/features/auth/SignupPage'), 'SignupPage') },
      { path: 'forgot-password', lazy: page(() => import('@/features/auth/ForgotPasswordPage'), 'ForgotPasswordPage') },
      {
        // F-017: the overview, orders and addresses share the account sidebar (wide screens).
        path: 'account',
        lazy: page(() => import('@/features/account/AccountLayout'), 'AccountLayout'),
        children: [
          { index: true, lazy: page(() => import('@/features/account/AccountPage'), 'AccountPage') },
          { path: 'orders', lazy: page(() => import('@/features/orders/OrdersPage'), 'OrdersPage') },
          { path: 'addresses', lazy: page(() => import('@/features/addresses/AddressesPage'), 'AddressesPage') },
          { path: 'addresses/new', lazy: page(() => import('@/features/addresses/AddressEditorPage'), 'AddressEditorPage') },
          { path: 'addresses/:id/edit', lazy: page(() => import('@/features/addresses/AddressEditorPage'), 'AddressEditorPage') },
        ],
      },
      { path: 'p/:productSlug', element: <ProductPage /> },
      { path: 'orders/:orderId', lazy: page(() => import('@/features/orders/OrderPage'), 'OrderPage') },
      {
        path: 'sim',
        lazy: page(() => import('@/features/sim/SimConsole'), 'SimConsole'),
        children: [
          { path: 'orders', lazy: page(() => import('@/features/sim/SimOrdersPage'), 'SimOrdersPage') },
          { path: 'inventory', lazy: page(() => import('@/features/sim/SimInventoryPage'), 'SimInventoryPage') },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
];

/** Keyed by category so switching categories starts with fresh per-page UI state. */
function CategoryListingPage() {
  const { categorySlug } = useParams();
  return <ListingPage key={categorySlug} />;
}

/** Keyed by query so a new search starts with fresh per-page UI state. No query: browse instead. */
function SearchPage() {
  const [searchParams] = useSearchParams();
  const q = normalizeQuery(searchParams.get('q') ?? undefined);
  if (!q) return <Navigate to="/products" replace />;
  return <ListingPage key={q} />;
}
