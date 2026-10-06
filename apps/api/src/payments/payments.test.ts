import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartView, ChallengeResponse, Order, PaymentAttemptView, PaymentQuote } from '@store/shared';
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

async function customer(): Promise<Agent> {
  const agent = request.agent(app);
  counter += 1;
  const mobile = `96${String(counter).padStart(8, '0')}`;
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: `p${counter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  await agent.post('/api/addresses').send({
    fullName: 'Asha Rao', mobile, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
  }).expect(200);
  return agent;
}

const stock = (slug: string) =>
  db.prepare('SELECT on_hand AS onHand, reserved FROM inventory WHERE product_id = (SELECT id FROM products WHERE slug = ?) AND variant_id IS NULL')
    .get(slug) as { onHand: number; reserved: number };
const setStock = (slug: string, onHand: number) =>
  db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = ?)').run(onHand, slug);
const setPrice = (slug: string, pricePaise: number) => db.prepare('UPDATE products SET price_paise = ? WHERE slug = ?').run(pricePaise, slug);
const add = (agent: Agent, productSlug: string, quantity = 1) => agent.post('/api/cart/lines').send({ productSlug, quantity }).expect(200);
const events = (name: string) =>
  (db.prepare('SELECT properties FROM analytics_events WHERE name = ? ORDER BY id').all(name) as { properties: string }[]).map((r) => JSON.parse(r.properties));

/** A held order of 2 × apple-magsafe-battery-pack (₹3,000 each, ₹6,000 total with free delivery). */
async function heldOrder(agent: Agent, quantity = 2): Promise<Order> {
  setStock('apple-magsafe-battery-pack', 5);
  setPrice('apple-magsafe-battery-pack', 3_000_00);
  await add(agent, 'apple-magsafe-battery-pack', quantity);
  return (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
}

const AURORA_CREDIT = { bin: '424242', last4: '4242' };
const payByCard = (agent: Agent, orderId: string, card: { bin: string; last4: string }, offerId?: string) =>
  agent.post(`/api/orders/${orderId}/payments`).send({ method: 'card', ...card, offerId, visitorId: 'visitor-12345' });

async function cardAttempt(agent: Agent, orderId: string, card = AURORA_CREDIT, offerId?: string): Promise<PaymentAttemptView> {
  return (await payByCard(agent, orderId, card, offerId).expect(201)).body.attempt as PaymentAttemptView;
}
const verify = (agent: Agent, attempt: PaymentAttemptView, otp = attempt.demoCode) => agent.post(`/api/payments/${attempt.id}/verify`).send({ otp });

describe('offers', () => {
  it('lists the three fictional offers', async () => {
    const res = await request(app).get('/api/offers').expect(200);
    expect(res.body.offers.map((o: { id: string }) => o.id)).toEqual(['aurora-credit-10', 'meridian-flat-250', 'kestrel-credit-5']);
  });

  it('quotes eligibility for the chosen offer and card', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    expect(order.totals.totalPaise).toBe(6_000_00);

    let q = (await agent.get(`/api/orders/${order.id}/payment-quote`).expect(200)).body as PaymentQuote;
    expect(q).toMatchObject({ orderTotalPaise: 6_000_00, card: null, selected: null, suggestedOfferId: null, amountToPayPaise: 6_000_00 });
    expect(q.offers.map((o) => [o.offerId, o.discountPaise, o.reason])).toEqual([
      ['aurora-credit-10', 600_00, 'NO_CARD'],
      ['meridian-flat-250', 250_00, 'NO_CARD'],
      ['kestrel-credit-5', 300_00, 'NO_CARD'],
    ]);

    q = (await agent.get(`/api/orders/${order.id}/payment-quote?offerId=aurora-credit-10&bin=424242`)).body as PaymentQuote;
    expect(q).toMatchObject({ card: { bank: 'aurora', cardType: 'credit' }, selected: { applies: true, discountPaise: 600_00 }, amountToPayPaise: 5_400_00 });

    // Wrong card type for the chosen offer: full amount, with the reason.
    q = (await agent.get(`/api/orders/${order.id}/payment-quote?offerId=aurora-credit-10&bin=400050`)).body as PaymentQuote;
    expect(q).toMatchObject({ selected: { applies: false, reason: 'WRONG_CARD_TYPE' }, amountToPayPaise: 6_000_00 });

    // A qualifying card with no offer chosen suggests its offer.
    q = (await agent.get(`/api/orders/${order.id}/payment-quote?bin=652150`)).body as PaymentQuote;
    expect(q).toMatchObject({ suggestedOfferId: 'kestrel-credit-5', amountToPayPaise: 6_000_00 });
  });

  it('marks offers the order does not reach', async () => {
    const agent = await customer();
    const order = await heldOrder(agent, 1); // ₹3,000
    const q = (await agent.get(`/api/orders/${order.id}/payment-quote?offerId=aurora-credit-10&bin=424242`)).body as PaymentQuote;
    expect(q.selected).toMatchObject({ applies: false, reason: 'BELOW_MINIMUM', shortfallPaise: 2_000_00 });
  });
});

describe('card payment', () => {
  it('confirms the order after the bank OTP, converting the hold into a sale and emptying those items from the cart', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    await add(agent, 'apple-airpods'); // added after checkout: stays in the cart
    expect(stock('apple-magsafe-battery-pack')).toEqual({ onHand: 5, reserved: 2 });

    const attempt = await cardAttempt(agent, order.id, AURORA_CREDIT, 'aurora-credit-10');
    expect(attempt).toMatchObject({ status: 'pending', amountPaise: 5_400_00, discountPaise: 600_00, label: 'Aurora Bank Visa •••• 4242', otpAttemptsLeft: 3 });
    expect(attempt.demoCode).toMatch(/^\d{6}$/);

    const res = await verify(agent, attempt).expect(200);
    expect(res.body.attempt).toMatchObject({ status: 'succeeded' });
    const confirmed = res.body.order as Order;
    expect(confirmed).toMatchObject({
      status: 'confirmed',
      payment: { method: 'card', label: 'Aurora Bank Visa •••• 4242', offerId: 'aurora-credit-10', offerDiscountPaise: 600_00, paidPaise: 5_400_00 },
    });
    expect(confirmed.history.map((h) => h.status)).toEqual(['payment_successful', 'confirmed']);

    // Sold: on hand down, nothing still reserved, availability unchanged for others.
    expect(stock('apple-magsafe-battery-pack')).toEqual({ onHand: 3, reserved: 0 });
    const cart = (await agent.get('/api/cart')).body as CartView;
    expect(cart.lines.map((l) => l.product.slug)).toEqual(['apple-airpods']);

    expect(events('payment_completed')).toEqual([{ orderId: order.id, method: 'card', amountPaise: 5_400_00, discountPaise: 600_00, offerId: 'aurora-credit-10' }]);
    const packId = (db.prepare("SELECT id FROM products WHERE slug = 'apple-magsafe-battery-pack'").get() as { id: number }).id;
    expect(events('order_created')).toEqual([{ orderId: order.id, itemCount: 2, totalPaise: 5_400_00, productIds: String(packId) }]);
    // Server events carry the account id (user decision 2026-10-06); the visitor id is kept too.
    const stored = db.prepare("SELECT visitor_id AS visitorId, user_id AS userId FROM analytics_events WHERE name = 'order_created'").get() as { visitorId: string; userId: number };
    expect(stored).toEqual({ visitorId: 'visitor-12345', userId: (db.prepare('SELECT user_id FROM orders WHERE id = ?').get(order.id) as { user_id: number }).user_id });
  });

  it('keeps cart lines the customer topped up after checkout', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    await add(agent, 'apple-magsafe-battery-pack', 1); // now 3 in the cart, 2 ordered
    await verify(agent, await cardAttempt(agent, order.id)).expect(200);
    expect(((await agent.get('/api/cart')).body as CartView).lines).toEqual([expect.objectContaining({ quantity: 1 })]);
  });

  it('pays the full amount on any valid card outside the fictional banks', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = await cardAttempt(agent, order.id, { bin: '411111', last4: '1111' });
    expect(attempt).toMatchObject({ amountPaise: 6_000_00, label: 'Visa •••• 1111' });
    expect((await verify(agent, attempt).expect(200)).body.order.payment).toMatchObject({ paidPaise: 6_000_00, offerId: null });
  });

  it('refuses an offer the card does not qualify for', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const res = await payByCard(agent, order.id, { bin: '510510', last4: '5100' }, 'aurora-credit-10').expect(409);
    expect(res.body.error).toMatchObject({ code: 'OFFER_NOT_APPLICABLE', details: { reason: 'WRONG_BANK' } });
  });

  it('fails declined and insufficient-funds cards after the OTP, keeping the order, hold and cart', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    for (const [last4, reason] of [['0002', 'declined'], ['9995', 'insufficient_funds']] as const) {
      const res = await verify(agent, await cardAttempt(agent, order.id, { bin: '400000', last4 })).expect(200);
      expect(res.body.attempt).toMatchObject({ status: 'failed', failureReason: reason });
      expect(res.body.order.status).toBe('pending_payment');
    }
    expect(stock('apple-magsafe-battery-pack')).toEqual({ onHand: 5, reserved: 2 });
    expect(((await agent.get('/api/cart')).body as CartView).totalQuantity).toBe(2);
    expect(events('payment_failed').map((e) => e.reason)).toEqual(['declined', 'insufficient_funds']);

    // Retry with another card succeeds.
    expect((await verify(agent, await cardAttempt(agent, order.id)).expect(200)).body.order.status).toBe('confirmed');
  });

  it('fails after 3 wrong codes', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = await cardAttempt(agent, order.id);
    const wrong = attempt.demoCode === '000000' ? '111111' : '000000';
    expect((await verify(agent, attempt, wrong).expect(401)).body.error.details).toEqual({ attemptsLeft: 2 });
    expect((await verify(agent, attempt, wrong).expect(401)).body.error.details).toEqual({ attemptsLeft: 1 });
    expect((await verify(agent, attempt, wrong).expect(200)).body.attempt).toMatchObject({ status: 'failed', failureReason: 'verification_failed' });
    // The right code is too late now.
    expect((await verify(agent, attempt).expect(409)).body.error.code).toBe('ATTEMPT_NOT_PENDING');
  });

  it('never accepts full card details', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    for (const extra of [{ cardNumber: '4242424242424242' }, { cvv: '123' }, { expiry: '12/30' }]) {
      const res = await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'card', ...AURORA_CREDIT, ...extra }).expect(400);
      expect(res.body.error.code).toBe('INVALID_CARD');
    }
    await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'card', bin: '4242', last4: '4242' }).expect(400);
    await verify(agent, await cardAttempt(agent, order.id)).expect(200);
    const columns = (db.prepare('PRAGMA table_info(payment_attempts)').all() as { name: string }[]).map((c) => c.name);
    expect(columns.filter((c) => /number|cvv|expiry|pan/.test(c))).toEqual([]);
    const stored = JSON.stringify(db.prepare('SELECT * FROM payment_attempts').all());
    expect(stored).not.toContain('4242424242424242');
  });
});

describe('UPI payment', () => {
  const upi = (agent: Agent, orderId: string, body: object = { method: 'upi_id', upiId: 'asha@okdemo' }) =>
    agent.post(`/api/orders/${orderId}/payments`).send(body);
  const respond = (agent: Agent, id: string, approve: boolean) => agent.post(`/api/payments/${id}/upi-response`).send({ approve });

  it('confirms on approval of a UPI ID request', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = (await upi(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    expect(attempt).toMatchObject({ method: 'upi_id', status: 'pending', label: 'UPI · asha@okdemo', amountPaise: 6_000_00, expiresAt: '2026-10-06T10:05:00.000Z' });
    expect(attempt.demoCode).toBeUndefined();
    expect((await agent.get(`/api/payments/${attempt.id}`).expect(200)).body.attempt.status).toBe('pending');
    const res = await respond(agent, attempt.id, true).expect(200);
    expect(res.body.order).toMatchObject({ status: 'confirmed', payment: { method: 'upi_id', label: 'UPI · asha@okdemo', paidPaise: 6_000_00 } });
  });

  it('fails on decline, on expiry after 5 minutes, and on cancel', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    let attempt = (await upi(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    expect((await respond(agent, attempt.id, false).expect(200)).body.attempt).toMatchObject({ status: 'failed', failureReason: 'upi_declined' });

    attempt = (await upi(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    now += 5 * 60 * 1000;
    expect((await agent.get(`/api/payments/${attempt.id}`)).body.attempt).toMatchObject({ status: 'failed', failureReason: 'upi_expired' });
    expect((await respond(agent, attempt.id, true).expect(409)).body.error.code).toBe('ATTEMPT_NOT_PENDING');

    attempt = (await upi(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    expect((await agent.post(`/api/payments/${attempt.id}/cancel`).send({}).expect(200)).body.attempt).toMatchObject({ failureReason: 'cancelled' });
    expect(((await agent.get(`/api/orders/${order.id}`)).body.order as Order).status).toBe('pending_payment');
  });

  it('never lets a request outlive the stock hold', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    now += 8 * 60 * 1000;
    const attempt = (await upi(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    expect(attempt.expiresAt).toBe(order.holdExpiresAt);
  });

  it('shows a demo-payment QR URI and confirms on simulated scan + approve', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = (await upi(agent, order.id, { method: 'upi_qr' }).expect(201)).body.attempt as PaymentAttemptView;
    expect(attempt.qrUri).toBe(`demo-payment://pay?orderId=${order.id}&amount=6000.00`);
    expect((await respond(agent, attempt.id, true).expect(200)).body.order.status).toBe('confirmed');
  });

  it('refuses malformed UPI IDs', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    expect((await upi(agent, order.id, { method: 'upi_id', upiId: 'asha' }).expect(400)).body.error.code).toBe('INVALID_UPI_ID');
  });

  it('withdraws an open request when a new attempt starts', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const first = (await upi(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    await cardAttempt(agent, order.id);
    expect((await agent.get(`/api/payments/${first.id}`)).body.attempt).toMatchObject({ status: 'failed', failureReason: 'cancelled' });
  });
});

describe('boundaries', () => {
  it('cannot pay after the hold expires, including a late approval', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const card = await cardAttempt(agent, order.id);
    now += 10 * 60 * 1000 + 1;
    expect((await verify(agent, card).expect(409)).body.error.code).toBe('ATTEMPT_NOT_PENDING');
    expect(((await agent.get(`/api/orders/${order.id}`)).body.order as Order).status).toBe('payment_expired');
    expect((await agent.get(`/api/payments/${card.id}`)).body.attempt.failureReason).toBe('hold_expired');
    expect(stock('apple-magsafe-battery-pack')).toEqual({ onHand: 5, reserved: 0 });
    expect((await upiStart(agent, order.id).expect(409)).body.error.code).toBe('HOLD_EXPIRED');
  });

  it('completes once, however often it is approved', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = (await upiStart(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    const [a, b] = await Promise.all([
      agent.post(`/api/payments/${attempt.id}/upi-response`).send({ approve: true }),
      agent.post(`/api/payments/${attempt.id}/upi-response`).send({ approve: true }),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    await agent.post(`/api/payments/${attempt.id}/upi-response`).send({ approve: true }).expect(200);
    expect(stock('apple-magsafe-battery-pack')).toEqual({ onHand: 3, reserved: 0 });
    expect(events('payment_completed')).toHaveLength(1);
    expect(events('order_created')).toHaveLength(1);
    // A paid order takes no further payments (cancelling it is F-010's paid cancellation).
    expect((await upiStart(agent, order.id).expect(409)).body.error.code).toBe('ORDER_NOT_PENDING');
  });

  it('cancelling the order fails the payment in progress', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = (await upiStart(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(200);
    expect((await agent.get(`/api/payments/${attempt.id}`)).body.attempt).toMatchObject({ status: 'failed', failureReason: 'cancelled' });
    expect((await agent.post(`/api/payments/${attempt.id}/upi-response`).send({ approve: true }).expect(409)).body.error.code).toBe('ATTEMPT_NOT_PENDING');
  });

  it("keeps other customers out of an order's payments", async () => {
    const owner = await customer();
    const order = await heldOrder(owner);
    const attempt = (await upiStart(owner, order.id).expect(201)).body.attempt as PaymentAttemptView;
    const other = await customer();
    await other.get(`/api/orders/${order.id}/payment-quote`).expect(404);
    await upiStart(other, order.id).expect(404);
    await other.get(`/api/payments/${attempt.id}`).expect(404);
    await other.post(`/api/payments/${attempt.id}/upi-response`).send({ approve: true }).expect(404);
    await other.post(`/api/payments/${attempt.id}/cancel`).send({}).expect(404);
    await request(app).get(`/api/payments/${attempt.id}`).expect(401);
    expect((await owner.get(`/api/payments/${attempt.id}`)).body.attempt.status).toBe('pending');
  });

  it('records payment_started and payment_failed once per occurrence', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = (await upiStart(agent, order.id).expect(201)).body.attempt as PaymentAttemptView;
    await agent.post(`/api/payments/${attempt.id}/cancel`).send({}).expect(200);
    await agent.post(`/api/payments/${attempt.id}/cancel`).send({}).expect(200);
    expect(events('payment_started')).toEqual([{ orderId: order.id, method: 'upi_id', amountPaise: 6_000_00, offerId: null }]);
    expect(events('payment_failed')).toEqual([{ orderId: order.id, method: 'upi_id', reason: 'cancelled' }]);
  });
});

function upiStart(agent: Agent, orderId: string) {
  return agent.post(`/api/orders/${orderId}/payments`).send({ method: 'upi_id', upiId: 'asha@okdemo' });
}
