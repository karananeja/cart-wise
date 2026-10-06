import { Navigate, useParams, useSearchParams, type RouteObject } from 'react-router';
import { normalizeQuery } from '@store/shared';
import { NotFound } from '@/components/NotFound';
import { HomePage } from '@/features/catalog/pages/HomePage';
import { ListingPage } from '@/features/catalog/pages/ListingPage';
import { ProductPage } from '@/features/catalog/pages/ProductPage';
import { CartPage } from '@/features/cart/CartPage';
import { WishlistPage } from '@/features/wishlist/WishlistPage';
import { AccountPage } from '@/features/auth/AccountPage';
import { ForgotPasswordPage } from '@/features/auth/ForgotPasswordPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { SignupPage } from '@/features/auth/SignupPage';
import { RootLayout } from './RootLayout';
import { RouteError } from './RouteError';

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteError />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'products', element: <ListingPage /> },
      { path: 'c/:categorySlug', element: <CategoryListingPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'cart', element: <CartPage /> },
      { path: 'wishlist', element: <WishlistPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'signup', element: <SignupPage /> },
      { path: 'forgot-password', element: <ForgotPasswordPage /> },
      { path: 'account', element: <AccountPage /> },
      { path: 'p/:productSlug', element: <ProductPage /> },
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
