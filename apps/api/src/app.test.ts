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
