import type { Category, ListingResponse, ProductSummary } from '@store/shared';

export function product(overrides: Partial<ProductSummary> & Pick<ProductSummary, 'id'>): ProductSummary {
  return {
    slug: `product-${overrides.id}`,
    title: `Product ${overrides.id}`,
    brand: 'Apple',
    categorySlug: 'laptops',
    mrpPaise: 100_000_00,
    pricePaise: 90_000_00,
    discountPercent: 10,
    rating: 4.2,
    thumbnailUrl: `https://img.test/${overrides.id}.webp`,
    availability: { status: 'in_stock' },
    ...overrides,
  };
}

export const categories: Category[] = [
  { slug: 'laptops', name: 'Laptops', imageUrl: 'https://img.test/laptops.webp', productCount: 3 },
  { slug: 'phones', name: 'Phones', imageUrl: 'https://img.test/phones.webp', productCount: 1 },
];

export const products = [
  product({ id: 1, title: 'MacBook Pro', brand: 'Apple', rating: 4.6 }),
  product({ id: 2, title: 'Zenbook', brand: 'Asus', rating: 4.1, discountPercent: 0, pricePaise: 80_000_00, mrpPaise: 80_000_00 }),
  product({ id: 3, title: 'XPS 13', brand: 'Dell', rating: 3.5, availability: { status: 'out_of_stock' } }),
  product({ id: 4, title: 'iPhone', brand: 'Apple', categorySlug: 'phones', rating: 4.8 }),
];

export function listing(items: ProductSummary[], overrides: Partial<ListingResponse> = {}): ListingResponse {
  return {
    items,
    page: 1,
    pageSize: 24,
    total: items.length,
    facets: {
      categories: [
        { value: 'laptops', label: 'Laptops', count: 3 },
        { value: 'phones', label: 'Phones', count: 1 },
      ],
      brands: [
        { value: 'apple', label: 'Apple', count: 2 },
        { value: 'asus', label: 'Asus', count: 1 },
        { value: 'dell', label: 'Dell', count: 1 },
      ],
      ratings: [
        { value: 4, count: 3 },
        { value: 3, count: 4 },
      ],
      inStock: 3,
      price: { min: 80000, max: 90000 },
    },
    relaxations: [],
    ...overrides,
  };
}
