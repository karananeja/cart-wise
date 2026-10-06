export type AvailabilityStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface Availability {
  status: AvailabilityStatus;
  /** Present only for `low_stock`, so the UI can say "Only N left". */
  available?: number;
}

export interface Category {
  slug: string;
  name: string;
  imageUrl: string;
  productCount: number;
}

export interface ProductSummary {
  id: number;
  slug: string;
  title: string;
  brand: string | null;
  categorySlug: string;
  mrpPaise: number;
  pricePaise: number;
  /** Whole percent; 0 means no discount. */
  discountPercent: number;
  /** Average of the product's reviews (one decimal). */
  rating: number;
  reviewCount: number;
  thumbnailUrl: string;
  /** For sized products, the total across sizes; for products with options, across tiers. */
  availability: Availability;
  /**
   * Sold in options with their own prices (F-013): the price fields are then the cheapest tier's,
   * shown as "From".
   */
  hasOptions: boolean;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export interface ProductSize {
  label: string;
  availability: Availability;
}

/** A storage or memory option with its own price and stock (F-013). */
export interface ProductOption {
  label: string;
  mrpPaise: number;
  pricePaise: number;
  discountPercent: number;
  availability: Availability;
}

export interface ProductReview {
  rating: number;
  comment: string;
  reviewerName: string;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  categoryName: string;
  imageUrls: string[];
  specifications: ProductSpecification[];
  /** Empty for products sold without sizes. In size order. */
  sizes: ProductSize[];
  /** Empty for products without options. In tier order, cheapest first. */
  options: ProductOption[];
  /** What the options are called ("Storage", "Configuration"); null without options. */
  optionName: string | null;
  reviews: ProductReview[];
}

export interface FacetValue {
  value: string;
  label: string;
  count: number;
}

export interface ListingFacets {
  categories: FacetValue[];
  brands: FacetValue[];
  ratings: { value: RatingFilter; count: number }[];
  /** Number of available products under the other active filters. */
  inStock: number;
  /** Whole rupees; null when nothing matches the other filters. */
  price: { min: number; max: number } | null;
}

export type FilterGroup = 'category' | 'brand' | 'price' | 'rating' | 'inStock';

export interface Relaxation {
  filter: FilterGroup;
  /** Result count if only this filter group were removed. */
  total: number;
}

export type SearchMatchMode = 'all' | 'partial';

export interface ListingResponse {
  items: ProductSummary[];
  page: number;
  pageSize: number;
  total: number;
  facets: ListingFacets;
  /** Populated only when `total` is 0. Sorted by `total`, largest first. */
  relaxations: Relaxation[];
  /** Present when the request had a search query. `partial`: no product matched every word. */
  search?: { query: string; matchMode: SearchMatchMode };
}

export interface SearchSuggestions {
  categories: { slug: string; name: string }[];
  products: ProductSummary[];
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: Record<string, unknown> };
}

export const RATING_FILTERS = [4, 3] as const;
export type RatingFilter = (typeof RATING_FILTERS)[number];
