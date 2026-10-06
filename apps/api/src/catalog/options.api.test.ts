import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartView, ChallengeResponse, ListingResponse, Order, PaymentAttemptView, ProductDetail } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

/** Electronics options (F-013) through the API: catalog, cart, checkout, payment and sign-in merge. */
let db: Db;
let app: ReturnType<typeof createApp>;
let counter = 0;
const PHONE = 'realme-xt';

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  db.prepare('UPDATE inventory SET on_hand = 20, reserved = 0').run();
  app = createApp(db, { fetch: async () => new Response('[]') });
});

type Agent = ReturnType<typeof request.agent>;
async function customer(agent: Agent = request.agent(app)): Promise<Agent> {
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
const detail = async (slug: string) => (await request(app).get(`/api/products/${slug}`).expect(200)).body.product as ProductDetail;
const addLine = (agent: Agent, body: object) => agent.post('/api/cart/lines').send({ quantity: 1, ...body });
const tierStock = (slug: string, label: string) =>
  db.prepare(`SELECT i.on_hand AS onHand, i.reserved FROM inventory i JOIN product_variants v ON v.id = i.variant_id
    JOIN products p ON p.id = v.product_id WHERE p.slug = ? AND v.label = ?`).get(slug, label) as { onHand: number; reserved: number };

describe('catalog', () => {
  it('lists each tier with its own price, discount and stock, cheapest first', async () => {
    const phone = await detail(PHONE);
    expect(phone.optionName).toBe('Storage');
    expect(phone.hasOptions).toBe(true);
    expect(phone.sizes).toEqual([]);
    expect(phone.options.map((o) => o.label)).toEqual(['128 GB', '256 GB', '512 GB']);
    expect(phone.options[0]).toMatchObject({ pricePaise: phone.pricePaise, mrpPaise: phone.mrpPaise, discountPercent: phone.discountPercent });
    expect(phone.options[1]!.pricePaise).toBe(Math.round((phone.pricePaise * 1.1) / 100) * 100);
    expect(phone.options[2]!.pricePaise).toBe(Math.round((phone.pricePaise * 1.25) / 100) * 100);
    expect(phone.options.every((o) => o.discountPercent === phone.discountPercent)).toBe(true);

    db.prepare(`UPDATE inventory SET on_hand = 0 WHERE variant_id = (SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.slug = ? AND v.label = '512 GB')`).run(PHONE);
    expect((await detail(PHONE)).options[2]!.availability).toEqual({ status: 'out_of_stock' });

    const laptop = await detail('lenovo-yoga-920');
    expect(laptop.optionName).toBe('Configuration');
    expect(laptop.options.map((o) => o.label)).toEqual(['8 GB · 256 GB', '16 GB · 512 GB', '32 GB · 1 TB']);
    expect((await detail('apple-airpods'))).toMatchObject({ hasOptions: false, options: [], optionName: null });
  });

  it('filters and sorts by the starting price, and marks summaries with options', async () => {
    const phone = await detail(PHONE);
    const rupees = phone.pricePaise / 100;
    const listing = (await request(app).get(`/api/products?category=smartphones&price=${Math.floor(rupees)}-${Math.ceil(rupees)}`).expect(200))
      .body as ListingResponse;
    expect(listing.items.map((i) => i.slug)).toContain(PHONE);
    expect(listing.items.every((i) => i.hasOptions)).toBe(true);
    const accessories = (await request(app).get('/api/products?category=mobile-accessories').expect(200)).body as ListingResponse;
    expect(accessories.items.every((i) => !i.hasOptions)).toBe(true);
  });
});

describe('cart', () => {
  it('needs a valid option for products with options, and refuses options elsewhere', async () => {
    const guest = request.agent(app);
    expect((await addLine(guest, { productSlug: PHONE }).expect(400)).body.error.code).toBe('OPTION_REQUIRED');
    expect((await addLine(guest, { productSlug: PHONE, option: '1 TB' }).expect(400)).body.error.code).toBe('INVALID_OPTION');
    expect((await addLine(guest, { productSlug: PHONE, size: 'M' }).expect(400)).body.error.code).toBe('INVALID_SIZE');
    expect((await addLine(guest, { productSlug: 'apple-airpods', option: '128 GB' }).expect(400)).body.error.code).toBe('INVALID_OPTION');
    expect((await addLine(guest, { productSlug: 'lenovo-yoga-920', option: '128 GB' }).expect(400)).body.error.code).toBe('INVALID_OPTION');
  });

  it('keeps each tier as its own line at its own price, with stock and limits per tier', async () => {
    const guest = request.agent(app);
    const phone = await detail(PHONE);
    await addLine(guest, { productSlug: PHONE, option: '128 GB' }).expect(200);
    const cart = (await addLine(guest, { productSlug: PHONE, option: '256 GB', quantity: 2 }).expect(200)).body as CartView;
    expect(cart.lines.map((l) => [l.option, l.size, l.quantity, l.unitPricePaise, l.linePricePaise])).toEqual([
      ['256 GB', null, 2, phone.options[1]!.pricePaise, phone.options[1]!.pricePaise * 2],
      ['128 GB', null, 1, phone.pricePaise, phone.pricePaise],
    ]);
    expect(cart.totals.subtotalPaise).toBe(phone.pricePaise + phone.options[1]!.pricePaise * 2);
    expect(cart.totals.mrpPaise).toBe(phone.mrpPaise + phone.options[1]!.mrpPaise * 2);

    db.prepare(`UPDATE inventory SET on_hand = 2 WHERE variant_id = (SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id
      WHERE p.slug = ? AND v.label = '256 GB')`).run(PHONE);
    expect((await addLine(guest, { productSlug: PHONE, option: '256 GB' }).expect(409)).body.error.code).toBe('QUANTITY_LIMIT');
    await addLine(guest, { productSlug: PHONE, option: '128 GB', quantity: 5 }).expect(200);
  });
});

describe('checkout and payment', () => {
  it('holds the chosen tier, snapshots its label and price, and charges it', async () => {
    const agent = await customer();
    const phone = await detail(PHONE);
    const tier = phone.options[2]!;
    await addLine(agent, { productSlug: PHONE, option: '512 GB' }).expect(200);
    const order = (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
    expect(order.lines).toEqual([expect.objectContaining({ slug: PHONE, option: '512 GB', size: null, unitPricePaise: tier.pricePaise, unitMrpPaise: tier.mrpPaise })]);
    expect(order.totals.totalPaise).toBe(tier.pricePaise);
    expect(tierStock(PHONE, '512 GB')).toEqual({ onHand: 20, reserved: 1 });
    expect(tierStock(PHONE, '128 GB')).toEqual({ onHand: 20, reserved: 0 });

    // Any valid card outside the fictional banks pays in full.
    const attempt = (await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'card', bin: '411111', last4: '1111' }).expect(201)).body
      .attempt as PaymentAttemptView;
    await agent.post(`/api/payments/${attempt.id}/verify`).send({ otp: attempt.demoCode }).expect(200);
    const paid = (await agent.get(`/api/orders/${order.id}`)).body.order as Order;
    expect(paid.payment?.paidPaise).toBe(tier.pricePaise);
    expect(tierStock(PHONE, '512 GB')).toEqual({ onHand: 19, reserved: 0 });
  });
});

describe('sign-in merge', () => {
  it('combines lines of the same tier only', async () => {
    const account = await customer();
    await addLine(account, { productSlug: PHONE, option: '128 GB' }).expect(200);
    await account.post('/api/auth/logout').send({}).expect(200);

    const guest = request.agent(app);
    await addLine(guest, { productSlug: PHONE, option: '128 GB', quantity: 3 }).expect(200);
    await addLine(guest, { productSlug: PHONE, option: '256 GB' }).expect(200);
    const email = `o${counter}@example.com`;
    await guest.post('/api/auth/password').send({ identifier: email, password: 'correct horse battery' }).expect(200);
    const cart = (await guest.get('/api/cart')).body as CartView;
    expect(cart.lines.map((l) => [l.option, l.quantity]).sort()).toEqual([['128 GB', 3], ['256 GB', 1]]);
  });
});
