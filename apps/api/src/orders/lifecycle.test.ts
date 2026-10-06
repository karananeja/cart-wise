import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChallengeResponse, Order, OrderList, PaymentAttemptView, SimOrder } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

let db: Db;
let now: number;
let app: ReturnType<typeof createApp>;
let counter = 0;
const PASSWORD = 'test-operator';

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  now = Date.parse('2026-10-06T10:00:00.000Z');
  app = createApp(db, { fetch: async () => new Response('[]'), clock: () => now, operatorPassword: PASSWORD });
});

type Agent = ReturnType<typeof request.agent>;

async function customer(): Promise<Agent> {
  const agent = request.agent(app);
  counter += 1;
  const mobile = `95${String(counter).padStart(8, '0')}`;
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: `o${counter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  await agent.post('/api/addresses').send({
    fullName: 'Asha Rao', mobile, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
  }).expect(200);
  return agent;
}

async function operator(): Promise<Agent> {
  const agent = request.agent(app);
  await agent.post('/api/sim/session').send({ password: PASSWORD }).expect(200);
  return agent;
}

const onHand = (slug: string) =>
  (db.prepare('SELECT on_hand AS n FROM inventory WHERE product_id = (SELECT id FROM products WHERE slug = ?)').get(slug) as { n: number }).n;
const setStock = (slug: string, n: number) =>
  db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = ?)').run(n, slug);
const setPrice = (slug: string, pricePaise: number) => db.prepare('UPDATE products SET price_paise = ? WHERE slug = ?').run(pricePaise, slug);
const events = (name: string) =>
  (db.prepare('SELECT properties FROM analytics_events WHERE name = ? ORDER BY id').all(name) as { properties: string }[]).map((r) => JSON.parse(r.properties));

/**
 * A paid order: 2 × iphone-x at ₹3,000 and 1 × apple-airpods at ₹2,000 (₹8,000, free delivery),
 * paid with an Aurora credit card and its 10% offer (−₹800), so ₹7,200 was paid.
 */
async function paidOrder(agent: Agent, options: { offer?: boolean; cheap?: boolean } = { offer: true }): Promise<Order> {
  setStock('iphone-x', 10);
  setStock('apple-airpods', 10);
  if (options.cheap) {
    setPrice('apple-airpods', 500_00);
    await agent.post('/api/cart/lines').send({ productSlug: 'apple-airpods', quantity: 1 }).expect(200);
  } else {
    setPrice('iphone-x', 3_000_00);
    setPrice('apple-airpods', 2_000_00);
    await agent.post('/api/cart/lines').send({ productSlug: 'iphone-x', quantity: 2 }).expect(200);
    await agent.post('/api/cart/lines').send({ productSlug: 'apple-airpods', quantity: 1 }).expect(200);
  }
  const order = (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
  const attempt = (await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'card', bin: '424242', last4: '4242', offerId: options.offer ? 'aurora-credit-10' : undefined }).expect(201))
    .body.attempt as PaymentAttemptView;
  return (await agent.post(`/api/payments/${attempt.id}/verify`).send({ otp: attempt.demoCode }).expect(200)).body.order as Order;
}

const getOrder = async (agent: Agent, id: string) => (await agent.get(`/api/orders/${id}`).expect(200)).body.order as Order;
const advance = (op: Agent, id: string) => op.post(`/api/sim/orders/${id}/advance`).send({});
const toOutForDelivery = async (op: Agent, id: string) => {
  for (let i = 0; i < 3; i += 1) await advance(op, id).expect(200);
};
async function delivered(agent: Agent, op: Agent, id: string) {
  await toOutForDelivery(op, id);
  const code = (await getOrder(agent, id)).deliveryCode!;
  await op.post(`/api/sim/orders/${id}/deliver`).send({ code }).expect(200);
}

describe('order history', () => {
  it('lists paid orders only, newest first, 10 at a time', async () => {
    const agent = await customer();
    setStock('apple-airpods', 50);
    // An unpaid hold is not an order to the customer.
    await agent.post('/api/cart/lines').send({ productSlug: 'apple-airpods', quantity: 1 }).expect(200);
    await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201);
    expect(((await agent.get('/api/orders').expect(200)).body as OrderList)).toEqual({ orders: [], nextCursor: null });

    const ids: string[] = [];
    for (let i = 0; i < 12; i += 1) {
      now += 60_000;
      ids.push((await paidOrder(agent, { cheap: true })).id);
    }
    const first = (await agent.get('/api/orders')).body as OrderList;
    expect(first.orders.map((o) => o.id)).toEqual(ids.slice(2).reverse());
    expect(first.orders[0]).toMatchObject({ status: 'confirmed', itemCount: 1, paidPaise: 500_00 + 49_00, deliveryCode: null, returnState: 'none' });
    expect(first.orders[0]!.thumbnails).toHaveLength(1);
    const second = (await agent.get(`/api/orders?cursor=${first.nextCursor}`)).body as OrderList;
    expect(second).toEqual({ orders: expect.any(Array), nextCursor: null });
    expect(second.orders.map((o) => o.id)).toEqual(ids.slice(0, 2).reverse());

    // Someone else's list is their own.
    expect(((await (await customer()).get('/api/orders')).body as OrderList).orders).toEqual([]);
  });
});

describe('lifecycle', () => {
  it('advances one step at a time and records each step; Delivered needs the code', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    expect(order.actions).toEqual({ canCancel: true, canReturn: false, returnWindowEndsAt: null });

    now += 60_000;
    expect(((await advance(op, order.id).expect(200)).body.order as SimOrder)).toMatchObject({ status: 'processing', nextStatus: 'shipped', city: 'Bengaluru' });
    now += 60_000;
    await advance(op, order.id).expect(200);
    let o = await getOrder(agent, order.id);
    expect(o.status).toBe('shipped');
    expect(o.actions.canCancel).toBe(false);
    expect(o.history.map((h) => h.status)).toEqual(['payment_successful', 'confirmed', 'processing', 'shipped']);
    expect(o.history[2]!.at).toBe('2026-10-06T10:01:00.000Z');

    await advance(op, order.id).expect(200);
    expect((await advance(op, order.id).expect(409)).body.error.code).toBe('INVALID_TRANSITION');
    o = await getOrder(agent, order.id);
    expect(o.status).toBe('out_for_delivery');
    expect(o.deliveryCode).toMatch(/^\d{4}$/);
  });

  it('refuses steps on unpaid or cancelled orders and unknown ids', async () => {
    const op = await operator();
    await advance(op, 'ORD-NOPE').expect(404);
    const agent = await customer();
    const order = await paidOrder(agent);
    await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(200);
    expect((await advance(op, order.id).expect(409)).body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('cancellation', () => {
  it('refunds everything paid, restocks once and records order_cancelled, while Confirmed or Processing', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    await advance(op, order.id).expect(200); // Processing
    expect(onHand('iphone-x')).toBe(8);

    const res = await agent.post(`/api/orders/${order.id}/cancel`).send({ reason: 'changed_mind', visitorId: 'visitor-1234' }).expect(200);
    const cancelled = res.body.order as Order;
    expect(cancelled).toMatchObject({ status: 'cancelled', cancelReason: 'changed_mind', actions: { canCancel: false } });
    expect(cancelled.refunds).toEqual([expect.objectContaining({ returnId: null, amountPaise: 7_200_00, label: 'Aurora Bank Visa •••• 4242', status: 'refunded' })]);
    expect(cancelled.history.at(-1)!.status).toBe('cancelled');
    expect(onHand('iphone-x')).toBe(10);
    expect(onHand('apple-airpods')).toBe(10);
    expect(events('order_cancelled')).toEqual([{ orderId: order.id, itemCount: 3, totalPaise: 7_200_00, reason: 'changed_mind' }]);

    expect((await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(409)).body.error.code).toBe('NOT_CANCELLABLE');
    expect(onHand('iphone-x')).toBe(10);
    expect(events('order_cancelled')).toHaveLength(1);
    // Still listed in history (it was paid).
    expect(((await agent.get('/api/orders')).body as OrderList).orders[0]).toMatchObject({ status: 'cancelled' });
  });

  it('refuses from Shipped onwards and for other customers', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    await (await customer()).post(`/api/orders/${order.id}/cancel`).send({}).expect(404);
    await advance(op, order.id);
    await advance(op, order.id);
    expect((await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(409)).body.error.code).toBe('NOT_CANCELLABLE');
  });
});

describe('delivery code', () => {
  it('is shown only to the owner, and only while out for delivery', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    await toOutForDelivery(op, order.id);
    const code = (await getOrder(agent, order.id)).deliveryCode!;
    expect(((await agent.get('/api/orders')).body as OrderList).orders[0]!.deliveryCode).toBe(code);
    const sim = (await op.get('/api/sim/orders').expect(200)).body.orders as SimOrder[];
    expect(JSON.stringify(sim)).not.toContain(`"${code}"`);
    expect(sim[0]).toMatchObject({ id: order.id, deliveryAttemptsLeft: 3 });
    expect(JSON.stringify(sim[0])).not.toMatch(/Flat 4B|560038|Asha/);
    await (await customer()).get(`/api/orders/${order.id}`).expect(404);
  });

  it('locks after 3 wrong codes until a new code is issued; the right code delivers', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    await toOutForDelivery(op, order.id);
    const code = (await getOrder(agent, order.id)).deliveryCode!;
    const wrong = code === '0000' ? '1111' : '0000';
    const deliver = (c: string) => op.post(`/api/sim/orders/${order.id}/deliver`).send({ code: c });

    expect((await deliver(wrong).expect(401)).body.error.details).toEqual({ attemptsLeft: 2 });
    expect((await deliver(wrong).expect(401)).body.error.details).toEqual({ attemptsLeft: 1 });
    expect((await deliver(wrong).expect(423)).body.error.code).toBe('DELIVERY_LOCKED');
    expect((await deliver(code).expect(423)).body.error.code).toBe('DELIVERY_LOCKED');

    const reissued = (await op.post(`/api/sim/orders/${order.id}/delivery-code`).send({}).expect(200)).body.order as SimOrder;
    expect(reissued.deliveryAttemptsLeft).toBe(3);
    const fresh = (await getOrder(agent, order.id)).deliveryCode!;
    now += 60_000;
    expect(((await deliver(fresh).expect(200)).body.order as SimOrder).status).toBe('delivered');

    const o = await getOrder(agent, order.id);
    expect(o).toMatchObject({ status: 'delivered', deliveryCode: null, deliveredAt: '2026-10-06T10:01:00.000Z' });
    expect(o.actions).toEqual({ canCancel: false, canReturn: true, returnWindowEndsAt: '2026-10-13T10:01:00.000Z' });
    expect((await deliver(fresh).expect(409)).body.error.code).toBe('INVALID_TRANSITION');
  });
});

describe('returns and refunds', () => {
  it('refunds each item its paid share (bank offer shared out), staged by the operator, restocking at pickup', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    await delivered(agent, op, order.id);
    const iphones = order.lines.find((l) => l.slug === 'iphone-x');
    const airpods = order.lines.find((l) => l.slug === 'apple-airpods');

    const requested = (await agent.post(`/api/orders/${order.id}/returns`).send({ lines: [{ orderLineId: airpods!.id, reason: 'damaged' }] }).expect(201)).body.order as Order;
    // ₹2,000 line minus its share of ₹800 (₹200) = ₹1,800.
    expect(requested.returns).toEqual([expect.objectContaining({ status: 'requested', refundPaise: 1_800_00, lines: [{ orderLineId: airpods!.id, reason: 'damaged', refundPaise: 1_800_00 }] })]);
    expect(requested).toMatchObject({ returnState: 'partial', actions: { canReturn: true } });
    expect(onHand('apple-airpods')).toBe(9);

    expect((await agent.post(`/api/orders/${order.id}/returns`).send({ lines: [{ orderLineId: airpods!.id, reason: 'damaged' }] }).expect(409)).body.error.code).toBe('ALREADY_RETURNED');

    const returnId = requested.returns[0]!.id;
    await op.post(`/api/sim/returns/${returnId}/refund`).send({}).expect(409); // not picked up yet
    now += 60_000;
    await op.post(`/api/sim/returns/${returnId}/pickup`).send({}).expect(200);
    await op.post(`/api/sim/returns/${returnId}/pickup`).send({}).expect(409);
    expect(onHand('apple-airpods')).toBe(10);
    let o = await getOrder(agent, order.id);
    expect(o.returns[0]).toMatchObject({ status: 'picked_up', pickedUpAt: '2026-10-06T10:01:00.000Z' });
    expect(o.refunds).toEqual([expect.objectContaining({ returnId, amountPaise: 1_800_00, status: 'initiated', refundedAt: null })]);

    await op.post(`/api/sim/returns/${returnId}/refund`).send({}).expect(200);
    o = await getOrder(agent, order.id);
    expect(o.returns[0]!.status).toBe('refunded');
    expect(o.refunds[0]).toMatchObject({ status: 'refunded', label: 'Aurora Bank Visa •••• 4242' });

    // The rest: ₹6,000 minus ₹600 = ₹5,400. All refunds add up to what was paid for items.
    o = (await agent.post(`/api/orders/${order.id}/returns`).send({ lines: [{ orderLineId: iphones!.id, reason: 'not_needed' }] }).expect(201)).body.order as Order;
    expect(o.returns[1]!.refundPaise).toBe(5_400_00);
    expect(o.returns.reduce((n, r) => n + r.refundPaise, 0)).toBe(order.payment!.paidPaise);
    expect(o).toMatchObject({ returnState: 'all', actions: { canReturn: false } });
  });

  it('does not refund the delivery charge on returns', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent, { cheap: true });
    expect(order.payment!.paidPaise).toBe(500_00 + 49_00);
    await delivered(agent, op, order.id);
    const o = (await agent.post(`/api/orders/${order.id}/returns`).send({ lines: [{ orderLineId: order.lines[0]!.id, reason: 'size_fit' }] }).expect(201)).body.order as Order;
    expect(o.returns[0]!.refundPaise).toBe(500_00);
  });

  it('accepts returns for 7 days after delivery only, and only for delivered orders', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    const line = { orderLineId: order.lines[0]!.id, reason: 'damaged' };
    expect((await agent.post(`/api/orders/${order.id}/returns`).send({ lines: [line] }).expect(409)).body.error.code).toBe('NOT_DELIVERED');
    await delivered(agent, op, order.id);
    now += 7 * 24 * 60 * 60 * 1000;
    expect((await getOrder(agent, order.id)).actions.canReturn).toBe(false);
    expect((await agent.post(`/api/orders/${order.id}/returns`).send({ lines: [line] }).expect(409)).body.error.code).toBe('RETURN_WINDOW_CLOSED');
  });

  it('refuses bad return requests and other customers', async () => {
    const agent = await customer();
    const op = await operator();
    const order = await paidOrder(agent);
    await delivered(agent, op, order.id);
    const send = (body: object) => agent.post(`/api/orders/${order.id}/returns`).send(body);
    await send({ lines: [] }).expect(400);
    await send({ lines: [{ orderLineId: order.lines[0]!.id, reason: 'bored' }] }).expect(400);
    await send({ lines: [{ orderLineId: 999_999, reason: 'damaged' }] }).expect(400);
    await send({ lines: [{ orderLineId: order.lines[0]!.id, reason: 'damaged' }, { orderLineId: order.lines[0]!.id, reason: 'damaged' }] }).expect(400);
    await (await customer()).post(`/api/orders/${order.id}/returns`).send({ lines: [{ orderLineId: order.lines[0]!.id, reason: 'damaged' }] }).expect(404);
  });
});
