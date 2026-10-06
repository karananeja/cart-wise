import {
  RATING_FILTERS,
  type FacetValue,
  type FilterGroup,
  type ListingParams,
  type ListingResponse,
  type ProductSummary,
  type Relaxation,
  type SortOption,
} from '@store/shared';

export interface CatalogItem {
  summary: ProductSummary;
  brandSlug: string | null;
  /** onHand − reserved, from application inventory. */
  available: number;
  catalogOrder: number;
}

type Predicate = (item: CatalogItem) => boolean;

function buildPredicates(params: ListingParams): Partial<Record<FilterGroup, Predicate>> {
  const predicates: Partial<Record<FilterGroup, Predicate>> = {};
  const { category, brands, priceMin, priceMax, rating, inStock } = params;

  if (category) predicates.category = (i) => i.summary.categorySlug === category;
  if (brands.length) {
    const selected = new Set(brands);
    predicates.brand = (i) => i.brandSlug !== null && selected.has(i.brandSlug);
  }
  if (priceMin !== undefined || priceMax !== undefined) {
    predicates.price = (i) =>
      (priceMin === undefined || i.summary.pricePaise >= priceMin * 100) &&
      (priceMax === undefined || i.summary.pricePaise <= priceMax * 100);
  }
  if (rating) predicates.rating = (i) => i.summary.rating >= rating;
  if (inStock) predicates.inStock = (i) => i.available > 0;
  return predicates;
}

const SORTERS: Record<SortOption, (a: CatalogItem, b: CatalogItem) => number> = {
  featured: () => 0,
  price_asc: (a, b) => a.summary.pricePaise - b.summary.pricePaise,
  price_desc: (a, b) => b.summary.pricePaise - a.summary.pricePaise,
  rating: (a, b) => b.summary.rating - a.summary.rating,
  discount: (a, b) => b.summary.discountPercent - a.summary.discountPercent,
};

/** Available items always come before out-of-stock items, whatever the sort (FR-12). */
function compare(sort: SortOption) {
  return (a: CatalogItem, b: CatalogItem) =>
    Number(a.available === 0) - Number(b.available === 0) || SORTERS[sort](a, b) || a.catalogOrder - b.catalogOrder;
}

/**
 * Filters, facets, sorts and paginates the catalog in memory. The catalog is ~200 products,
 * so this is cheap; facet counts use disjunctive faceting (each facet ignores its own filter).
 */
export function queryCatalog(
  items: CatalogItem[],
  params: ListingParams,
  categories: { slug: string; name: string }[],
): ListingResponse {
  const predicates = buildPredicates(params);
  const groups = Object.keys(predicates) as FilterGroup[];
  const matchesExcept = (item: CatalogItem, excluded?: FilterGroup) =>
    groups.every((group) => group === excluded || predicates[group]!(item));
  const countExcept = (excluded: FilterGroup, extra: Predicate = () => true) =>
    items.filter((item) => matchesExcept(item, excluded) && extra(item)).length;

  const matched = items.filter((item) => matchesExcept(item)).sort(compare(params.sort));
  const total = matched.length;
  const lastPage = Math.max(1, Math.ceil(total / params.pageSize));
  const page = Math.min(params.page, lastPage);
  const start = (page - 1) * params.pageSize;

  const priced = items.filter((item) => matchesExcept(item, 'price')).map((item) => item.summary.pricePaise);

  const relaxations: Relaxation[] =
    total === 0
      ? groups.map((filter) => ({ filter, total: countExcept(filter) })).sort((a, b) => b.total - a.total)
      : [];

  return {
    items: matched.slice(start, start + params.pageSize).map((item) => item.summary),
    page,
    pageSize: params.pageSize,
    total,
    facets: {
      categories: categories.map((c) => ({
        value: c.slug,
        label: c.name,
        count: countExcept('category', (i) => i.summary.categorySlug === c.slug),
      })),
      brands: brandFacet(items, params, predicates.category, (i) => matchesExcept(i, 'brand')),
      ratings: RATING_FILTERS.map((value) => ({ value, count: countExcept('rating', (i) => i.summary.rating >= value) })),
      inStock: countExcept('inStock', (i) => i.available > 0),
      price: priced.length
        ? { min: Math.floor(Math.min(...priced) / 100), max: Math.ceil(Math.max(...priced) / 100) }
        : null,
    },
    relaxations,
  };
}

/**
 * Brands present in the current category, ordered by how many products they have there (a
 * stable order that does not jump around as other filters change). Counts apply the other
 * filters. Selected brands are always listed so they can be deselected.
 */
function brandFacet(
  items: CatalogItem[],
  params: ListingParams,
  inCategory: Predicate | undefined,
  matchesOtherFilters: Predicate,
): FacetValue[] {
  const brands = new Map<string, { label: string; scopeCount: number; count: number }>();
  for (const item of items) {
    if (!item.brandSlug || !item.summary.brand || (inCategory && !inCategory(item))) continue;
    const entry = brands.get(item.brandSlug) ?? { label: item.summary.brand, scopeCount: 0, count: 0 };
    entry.scopeCount += 1;
    if (matchesOtherFilters(item)) entry.count += 1;
    brands.set(item.brandSlug, entry);
  }
  for (const slug of params.brands) {
    if (!brands.has(slug)) brands.set(slug, { label: slug, scopeCount: 0, count: 0 });
  }
  return [...brands.entries()]
    .sort(([, a], [, b]) => b.scopeCount - a.scopeCount || a.label.localeCompare(b.label))
    .map(([value, { label, count }]) => ({ value, label, count }));
}
