import type { Category, ListingResponse, ProductDetail, ProductSummary } from '@store/shared';

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
    reviewCount: 3,
    thumbnailUrl: `https://img.test/${overrides.id}.webp`,
    availability: { status: 'in_stock' },
    hasOptions: false,
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

export function productDetail(overrides: Partial<ProductDetail> & Pick<ProductDetail, 'id'>): ProductDetail {
  return {
    ...product(overrides),
    description: 'A product description.',
    categoryName: 'Laptops',
    imageUrls: ['https://img.test/a.webp', 'https://img.test/b.webp', 'https://img.test/c.webp'],
    specifications: [{ label: 'Warranty', value: '1 year warranty' }],
    sizes: [],
    options: [],
    optionName: null,
    reviews: [
      { rating: 5, comment: 'Love it', reviewerName: 'Asha Rao' },
      { rating: 4, comment: 'Good value', reviewerName: 'Vikram Shah' },
      { rating: 3, comment: 'Okay', reviewerName: 'Meera Iyer' },
    ],
    ...overrides,
  };
}

/** A sized product: S and XL sold out, M low on stock. */
export const shirt = productDetail({
  id: 50,
  slug: 'check-shirt',
  title: 'Check Shirt',
  categorySlug: 'mens-shirts',
  categoryName: "Men's Shirts",
  sizes: [
    { label: 'S', availability: { status: 'out_of_stock' } },
    { label: 'M', availability: { status: 'low_stock', available: 2 } },
    { label: 'L', availability: { status: 'in_stock' } },
    { label: 'XL', availability: { status: 'out_of_stock' } },
  ],
});

/** A phone sold in storage options (F-013): 128 GB in stock, 256 GB low, 512 GB sold out. */
export const phone = productDetail({
  id: 70,
  slug: 'galaxy-phone',
  title: 'Galaxy Phone',
  brand: 'Samsung',
  categorySlug: 'smartphones',
  categoryName: 'Smartphones',
  pricePaise: 30_000_00,
  mrpPaise: 33_000_00,
  discountPercent: 9,
  hasOptions: true,
  optionName: 'Storage',
  options: [
    { label: '128 GB', pricePaise: 30_000_00, mrpPaise: 33_000_00, discountPercent: 9, availability: { status: 'in_stock' } },
    { label: '256 GB', pricePaise: 33_000_00, mrpPaise: 36_300_00, discountPercent: 9, availability: { status: 'low_stock', available: 2 } },
    { label: '512 GB', pricePaise: 37_500_00, mrpPaise: 41_250_00, discountPercent: 9, availability: { status: 'out_of_stock' } },
  ],
});

/** Cheaper products for bank-offer thresholds (F-009); product pages only, not listings. */
const priced = (id: number, slug: string, title: string, pricePaise: number, overrides: Partial<ProductDetail> = {}) =>
  productDetail({ id, slug, title, pricePaise, mrpPaise: pricePaise, discountPercent: 0, categorySlug: 'accessories', categoryName: 'Accessories', sizes: [], ...overrides });

export const productDetails: ProductDetail[] = [
  ...products.map((p) => productDetail({ ...p, categoryName: p.categorySlug === 'phones' ? 'Phones' : 'Laptops' })),
  shirt,
  phone,
  priced(60, 'usb-cable', 'USB Cable', 1_200_00),
  priced(61, 'phone-case', 'Phone Case', 800_00),
  priced(62, 'headphones', 'Headphones', 6_000_00),
  priced(63, 'sold-out-speaker', 'Sold-out Speaker', 6_000_00, { availability: { status: 'out_of_stock' } }),
];
