import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { emiPlan, type ChallengeResponse, type Order, type PaymentAttemptView, type PaymentQuote } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

/** Demo EMI (F-014 FR-1–FR-8): plans, no-cost EMI and offer stacking through the API. */
let db: Db;
let app: ReturnType<typeof createApp>;
let counter = 0;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  app = createApp(db, { fetch: async () => new Response('[]'), razorpay: { enabled: false } });
});

type Agent = ReturnType<typeof request.agent>;
async function customer(): Promise<Agent> {
  const agent = request.agent(app);
  counter += 1;
  const mobile = `94${String(counter).padStart(8, '0')}`;
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: `e${counter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  await agent.post('/api/addresses').send({
    fullName: 'Asha Rao', mobile, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
  }).expect(200);
  return agent;
}

/** A held order for `quantity` × ₹30,000 (free delivery). */
async function heldOrder(agent: Agent, unitPaise = 30_000_00, quantity = 2): Promise<Order> {
  db.prepare("UPDATE inventory SET on_hand = 10, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = 'apple-magsafe-battery-pack')").run();
  db.prepare("UPDATE products SET price_paise = ?, mrp_paise = ? WHERE slug = 'apple-magsafe-battery-pack'").run(unitPaise, unitPaise);
  await agent.post('/api/cart/lines').send({ productSlug: 'apple-magsafe-battery-pack', quantity }).expect(200);
  return (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
}

const pay = (agent: Agent, orderId: string, body: object) => agent.post(`/api/orders/${orderId}/payments`).send({ method: 'card', bin: '424242', last4: '4242', ...body });
const confirm = async (agent: Agent, attempt: PaymentAttemptView) =>
  (await agent.post(`/api/payments/${attempt.id}/verify`).send({ otp: attempt.demoCode }).expect(200)).body.order as Order;

describe('EMI quote', () => {
  it('lists no-cost and normal plans for an eligible credit card, and normal plans after the bank offer', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    expect(order.totals.totalPaise).toBe(60_000_00);

    let q = (await agent.get(`/api/orders/${order.id}/payment-quote?bin=424242`)).body as PaymentQuote;
    expect(q.emi.eligible).toBe(true);
    expect(q.emi.bankName).toBe('Aurora Bank');
    expect(q.emi.plans.map((p) => [p.tenure, p.noCost, p.monthlyPaise])).toEqual([
      [3, true, 20_000_00],
      [6, true, 10_000_00],
      [3, false, 20_468_00],
      [6, false, 10_412_00],
      [9, false, emiPlan('aurora', 60_000_00, 9, false).monthlyPaise],
      [12, false, 5_387_00],
    ]);

    q = (await agent.get(`/api/orders/${order.id}/payment-quote?bin=424242&offerId=aurora-credit-10`)).body as PaymentQuote;
    expect(q.emi.plans.find((p) => !p.noCost)!.chargedPaise).toBe(58_500_00);
    expect(q.emi.plans.find((p) => p.noCost)!.chargedPaise).toBe(58_627_00);

    q = (await agent.get(`/api/orders/${order.id}/payment-quote?bin=400050`)).body as PaymentQuote;
    expect(q.emi).toEqual({ eligible: false, reason: 'NOT_CREDIT', bankName: 'Aurora Bank', plans: [] });
  });
});

describe('EMI payment', () => {
  it('pays normal EMI with the bank offer and records the plan on the order', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = (await pay(agent, order.id, { offerId: 'aurora-credit-10', emi: { tenure: 6, noCost: false } }).expect(201)).body.attempt as PaymentAttemptView;
    const plan = emiPlan('aurora', 58_500_00, 6, false);
    expect(attempt).toMatchObject({ amountPaise: 58_500_00, discountPaise: 1_500_00, offerId: 'aurora-credit-10' });
    expect(attempt.emi).toMatchObject({ tenure: 6, noCost: false, monthlyPaise: plan.monthlyPaise, interestPaise: plan.interestPaise });

    const paid = await confirm(agent, attempt);
    expect(paid.payment).toMatchObject({
      paidPaise: 58_500_00,
      offerId: 'aurora-credit-10',
      provider: 'demo',
      emi: { tenure: 6, monthlyPaise: plan.monthlyPaise, interestPaise: plan.interestPaise, noCost: false },
    });
  });

  it('charges no-cost EMI so the instalments add up to the price, as the order’s one offer', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const attempt = (await pay(agent, order.id, { emi: { tenure: 6, noCost: true } }).expect(201)).body.attempt as PaymentAttemptView;
    expect(attempt).toMatchObject({ amountPaise: 57_624_00, discountPaise: 2_376_00, offerId: 'no-cost-emi' });
    expect(attempt.emi).toMatchObject({ tenure: 6, noCost: true, monthlyPaise: 10_000_00, interestPaise: 0, totalPaise: 60_000_00 });

    const paid = await confirm(agent, attempt);
    expect(paid.payment).toMatchObject({
      paidPaise: 57_624_00,
      offerId: 'no-cost-emi',
      offerDiscountPaise: 2_376_00,
      emi: { tenure: 6, monthlyPaise: 10_000_00, interestPaise: 0, noCost: true },
    });

    // Cancelling refunds what was paid, as for any order.
    const cancelled = (await agent.post(`/api/orders/${order.id}/cancel`).send({}).expect(200)).body.order as Order;
    expect(cancelled.refunds).toEqual([expect.objectContaining({ amountPaise: 57_624_00, status: 'refunded' })]);
  });

  it('refuses plans that do not apply', async () => {
    const agent = await customer();
    const order = await heldOrder(agent);
    const code = async (body: object) => (await pay(agent, order.id, body).expect((r) => expect(r.status).toBeGreaterThanOrEqual(400))).body.error;

    expect(await code({ offerId: 'aurora-credit-10', emi: { tenure: 6, noCost: true } })).toMatchObject({ code: 'OFFER_NOT_APPLICABLE', details: { reason: 'NO_COST_EMI' } });
    expect(await code({ emi: { tenure: 9, noCost: true } })).toMatchObject({ code: 'EMI_NOT_AVAILABLE' });
    expect(await code({ emi: { tenure: 5, noCost: false } })).toMatchObject({ code: 'EMI_NOT_AVAILABLE' });
    expect(await code({ bin: '400050', last4: '1009', emi: { tenure: 6, noCost: false } })).toMatchObject({ code: 'EMI_NOT_AVAILABLE', details: { reason: 'NOT_CREDIT' } });
    expect(await code({ bin: '411111', last4: '1111', emi: { tenure: 6, noCost: false } })).toMatchObject({ code: 'EMI_NOT_AVAILABLE', details: { reason: 'BANK_NOT_SUPPORTED' } });
    expect(await code({ emi: { tenure: 6, noCost: false }, cvv: '123' })).toMatchObject({ code: 'INVALID_CARD' });
  });

  it('keeps no-cost EMI for orders of ₹10,000 or more, and EMI for ₹3,000 or more', async () => {
    const agent = await customer();
    const small = await heldOrder(agent, 3_000_00, 2); // ₹6,000
    expect((await pay(agent, small.id, { emi: { tenure: 3, noCost: true } }).expect(409)).body.error.code).toBe('EMI_NOT_AVAILABLE');
    await pay(agent, small.id, { emi: { tenure: 3, noCost: false } }).expect(201);

    const other = await customer();
    const tiny = await heldOrder(other, 1_000_00, 2); // ₹2,000 + ₹49 delivery
    expect((await pay(other, tiny.id, { emi: { tenure: 3, noCost: false } }).expect(409)).body.error.details.reason).toBe('BELOW_MINIMUM');
  });
});
