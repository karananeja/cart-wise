import { describe, expect, it } from 'vitest';
import type { DummyJsonProduct } from './dummyjson.js';
import { applyDiscount, categoryName, mapCatalog, ratingFromReviews, slugify, toPaise } from './mapping.js';

const product = (overrides: Partial<DummyJsonProduct>): DummyJsonProduct => ({
  id: 1,
  title: 'Item',
  description: 'desc',
  category: 'beauty',
  price: 10,
  discountPercentage: 0,
  rating: 4.123,
  images: ['a.webp'],
  thumbnail: 't.webp',
  ...overrides,
});

describe('price conversion', () => {
  it('converts USD to paise at the configured rate', () => {
    expect(toPaise(9.99, 1)).toBe(999);
    expect(toPaise(9.99, 85)).toBe(84915);
  });

  it('treats upstream price as MRP and applies the discount', () => {
    expect(applyDiscount(10000, 10.48)).toEqual({ pricePaise: 8952, discountPercent: 10 });
  });

  it('ignores discounts below 1%', () => {
    expect(applyDiscount(10000, 0.4)).toEqual({ pricePaise: 10000, discountPercent: 0 });
  });
});

describe('ratingFromReviews', () => {
  it('averages review ratings to one decimal', () => {
    expect(ratingFromReviews([{ rating: 3 }, { rating: 4 }, { rating: 5 }], 2.56)).toBe(4);
    expect(ratingFromReviews([{ rating: 4 }, { rating: 5 }, { rating: 5 }], 1)).toBe(4.7);
  });

  it('falls back to the catalog rating without reviews', () => {
    expect(ratingFromReviews([], 4.123)).toBe(4.1);
  });
});

describe('names and slugs', () => {
  it('slugifies titles', () => {
    expect(slugify("Gucci Bloom Eau de Parfum — Women's")).toBe('gucci-bloom-eau-de-parfum-womens');
  });

  it('prettifies category slugs', () => {
    expect(categoryName('mens-shirts')).toBe("Men's Shirts");
    expect(categoryName('womens-jewellery')).toBe("Women's Jewellery");
    expect(categoryName('home-decoration')).toBe('Home Decoration');
  });
});

describe('mapCatalog', () => {
  const { products, categories } = mapCatalog(
    [
      product({
        id: 1,
        title: 'Lamp',
        category: 'home-decoration',
        brand: ' Acme Co ',
        reviews: [{ rating: 5, comment: 'Great', date: '2025-04-30', reviewerName: 'Asha', reviewerEmail: 'asha@x.test' }],
      }),
      product({ id: 2, title: 'Lamp', category: 'home-decoration', thumbnail: 'second.webp' }),
      product({ id: 3, title: 'Shirt', category: 'mens-shirts' }),
    ],
    1,
  );

  it('de-duplicates slugs using the upstream id', () => {
    expect(products.map((p) => p.slug)).toEqual(['lamp', 'lamp-2', 'shirt']);
  });

  it('keeps the upstream id separate from application fields', () => {
    expect(products[0]).toMatchObject({ externalCatalogId: 'dummyjson:1', brand: 'Acme Co', brandSlug: 'acme-co', rating: 5 });
    expect(products[1]).toMatchObject({ rating: 4.1, reviews: [] });
    expect(products[1]).toMatchObject({ brand: null, brandSlug: null });
  });

  it('keeps review text and name but drops email and date', () => {
    expect(products[0]!.reviews).toEqual([{ rating: 5, comment: 'Great', reviewerName: 'Asha' }]);
  });

  it('derives categories in first-seen order, imaged by their first product', () => {
    expect(categories).toEqual([
      { slug: 'home-decoration', name: 'Home Decoration', imageUrl: 't.webp', sortOrder: 0 },
      { slug: 'mens-shirts', name: "Men's Shirts", imageUrl: 't.webp', sortOrder: 1 },
    ]);
  });
});
