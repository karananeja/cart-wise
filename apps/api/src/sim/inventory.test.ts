import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { InventoryChange, SimAutomation, SimInventoryPage, SimInventoryProduct, SimInventoryUnit } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { seedOnHand, seedSizeOnHand } from '../inventory/inventory.js';

let db: Db;
let app: ReturnType<typeof createApp>;
let randomValues: number[];
const random = () => randomValues.shift() ?? 0;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  randomValues = [];
  app = createApp(db, { fetch: async () => new Response('[]'), operatorPassword: 'op', random });
});

type Agent = ReturnType<typeof request.agent>;
async function operator(target = app): Promise<Agent> {
  const agent = request.agent(target);
  await agent.post('/api/sim/session').send({ password: 'op' }).expect(200);
  return agent;
}

const productId = (slug: string) => (db.prepare('SELECT id FROM products WHERE slug = ?').get(slug) as { id: number }).id;
const unit = (slug: string) =>
  db.prepare('SELECT on_hand AS onHand, reserved FROM inventory WHERE product_id = ? AND variant_id IS NULL').get(productId(slug)) as { onHand: number; reserved: number };
const setUnit = (slug: string, onHand: number, reserved = 0) =>
  db.prepare('UPDATE inventory SET on_hand = ?, reserved = ? WHERE product_id = ? AND variant_id IS NULL').run(onHand, reserved, productId(slug));
/** Empties the store except the given units, so automation has a known pool. */
const onlyStock = (units: Record<string, [number, number?]>) => {
  db.prepare('UPDATE inventory SET on_hand = 0, reserved = 0').run();
  for (const [slug, [onHand, reserved]] of Object.entries(units)) setUnit(slug, onHand, reserved ?? 0);
};
const putUnit = (op: Agent, body: object) => op.put('/api/sim/inventory/units').send(body);
const settings = (op: Agent, body: object) => op.put('/api/sim/automation').send(body);

describe('inventory list', () => {
  it('searches by name and pages 20 at a time', async () => {
    const op = await operator();
    const page = (await op.get('/api/sim/inventory?q=iphone').expect(200)).body as SimInventoryPage;
    expect(page.products.length).toBeGreaterThan(0);
    expect(page.products.every((p) => /iphone/i.test(p.title))).toBe(true);

    const first = (await op.get('/api/sim/inventory')).body as SimInventoryPage;
    expect(first.products).toHaveLength(20);
    const second = (await op.get(`/api/sim/inventory?cursor=${first.nextCursor}`)).body as SimInventoryPage;
    expect(second.products[0]!.productId).not.toBe(first.products[0]!.productId);
    expect(((await op.get('/api/sim/inventory?q=%25%25nothing')).body as SimInventoryPage).products).toEqual([]);
  });

  it('filters by product-level availability, and shows sizes as units', async () => {
    const op = await operator();
    setUnit('apple-magsafe-battery-pack', 3);
    setUnit('apple-airpods', 0);
    const low = (await op.get('/api/sim/inventory?filter=low&q=magsafe battery')).body as SimInventoryPage;
    expect(low.products.map((p) => p.slug)).toContain('apple-magsafe-battery-pack');
    expect(low.products.every((p) => p.available >= 1 && p.available <= 5 && p.status === 'low_stock')).toBe(true);
    const sold = (await op.get('/api/sim/inventory?filter=sold_out&q=airpods')).body as SimInventoryPage;
    expect(sold.products.map((p) => p.slug)).toContain('apple-airpods');

    const sized = db.prepare('SELECT p.title FROM products p WHERE EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) LIMIT 1').get() as { title: string };
    const product = ((await op.get(`/api/sim/inventory?q=${encodeURIComponent(sized.title)}`)).body as SimInventoryPage).products[0]!;
    expect(product.units.length).toBeGreaterThan(1);
    expect(product.units.every((u) => u.size && u.variantId)).toBe(true);
    expect(product.onHand).toBe(product.units.reduce((n, u) => n + u.onHand, 0));
  });
});

describe('manual stock', () => {
  it('sets on hand, logs it, and the storefront reflects it', async () => {
    const op = await operator();
    setUnit('apple-magsafe-battery-pack', 20);
    const res = (await putUnit(op, { productId: productId('apple-magsafe-battery-pack'), variantId: null, onHand: 4 }).expect(200)).body as { unit: SimInventoryUnit; product: SimInventoryProduct };
    expect(res.unit).toMatchObject({ onHand: 4, held: 0, available: 4, status: 'low_stock' });
    expect(res.product.slug).toBe('apple-magsafe-battery-pack');
    expect((await request(app).get('/api/products/apple-magsafe-battery-pack')).body.product.availability).toEqual({ status: 'low_stock', available: 4 });

    await putUnit(op, { productId: productId('apple-magsafe-battery-pack'), variantId: null, onHand: 0 }).expect(200);
    expect((await request(app).get('/api/products/apple-magsafe-battery-pack')).body.product.availability).toEqual({ status: 'out_of_stock' });

    const log = ((await op.get('/api/sim/automation')).body as SimAutomation).log;
    expect(log.map((c) => [c.fromOnHand, c.toOnHand, c.source])).toEqual([
      [4, 0, 'manual'],
      [20, 4, 'manual'],
    ]);
  });

  it('never goes below units held in checkout', async () => {
    const op = await operator();
    setUnit('apple-magsafe-battery-pack', 6, 2);
    const res = await putUnit(op, { productId: productId('apple-magsafe-battery-pack'), variantId: null, onHand: 1 }).expect(409);
    expect(res.body.error).toMatchObject({ code: 'BELOW_HELD', details: { held: 2 } });
    expect(unit('apple-magsafe-battery-pack')).toEqual({ onHand: 6, reserved: 2 });
    await putUnit(op, { productId: productId('apple-magsafe-battery-pack'), variantId: null, onHand: 2 }).expect(200);
  });

  it('refuses bad values and unknown units', async () => {
    const op = await operator();
    const id = productId('apple-magsafe-battery-pack');
    for (const onHand of [-1, 1000, 2.5, '3']) await putUnit(op, { productId: id, variantId: null, onHand }).expect(400);
    await putUnit(op, { productId: 999_999, variantId: null, onHand: 3 }).expect(404);
    await putUnit(op, { productId: id, variantId: 999_999, onHand: 3 }).expect(404);
  });
});

describe('automation', () => {
  it('is off by default at 60 s, saves settings, and keeps them for a new app on the same database', async () => {
    const op = await operator();
    expect((await op.get('/api/sim/automation')).body).toMatchObject({ autoDecrease: false, autoRestock: false, intervalSeconds: 60, nextTickAt: null, log: [] });
    expect((await op.post('/api/sim/automation/run').send({}).expect(409)).body.error.code).toBe('AUTOMATION_OFF');
    await settings(op, { autoDecrease: true, autoRestock: false, intervalSeconds: 45 }).expect(400);
    await settings(op, { autoDecrease: true, autoRestock: true, intervalSeconds: 10 }).expect(200);

    const restarted = createApp(db, { fetch: async () => new Response('[]'), operatorPassword: 'op' });
    const op2 = await operator(restarted);
    expect((await op2.get('/api/sim/automation')).body).toMatchObject({ autoDecrease: true, autoRestock: true, intervalSeconds: 10 });
  });

  it('decreases 1–3 available units by 1, never held units or below zero', async () => {
    const op = await operator();
    onlyStock({ 'apple-magsafe-battery-pack': [5, 5], 'apple-airpods': [2], 'apple-homepod-mini-cosmic-grey': [1] });
    await settings(op, { autoDecrease: true, autoRestock: false, intervalSeconds: 60 });

    randomValues = [0.99, 0, 0, 0]; // 3 units; then pick the first available each time
    let changes = (await op.post('/api/sim/automation/run').send({}).expect(200)).body.changes as InventoryChange[];
    expect(changes.map((c) => c.source)).toEqual(['auto_decrease', 'auto_decrease']); // only 2 units have anything available
    expect(unit('apple-magsafe-battery-pack')).toEqual({ onHand: 5, reserved: 5 });
    expect(unit('apple-airpods').onHand).toBe(1);
    expect(unit('apple-homepod-mini-cosmic-grey').onHand).toBe(0);

    randomValues = [0, 0];
    changes = (await op.post('/api/sim/automation/run').send({}).expect(200)).body.changes as InventoryChange[];
    expect(changes).toHaveLength(1);
    expect(unit('apple-airpods').onHand).toBe(0);

    changes = (await op.post('/api/sim/automation/run').send({}).expect(200)).body.changes as InventoryChange[];
    expect(changes).toEqual([]);
    expect(unit('apple-magsafe-battery-pack')).toEqual({ onHand: 5, reserved: 5 });
  });

  it('restocks up to 3 low or sold-out units to their seeded level, at least 10 available', async () => {
    const op = await operator();
    await settings(op, { autoDecrease: false, autoRestock: true, intervalSeconds: 60 });
    // Everything else comfortably stocked, so only these are low.
    db.prepare('UPDATE inventory SET on_hand = 50, reserved = 0').run();
    setUnit('apple-magsafe-battery-pack', 2, 1);
    setUnit('apple-airpods', 0);
    const sized = db.prepare(`SELECT i.product_id AS productId, i.variant_id AS variantId, v.sort_order AS sortOrder FROM inventory i
      JOIN product_variants v ON v.id = i.variant_id LIMIT 1`).get() as { productId: number; variantId: number; sortOrder: number };
    db.prepare('UPDATE inventory SET on_hand = 1 WHERE variant_id = ?').run(sized.variantId);

    const changes = (await op.post('/api/sim/automation/run').send({}).expect(200)).body.changes as InventoryChange[];
    expect(changes).toHaveLength(3);
    expect(changes.every((c) => c.source === 'auto_restock')).toBe(true);
    expect(unit('apple-magsafe-battery-pack')).toEqual({ onHand: 1 + Math.max(seedOnHand(productId('apple-magsafe-battery-pack')), 10), reserved: 1 });
    expect(unit('apple-airpods').onHand).toBe(Math.max(seedOnHand(productId('apple-airpods')), 10));
    const sizedNow = db.prepare('SELECT on_hand AS n FROM inventory WHERE variant_id = ?').get(sized.variantId) as { n: number };
    expect(sizedNow.n).toBe(Math.max(seedSizeOnHand(sized.productId, sized.sortOrder), 10));
  });

  it('keeps only the latest changes in the log view (20, newest first)', async () => {
    const op = await operator();
    const id = productId('apple-magsafe-battery-pack');
    for (let i = 1; i <= 25; i += 1) await putUnit(op, { productId: id, variantId: null, onHand: i }).expect(200);
    const log = ((await op.get('/api/sim/automation')).body as SimAutomation).log;
    expect(log).toHaveLength(20);
    expect(log[0]!.toOnHand).toBe(25);
  });

  it('needs the operator session', async () => {
    await request(app).get('/api/sim/inventory').expect(401);
    await request(app).put('/api/sim/inventory/units').send({ productId: 1, variantId: null, onHand: 1 }).expect(401);
    await request(app).get('/api/sim/automation').expect(401);
    await request(app).put('/api/sim/automation').send({ autoDecrease: true, autoRestock: true, intervalSeconds: 60 }).expect(401);
    await request(app).post('/api/sim/automation/run').send({}).expect(401);
  });
});
