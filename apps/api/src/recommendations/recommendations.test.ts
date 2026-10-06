import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartRecommendations, ChallengeResponse, HomeRecommendations, Order, PaymentAttemptView, ProductRecommendations } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

let db: Db;
let app: ReturnType<typeof createApp>;
let counter = 0;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  db.prepare('UPDATE inventory SET on_hand = 50, reserved = 0').run();
  app = createApp(db, { fetch: async () => new Response('[]') });
});

type Agent = ReturnType<typeof request.agent>;
async function customer(): Promise<Agent> {
  const agent = request.agent(app);
  counter += 1;
  const mobile = `93${String(counter).padStart(8, '0')}`;
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: `r${counter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  await agent.post('/api/addresses').send({
    fullName: 'Asha Rao', mobile, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
  }).expect(200);
  return agent;
}
/** Phones are sold in storage options (F-013): those are added as their base tier. */
const baseOption = (slug: string) =>
  (db.prepare("SELECT v.label FROM product_variants v JOIN products p ON p.id = v.product_id WHERE p.slug = ? AND v.kind = 'option' ORDER BY v.sort_order LIMIT 1").get(slug) as { label: string } | undefined)?.label;
const add = (agent: Agent, productSlug: string) => agent.post('/api/cart/lines').send({ productSlug, option: baseOption(productSlug), quantity: 1 }).expect(200);
async function buy(agent: Agent, slugs: string[], pay = true): Promise<Order> {
  for (const slug of slugs) await add(agent, slug);
  const order = (await agent.post('/api/orders').send({ delivery: 'standard' }).expect(201)).body.order as Order;
  if (!pay) return order;
  const attempt = (await agent.post(`/api/orders/${order.id}/payments`).send({ method: 'card', bin: '411111', last4: '1111' }).expect(201)).body.attempt as PaymentAttemptView;
  await agent.post(`/api/payments/${attempt.id}/verify`).send({ otp: attempt.demoCode }).expect(200);
  return order;
}
const productRecs = async (slug: string) => (await request(app).get(`/api/products/${slug}/recommendations`).expect(200)).body as ProductRecommendations;
const slugsOfCategory = (category: string) =>
  (db.prepare('SELECT slug FROM products WHERE category_slug = ? AND NOT EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = products.id) ORDER BY id').all(category) as { slug: string }[]).map((r) => r.slug);

describe('product recommendations', () => {
  it('suggests similar items in the same category, never the product itself', async () => {
    const recs = await productRecs('iphone-x');
    expect(recs.similar.length).toBeGreaterThan(0);
    expect(recs.similar.every((p) => p.categorySlug === 'smartphones' && p.slug !== 'iphone-x')).toBe(true);
    // Phones need a storage option chosen, so they can't be bundle-added blindly (F-013).
    expect(recs.similar[0]).toMatchObject({ needsSize: true, hasOptions: true });
  });

  it('pairs from the complementary map until 2 real paid orders contain both items', async () => {
    let recs = await productRecs('iphone-x');
    expect(recs.pairing?.kind).toBe('pairs_well');
    expect(recs.pairing!.items.every((p) => p.categorySlug === 'mobile-accessories')).toBe(true);

    // A companion the map would not pick first.
    const companion = slugsOfCategory('mobile-accessories').find((s) => !recs.pairing!.items.some((p) => p.slug === s))!;
    await buy(await customer(), ['iphone-x', companion]);
    // An unpaid hold doesn't count.
    await buy(await customer(), ['iphone-x', companion], false);
    expect((await productRecs('iphone-x')).pairing?.kind).toBe('pairs_well');

    await buy(await customer(), ['iphone-x', companion]);
    recs = await productRecs('iphone-x');
    expect(recs.pairing).toEqual({ kind: 'bought_together', items: [expect.objectContaining({ slug: companion })] });
    // And the other way round.
    expect((await productRecs(companion)).pairing).toEqual({ kind: 'bought_together', items: [expect.objectContaining({ slug: 'iphone-x' })] });
  });

  it('shows no pairing for unmapped categories, and 404s unknown products', async () => {
    const ball = slugsOfCategory('sports-accessories')[0]!;
    expect((await productRecs(ball)).pairing).toBeNull();
    await request(app).get('/api/products/nope/recommendations').expect(404);
  });
});

describe('home recommendations', () => {
  it('is empty for a first-time visitor', async () => {
    expect((await request(app).get('/api/recommendations/home').expect(200)).body).toEqual({ becauseViewed: null, becauseBought: null });
  });

  it('suggests from the latest viewed product, excluding everything viewed, and ignores bad slugs', async () => {
    const viewed = ['iphone-x', 'apple-airpods', 'BAD SLUG', 'nope'];
    const res = (await request(app).get(`/api/recommendations/home?viewed=${viewed.map(encodeURIComponent).join(',')}`).expect(200)).body as HomeRecommendations;
    expect(res.becauseViewed?.anchor).toEqual({ slug: 'iphone-x', title: expect.any(String) });
    expect(res.becauseViewed!.items.some((p) => ['iphone-x', 'apple-airpods'].includes(p.slug))).toBe(false);
    expect(res.becauseBought).toBeNull();
  });

  it('adds Because you bought for signed-in customers, without items bought or in the cart', async () => {
    const agent = await customer();
    await buy(agent, ['iphone-x']);
    let res = (await agent.get('/api/recommendations/home').expect(200)).body as HomeRecommendations;
    expect(res.becauseBought?.anchor.slug).toBe('iphone-x');
    const first = res.becauseBought!.items[0]!;
    expect(res.becauseBought!.items.some((p) => p.slug === 'iphone-x')).toBe(false);

    await add(agent, first.slug);
    res = (await agent.get('/api/recommendations/home').expect(200)).body as HomeRecommendations;
    expect(res.becauseBought?.items.some((p) => p.slug === first.slug) ?? false).toBe(false);
    // Guests never get it.
    expect(((await request(app).get('/api/recommendations/home')).body as HomeRecommendations).becauseBought).toBeNull();
  });
});

describe('cart recommendations', () => {
  it('pairs with what is in the cart, never suggesting cart items, for guests too', async () => {
    const guest = request.agent(app);
    expect(((await guest.get('/api/cart/recommendations').expect(200)).body as CartRecommendations).items).toEqual([]);
    await add(guest, 'iphone-x');
    const items = ((await guest.get('/api/cart/recommendations')).body as CartRecommendations).items;
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((p) => p.categorySlug === 'mobile-accessories')).toBe(true);
    await add(guest, items[0]!.slug);
    const after = ((await guest.get('/api/cart/recommendations')).body as CartRecommendations).items;
    expect(after.some((p) => p.slug === items[0]!.slug)).toBe(false);
    expect(after.length).toBeLessThanOrEqual(8);
  });
});
