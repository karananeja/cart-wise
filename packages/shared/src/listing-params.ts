import { RATING_FILTERS, type RatingFilter } from './types.js';

export const SORT_OPTIONS = ['relevance', 'featured', 'price_asc', 'price_desc', 'rating', 'discount'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  relevance: 'Relevance',
  featured: 'Featured',
  price_asc: 'Price: low to high',
  price_desc: 'Price: high to low',
  rating: 'Customer rating',
  discount: 'Biggest discount',
};

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_QUERY_LENGTH = 100;
export const MAX_PAGE_SIZE = 48;

export interface ListingParams {
  /** Search query; absent when not searching. */
  q?: string;
  category?: string;
  /** Brand slugs, sorted and de-duplicated. */
  brands: string[];
  /** Whole rupees, inclusive. */
  priceMin?: number;
  priceMax?: number;
  rating?: RatingFilter;
  inStock: boolean;
  sort: SortOption;
  page: number;
  pageSize: number;
}

export const DEFAULT_LISTING_PARAMS: ListingParams = {
  brands: [],
  inStock: false,
  sort: 'featured',
  page: 1,
  pageSize: DEFAULT_PAGE_SIZE,
};

type ParamSource = URLSearchParams | Record<string, unknown>;

/** Trims, collapses whitespace and caps length. Returns undefined for a blank query. */
export function normalizeQuery(value: string | undefined): string | undefined {
  const q = value?.replace(/\s+/g, ' ').trim().slice(0, MAX_QUERY_LENGTH).trim();
  return q ? q : undefined;
}

/** Relevance only makes sense for a search; it is then the default. */
export function defaultSort(params: Pick<ListingParams, 'q'>): SortOption {
  return params.q ? 'relevance' : 'featured';
}

export function sortOptionsFor(params: Pick<ListingParams, 'q'>): readonly SortOption[] {
  return params.q ? SORT_OPTIONS : SORT_OPTIONS.filter((s) => s !== 'relevance');
}

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_BRANDS = 50;

function read(source: ParamSource, key: string): string | undefined {
  const value = source instanceof URLSearchParams ? source.get(key) : source[key];
  return typeof value === 'string' ? value : undefined;
}

function parsePositiveInt(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d{1,9}$/.test(value)) return undefined;
  return Number(value);
}

function parsePrice(value: string | undefined): Pick<ListingParams, 'priceMin' | 'priceMax'> {
  const match = value?.match(/^(\d{0,9})-(\d{0,9})$/);
  if (!match) return {};
  let min = match[1] ? Number(match[1]) : undefined;
  let max = match[2] ? Number(match[2]) : undefined;
  if (min !== undefined && max !== undefined && min > max) [min, max] = [max, min];
  return {
    ...(min !== undefined && min > 0 ? { priceMin: min } : {}),
    ...(max !== undefined ? { priceMax: max } : {}),
  };
}

/**
 * Lenient parser shared by the web URL and the API: invalid values are dropped, never thrown,
 * so a hand-edited or stale link still renders a sensible listing.
 */
export function parseListingParams(source: ParamSource): ListingParams {
  const q = normalizeQuery(read(source, 'q'));
  const category = read(source, 'category');
  const brands = [
    ...new Set(
      (read(source, 'brand') ?? '')
        .split(',')
        .map((b) => b.trim())
        .filter((b) => SLUG.test(b)),
    ),
  ]
    .sort()
    .slice(0, MAX_BRANDS);
  const rating = Number(read(source, 'rating'));
  const sort = read(source, 'sort');
  const page = parsePositiveInt(read(source, 'page'));
  const pageSize = parsePositiveInt(read(source, 'pageSize'));

  return {
    ...(q ? { q } : {}),
    ...(category && SLUG.test(category) ? { category } : {}),
    brands,
    ...parsePrice(read(source, 'price')),
    ...((RATING_FILTERS as readonly number[]).includes(rating) ? { rating: rating as RatingFilter } : {}),
    inStock: read(source, 'inStock') === '1',
    sort: sortOptionsFor({ q }).includes(sort as SortOption) ? (sort as SortOption) : defaultSort({ q }),
    page: page && page >= 1 ? page : 1,
    pageSize: pageSize && pageSize >= 1 ? Math.min(pageSize, MAX_PAGE_SIZE) : DEFAULT_PAGE_SIZE,
  };
}

/** Canonical query string: fixed key order, defaults omitted. */
export function serializeListingParams(
  params: Partial<ListingParams>,
  options: { omitCategory?: boolean } = {},
): URLSearchParams {
  const out = new URLSearchParams();
  if (params.q) out.set('q', params.q);
  if (params.category && !options.omitCategory) out.set('category', params.category);
  if (params.brands?.length) out.set('brand', [...new Set(params.brands)].sort().join(','));
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    out.set('price', `${params.priceMin ?? ''}-${params.priceMax ?? ''}`);
  }
  if (params.rating) out.set('rating', String(params.rating));
  if (params.inStock) out.set('inStock', '1');
  if (params.sort && params.sort !== defaultSort(params)) out.set('sort', params.sort);
  if (params.page && params.page > 1) out.set('page', String(params.page));
  if (params.pageSize && params.pageSize !== DEFAULT_PAGE_SIZE) out.set('pageSize', String(params.pageSize));
  return out;
}

/** Number of active filters (not counting sort or page), for the mobile "Filters (3)" button. */
export function countActiveFilters(params: ListingParams, options: { includeCategory: boolean }): number {
  return (
    (options.includeCategory && params.category ? 1 : 0) +
    params.brands.length +
    (params.priceMin !== undefined || params.priceMax !== undefined ? 1 : 0) +
    (params.rating ? 1 : 0) +
    (params.inStock ? 1 : 0)
  );
}
