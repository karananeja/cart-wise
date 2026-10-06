import { formatRupees, type FilterGroup, type ListingFacets, type ListingParams } from '@store/shared';

export function priceLabel(min?: number, max?: number): string {
  if (min !== undefined && max !== undefined) return `${formatRupees(min)} – ${formatRupees(max)}`;
  if (min !== undefined) return `${formatRupees(min)} & above`;
  return `Under ${formatRupees(max ?? 0)}`;
}

export function ratingLabel(rating: number): string {
  return `${rating}★ & up`;
}

export function brandLabel(slug: string, facets?: ListingFacets): string {
  return facets?.brands.find((b) => b.value === slug)?.label ?? slug;
}

export function categoryLabel(slug: string, facets?: ListingFacets): string {
  return facets?.categories.find((c) => c.value === slug)?.label ?? slug;
}

/** Human description of a whole filter group, used in the empty-state suggestion. */
export function describeFilterGroup(group: FilterGroup, params: ListingParams, facets?: ListingFacets): string {
  switch (group) {
    case 'category':
      return `Category: ${categoryLabel(params.category ?? '', facets)}`;
    case 'brand':
      return `Brand: ${params.brands.map((b) => brandLabel(b, facets)).join(', ')}`;
    case 'price':
      return `Price: ${priceLabel(params.priceMin, params.priceMax)}`;
    case 'rating':
      return `Rating: ${ratingLabel(params.rating ?? 0)}`;
    case 'inStock':
      return 'In stock only';
  }
}

export function clearFilterGroup(group: FilterGroup): Partial<ListingParams> {
  switch (group) {
    case 'category':
      return { category: undefined };
    case 'brand':
      return { brands: [] };
    case 'price':
      return { priceMin: undefined, priceMax: undefined };
    case 'rating':
      return { rating: undefined };
    case 'inStock':
      return { inStock: false };
  }
}

const NICE_BOUNDS = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000, 100000, 250000, 500000];

/**
 * Up to four preset ranges spread across the available price range, using round numbers.
 * Derived from the price facet, which ignores the price filter itself, so presets stay put
 * while the user switches between them.
 */
export function pricePresets(range: { min: number; max: number }): { min?: number; max?: number }[] {
  const inside = NICE_BOUNDS.filter((n) => n > range.min && n < range.max);
  if (inside.length === 0) return [];
  const bounds =
    inside.length <= 3
      ? inside
      : [...new Set([1, 2, 3].map((q) => inside[Math.min(inside.length - 1, Math.floor((q * inside.length) / 4))]!))];
  return [
    { max: bounds[0] },
    ...bounds.slice(1).map((max, i) => ({ min: bounds[i], max })),
    { min: bounds[bounds.length - 1] },
  ];
}
