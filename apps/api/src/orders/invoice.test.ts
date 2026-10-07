import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { ChallengeResponse, Order, PaymentAttemptView } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { buildInvoice, type InvoiceData } from './invoice.js';
import { renderInvoicePdf } from './invoicePdf.js';

let db: Db;
let now: number;
let app: ReturnType<typeof createApp>;
let counter = 0;
const PASSWORD = 'test-operator';

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  now = Date.parse('2026-10-07T10:00:00.000Z');
  app = createApp(db, { fetch: async () => new Response('[]'), clock: () => now, operatorPassword: PASSWORD });
});

type Agent = ReturnType<typeof request.agent>;

async function customer(state = 'Karnataka', pincode = '560038'): Promise<Agent> {
  const agent = request.agent(app);
  counter += 1;
  const mobile = `93${String(counter).padStart(8, '0')}`;
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: `inv${counter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  await agent.post('/api/addresses').send({
    fullName: 'Asha Rao', mobile, pincode, line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: state === 'Karnataka' ? 'Bengaluru' : 'Mumbai', state, type: 'home', latitude: null, longitude: null,
  }).expect(200);
  return agent;
}

/** A product of this category at this price, in stock, and its first size if it has sizes. */
function product(category: string, pricePaise: number, nth = 0): { slug: string; size?: string } {
  const { id, slug } = db.prepare('SELECT id, slug FROM products WHERE category_slug = ? ORDER BY id LIMIT 1 OFFSET ?').get(category, nth) as { id: number; slug: string };
  db.prepare('UPDATE products SET price_paise = ?, mrp_paise = ? WHERE id = ?').run(pricePaise, pricePaise, id);
  db.prepare('UPDATE inventory SET on_hand = 20, reserved = 0 WHERE product_id = ?').run(id);
  const size = db.prepare("SELECT label FROM product_variants WHERE product_id = ? AND kind = 'size' ORDER BY sort_order LIMIT 1").get(id) as { label: string } | undefined;
  return { slug, size: size?.label };
}

async function paid(
  agent: Agent,
  items: { slug: string; size?: string; quantity?: number }[],
  pay: Record<string, unknown> = { method: 'card', bin: '424242', last4: '4242' },
): Promise<Order> {
  for (const item of items) await agent.post('/api/cart/lines').send({ productSlug: item.slug, quantity: item.quantity ?? 1, size: item.size }).expect(200);
  const order = (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
  const attempt = (await agent.post(`/api/orders/${order.id}/payments`).send(pay).expect(201)).body.attempt as PaymentAttemptView;
  return (await agent.post(`/api/payments/${attempt.id}/verify`).send({ otp: attempt.demoCode }).expect(200)).body.order as Order;
}

const categoriesOf = (order: Order) =>
  new Map(order.lines.map((l) => [l.productId, (db.prepare('SELECT category_slug AS c FROM products WHERE id = ?').get(l.productId) as { c: string }).c]));
const invoiceOf = (order: Order): InvoiceData => buildInvoice(order, categoriesOf(order));

function expectReconciled(invoice: InvoiceData) {
  const t = invoice.totals;
  expect(t.taxablePaise + t.taxPaise).toBe(t.totalPaise);
  expect(t.cgstPaise + t.sgstPaise + t.igstPaise).toBe(t.taxPaise);
  expect(t.itemsPaise + t.deliveryPaise).toBe(t.totalPaise);
  for (const l of invoice.lines) expect(l.taxablePaise + l.taxPaise).toBe(l.amountPaise);
}

describe('GET /api/orders/:id/invoice.pdf', () => {
  it('needs sign-in, belongs to the owner, and exists only once paid', async () => {
    await request(app).get('/api/orders/ORD-NOPE/invoice.pdf').expect(401);
    const agent = await customer();
    await agent.get('/api/orders/ORD-NOPE/invoice.pdf').expect(404);

    await agent.post('/api/cart/lines').send({ productSlug: product('groceries', 1_200_00).slug, quantity: 1 }).expect(200);
    const pending = (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
    expect((await agent.get(`/api/orders/${pending.id}/invoice.pdf`).expect(409)).body.error.code).toBe('INVOICE_NOT_AVAILABLE');
    now += 11 * 60 * 1000;
    expect((await agent.get(`/api/orders/${pending.id}`)).body.order.status).toBe('payment_expired');
    expect((await agent.get(`/api/orders/${pending.id}/invoice.pdf`).expect(409)).body.error.code).toBe('INVOICE_NOT_AVAILABLE');

    const order = await paid(agent, [product('groceries', 1_200_00)]);
    await (await customer()).get(`/api/orders/${order.id}/invoice.pdf`).expect(404);
  });

  it('sends the PDF as a named attachment', async () => {
    const agent = await customer();
    const order = await paid(agent, [product('groceries', 1_200_00), product('mens-shirts', 2_000_00)]);
    const res = await agent
      .get(`/api/orders/${order.id}/invoice.pdf`)
      .buffer(true)
      .parse((r, done) => {
        const chunks: Buffer[] = [];
        r.on('data', (c: Buffer) => chunks.push(c));
        r.on('end', () => done(null, Buffer.concat(chunks)));
      })
      .expect(200);
    expect(res.headers['content-type']).toBe('application/pdf');
    expect(res.headers['content-disposition']).toBe(`attachment; filename="Cartwise-Invoice-${order.id}.pdf"`);
    const pdf = res.body as Buffer;
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(pdf.length).toBeGreaterThan(5_000);
  });

  it('is still available after a paid order is cancelled', async () => {
    const agent = await customer();
    const order = await paid(agent, [product('groceries', 1_200_00)]);
    await agent.post(`/api/orders/${order.id}/cancel`).send({ reason: 'changed_mind' }).expect(200);
    await agent.get(`/api/orders/${order.id}/invoice.pdf`).expect(200);
  });
});

describe('invoice data', () => {
  it('rates each line by category and price, and splits CGST + SGST for Karnataka', async () => {
    const agent = await customer();
    const order = await paid(agent, [
      product('groceries', 1_000_00),
      product('mens-shirts', 2_000_00, 0),
      product('mens-shirts', 3_000_00, 1),
      product('womens-shoes', 2_500_00),
      product('mobile-accessories', 4_999_00),
      { ...product('womens-jewellery', 5_000_00), quantity: 2 },
      product('motorcycle', 1_00_000_00),
    ], { method: 'card', bin: '424242', last4: '4242', offerId: 'aurora-credit-10' });
    const invoice = invoiceOf(order);

    expect(invoice).toMatchObject({
      title: 'Tax Invoice (demo)',
      demoNote: 'Not a valid tax document. Demo store.',
      number: `INV-${order.id.slice(4)}`,
      invoiceDate: order.payment!.paidAt,
      orderId: order.id,
      orderDate: order.createdAt,
      seller: { name: 'Cartwise Demo Retail', state: 'Karnataka', gstin: 'DEMO — not registered' },
      billTo: { name: 'Asha Rao', state: 'Karnataka', pincode: '560038', lines: ['Flat 4B', 'Indiranagar', 'Bengaluru, Karnataka 560038'] },
      supply: 'intra',
      banner: null,
      refunds: [],
    });
    expect(invoice.lines.map((l) => [l.kind, l.ratePercent, l.amountPaise])).toEqual(
      order.lines.map((l) => ['item', rateFor(l.unitPricePaise), l.unitPricePaise * l.quantity]),
    );
    expect(invoice.lines.some((l) => l.kind === 'delivery')).toBe(false);
    expect(invoice.lines.find((l) => l.unitPricePaise === 2_000_00)!.description).toMatch(/\(Size .+\)$/);
    for (const l of invoice.lines) {
      expect(l.igstPaise).toBe(0);
      expect(l.sgstPaise - l.cgstPaise).toBeGreaterThanOrEqual(0);
      expect(l.sgstPaise - l.cgstPaise).toBeLessThanOrEqual(1);
    }
    expectReconciled(invoice);
    expect(invoice.totals.totalPaise).toBe(order.totals.totalPaise);
    expect(invoice.payment).toMatchObject({
      label: 'Aurora Bank Visa •••• 4242',
      emi: null,
      discounts: [{ label: 'Bank offer · Aurora Bank 10% instant discount', amountPaise: 1_500_00 }],
      paidPaise: order.totals.totalPaise - 1_500_00,
    });
    expect(invoice.payment.note).toMatch(/don't change the tax on items/);
    expect(invoice.amountInWords).toBe('Rupees one lakh twenty-three thousand four hundred ninety-nine only');
  });

  it('charges IGST outside Karnataka and adds delivery as an 18% line', async () => {
    const agent = await customer('Maharashtra', '400001');
    const order = await paid(agent, [product('groceries', 100_00), product('tops', 500_00)]);
    expect(order.totals.deliveryPaise).toBe(49_00);
    const invoice = invoiceOf(order);
    expect(invoice.supply).toBe('inter');
    expect(invoice.lines.map((l) => [l.kind, l.ratePercent, l.amountPaise])).toEqual([
      // Newest cart line first, as on the order.
      ['item', 5, 500_00],
      ['item', 5, 100_00],
      ['delivery', 18, 49_00],
    ]);
    expect(invoice.lines[2]).toMatchObject({ description: 'Delivery charge (Standard)', taxablePaise: 4153, taxPaise: 747, igstPaise: 747, cgstPaise: 0, sgstPaise: 0 });
    expect(invoice.totals).toMatchObject({ itemsPaise: 600_00, deliveryPaise: 49_00, totalPaise: 649_00, cgstPaise: 0, sgstPaise: 0 });
    expectReconciled(invoice);
    expect(invoice.payment).toMatchObject({ discounts: [], paidPaise: 649_00 });
    expect(invoice.amountInWords).toBe('Rupees six hundred forty-nine only');
  });

  it('records the EMI plan and the no-cost EMI discount', async () => {
    const agent = await customer();
    const order = await paid(agent, [product('mobile-accessories', 60_000_00)], { method: 'card', bin: '424242', last4: '4242', emi: { tenure: 6, noCost: true } });
    const invoice = invoiceOf(order);
    expect(invoice.payment).toMatchObject({
      emi: 'EMI 6 × ₹10,000/month · No Cost EMI, no interest',
      discounts: [{ label: 'No Cost EMI discount', amountPaise: order.payment!.offerDiscountPaise }],
      paidPaise: order.payment!.paidPaise,
    });
    // The tax is on the price, not on what was charged after the discount.
    expect(invoice.totals.totalPaise).toBe(60_000_00);
  });

  it('labels a Razorpay offer', () => {
    const base = fixture();
    const invoice = buildInvoice({ ...base, payment: { ...base.payment!, provider: 'razorpay', method: 'razorpay', label: 'Razorpay · UPI', offerId: 'offer_x', offerDiscountPaise: 100_00 } }, new Map());
    expect(invoice.payment.discounts).toEqual([{ label: 'Razorpay offer', amountPaise: 100_00 }]);
    // Unknown categories fall back to 18%.
    expect(invoice.lines[0]!.ratePercent).toBe(18);
  });

  it('says the refund is in progress until every refund of a cancelled order has completed', () => {
    const base = fixture();
    const refund = { id: 'r1', returnId: null, amountPaise: 100_00, label: 'Razorpay · UPI', status: 'initiated' as const, initiatedAt: base.createdAt, refundedAt: null };
    const cancelled = { ...base, status: 'cancelled' as const, cancelledAt: base.createdAt, refunds: [refund] } as unknown as Order;
    expect(buildInvoice(cancelled, new Map()).banner).toBe('Cancelled — refund in progress');
    expect(buildInvoice({ ...cancelled, refunds: [{ ...refund, status: 'refunded', refundedAt: base.createdAt }] } as unknown as Order, new Map()).banner).toBe('Cancelled — refunded');
  });

  it('keeps the sale and adds the banner and refund when cancelled after payment', async () => {
    const agent = await customer();
    const order = await paid(agent, [product('groceries', 1_200_00)]);
    const before = invoiceOf(order);
    const cancelled = (await agent.post(`/api/orders/${order.id}/cancel`).send({ reason: 'changed_mind' }).expect(200)).body.order as Order;
    const invoice = invoiceOf(cancelled);
    expect(invoice.banner).toBe('Cancelled — refunded');
    expect(invoice.lines).toEqual(before.lines);
    expect(invoice.totals).toEqual(before.totals);
    expect(invoice.refunds).toEqual([
      { date: cancelled.refunds[0]!.refundedAt, what: 'Order cancelled (Changed my mind)', to: 'Aurora Bank Visa •••• 4242', amountPaise: 1_200_00, status: 'Refunded' },
    ]);
  });

  it('lists a return refund without changing the sale', async () => {
    const agent = await customer();
    const op = request.agent(app);
    await op.post('/api/sim/session').send({ password: PASSWORD }).expect(200);
    const order = await paid(agent, [product('groceries', 1_200_00), product('home-decoration', 800_00)]);
    for (let i = 0; i < 3; i += 1) await op.post(`/api/sim/orders/${order.id}/advance`).send({}).expect(200);
    const code = ((await agent.get(`/api/orders/${order.id}`)).body.order as Order).deliveryCode!;
    await op.post(`/api/sim/orders/${order.id}/deliver`).send({ code }).expect(200);
    const line = order.lines.find((l) => l.unitPricePaise === 800_00)!;
    const returned = (await agent.post(`/api/orders/${order.id}/returns`).send({ lines: [{ orderLineId: line.id, reason: 'damaged' }] }).expect(201)).body.order as Order;
    let invoice = invoiceOf(returned);
    expect(invoice.banner).toBeNull();
    expect(invoice.refunds).toEqual([]);

    const returnId = returned.returns[0]!.id;
    await op.post(`/api/sim/returns/${returnId}/pickup`).send({}).expect(200);
    await op.post(`/api/sim/returns/${returnId}/refund`).send({}).expect(200);
    const refunded = (await agent.get(`/api/orders/${order.id}`)).body.order as Order;
    invoice = invoiceOf(refunded);
    expect(invoice.refunds).toEqual([expect.objectContaining({ what: `Return: ${line.title} (Damaged or defective)`, status: 'Refunded', amountPaise: returned.returns[0]!.refundPaise })]);
    expect(invoice.totals).toEqual(invoiceOf(order).totals);
  });

  it('renders a multi-page PDF for a long order', async () => {
    const base = fixture();
    const lines = Array.from({ length: 60 }, (_, i) => ({ ...base.lines[0]!, id: i + 1, title: `A product with a fairly long name that wraps onto two lines in the table, number ${i + 1}` }));
    const invoice = buildInvoice({ ...base, lines }, new Map());
    const pdf = await renderInvoicePdf(invoice);
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
    expect(Number(pdf.toString('latin1').match(/\/Type \/Pages\n\/Count (\d+)/)?.[1])).toBeGreaterThan(1);
  });
});

/** The rate the mixed order expects for each line, by its (unique) unit price. */
function rateFor(unitPricePaise: number): number {
  return ({ 1_000_00: 5, 2_000_00: 5, 3_000_00: 18, 2_500_00: 5, 4_999_00: 18, 5_000_00: 3, 1_00_000_00: 40 } as Record<number, number>)[unitPricePaise]!;
}

function fixture(): Order {
  const at = '2026-10-07T10:00:00.000Z';
  return {
    id: 'ORD-FIXTURE1',
    status: 'confirmed',
    lines: [{ id: 1, productId: 999_999, slug: 'gone', title: 'Gone product', size: null, option: null, thumbnailUrl: '/x.jpg', quantity: 1, unitPricePaise: 1_000_00, unitMrpPaise: 1_000_00 }],
    address: { fullName: 'Asha Rao', mobile: '9876543210', pincode: '560038', line1: 'Flat 4B', line2: '', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null },
    delivery: { option: 'standard', label: 'Standard', pricePaise: 0, estimate: { from: '2026-10-09', to: '2026-10-10' } },
    totals: { itemCount: 1, mrpPaise: 1_000_00, discountPaise: 0, deliveryPaise: 0, totalPaise: 1_000_00 },
    createdAt: at,
    holdExpiresAt: at,
    payment: { method: 'card', label: 'Aurora Bank Visa •••• 4242', offerId: null, offerDiscountPaise: 0, paidPaise: 1_000_00, paidAt: at, provider: 'demo', emi: null },
    history: [],
    deliveredAt: null,
    cancelledAt: null,
    cancelReason: null,
    returns: [],
    refunds: [],
    deliveryCode: null,
    actions: { canCancel: true, canReturn: false, returnWindowEndsAt: null },
    returnState: 'none',
  };
}
