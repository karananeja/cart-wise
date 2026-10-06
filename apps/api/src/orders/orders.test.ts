import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartView, ChallengeResponse, CheckoutQuote, Order } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

let db: Db;
let now: number;
let app: ReturnType<typeof createApp>;
let counter = 0;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  now = Date.parse('2026-10-06T10:00:00.000Z');
  app = createApp(db, { fetch: async () => new Response('[]'), clock: () => now });
});

type Agent = ReturnType<typeof request.agent>;

async function customer(options: { address?: boolean } = { address: true }): Promise<Agent> {
  const agent = request.agent(app);
  counter += 1;
  const mobile = `97${String(counter).padStart(8, '0')}`;
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: `a${counter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  if (options.address) {
    await agent.post('/api/addresses').send({
      fullName: 'Asha Rao', mobile, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
    }).expect(200);
  }
  return agent;
}

const stock = (slug: string, size: string | null = null) =>
  db.prepare(`SELECT on_hand AS onHand, reserved FROM inventory WHERE product_id = (SELECT id FROM products WHERE slug = ?)
    AND IFNULL(variant_id, 0) = IFNULL((SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.slug = ? AND v.label = ?), 0)`)
    .get(slug, slug, size) as { onHand: number; reserved: number };
const setStock = (slug: string, onHand: number) =>
  db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = ?)').run(onHand, slug);
const add = (agent: Agent, productSlug: string, quantity = 1, size?: string) => agent.post('/api/cart/lines').send({ productSlug, quantity, size }).expect(200);
const placeOrder = (agent: Agent, delivery = 'standard') => agent.post('/api/orders').send({ delivery });

describe('checkout quote', () => {
  it('requires sign-in', async () => {
    await request(app).get('/api/checkout').expect(401);
    await request(app).post('/api/orders').send({ delivery: 'standard' }).expect(401);
  });

  it('reports what blocks checkout', async () => {
    const agent = await customer({ address: false });
    expect(((await agent.get('/api/checkout')).body as CheckoutQuote).blockers).toEqual(['EMPTY_CART', 'NO_ADDRESS']);
    await add(agent, 'apple-magsafe-battery-pack');
    expect(((await agent.get('/api/checkout')).body as CheckoutQuote).blockers).toEqual(['NO_ADDRESS']);
  });

  it('prices delivery: Standard ₹49 under ₹999, free from ₹999; Express ₹149', async () => {
    const agent = await customer();
    setStock('essence-mascara-lash-princess', 20);
    await add(agent, 'essence-mascara-lash-princess'); // ₹858.53
    let q = (await agent.get('/api/checkout')).body as CheckoutQuote;
    expect(q.delivery[0]).toMatchObject({ option: 'standard', pricePaise: 4900, freeDeliveryShortfallPaise: 99900 - 85853 });
    expect(q.totals).toMatchObject({ deliveryPaise: 4900, totalPaise: 85853 + 4900 });
    expect(q.address?.city).toBe('Bengaluru');
    expect(q.blockers).toEqual([]);

    q = (await agent.get('/api/checkout?delivery=express')).body as CheckoutQuote;
    expect(q.totals).toMatchObject({ deliveryPaise: 14900, totalPaise: 85853 + 14900 });

    await add(agent, 'essence-mascara-lash-princess');
    q = (await agent.get('/api/checkout')).body as CheckoutQuote;
    expect(q.totals.deliveryPaise).toBe(0);
  });
});

describe('placing an order', () => {
  it('creates a Pending Payment order with locked prices and holds the stock for 10 minutes', async () => {
    const agent = await customer();
    setStock('apple-magsafe-battery-pack', 5);
    await add(agent, 'apple-magsafe-battery-pack', 2);
    const res = await placeOrder(agent, 'express').expect(201);
    const order = res.body.order as Order;
    expect(order.id).toMatch(/^ORD-[A-Z2-9]{8}$/);
    expect(order).toMatchObject({ status: 'pending_payment', holdExpiresAt: '2026-10-06T10:10:00.000Z' });
    expect(order.lines).toEqual([expect.objectContaining({ slug: 'apple-magsafe-battery-pack', quantity: 2 })]);
    expect(order.totals.deliveryPaise).toBe(0 + 14900);
    expect(order.address).toMatchObject({ line1: 'Flat 4B', city: 'Bengaluru' });

    expect(stock('apple-magsafe-battery-pack')).toEqual({ onHand: 5, reserved: 2 });
    // Others see less; the customer's own cart still shows the held items as fine.
    expect((await request(app).get('/api/products/apple-magsafe-battery-pack')).body.product.availability).toEqual({ status: 'low_stock', available: 3 });
    expect(((await agent.get('/api/cart')).body as CartView).hasIssues).toBe(false);

    // Prices are locked in the order even if the catalog changes.
    db.prepare("UPDATE products SET price_paise = 1 WHERE slug = 'apple-magsafe-battery-pack'").run();
    expect(((await agent.get(`/api/orders/${order.id}`)).body.order as Order).lines[0]!.unitPricePaise).toBe(order.lines[0]!.unitPricePaise);
  });

  it('holds the exact size', async () => {
    const agent = await customer();
    const sized = db.prepare(`SELECT p.slug, v.label FROM products p JOIN product_variants v ON v.product_id = p.id
      JOIN inventory i ON i.variant_id = v.id WHERE v.kind = 'size' AND i.on_hand >= 2 ORDER BY p.id, v.sort_order LIMIT 1`).get() as { slug: string; label: string };
    const before = stock(sized.slug, sized.label).reserved;
    await add(agent, sized.slug, 1, sized.label);
    await placeOrder(agent).expect(201);
    expect(stock(sized.slug, sized.label).reserved).toBe(before + 1);
  });

  it('reserves all or nothing', async () => {
    const agent = await customer();
    setStock('apple-magsafe-battery-pack', 5);
    setStock('apple-airpods', 5);
    await add(agent, 'apple-magsafe-battery-pack', 2);
    await add(agent, 'apple-airpods', 2);
    // Someone else takes most of the AirPods between quote and order.
    db.prepare("UPDATE inventory SET reserved = 4 WHERE product_id = (SELECT id FROM products WHERE slug = 'apple-airpods')").run();
    const res = await placeOrder(agent).expect(409);
    expect(res.body.error.code).toBe('CART_CHANGED');
    expect(stock('apple-magsafe-battery-pack').reserved).toBe(0);
    expect((db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }).n).toBe(0);
  });

  it('gives the last unit to only one customer', async () => {
    setStock('apple-magsafe-battery-pack', 1);
    const first = await customer();
    const second = await customer();
    await add(first, 'apple-magsafe-battery-pack');
    await add(second, 'apple-magsafe-battery-pack');
    await placeOrder(first).expect(201);
    expect((await placeOrder(second).expect(409)).body.error.code).toBe('CART_CHANGED');
    expect(stock('apple-magsafe-battery-pack')).toEqual({ onHand: 1, reserved: 1 });
    // The second customer's cart now shows the problem.
    expect(((await second.get('/api/cart')).body as CartView).lines[0]!.issue).toBe('out_of_stock');
  });

  it('refuses empty carts and carts with problems', async () => {
    const agent = await customer();
    expect((await placeOrder(agent).expect(400)).body.error.code).toBe('EMPTY_CART');
    setStock('apple-magsafe-battery-pack', 5);
    await add(agent, 'apple-magsafe-battery-pack', 3);
    setStock('apple-magsafe-battery-pack', 1);
    expect((await placeOrder(agent).expect(409)).body.error.code).toBe('CART_CHANGED');
  });

  it('keeps one unpaid hold per customer, cancelling the previous one', async () => {
    const agent = await customer();
    setStock('apple-magsafe-battery-pack', 5);
    await add(agent, 'apple-magsafe-battery-pack', 2);
    const first = (await placeOrder(agent).expect(201)).body.order as Order;
    const second = (await placeOrder(agent).expect(201)).body.order as Order;
    expect(((await agent.get(`/api/orders/${first.id}`)).body.order as Order).status).toBe('cancelled');
    expect(second.status).toBe('pending_payment');
    expect(stock('apple-magsafe-battery-pack').reserved).toBe(2);
  });
});

describe('ending a hold', () => {
  it('cancel releases the stock once and keeps the cart', async () => {
    const agent = await customer();
    setStock('apple-magsafe-battery-pack', 5);
    await add(agent, 'apple-magsafe-battery-pack', 2);
    const order = (await placeOrder(agent).expect(201)).body.order as Order;
    expect(((await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(200)).body.order as Order).status).toBe('cancelled');
    expect(stock('apple-magsafe-battery-pack').reserved).toBe(0);
    await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(409);
    expect(stock('apple-magsafe-battery-pack').reserved).toBe(0);
    expect(((await agent.get('/api/cart')).body as CartView).totalQuantity).toBe(2);
  });

  it('expires after 10 minutes, releasing exactly once', async () => {
    const agent = await customer();
    setStock('apple-magsafe-battery-pack', 5);
    await add(agent, 'apple-magsafe-battery-pack', 2);
    const order = (await placeOrder(agent).expect(201)).body.order as Order;
    now += 9 * 60 * 1000;
    expect(((await agent.get(`/api/orders/${order.id}`)).body.order as Order).status).toBe('pending_payment');
    now += 2 * 60 * 1000;
    expect(((await agent.get(`/api/orders/${order.id}`)).body.order as Order).status).toBe('payment_expired');
    await agent.get(`/api/orders/${order.id}`);
    expect(stock('apple-magsafe-battery-pack').reserved).toBe(0);
  });

  it("never shows or cancels another customer's order", async () => {
    const owner = await customer();
    setStock('apple-magsafe-battery-pack', 5);
    await add(owner, 'apple-magsafe-battery-pack');
    const order = (await placeOrder(owner).expect(201)).body.order as Order;
    const other = await customer();
    await other.get(`/api/orders/${order.id}`).expect(404);
    await other.post(`/api/orders/${order.id}/cancel`).send({}).expect(404);
    expect(stock('apple-magsafe-battery-pack').reserved).toBe(1);
  });
});
