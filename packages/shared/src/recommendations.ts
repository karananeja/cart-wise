/**
 * Product discovery (F-012): deterministic, explainable suggestions (brief §17).
 */
import type { ProductSummary } from './types.js';

/**
 * A suggested product. Products that need a size or option chosen can't be added in a bundle;
 * they link to their page ("Choose size" / "Choose option", by `hasOptions`).
 */
export interface RecommendedProduct extends ProductSummary {
  needsSize: boolean;
}

/** "Frequently bought together" needs at least this many real paid orders with both items. */
export const BOUGHT_TOGETHER_MIN_ORDERS = 2;
/** Companions shown in the pairing group. */
export const PAIRING_MAX = 2;
export const SIMILAR_MAX = 12;
export const CART_SUGGESTIONS_MAX = 8;
/** Recently viewed products sent for "Because you viewed". */
export const VIEWED_MAX = 10;

export type PairingKind = 'bought_together' | 'pairs_well';
export type RecommendationKind = PairingKind | 'similar' | 'because_viewed' | 'because_bought';
export type RecommendationSurface = 'product' | 'home' | 'cart';

export const PAIRING_TITLES: Record<PairingKind, string> = {
  bought_together: 'Frequently bought together',
  pairs_well: 'Pairs well with',
};

export interface ProductRecommendations {
  pairing: { kind: PairingKind; items: RecommendedProduct[] } | null;
  similar: RecommendedProduct[];
}

export interface AnchoredRecommendations {
  /** The product the suggestions are based on ("Because you viewed ‹title›"). */
  anchor: { slug: string; title: string };
  items: RecommendedProduct[];
}

export interface HomeRecommendations {
  becauseViewed: AnchoredRecommendations | null;
  /** Signed-in customers with paid orders only. */
  becauseBought: AnchoredRecommendations | null;
}

export interface CartRecommendations {
  items: RecommendedProduct[];
}

/**
 * Complementary categories for "Pairs well with" (approved at F-012 Gate 1, 2026-10-06).
 * Categories not listed pair with nothing.
 */
export const COMPLEMENTARY_CATEGORIES: Record<string, string[]> = {
  smartphones: ['mobile-accessories'],
  tablets: ['mobile-accessories'],
  laptops: ['mobile-accessories'],
  'mobile-accessories': ['smartphones'],
  'mens-shirts': ['mens-shoes', 'mens-watches'],
  'mens-shoes': ['mens-shirts'],
  'mens-watches': ['mens-shirts', 'sunglasses'],
  tops: ['womens-jewellery', 'womens-bags'],
  'womens-dresses': ['womens-shoes', 'womens-jewellery'],
  'womens-shoes': ['womens-dresses', 'womens-bags'],
  'womens-bags': ['womens-jewellery', 'sunglasses'],
  'womens-jewellery': ['womens-dresses'],
  'womens-watches': ['womens-jewellery'],
  sunglasses: ['mens-watches', 'womens-bags'],
  beauty: ['skin-care', 'fragrances'],
  'skin-care': ['beauty'],
  fragrances: ['beauty'],
  furniture: ['home-decoration'],
  'home-decoration': ['furniture'],
  'kitchen-accessories': ['groceries'],
  groceries: ['kitchen-accessories'],
};
