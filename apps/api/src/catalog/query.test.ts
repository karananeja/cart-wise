import { describe, expect, it } from 'vitest';
import { parseListingParams, type ProductSummary } from '@store/shared';
import { queryCatalog, type CatalogItem } from './query.js';

const categories = [
  { slug: 'laptops', name: 'Laptops' },
  { slug: 'phones', name: 'Phones' },
];

let order = 0;
function item(o: { id: number; category?: string; brand?: string | null; price: number; rating?: number; discount?: number; available?: number }): CatalogItem {
  const brand = o.brand === undefined ? 'Apple' : o.brand;
  const summary: ProductSummary = {
    id: o.id,
    slug: `p-${o.id}`,
    title: `Product ${o.id}`,
    brand,
    categorySlug: o.category ?? 'laptops',
    mrpPaise: o.price * 100,
    pricePaise: o.price * 100,
    discountPercent: o.discount ?? 0,
    rating: o.rating ?? 4,
    thumbnailUrl: '',
    availability: { status: (o.available ?? 10) > 0 ? 'in_stock' : 'out_of_stock' },
  };
  return { summary, brandSlug: brand ? brand.toLowerCase() : null, available: o.available ?? 10, catalogOrder: order++ };
}

const items = [
  item({ id: 1, brand: 'Apple', price: 1000, rating: 4.5, discount: 5 }),
  item({ id: 2, brand: 'Asus', price: 800, rating: 3.2, discount: 20, available: 0 }),
  item({ id: 3, brand: 'Asus', price: 600, rating: 4.1, discount: 10 }),
  item({ id: 4, brand: 'Dell', price: 1200, rating: 2.5 }),
  item({ id: 5, category: 'phones', brand: 'Apple', price: 900, rating: 4.8, discount: 15 }),
  item({ id: 6, category: 'phones', brand: null, price: 100, rating: 3.9 }),
];

const query = (qs: string) => queryCatalog(items, parseListingParams(new URLSearchParams(qs)), categories);
const ids = (qs: string) => query(qs).items.map((i) => i.id);

describe('filters', () => {
  it('filters by category', () => {
    expect(ids('category=phones')).toEqual([5, 6]);
  });

  it('filters by any of several brands', () => {
    expect(ids('brand=asus,dell')).toEqual([3, 4, 2]);
  });

  it('filters by inclusive price range in rupees', () => {
    expect(ids('price=600-900')).toEqual([3, 5, 2]);
    expect(ids('price=1000-')).toEqual([1, 4]);
  });

  it('filters by minimum rating', () => {
    expect(ids('rating=4')).toEqual([1, 3, 5]);
  });

  it('filters to available products', () => {
    expect(ids('inStock=1')).not.toContain(2);
  });

  it('combines filters', () => {
    expect(ids('category=laptops&brand=asus&rating=4')).toEqual([3]);
  });
});

describe('sorting', () => {
  it.each([
    ['featured', [1, 3, 4, 5, 6, 2]],
    ['price_asc', [6, 3, 5, 1, 4, 2]],
    ['price_desc', [4, 1, 5, 3, 6, 2]],
    ['rating', [5, 1, 3, 6, 4, 2]],
    ['discount', [5, 3, 1, 4, 6, 2]],
  ])('%s puts out-of-stock items last', (sort, expected) => {
    expect(ids(`sort=${sort}`)).toEqual(expected);
  });
});

describe('pagination', () => {
  it('pages results and reports the total', () => {
    const page2 = query('pageSize=4&page=2');
    expect(page2).toMatchObject({ page: 2, pageSize: 4, total: 6 });
    expect(page2.items.map((i) => i.id)).toEqual([6, 2]);
  });

  it('clamps a page beyond the end to the last page', () => {
    expect(query('pageSize=4&page=9').page).toBe(2);
    expect(query('category=phones&brand=dell&page=3').page).toBe(1);
  });
});

describe('facets', () => {
  it('counts brands with every filter except brand, so other brands stay selectable', () => {
    const { brands } = query('category=laptops&brand=asus').facets;
    expect(brands).toEqual([
      { value: 'asus', label: 'Asus', count: 2 },
      { value: 'apple', label: 'Apple', count: 1 },
      { value: 'dell', label: 'Dell', count: 1 },
    ]);
  });

  it('keeps zero-count brands in scope so they can be shown disabled', () => {
    const { brands } = query('category=laptops&rating=4').facets;
    expect(brands.find((b) => b.value === 'dell')).toEqual({ value: 'dell', label: 'Dell', count: 0 });
  });

  it('lists a selected brand outside the category so it can be cleared', () => {
    expect(query('category=phones&brand=dell').facets.brands).toContainEqual({ value: 'dell', label: 'dell', count: 0 });
  });

  it('counts categories, ratings, stock and price ignoring their own filter', () => {
    const { facets } = query('category=laptops&rating=4&inStock=1&price=700-');
    expect(facets.categories).toEqual([
      { value: 'laptops', label: 'Laptops', count: 1 },
      { value: 'phones', label: 'Phones', count: 1 },
    ]);
    expect(facets.ratings).toEqual([
      { value: 4, count: 1 },
      { value: 3, count: 1 },
    ]);
    expect(facets.inStock).toBe(1);
    expect(facets.price).toEqual({ min: 600, max: 1000 });
  });

  it('returns a null price facet when nothing matches the other filters', () => {
    expect(query('category=phones&brand=dell').facets.price).toBeNull();
  });
});

describe('relaxations', () => {
  it('suggests which single filter removal brings results back, largest first', () => {
    const result = query('category=laptops&brand=dell&rating=4');
    expect(result.total).toBe(0);
    expect(result.relaxations).toEqual([
      { filter: 'brand', total: 2 },
      { filter: 'category', total: 0 },
      { filter: 'rating', total: 1 },
    ].sort((a, b) => b.total - a.total));
  });

  it('is empty when there are results', () => {
    expect(query('category=laptops').relaxations).toEqual([]);
  });
});

describe('relevance', () => {
  const relevance = new Map([
    [3, 1],
    [1, 5],
    [2, 9],
  ]);
  const search = (qs: string) => queryCatalog(items, parseListingParams(new URLSearchParams(qs)), categories, relevance);

  it('limits results and facets to matching products', () => {
    const result = search('q=x');
    expect(result.total).toBe(3);
    expect(result.facets.categories.find((c) => c.value === 'phones')?.count).toBe(0);
  });

  it('orders by score, still putting out-of-stock last', () => {
    expect(search('q=x').items.map((i) => i.id)).toEqual([1, 3, 2]);
  });

  it('allows other sorts on search results', () => {
    expect(search('q=x&sort=price_asc').items.map((i) => i.id)).toEqual([3, 1, 2]);
  });
});
