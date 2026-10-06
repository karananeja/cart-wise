import { useQuery } from '@tanstack/react-query';
import {
  VIEWED_MAX,
  type CartRecommendations,
  type HomeRecommendations,
  type ProductRecommendations,
  type RecommendationKind,
  type RecommendationSurface,
} from '@store/shared';
import { track } from '@/lib/analytics';
import { apiGet } from '@/lib/api';

export const recommendationKeys = {
  product: (slug: string) => ['recommendations', 'product', slug] as const,
  home: (viewed: string[], account: string | null) => ['recommendations', 'home', viewed.join(','), account] as const,
  cart: (signature: string) => ['recommendations', 'cart', signature] as const,
};

/**
 * Suggestions are a convenience: no retries and no error UI. A failed or empty query simply
 * leaves its section out (spec §14).
 */
const quiet = { retry: false, staleTime: 60_000 } as const;

export function useProductRecommendations(slug: string) {
  return useQuery({
    queryKey: recommendationKeys.product(slug),
    queryFn: ({ signal }) => apiGet<ProductRecommendations>(`/products/${encodeURIComponent(slug)}/recommendations`, signal),
    ...quiet,
  });
}

/** `viewed` newest first; `account` identifies the signed-in user (for "Because you bought"). */
export function useHomeRecommendations(viewed: string[], account: string | null) {
  const slugs = viewed.slice(0, VIEWED_MAX);
  return useQuery({
    queryKey: recommendationKeys.home(slugs, account),
    queryFn: ({ signal }) =>
      apiGet<HomeRecommendations>(`/recommendations/home${slugs.length ? `?viewed=${slugs.map(encodeURIComponent).join(',')}` : ''}`, signal),
    // First-time visitors: nothing to base suggestions on, so no request at all.
    enabled: slugs.length > 0 || account !== null,
    ...quiet,
  });
}

/** `signature` changes whenever the cart's contents change, so suggestions follow the cart. */
export function useCartRecommendations(signature: string) {
  return useQuery({
    queryKey: recommendationKeys.cart(signature),
    queryFn: ({ signal }) => apiGet<CartRecommendations>('/cart/recommendations', signal),
    enabled: signature !== '',
    ...quiet,
  });
}

/** `recommendation_clicked` (spec FR-11). Positions start at 1. */
export function trackRecommendation(surface: RecommendationSurface, kind: RecommendationKind, productId: number, position: number) {
  track('recommendation_clicked', { surface, kind, productId, position });
}
