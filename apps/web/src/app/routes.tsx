import { useParams, type RouteObject } from 'react-router';
import { NotFound } from '@/components/NotFound';
import { HomePage } from '@/features/catalog/pages/HomePage';
import { ListingPage } from '@/features/catalog/pages/ListingPage';
import { ProductPage } from '@/features/catalog/pages/ProductPage';
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
