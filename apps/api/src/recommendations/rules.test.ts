import { describe, expect, it } from 'vitest';
import type { RecommendedProduct } from '@store/shared';
import { pairsWell, similar, similarityScore, type Candidate } from './rules.js';

let nextId = 1;
function candidate(over: Partial<RecommendedProduct> & { tags?: string[]; available?: number } = {}): Candidate {
  const { tags = [], available = 10, ...product } = over;
  const id = product.id ?? nextId++;
  return {
    product: {
      id,
      slug: `p-${id}`,
      title: `Product ${id}`,
      brand: null,
      categorySlug: 'smartphones',
      mrpPaise: 10_000_00,
      pricePaise: 10_000_00,
      discountPercent: 0,
      rating: 4,
      reviewCount: 3,
      thumbnailUrl: '',
      availability: { status: available > 0 ? 'in_stock' : 'out_of_stock' },
      needsSize: false,
      ...product,
    },
    tags,
    available,
  };
}

describe('similarity', () => {
  it('scores shared tags ×3, same brand +2, and price closeness', () => {
    const anchor = candidate({ brand: 'Apple', tags: ['phone', 'ios'], pricePaise: 10_000_00 });
    expect(similarityScore(anchor, candidate({ brand: 'Apple', tags: ['IOS', 'phone'], pricePaise: 12_000_00 }))).toBe(6 + 2 + 2);
    expect(similarityScore(anchor, candidate({ tags: ['phone'], pricePaise: 15_000_00 }))).toBe(3 + 1);
    expect(similarityScore(anchor, candidate({ pricePaise: 20_000_00 }))).toBe(0);
  });

  it('ranks the same category only, in stock first, then score, rating and id; never the anchor', () => {
    const anchor = candidate({ id: 100, tags: ['phone'] });
    const strong = candidate({ id: 101, tags: ['phone'], rating: 3 });
    const weakHighRated = candidate({ id: 102, rating: 5, pricePaise: 50_000_00 });
    const strongSoldOut = candidate({ id: 103, tags: ['phone'], available: 0 });
    const tieA = candidate({ id: 105, rating: 4, pricePaise: 50_000_00 });
    const tieB = candidate({ id: 104, rating: 4, pricePaise: 50_000_00 });
    const otherCategory = candidate({ id: 106, categorySlug: 'laptops', tags: ['phone'] });
    const result = similar(anchor, [anchor, strong, weakHighRated, strongSoldOut, tieA, tieB, otherCategory]);
    expect(result.map((p) => p.id)).toEqual([101, 102, 104, 105, 103]);
    expect(similar(anchor, [anchor, strong], new Set([101]))).toEqual([]);
  });
});

describe('pairs well with', () => {
  it('picks the best in-stock item per complementary category, one each', () => {
    const shirt = candidate({ id: 200, categorySlug: 'mens-shirts', pricePaise: 2_000_00 });
    const shoesTop = candidate({ id: 201, categorySlug: 'mens-shoes', rating: 4.8, pricePaise: 9_000_00 });
    const shoesLow = candidate({ id: 202, categorySlug: 'mens-shoes', rating: 4.1 });
    const watchSoldOut = candidate({ id: 203, categorySlug: 'mens-watches', rating: 5, available: 0 });
    const watchBelow = candidate({ id: 204, categorySlug: 'mens-watches', rating: 4.5, pricePaise: 1_500_00 });
    const watchAbove = candidate({ id: 205, categorySlug: 'mens-watches', rating: 4.5, pricePaise: 2_100_00 });
    const result = pairsWell(shirt, [shirt, shoesTop, shoesLow, watchSoldOut, watchBelow, watchAbove]);
    // Shoes first (map order), best rated; watch: same rating, so the one at or below the shirt's price.
    expect(result.map((p) => p.id)).toEqual([201, 204]);
  });

  it('pairs unmapped categories with nothing, and respects exclusions', () => {
    const ball = candidate({ categorySlug: 'sports-accessories' });
    expect(pairsWell(ball, [ball, candidate({ categorySlug: 'mobile-accessories' })])).toEqual([]);
    const phone = candidate({ categorySlug: 'smartphones' });
    const charger = candidate({ categorySlug: 'mobile-accessories' });
    expect(pairsWell(phone, [phone, charger], new Set([charger.product.id]))).toEqual([]);
  });
});
