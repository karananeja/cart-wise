import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartView, ChallengeResponse, HistoryLists, SignedInResponse, WishlistView } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  app = createApp(db);
});

const SIGNUP = { name: 'Karan Aneja', email: 'Karan@Example.com', mobile: '+91 98765 43210', password: 'correct horse battery' };
type Agent = ReturnType<typeof request.agent>;

async function signUp(agent: Agent = request.agent(app), details = SIGNUP) {
  const challenge = (await agent.post('/api/auth/signup').send(details).expect(200)).body as ChallengeResponse;
  const result = (await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200))
    .body as SignedInResponse;
  return { agent, challenge, result };
}

async function otpLogin(agent: Agent, mobile = '9876543210') {
  const challenge = (await agent.post('/api/auth/otp').send({ purpose: 'login', mobile }).expect(200)).body as ChallengeResponse;
  return (await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200))
    .body as SignedInResponse;
}

describe('sign-up', () => {
  it('sends a code, then creates the account, normalises details, and signs in', async () => {
    const agent = request.agent(app);
    const challenge = (await agent.post('/api/auth/signup').send(SIGNUP).expect(200)).body as ChallengeResponse;
    expect(challenge).toMatchObject({ maskedMobile: '••••••3210', resendAfterSeconds: 30, expiresInSeconds: 300 });
    expect(challenge.demoCode).toMatch(/^\d{6}$/);
    // Nothing exists until the code is verified.
    expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(0);

    const verify = await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200);
    expect(String(verify.headers['set-cookie'])).toMatch(/session=[\w-]{40,}.*HttpOnly/);
    expect(verify.body.user).toEqual({ name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', maskedMobile: '••••••3210' });
    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Karan Aneja');
  });

  it('stores only hashes for passwords, codes and sessions', async () => {
    const { challenge } = await signUp();
    const user = db.prepare('SELECT password_hash FROM users').get() as { password_hash: string };
    expect(user.password_hash).toMatch(/^scrypt\$/);
    expect(user.password_hash).not.toContain(SIGNUP.password);
    const stored = db.prepare('SELECT code_hash FROM otp_challenges').get() as { code_hash: string };
    expect(stored.code_hash).not.toContain(challenge.demoCode);
  });

  it('returns field errors for invalid details and common passwords', async () => {
    const res = await request(app).post('/api/auth/signup').send({ name: 'K', email: 'nope', mobile: '12345', password: 'password' }).expect(400);
    expect(res.body.error.details.fields).toEqual({
      name: 'Enter your name (2–60 characters)',
      email: 'Enter a valid email address',
      mobile: 'Enter a 10-digit Indian mobile number',
      password: 'That password is too common',
    });
  });

  it('refuses an email or mobile that already has an account', async () => {
    await signUp();
    expect((await request(app).post('/api/auth/signup').send({ ...SIGNUP, mobile: '9123456789' }).expect(409)).body.error.code).toBe('EMAIL_TAKEN');
    expect((await request(app).post('/api/auth/signup').send({ ...SIGNUP, email: 'new@example.com' }).expect(409)).body.error.code).toBe('MOBILE_TAKEN');
  });

  it('lets an unverified sign-up be started again', async () => {
    await request(app).post('/api/auth/signup').send(SIGNUP).expect(200);
    await signUp();
  });
});

describe('codes', () => {
  it('counts wrong attempts and requires a new code after 5', async () => {
    const agent = request.agent(app);
    const { challengeId, demoCode } = (await agent.post('/api/auth/signup').send(SIGNUP)).body as ChallengeResponse;
    const wrong = demoCode === '000000' ? '111111' : '000000';
    for (let left = 4; left >= 1; left--) {
      const res = await agent.post('/api/auth/verify').send({ challengeId, code: wrong }).expect(401);
      expect(res.body.error).toMatchObject({ code: 'INVALID_CODE', details: { attemptsLeft: left } });
    }
    await agent.post('/api/auth/verify').send({ challengeId, code: wrong }).expect(429);
    await agent.post('/api/auth/verify').send({ challengeId, code: demoCode }).expect(429);
  });

  it('expires codes after 5 minutes and allows resend only after 30 seconds', async () => {
    const agent = request.agent(app);
    const { challengeId, demoCode } = (await agent.post('/api/auth/signup').send(SIGNUP)).body as ChallengeResponse;
    const early = await agent.post('/api/auth/otp/resend').send({ challengeId }).expect(429);
    expect(early.body.error.code).toBe('RESEND_TOO_SOON');

    db.prepare("UPDATE otp_challenges SET expires_at = '2000-01-01T00:00:00.000Z', last_sent_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await agent.post('/api/auth/verify').send({ challengeId, code: demoCode }).expect(410)).body.error.code).toBe('CODE_EXPIRED');

    const fresh = (await agent.post('/api/auth/otp/resend').send({ challengeId }).expect(200)).body as ChallengeResponse;
    await agent.post('/api/auth/verify').send({ challengeId, code: fresh.demoCode }).expect(200);
  });

  it('allows at most 5 codes per mobile per hour', async () => {
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/signup').send(SIGNUP).expect(200);
    expect((await request(app).post('/api/auth/signup').send(SIGNUP).expect(429)).body.error.code).toBe('TOO_MANY_CODES');
  });

  it('cannot reuse a code', async () => {
    const { challenge } = await signUp();
    await request(app).post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(404);
  });
});

describe('sign-in', () => {
  it('signs in with mobile and code, and says when there is no account', async () => {
    await signUp();
    const agent = request.agent(app);
    expect((await otpLogin(agent)).user.name).toBe('Karan Aneja');
    expect((await request(app).post('/api/auth/otp').send({ purpose: 'login', mobile: '9000000000' }).expect(404)).body.error.code).toBe('NO_ACCOUNT');
    await request(app).post('/api/auth/otp').send({ purpose: 'login', mobile: '123' }).expect(400);
  });

  it('signs in with email or mobile plus password, with one generic error', async () => {
    await signUp();
    await request.agent(app).post('/api/auth/password').send({ identifier: 'KARAN@example.com', password: SIGNUP.password }).expect(200);
    await request.agent(app).post('/api/auth/password').send({ identifier: '98765 43210', password: SIGNUP.password }).expect(200);
    const wrong = await request(app).post('/api/auth/password').send({ identifier: 'karan@example.com', password: 'nope nope' }).expect(401);
    const unknown = await request(app).post('/api/auth/password').send({ identifier: 'who@example.com', password: 'nope nope' }).expect(401);
    expect(wrong.body.error.message).toBe(unknown.body.error.message);
  });

  it('locks an identifier after 5 failed passwords in 15 minutes', async () => {
    await signUp();
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/password').send({ identifier: '9876543210', password: 'wrong pass' }).expect(401);
    const locked = await request(app).post('/api/auth/password').send({ identifier: '+919876543210', password: SIGNUP.password }).expect(429);
    expect(locked.body.error.details.retryAfterSeconds).toBeGreaterThan(0);
  });

  it('signs out this device only', async () => {
    await signUp();
    const a = request.agent(app);
    const b = request.agent(app);
    await otpLogin(a);
    await otpLogin(b);
    const out = await a.post('/api/auth/logout').send({}).expect(200);
    expect(String(out.headers['set-cookie'])).toMatch(/session=;/);
    expect((await a.get('/api/auth/me')).body.user).toBeNull();
    expect((await b.get('/api/auth/me')).body.user).not.toBeNull();
  });

  it('expires sessions', async () => {
    const { agent } = await signUp();
    db.prepare("UPDATE sessions SET expires_at = '2000-01-01T00:00:00.000Z'").run();
    expect((await agent.get('/api/auth/me')).body.user).toBeNull();
  });
});

describe('forgot password', () => {
  it('resets with a code, signs in, and signs out other sessions', async () => {
    const { agent: other } = await signUp();
    const agent = request.agent(app);
    const challenge = (await agent.post('/api/auth/otp').send({ purpose: 'reset', identifier: 'karan@example.com' }).expect(200)).body as ChallengeResponse;
    const { resetToken } = (await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200)).body;
    await agent.post('/api/auth/reset').send({ resetToken, newPassword: 'short' }).expect(400);
    await agent.post('/api/auth/reset').send({ resetToken, newPassword: 'a brand new secret' }).expect(200);

    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Karan Aneja');
    expect((await other.get('/api/auth/me')).body.user).toBeNull();
    await request.agent(app).post('/api/auth/password').send({ identifier: '9876543210', password: 'a brand new secret' }).expect(200);
    await agent.post('/api/auth/reset').send({ resetToken, newPassword: 'another new secret' }).expect(410);
  });

  it('says when there is no account', async () => {
    expect((await request(app).post('/api/auth/otp').send({ purpose: 'reset', identifier: 'who@example.com' }).expect(404)).body.error.code).toBe('NO_ACCOUNT');
  });
});

describe('guest merge on sign-in', () => {
  const addToCart = (agent: Agent, productSlug: string, quantity = 1) => agent.post('/api/cart/lines').send({ productSlug, quantity }).expect(200);
  const cart = async (agent: Agent) => (await agent.get('/api/cart')).body as CartView;
  const lineQty = (view: CartView, slug: string) => view.lines.find((l) => l.product.slug === slug)?.quantity;

  it('keeps a guest cart and wishlist when there is nothing on the account yet', async () => {
    const agent = request.agent(app);
    await addToCart(agent, 'apple-magsafe-battery-pack', 2);
    await agent.put('/api/wishlist/items/essence-mascara-lash-princess').expect(200);
    const { result } = await signUp(agent);
    expect(result.merged).toEqual({ cart: true, wishlist: true });
    expect(lineQty(await cart(agent), 'apple-magsafe-battery-pack')).toBe(2);
    expect(((await agent.get('/api/wishlist')).body as WishlistView).count).toBe(1);
  });

  it('takes the larger quantity for items in both carts and keeps the rest', async () => {
    db.prepare("UPDATE inventory SET on_hand = 20 WHERE product_id IN (SELECT id FROM products WHERE slug IN ('apple-magsafe-battery-pack', 'essence-mascara-lash-princess', 'apple-airpods'))").run();
    const { agent: account } = await signUp();
    await addToCart(account, 'apple-magsafe-battery-pack', 1);
    await addToCart(account, 'apple-airpods', 1);
    await account.post('/api/auth/logout').send({});

    const guest = request.agent(app);
    await addToCart(guest, 'apple-magsafe-battery-pack', 3);
    await addToCart(guest, 'essence-mascara-lash-princess', 1);
    expect((await otpLogin(guest)).merged.cart).toBe(true);

    const merged = await cart(guest);
    expect(lineQty(merged, 'apple-magsafe-battery-pack')).toBe(3);
    expect(lineQty(merged, 'apple-airpods')).toBe(1);
    expect(lineQty(merged, 'essence-mascara-lash-princess')).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM carts').get() as { n: number }).n).toBe(1);
  });

  it('unions wishlists, keeping at most 100', async () => {
    const { agent: account } = await signUp();
    const slugs = (db.prepare('SELECT slug FROM products ORDER BY id LIMIT 105').all() as { slug: string }[]).map((r) => r.slug);
    for (const slug of slugs.slice(0, 60)) await account.put(`/api/wishlist/items/${slug}`).expect(200);
    await account.post('/api/auth/logout').send({});

    const guest = request.agent(app);
    for (const slug of slugs.slice(50, 105)) await guest.put(`/api/wishlist/items/${slug}`).expect(200);
    await otpLogin(guest);
    expect(((await guest.get('/api/wishlist')).body as WishlistView).count).toBe(100);
  });

  it('leaves the device as an empty guest after sign-out, and an old guest cookie cannot reach the account cart', async () => {
    const agent = request.agent(app);
    await addToCart(agent, 'apple-magsafe-battery-pack');
    const guestCookie = (await agent.get('/api/cart')).request.cookies ?? '';
    await signUp(agent);
    await agent.post('/api/auth/logout').send({});
    expect((await cart(agent)).lines).toEqual([]);
    // Replaying the pre-sign-in guest cookie must not expose the (adopted) account cart.
    const cartId = db.prepare('SELECT id FROM carts').get() as { id: string };
    expect((await request(app).get('/api/cart').set('Cookie', `cart_id=${cartId.id}`)).body.lines).toEqual([]);
    expect(guestCookie).toBeDefined();

    await otpLogin(agent);
    expect(lineQty(await cart(agent), 'apple-magsafe-battery-pack')).toBe(1);
  });

  it('merges recently viewed and searches into the account, newest first', async () => {
    const { agent } = await signUp();
    const first: HistoryLists = {
      recentlyViewed: [{ slug: 'apple-magsafe-battery-pack', viewedAt: '2026-10-01T10:00:00.000Z' }],
      recentSearches: [{ query: 'Laptop', searchedAt: '2026-10-01T10:00:00.000Z' }],
    };
    await agent.post('/api/auth/sync').send(first).expect(200);
    const merged = (await agent.post('/api/auth/sync').send({
      recentlyViewed: [{ slug: 'apple-airpods', viewedAt: '2026-10-02T10:00:00.000Z' }, { slug: 'apple-magsafe-battery-pack', viewedAt: '2026-09-01T10:00:00.000Z' }],
      recentSearches: [{ query: 'laptop', searchedAt: '2026-10-03T10:00:00.000Z' }],
    }).expect(200)).body as HistoryLists;
    expect(merged.recentlyViewed.map((v) => v.slug)).toEqual(['apple-airpods', 'apple-magsafe-battery-pack']);
    expect(merged.recentlyViewed[1]!.viewedAt).toBe('2026-10-01T10:00:00.000Z');
    expect(merged.recentSearches).toEqual([{ query: 'laptop', searchedAt: '2026-10-03T10:00:00.000Z' }]);
    await request(app).post('/api/auth/sync').send(first).expect(401);

    // Removing from the account means a later sync can't bring it back.
    await agent.post('/api/auth/history/remove').send({ list: 'recentSearches', key: 'LAPTOP' }).expect(200);
    await agent.post('/api/auth/history/remove').send({ list: 'recentlyViewed', key: 'apple-magsafe-battery-pack' }).expect(200);
    let after = (await agent.post('/api/auth/sync').send({ recentlyViewed: [], recentSearches: [] })).body as HistoryLists;
    expect(after).toEqual({ recentlyViewed: [expect.objectContaining({ slug: 'apple-airpods' })], recentSearches: [] });
    await agent.post('/api/auth/history/remove').send({ list: 'recentlyViewed' }).expect(200);
    after = (await agent.post('/api/auth/sync').send({ recentlyViewed: [], recentSearches: [] })).body as HistoryLists;
    expect(after.recentlyViewed).toEqual([]);
    await agent.post('/api/auth/history/remove').send({ list: 'wishlist' }).expect(400);
    await request(app).post('/api/auth/history/remove').send({ list: 'recentlyViewed' }).expect(401);
  });
});

describe('cross-site guard', () => {
  it('rejects non-JSON POSTs but still accepts the analytics beacon', async () => {
    await request(app).post('/api/auth/logout').set('Content-Type', 'application/x-www-form-urlencoded').send('a=1').expect(415);
    await request(app).post('/api/cart/lines').set('Content-Type', 'text/plain').send('{}').expect(415);
    const event = { name: 'filter_applied', properties: {}, visitorId: 'visitor-12345', occurredAt: new Date().toISOString() };
    await request(app).post('/api/events').set('Content-Type', 'text/plain').send(JSON.stringify({ events: [event] })).expect(202);
  });
});
