import request from 'supertest';
import { beforeAll, describe, expect, it } from 'vitest';
import type { ListingResponse } from '@store/shared';
import { createApp } from './app.js';
import { openDatabase, type Db } from './db/database.js';
import { seedDatabase } from './db/seed.js';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  app = createApp(db);
});

describe('GET /api/categories', () => {
  it('lists every imported category alphabetically with product counts', async () => {
    const res = await request(app).get('/api/categories').expect(200);
    expect(res.body.categories).toHaveLength(24);
    expect(res.body.categories.map((c: { slug: string }) => c.slug)).toContain('vehicle');
    const total = res.body.categories.reduce((sum: number, c: { productCount: number }) => sum + c.productCount, 0);
    expect(total).toBe(194);
    const names = res.body.categories.map((c: { name: string }) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)));
  });
});

describe('GET /api/products', () => {
  it('returns the first page of all products by default', async () => {
    const res = await request(app).get('/api/products').expect(200);
    const body = res.body as ListingResponse;
    expect(body).toMatchObject({ page: 1, pageSize: 24, total: 194 });
    expect(body.items).toHaveLength(24);
  });

  it('applies filters from the query string', async () => {
    const res = await request(app).get('/api/products?category=laptops&sort=price_asc').expect(200);
    const prices = (res.body as ListingResponse).items.map((i) => i.pricePaise);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
    expect((res.body as ListingResponse).items.every((i) => i.categorySlug === 'laptops')).toBe(true);
  });

  it('ignores invalid parameters', async () => {
    const res = await request(app).get('/api/products?sort=nonsense&page=abc&rating=9').expect(200);
    expect(res.body).toMatchObject({ page: 1, total: 194 });
  });

  it('404s for an unknown category', async () => {
    const res = await request(app).get('/api/products?category=not-a-category').expect(404);
    expect(res.body).toEqual({ error: { code: 'CATEGORY_NOT_FOUND', message: 'Category not found' } });
  });

  it('derives availability from application inventory without exposing stock counts', async () => {
    db.prepare("UPDATE inventory SET on_hand = 3, reserved = 1 WHERE product_id = (SELECT id FROM products WHERE slug = 'essence-mascara-lash-princess')").run();
    const res = await request(app).get('/api/products?category=beauty').expect(200);
    const mascara = (res.body as ListingResponse).items.find((i) => i.slug === 'essence-mascara-lash-princess');
    expect(mascara?.availability).toEqual({ status: 'low_stock', available: 2 });
    expect(JSON.stringify(res.body)).not.toMatch(/on_?hand|reserved|"stock"/i);
  });
});

describe('search', () => {
  it('searches with q, sorts by relevance and reports the match mode', async () => {
    const res = await request(app).get('/api/products?q=lapotp').expect(200);
    const body = res.body as ListingResponse;
    expect(body.total).toBe(5);
    expect(body.search).toEqual({ query: 'lapotp', matchMode: 'all' });
    expect(body.items.every((i) => i.categorySlug === 'laptops')).toBe(true);
  });

  it('combines q with filters, sort and pagination', async () => {
    const res = await request(app).get('/api/products?q=phone&brand=apple&sort=price_asc&pageSize=2&page=2').expect(200);
    const body = res.body as ListingResponse;
    expect(body.page).toBe(2);
    expect(body.items).toHaveLength(2);
    expect(body.items.every((i) => i.brand === 'Apple')).toBe(true);
    expect(body.facets.brands.find((b) => b.value === 'samsung')?.count).toBeGreaterThan(0);
  });

  it('marks partial matches and returns zero results for nonsense', async () => {
    expect((await request(app).get('/api/products?q=red+leather+office+chair')).body.search.matchMode).toBe('partial');
    const none = (await request(app).get('/api/products?q=qwxzv')).body as ListingResponse;
    expect(none.total).toBe(0);
  });

  it('ignores a relevance sort without a query', async () => {
    const res = await request(app).get('/api/products?sort=relevance').expect(200);
    expect(res.body).not.toHaveProperty('search');
    expect(res.body.total).toBe(194);
  });

  it('suggests categories and up to five products', async () => {
    const res = await request(app).get('/api/search/suggestions?q=lap').expect(200);
    expect(res.body.categories).toEqual([{ slug: 'laptops', name: 'Laptops' }]);
    expect(res.body.products).toHaveLength(5);
    expect(res.body.products[0]).toHaveProperty('pricePaise');

    const many = await request(app).get('/api/search/suggestions?q=apple').expect(200);
    expect(many.body.products).toHaveLength(5);
  });

  it('returns empty suggestions for short queries and caps long ones', async () => {
    expect((await request(app).get('/api/search/suggestions?q=l')).body).toEqual({ categories: [], products: [] });
    await request(app).get(`/api/search/suggestions?q=${'a'.repeat(5000)}`).expect(200);
    const long = await request(app).get(`/api/products?q=laptop${'%20x'.repeat(200)}`).expect(200);
    expect(long.body.search.query.length).toBeLessThanOrEqual(100);
  });
});

describe('GET /api/products/:slug', () => {
  it('returns product details', async () => {
    const res = await request(app).get('/api/products/essence-mascara-lash-princess').expect(200);
    expect(res.body.product).toMatchObject({
      title: 'Essence Mascara Lash Princess',
      categoryName: 'Beauty',
      mrpPaise: 999,
      discountPercent: 10,
    });
    expect(res.body.product.imageUrls.length).toBeGreaterThan(0);
  });

  it('404s for an unknown product', async () => {
    await request(app).get('/api/products/nope').expect(404);
  });
});

describe('F-003 product details', () => {
  const detail = async (slug: string) => (await request(app).get(`/api/products/${slug}`).expect(200)).body.product;
  const slugIn = (category: string) =>
    (db.prepare('SELECT slug FROM products WHERE category_slug = ? ORDER BY id LIMIT 1').get(category) as { slug: string }).slug;

  it('returns sizes in order for sized products and none otherwise', async () => {
    expect((await detail(slugIn('mens-shirts'))).sizes.map((s: { label: string }) => s.label)).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    expect((await detail(slugIn('mens-shoes'))).sizes).toHaveLength(6);
    expect((await detail(slugIn('laptops'))).sizes).toEqual([]);
  });

  it('seeds sold-out and low-stock sizes', () => {
    const units = db.prepare('SELECT MAX(on_hand - reserved, 0) AS a FROM inventory WHERE variant_id IS NOT NULL').all() as { a: number }[];
    expect(units.some((u) => u.a === 0)).toBe(true);
    expect(units.some((u) => u.a >= 1 && u.a <= 5)).toBe(true);
  });

  it('returns reviews without emails, and a rating equal to their average', async () => {
    const product = await detail('essence-mascara-lash-princess');
    expect(product.reviews).toHaveLength(3);
    expect(product.reviews[0]).toEqual({ rating: 3, comment: 'Would not recommend!', reviewerName: 'Eleanor Collins' });
    expect(product.rating).toBe(4);
    expect(product.reviewCount).toBe(3);
    expect(JSON.stringify(product)).not.toMatch(/@|reviewerEmail|date/);
  });

  it('aggregates size stock for product availability, listings and the in-stock filter', async () => {
    const slug = slugIn('tops');
    const id = (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug) as { id: number }).id;
    const setStock = (onHand: number) => db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = ?').run(onHand, id);

    setStock(0);
    db.prepare('UPDATE inventory SET on_hand = 2 WHERE id = (SELECT MIN(id) FROM inventory WHERE product_id = ?)').run(id);
    expect((await detail(slug)).availability).toEqual({ status: 'low_stock', available: 2 });

    setStock(0);
    expect((await detail(slug)).availability).toEqual({ status: 'out_of_stock' });
    const inStock = (await request(app).get('/api/products?category=tops&inStock=1')).body as ListingResponse;
    expect(inStock.items.some((i) => i.slug === slug)).toBe(false);

    setStock(4);
    expect((await detail(slug)).availability).toEqual({ status: 'in_stock' });
  });

  it('looks up summaries by slug in request order, skipping unknown and invalid slugs', async () => {
    const res = await request(app).get('/api/products/batch?slugs=iphone-x,nope,essence-mascara-lash-princess,Bad%20Slug,iphone-x').expect(200);
    expect(res.body.items.map((i: { slug: string }) => i.slug)).toEqual(['iphone-x', 'essence-mascara-lash-princess']);
    expect(res.body.items[0]).toHaveProperty('reviewCount');
    expect((await request(app).get('/api/products/batch')).body).toEqual({ items: [] });
  });
});

describe('POST /api/events', () => {
  const event = {
    name: 'filter_applied',
    properties: { filter: 'brand', value: 'apple', resultCount: 3, categorySlug: 'laptops' },
    visitorId: 'visitor-12345',
    occurredAt: new Date().toISOString(),
  };

  it('stores valid events', async () => {
    await request(app).post('/api/events').send({ events: [event] }).expect(202);
    const row = db.prepare("SELECT * FROM analytics_events WHERE name = 'filter_applied'").get() as { properties: string };
    expect(JSON.parse(row.properties)).toEqual(event.properties);
  });

  it('accepts sendBeacon text/plain bodies', async () => {
    await request(app).post('/api/events').set('Content-Type', 'text/plain').send(JSON.stringify({ events: [event] })).expect(202);
  });

  it('rejects unknown event names and malformed bodies', async () => {
    await request(app).post('/api/events').send({ events: [{ ...event, name: 'page_spam' }] }).expect(400);
    await request(app).post('/api/events').set('Content-Type', 'application/json').send('{bad').expect(400);
  });
});

it('seeding twice gives identical catalog and inventory', () => {
  const snapshot = () => db.prepare('SELECT p.slug, p.price_paise, i.on_hand FROM products p JOIN inventory i ON i.product_id = p.id ORDER BY p.id').all();
  seedDatabase(db);
  const first = snapshot();
  seedDatabase(db);
  expect(snapshot()).toEqual(first);
});
