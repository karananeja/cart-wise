import { COMPLEMENTARY_CATEGORIES, PAIRING_MAX, SIMILAR_MAX, type RecommendedProduct } from '@store/shared';

/** What the rules need to know about a product. */
export interface Candidate {
  product: RecommendedProduct;
  tags: string[];
  /** Units available to buy (on hand minus held, across sizes). */
  available: number;
}

const inStock = (c: Candidate) => c.available > 0;

/** FR-1 score: shared tags ×3, same brand +2, price within ±30% +2 or ±60% +1. */
export function similarityScore(anchor: Candidate, other: Candidate): number {
  const tags = new Set(anchor.tags.map((t) => t.toLowerCase()));
  let score = other.tags.filter((t) => tags.has(t.toLowerCase())).length * 3;
  if (anchor.product.brand && anchor.product.brand === other.product.brand) score += 2;
  const ratio = Math.abs(other.product.pricePaise - anchor.product.pricePaise) / Math.max(anchor.product.pricePaise, 1);
  if (ratio <= 0.3) score += 2;
  else if (ratio <= 0.6) score += 1;
  return score;
}

/**
 * "You may also like": same category, best score first; ties by rating, then id. Out-of-stock
 * items go last rather than being hidden. Never the anchor itself or anything in `exclude`.
 */
export function similar(anchor: Candidate, all: Candidate[], exclude: Set<number> = new Set(), max = SIMILAR_MAX): RecommendedProduct[] {
  return all
    .filter((c) => c.product.categorySlug === anchor.product.categorySlug && c.product.id !== anchor.product.id && !exclude.has(c.product.id))
    .map((c) => ({ c, score: similarityScore(anchor, c) }))
    .sort(
      (a, b) =>
        Number(inStock(b.c)) - Number(inStock(a.c)) || b.score - a.score || b.c.product.rating - a.c.product.rating || a.c.product.id - b.c.product.id,
    )
    .slice(0, max)
    .map(({ c }) => c.product);
}

/**
 * "Pairs well with": per complementary category (in map order), the best in-stock item by
 * rating, then the closest price at or below the anchor's, then the closest above. One per
 * category, up to 2. Unmapped categories pair with nothing.
 */
export function pairsWell(anchor: Candidate, all: Candidate[], exclude: Set<number> = new Set()): RecommendedProduct[] {
  const picks: RecommendedProduct[] = [];
  const price = anchor.product.pricePaise;
  for (const category of COMPLEMENTARY_CATEGORIES[anchor.product.categorySlug] ?? []) {
    if (picks.length >= PAIRING_MAX) break;
    const best = all
      .filter((c) => c.product.categorySlug === category && inStock(c) && c.product.id !== anchor.product.id && !exclude.has(c.product.id))
      .sort((a, b) => {
        if (b.product.rating !== a.product.rating) return b.product.rating - a.product.rating;
        const below = (c: Candidate) => c.product.pricePaise <= price;
        if (below(a) !== below(b)) return below(a) ? -1 : 1;
        return Math.abs(a.product.pricePaise - price) - Math.abs(b.product.pricePaise - price) || a.product.id - b.product.id;
      })[0];
    if (best) picks.push(best.product);
  }
  return picks;
}
