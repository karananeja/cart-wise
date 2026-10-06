import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartView } from '@store/shared';
import { createApp } from '../app.js';
import { createCatalogRepository } from '../catalog/repository.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { createCartService } from './service.js';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  app = createApp(db);
});

const UNSIZED = 'essence-mascara-lash-princess';

function sizedProduct() {
  return db
    .prepare(
      `SELECT p.slug, v.label, i.on_hand AS onHand, v.id AS variantId FROM products p
       JOIN product_variants v ON v.product_id = p.id JOIN inventory i ON i.variant_id = v.id
       WHERE p.category_slug = 'mens-shirts' AND i.on_hand >= 3 ORDER BY p.id, v.sort_order LIMIT 1`,
    )
    .get() as { slug: string; label: string; onHand: number; variantId: number };
}

const setUnsizedStock = (slug: string, onHand: number) =>
  db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = ?)').run(onHand, slug);

/** A browser: keeps the cart cookie between requests. */
function browser() {
  return request.agent(app);
}

describe('cart', () => {
  it('starts empty and does not create a cart or cookie on read', async () => {
    const res = await request(app).get('/api/cart').expect(200);
    expect(res.body).toMatchObject({ lines: [], totalQuantity: 0 });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('creates a cart on first add with an HTTP-only cookie, and computes totals server-side', async () => {
    const res = await browser().post('/api/cart/lines').send({ productSlug: UNSIZED, pricePaise: 1 }).expect(200);
    const cookie = String(res.headers['set-cookie']);
    expect(cookie).toMatch(/cart_id=[\w-]{20,}/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);

    const cart = res.body as CartView;
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]).toMatchObject({ size: null, quantity: 1, issue: 'none', linePricePaise: 85853, lineMrpPaise: 95904 });
    expect(cart.totals).toEqual({ itemCount: 1, mrpPaise: 95904, discountPaise: 10051, subtotalPaise: 85853 });
  });

  it('keeps the cart across requests and isolates different browsers', async () => {
    const a = browser();
    await a.post('/api/cart/lines').send({ productSlug: UNSIZED }).expect(200);
    expect(((await a.get('/api/cart')).body as CartView).totalQuantity).toBe(1);
    expect(((await browser().get('/api/cart')).body as CartView).totalQuantity).toBe(0);
  });

  it('merges repeat adds of the same product and size into one line', async () => {
    const a = browser();
    await a.post('/api/cart/lines').send({ productSlug: UNSIZED }).expect(200);
    const cart = (await a.post('/api/cart/lines').send({ productSlug: UNSIZED }).expect(200)).body as CartView;
    expect(cart.lines).toHaveLength(1);
    expect(cart.lines[0]!.quantity).toBe(2);
  });

  describe('sizes', () => {
    it('requires a size for sized products and rejects sizes that do not exist', async () => {
      const { slug } = sizedProduct();
      const missing = await browser().post('/api/cart/lines').send({ productSlug: slug }).expect(400);
      expect(missing.body.error.code).toBe('SIZE_REQUIRED');
      expect((await browser().post('/api/cart/lines').send({ productSlug: slug, size: 'ZZ' }).expect(400)).body.error.code).toBe('INVALID_SIZE');
      expect((await browser().post('/api/cart/lines').send({ productSlug: UNSIZED, size: 'M' }).expect(400)).body.error.code).toBe('INVALID_SIZE');
    });

    it('adds a specific size as its own line', async () => {
      const { slug, label } = sizedProduct();
      const cart = (await browser().post('/api/cart/lines').send({ productSlug: slug, size: label }).expect(200)).body as CartView;
      expect(cart.lines[0]).toMatchObject({ size: label, quantity: 1 });
    });
  });

  describe('limits', () => {
    it('refuses out-of-stock items', async () => {
      setUnsizedStock(UNSIZED, 0);
      const res = await browser().post('/api/cart/lines').send({ productSlug: UNSIZED }).expect(409);
      expect(res.body.error.code).toBe('OUT_OF_STOCK');
    });

    it('caps a line at the lower of 10 and available stock', async () => {
      setUnsizedStock(UNSIZED, 50);
      const a = browser();
      await a.post('/api/cart/lines').send({ productSlug: UNSIZED, quantity: 10 }).expect(200);
      const over = await a.post('/api/cart/lines').send({ productSlug: UNSIZED }).expect(409);
      expect(over.body.error).toMatchObject({ code: 'QUANTITY_LIMIT', details: { max: 10 } });

      setUnsizedStock(UNSIZED, 3);
      const b = browser();
      const res = await b.post('/api/cart/lines').send({ productSlug: UNSIZED, quantity: 4 }).expect(409);
      expect(res.body.error.details).toEqual({ max: 3 });
      expect((await b.post('/api/cart/lines').send({ productSlug: UNSIZED, quantity: 3 }).expect(200)).body.lines[0].maxQuantity).toBe(3);
    });

    it('validates quantity on update and rejects increases above stock', async () => {
      setUnsizedStock(UNSIZED, 4);
      const a = browser();
      const lineId = ((await a.post('/api/cart/lines').send({ productSlug: UNSIZED })).body as CartView).lines[0]!.id;
      expect((await a.patch(`/api/cart/lines/${lineId}`).send({ quantity: 4 }).expect(200)).body.lines[0].quantity).toBe(4);
      await a.patch(`/api/cart/lines/${lineId}`).send({ quantity: 5 }).expect(409);
      await a.patch(`/api/cart/lines/${lineId}`).send({ quantity: 0 }).expect(400);
      await a.patch(`/api/cart/lines/${lineId}`).send({ quantity: 11 }).expect(400);
      await a.patch(`/api/cart/lines/${lineId}`).send({ quantity: 'lots' }).expect(400);
    });
  });

  it('flags lines when stock drops, keeps the quantity, and excludes them from totals', async () => {
    setUnsizedStock(UNSIZED, 10);
    const a = browser();
    const lineId = ((await a.post('/api/cart/lines').send({ productSlug: UNSIZED, quantity: 5 })).body as CartView).lines[0]!.id;
    await a.post('/api/cart/lines').send({ productSlug: 'apple-magsafe-battery-pack' }).expect(200);

    setUnsizedStock(UNSIZED, 2);
    let cart = (await a.get('/api/cart')).body as CartView;
    expect(cart.lines[0]).toMatchObject({ id: lineId, quantity: 5, issue: 'exceeds_stock', maxQuantity: 2 });
    expect(cart.hasIssues).toBe(true);
    expect(cart.totals.itemCount).toBe(1);
    expect(cart.totalQuantity).toBe(6);

    // Decreasing is allowed even while still above stock, so the user can fix it step by step.
    expect((await a.patch(`/api/cart/lines/${lineId}`).send({ quantity: 4 }).expect(200)).body.lines[0].quantity).toBe(4);

    setUnsizedStock(UNSIZED, 0);
    cart = (await a.get('/api/cart')).body as CartView;
    expect(cart.lines[0]).toMatchObject({ issue: 'out_of_stock', availability: { status: 'out_of_stock' } });
  });

  it('removes lines, and cannot touch another cart’s lines', async () => {
    const a = browser();
    const lineId = ((await a.post('/api/cart/lines').send({ productSlug: UNSIZED })).body as CartView).lines[0]!.id;
    const b = browser();
    await b.post('/api/cart/lines').send({ productSlug: 'apple-magsafe-battery-pack' });

    await b.delete(`/api/cart/lines/${lineId}`).expect(404);
    await b.patch(`/api/cart/lines/${lineId}`).send({ quantity: 2 }).expect(404);
    await request(app).delete(`/api/cart/lines/${lineId}`).expect(404);

    expect(((await a.delete(`/api/cart/lines/${lineId}`).expect(200)).body as CartView).lines).toEqual([]);
    await a.delete(`/api/cart/lines/${lineId}`).expect(404);
  });

  it('expires carts untouched for 30 days', async () => {
    const a = browser();
    await a.post('/api/cart/lines').send({ productSlug: UNSIZED });
    db.prepare("UPDATE carts SET updated_at = '2000-01-01T00:00:00.000Z'").run();
    expect(((await a.get('/api/cart')).body as CartView).lines).toEqual([]);
    expect(createCartService(db, createCatalogRepository(db)).deleteExpired()).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM cart_lines').get() as { n: number }).n).toBe(0);
  });

  it('rejects malformed bodies and unknown products', async () => {
    await browser().post('/api/cart/lines').send({}).expect(400);
    await browser().post('/api/cart/lines').send({ productSlug: UNSIZED, quantity: 0 }).expect(400);
    expect((await browser().post('/api/cart/lines').send({ productSlug: 'nope' }).expect(404)).body.error.code).toBe('PRODUCT_NOT_FOUND');
  });
});
