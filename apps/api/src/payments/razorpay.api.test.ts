import { createHmac } from 'node:crypto';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChallengeResponse, Order, PaymentAttemptView, PaymentConfig, SimOrder } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { createFakeRazorpay, type FakeRazorpay } from './fakeRazorpay.js';
import { loadRazorpayConfig, razorpayLabel } from './razorpay.js';

/** Razorpay in test mode (F-014 FR-9–FR-13, ADR-005), against an in-memory fake. */
const SECRET = 'test_secret_abc';
const WEBHOOK_SECRET = 'whsec_test';
let db: Db;
let now: number;
let fake: FakeRazorpay;
let logs: string[];
let app: ReturnType<typeof createApp>;
let counter = 0;

function build(options: { webhook?: boolean } = {}) {
  fake = createFakeRazorpay(SECRET);
  logs = [];
  app = createApp(db, {
    fetch: fake.fetch,
    clock: () => now,
    operatorPassword: 'op',
    log: (m) => logs.push(m),
    razorpay: {
      enabled: true,
      config: { keyId: 'rzp_test_key', keySecret: SECRET, webhookSecret: options.webhook ? WEBHOOK_SECRET : null, noCostEmiOfferId: null, baseUrl: 'https://api.razorpay.test' },
    },
  });
}

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  now = Date.parse('2026-10-06T10:00:00.000Z');
  build();
});

type Agent = ReturnType<typeof request.agent>;
async function customer(): Promise<Agent> {
  const agent = request.agent(app);
  counter += 1;
  const mobile = `93${String(counter).padStart(8, '0')}`;
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: `rz${counter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  await agent.post('/api/addresses').send({
    fullName: 'Asha Rao', mobile, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
  }).expect(200);
  return agent;
}

const stock = () =>
  db.prepare("SELECT on_hand AS onHand, reserved FROM inventory WHERE product_id = (SELECT id FROM products WHERE slug = 'apple-magsafe-battery-pack')").get() as {
    onHand: number;
    reserved: number;
  };

/** A held order of 2 × ₹3,000 = ₹6,000, and a started Razorpay attempt. */
async function razorpayAttempt(agent: Agent): Promise<{ order: Order; attempt: PaymentAttemptView }> {
  db.prepare("UPDATE inventory SET on_hand = 5, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = 'apple-magsafe-battery-pack')").run();
  db.prepare("UPDATE products SET price_paise = 300000 WHERE slug = 'apple-magsafe-battery-pack'").run();
  await agent.post('/api/cart/lines').send({ productSlug: 'apple-magsafe-battery-pack', quantity: 2 }).expect(200);
  const order = (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
  const attempt = (await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'razorpay' }).expect(201)).body.attempt as PaymentAttemptView;
  return { order, attempt };
}
const verify = (agent: Agent, attempt: PaymentAttemptView, body: object) => agent.post(`/api/payments/${attempt.id}/razorpay/verify`).send(body);

describe('configuration', () => {
  it('accepts test keys only, and never exposes the secret', async () => {
    expect(loadRazorpayConfig({})).toEqual({ enabled: false });
    expect(loadRazorpayConfig({ RAZORPAY_KEY_ID: 'rzp_live_abc', RAZORPAY_KEY_SECRET: 's' })).toMatchObject({ enabled: false, error: expect.stringMatching(/live keys/) });
    expect(loadRazorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_abc' })).toMatchObject({ enabled: false, error: expect.stringMatching(/both/) });
    expect(loadRazorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 's', RAZORPAY_API_BASE_URL: 'https://evil.example' })).toMatchObject({ enabled: false });
    expect(loadRazorpayConfig({ RAZORPAY_KEY_ID: 'rzp_test_abc', RAZORPAY_KEY_SECRET: 's', RAZORPAY_API_BASE_URL: 'http://localhost:3199' })).toMatchObject({
      enabled: true,
      config: { baseUrl: 'http://localhost:3199', webhookSecret: null },
    });

    const config = (await request(app).get('/api/payments/config').expect(200)).body as PaymentConfig;
    expect(config).toEqual({ razorpay: { enabled: true, keyId: 'rzp_test_key', testMode: true } });
    expect(JSON.stringify(config)).not.toContain(SECRET);

    const off = createApp(db, { razorpay: { enabled: false } });
    expect((await request(off).get('/api/payments/config')).body).toEqual({ razorpay: { enabled: false, keyId: null, testMode: true } });
  });

  it('labels Razorpay payments by method', () => {
    const base = { id: 'pay_1', order_id: 'order_1', amount: 1, currency: 'INR', status: 'captured' as const };
    expect(razorpayLabel({ ...base, method: 'card', card: { last4: '1111', network: 'Visa' } })).toBe('Razorpay · Visa •••• 1111');
    expect(razorpayLabel({ ...base, method: 'emi', card: { last4: '1007', network: 'MasterCard' } })).toBe('Razorpay · EMI · Mastercard •••• 1007');
    expect(razorpayLabel({ ...base, method: 'upi', vpa: 'success@razorpay' })).toBe('Razorpay · UPI success@razorpay');
    expect(razorpayLabel({ ...base, method: 'netbanking', bank: 'HDFC' })).toBe('Razorpay · Netbanking HDFC');
  });
});

describe('paying with Razorpay', () => {
  it('creates a Razorpay order for the total and gives Checkout what it needs, without secrets', async () => {
    const agent = await customer();
    const { order, attempt } = await razorpayAttempt(agent);
    expect(attempt).toMatchObject({ method: 'razorpay', status: 'pending', amountPaise: 6_000_00, label: 'Razorpay' });
    expect(attempt.gateway).toEqual({
      keyId: 'rzp_test_key',
      orderId: expect.stringMatching(/^order_/),
      amountPaise: 6_000_00,
      prefill: { name: 'Asha Rao', email: expect.stringContaining('@example.com'), contact: expect.stringMatching(/^\+9193/) },
    });
    const created = fake.orders.get(attempt.gateway!.orderId)!;
    expect(created).toMatchObject({ amount: 6_000_00, receipt: order.id });
  });

  it('confirms only after the signature and Razorpay’s record agree, capturing an authorised payment', async () => {
    const agent = await customer();
    const { order, attempt } = await razorpayAttempt(agent);
    const paid = fake.pay(attempt.gateway!.orderId);

    // A tampered signature is refused and changes nothing.
    const bad = await verify(agent, attempt, { ...paid, razorpaySignature: createHmac('sha256', 'wrong').update('x').digest('hex') }).expect(400);
    expect(bad.body.error.code).toBe('GATEWAY_SIGNATURE_INVALID');
    expect(fake.payments.get(paid.razorpayPaymentId)!.status).toBe('authorized');

    const res = await verify(agent, attempt, paid).expect(200);
    expect(res.body.attempt).toMatchObject({ status: 'succeeded' });
    expect(res.body.order).toMatchObject({
      status: 'confirmed',
      payment: { method: 'razorpay', provider: 'razorpay', label: 'Razorpay · Visa •••• 1111', paidPaise: 6_000_00, offerDiscountPaise: 0, emi: null },
    });
    expect(fake.payments.get(paid.razorpayPaymentId)!.status).toBe('captured');
    expect(stock()).toEqual({ onHand: 3, reserved: 0 });

    // A repeat (or a webhook) completes nothing twice.
    await verify(agent, attempt, paid).expect(200);
    expect(stock()).toEqual({ onHand: 3, reserved: 0 });
    expect(order.id).toBe(res.body.order.id);
  });

  it('refuses a payment for a different amount unless Razorpay applied an offer', async () => {
    const agent = await customer();
    const { attempt } = await razorpayAttempt(agent);
    const short = fake.pay(attempt.gateway!.orderId, { amount: 5_000_00 });
    expect((await verify(agent, attempt, short).expect(400)).body.error.code).toBe('GATEWAY_SIGNATURE_INVALID');

    const offer = fake.pay(attempt.gateway!.orderId, { amount: 5_700_00, offerId: 'offer_nocost', method: 'emi' });
    const res = await verify(agent, attempt, offer).expect(200);
    expect(res.body.order.payment).toMatchObject({ paidPaise: 5_700_00, offerDiscountPaise: 300_00, offerId: 'offer_nocost', label: 'Razorpay · EMI · Visa •••• 1111' });
  });

  it('reconciles a payment whose callback never arrived, and cancels only when Razorpay has nothing', async () => {
    const agent = await customer();
    const { attempt } = await razorpayAttempt(agent);
    fake.pay(attempt.gateway!.orderId, { status: 'captured' });
    // Checkout closed after paying: cancel first asks Razorpay, and finds the payment.
    const closed = await agent.post(`/api/payments/${attempt.id}/cancel`).send({}).expect(409);
    expect(closed.body.error.details.attempt.status).toBe('succeeded');

    const other = await customer();
    const second = await razorpayAttempt(other);
    expect((await other.post(`/api/payments/${second.attempt.id}/cancel`).send({}).expect(200)).body.attempt).toMatchObject({ status: 'failed', failureReason: 'cancelled' });
  });

  it('refunds a payment that arrives after the hold expired, and does not confirm the order', async () => {
    const agent = await customer();
    const { order, attempt } = await razorpayAttempt(agent);
    const paid = fake.pay(attempt.gateway!.orderId, { status: 'captured' });
    now += 11 * 60 * 1000;
    const res = await verify(agent, attempt, paid).expect(200);
    expect(res.body.attempt).toMatchObject({ status: 'failed', failureReason: 'hold_expired' });
    expect(res.body.order.status).toBe('payment_expired');
    expect(fake.refunds.get(paid.razorpayPaymentId)).toEqual([expect.objectContaining({ amount: 6_000_00, receipt: `late-${attempt.id}` })]);
    // Asked again: no second refund.
    await verify(agent, attempt, paid).expect(200);
    expect(fake.refunds.get(paid.razorpayPaymentId)).toHaveLength(1);
    expect(order.id).toBeDefined();
  });

  it('says Razorpay is unavailable when it cannot be reached, without starting an attempt', async () => {
    const agent = await customer();
    db.prepare("UPDATE inventory SET on_hand = 5, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = 'apple-magsafe-battery-pack')").run();
    await agent.post('/api/cart/lines').send({ productSlug: 'apple-magsafe-battery-pack', quantity: 1 }).expect(200);
    const order = (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
    fake.setDown(true);
    expect((await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'razorpay' }).expect(502)).body.error.code).toBe('GATEWAY_UNAVAILABLE');
    expect(logs.some((l) => l.includes(SECRET))).toBe(false);
    // The demo payment still works.
    await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'upi_qr' }).expect(201);
  });
});

describe('webhooks', () => {
  const sign = (body: string) => createHmac('sha256', WEBHOOK_SECRET).update(body).digest('hex');

  it('confirm a paid order once, and only when signed', async () => {
    build({ webhook: true });
    const agent = await customer();
    const { attempt } = await razorpayAttempt(agent);
    const paid = fake.pay(attempt.gateway!.orderId, { status: 'captured' });
    const body = JSON.stringify({ event: 'payment.captured', payload: { payment: { entity: fake.payments.get(paid.razorpayPaymentId) } } });

    await request(app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', 'bad').send(body).expect(400);
    await request(app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sign(body)).send(body).expect(200);
    await request(app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').set('x-razorpay-signature', sign(body)).send(body).expect(200);
    expect((await agent.get(`/api/payments/${attempt.id}`)).body.order.status).toBe('confirmed');
    expect(stock()).toEqual({ onHand: 3, reserved: 0 });
  });

  it('are off without a webhook secret', async () => {
    await request(app).post('/api/payments/razorpay/webhook').set('Content-Type', 'application/json').send('{}').expect(404);
  });
});

describe('refunds through Razorpay (D3)', () => {
  async function paidOrder(agent: Agent) {
    const { order, attempt } = await razorpayAttempt(agent);
    const paid = fake.pay(attempt.gateway!.orderId);
    await verify(agent, attempt, paid).expect(200);
    return { order, paymentId: paid.razorpayPaymentId };
  }

  it('refunds a cancelled order through Razorpay', async () => {
    const agent = await customer();
    const { order, paymentId } = await paidOrder(agent);
    const cancelled = (await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(200)).body.order as Order;
    expect(cancelled.refunds).toEqual([expect.objectContaining({ amountPaise: 6_000_00, status: 'refunded', label: 'Razorpay · Visa •••• 1111' })]);
    expect(fake.refunds.get(paymentId)).toEqual([expect.objectContaining({ amount: 6_000_00 })]);
  });

  it('keeps a refund initiated when Razorpay refuses, and the operator retry refunds it once', async () => {
    const agent = await customer();
    const { order, paymentId } = await paidOrder(agent);
    fake.setRefundsDown(true);
    const cancelled = (await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(200)).body.order as Order;
    expect(cancelled.refunds).toEqual([expect.objectContaining({ status: 'initiated' })]);

    const op = request.agent(app);
    await op.post('/api/sim/session').send({ password: 'op' }).expect(200);
    const listed = ((await op.get('/api/sim/orders')).body.orders as SimOrder[]).find((o) => o.id === order.id)!;
    expect(listed).toMatchObject({ provider: 'razorpay', gatewayRefunds: [{ status: 'initiated', failure: 'Refunds are temporarily unavailable' }] });
    const refundId = listed.gatewayRefunds[0]!.id;
    expect((await op.post(`/api/sim/refunds/${refundId}/retry`).send({}).expect(502)).body.error.code).toBe('GATEWAY_UNAVAILABLE');

    fake.setRefundsDown(false);
    const retried = (await op.post(`/api/sim/refunds/${refundId}/retry`).send({}).expect(200)).body.order as SimOrder;
    expect(retried.gatewayRefunds).toEqual([expect.objectContaining({ status: 'refunded', failure: null })]);
    await op.post(`/api/sim/refunds/${refundId}/retry`).send({}).expect(200);
    expect(fake.refunds.get(paymentId)).toHaveLength(1);
    expect(((await agent.get(`/api/orders/${order.id}`)).body.order as Order).refunds[0]!.status).toBe('refunded');
  });
});
