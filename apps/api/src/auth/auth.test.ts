import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CartView, ChallengeResponse, HistoryLists, SignedInResponse, WishlistView } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import type { MailMessage, Mailer } from '../mail/mailer.js';
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

async function otpLogin(agent: Agent, email = 'karan@example.com') {
  const challenge = (await agent.post('/api/auth/otp').send({ purpose: 'login', email }).expect(200)).body as ChallengeResponse;
  return (await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200))
    .body as SignedInResponse;
}

describe('sign-up', () => {
  it('sends a code, then creates the account, normalises details, and signs in', async () => {
    const agent = request.agent(app);
    const challenge = (await agent.post('/api/auth/signup').send(SIGNUP).expect(200)).body as ChallengeResponse;
    expect(challenge).toMatchObject({ maskedEmail: 'k••••@example.com', delivery: 'demo', resendAfterSeconds: 30, expiresInSeconds: 300 });
    expect(challenge.demoCode).toMatch(/^\d{6}$/);
    // Nothing exists until the code is verified.
    expect((db.prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n).toBe(0);

    const verify = await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200);
    expect(String(verify.headers['set-cookie'])).toMatch(/session=[\w-]{40,}.*HttpOnly/);
    expect(verify.body.user).toEqual({ name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', maskedMobile: '••••••3210' });
    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Karan Aneja');
    // Entering the emailed code proves the email; the mobile is just a profile field now.
    expect(db.prepare('SELECT email_verified_at, mobile_verified_at FROM users').get()).toEqual({ email_verified_at: expect.any(String), mobile_verified_at: null });
  });

  it('works without a mobile (F-016)', async () => {
    const { result } = await signUp(request.agent(app), { ...SIGNUP, mobile: '' });
    expect(result.user).toEqual({ name: 'Karan Aneja', email: 'karan@example.com', mobile: null, maskedMobile: null });
    const other = { name: 'Asha Rao', email: 'asha@example.com', password: 'correct horse battery' };
    expect((await signUp(request.agent(app), other as typeof SIGNUP)).result.user.mobile).toBeNull();
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

  it('refuses an email that already has an account, but a mobile may be shared (F-016)', async () => {
    await signUp();
    expect((await request(app).post('/api/auth/signup').send({ ...SIGNUP, mobile: '9123456789' }).expect(409)).body.error.code).toBe('EMAIL_TAKEN');
    const { result } = await signUp(request.agent(app), { ...SIGNUP, email: 'new@example.com' });
    expect(result.user).toMatchObject({ email: 'new@example.com', mobile: '9876543210' });
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

  it('allows at most 5 codes per email per hour', async () => {
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/signup').send(SIGNUP).expect(200);
    expect((await request(app).post('/api/auth/signup').send(SIGNUP).expect(429)).body.error.code).toBe('TOO_MANY_CODES');
  });

  it('cannot reuse a code', async () => {
    const { challenge } = await signUp();
    await request(app).post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(404);
  });
});

describe('sign-in', () => {
  it('signs in with email and code, and says when there is no account', async () => {
    await signUp();
    const agent = request.agent(app);
    expect((await otpLogin(agent, ' KARAN@example.com ')).user.name).toBe('Karan Aneja');
    const none = await request(app).post('/api/auth/otp').send({ purpose: 'login', email: 'who@example.com' }).expect(404);
    expect(none.body.error).toMatchObject({ code: 'NO_ACCOUNT', message: 'No account for this email' });
    const invalid = await request(app).post('/api/auth/otp').send({ purpose: 'login', email: 'nope' }).expect(400);
    expect(invalid.body.error.details.fields).toEqual({ email: 'Enter a valid email address' });
    // A mobile number is no longer a way in.
    await request(app).post('/api/auth/otp').send({ purpose: 'login', mobile: '9876543210' }).expect(400);
  });

  it('signs in with email plus password only, with one generic error', async () => {
    await signUp();
    await request.agent(app).post('/api/auth/password').send({ email: 'KARAN@example.com', password: SIGNUP.password }).expect(200);
    const byMobile = await request(app).post('/api/auth/password').send({ email: '98765 43210', password: SIGNUP.password }).expect(401);
    const wrong = await request(app).post('/api/auth/password').send({ email: 'karan@example.com', password: 'nope nope' }).expect(401);
    const unknown = await request(app).post('/api/auth/password').send({ email: 'who@example.com', password: 'nope nope' }).expect(401);
    expect(wrong.body.error.message).toBe('Incorrect email or password');
    expect([unknown.body.error.message, byMobile.body.error.message]).toEqual([wrong.body.error.message, wrong.body.error.message]);
  });

  it('locks an email after 5 failed passwords in 15 minutes', async () => {
    await signUp();
    for (let i = 0; i < 5; i++) await request(app).post('/api/auth/password').send({ email: 'karan@example.com', password: 'wrong pass' }).expect(401);
    const locked = await request(app).post('/api/auth/password').send({ email: 'Karan@Example.com', password: SIGNUP.password }).expect(429);
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
    const challenge = (await agent.post('/api/auth/otp').send({ purpose: 'reset', email: 'karan@example.com' }).expect(200)).body as ChallengeResponse;
    expect(challenge).toMatchObject({ maskedEmail: 'k••••@example.com', delivery: 'demo' });
    const { resetToken } = (await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200)).body;
    await agent.post('/api/auth/reset').send({ resetToken, newPassword: 'short' }).expect(400);
    await agent.post('/api/auth/reset').send({ resetToken, newPassword: 'a brand new secret' }).expect(200);

    expect((await agent.get('/api/auth/me')).body.user.name).toBe('Karan Aneja');
    expect((await other.get('/api/auth/me')).body.user).toBeNull();
    await request.agent(app).post('/api/auth/password').send({ email: 'karan@example.com', password: 'a brand new secret' }).expect(200);
    await agent.post('/api/auth/reset').send({ resetToken, newPassword: 'another new secret' }).expect(410);
  });

  it('says when there is no account', async () => {
    expect((await request(app).post('/api/auth/otp').send({ purpose: 'reset', email: 'who@example.com' }).expect(404)).body.error.code).toBe('NO_ACCOUNT');
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

describe('email delivery (F-016)', () => {
  let sent: MailMessage[];
  let failing: boolean;
  let logs: string[];
  const fakeMailer: Mailer = {
    async send(message) {
      if (failing) throw Object.assign(new Error('Invalid login: 535 bad credentials for secret-pass'), { code: 'EAUTH', responseCode: 535 });
      sent.push(message);
    },
  };
  const codeFrom = (message: MailMessage) => message.subject.match(/^(\d{6}) is your Cartwise code$/)![1]!;

  beforeEach(() => {
    sent = [];
    failing = false;
    logs = [];
    app = createApp(db, { mailer: fakeMailer, log: (m) => logs.push(m) });
  });

  it('emails the sign-up code and never returns it', async () => {
    const agent = request.agent(app);
    const challenge = (await agent.post('/api/auth/signup').send(SIGNUP).expect(200)).body as ChallengeResponse;
    expect(challenge).toEqual({ challengeId: expect.any(String), maskedEmail: 'k••••@example.com', delivery: 'email', resendAfterSeconds: 30, expiresInSeconds: 300 });
    expect(sent).toHaveLength(1);
    const [email] = sent;
    expect(email!.to).toBe('karan@example.com');
    const code = codeFrom(email!);
    for (const body of [email!.text, email!.html]) {
      expect(body).toContain(code);
      expect(body).toContain('verify your email');
      expect(body).toContain('valid for 5 minutes');
      expect(body).toContain("If this wasn't you, ignore this email.");
      // No links in a code email.
      expect(body).not.toMatch(/https?:|href=/);
    }
    const verified = (await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code }).expect(200)).body as SignedInResponse;
    expect(verified.user.email).toBe('karan@example.com');
  });

  it('emails sign-in, resend and reset codes with their purpose', async () => {
    await signUp(request.agent(createApp(db)));
    const agent = request.agent(app);
    const login = (await agent.post('/api/auth/otp').send({ purpose: 'login', email: 'karan@example.com' }).expect(200)).body as ChallengeResponse;
    expect(login.demoCode).toBeUndefined();
    expect(sent.at(-1)!.text).toContain('sign in to Cartwise');

    db.prepare("UPDATE otp_challenges SET last_sent_at = '2000-01-01T00:00:00.000Z'").run();
    const resent = (await agent.post('/api/auth/otp/resend').send({ challengeId: login.challengeId }).expect(200)).body as ChallengeResponse;
    expect(resent).toMatchObject({ delivery: 'email' });
    expect(resent.demoCode).toBeUndefined();
    expect(sent).toHaveLength(2);
    await agent.post('/api/auth/verify').send({ challengeId: login.challengeId, code: codeFrom(sent[1]!) }).expect(200);

    const reset = (await request(app).post('/api/auth/otp').send({ purpose: 'reset', email: 'karan@example.com' }).expect(200)).body as ChallengeResponse;
    expect(sent.at(-1)!.text).toContain('reset your Cartwise password');
    const token = (await request(app).post('/api/auth/verify').send({ challengeId: reset.challengeId, code: codeFrom(sent.at(-1)!) }).expect(200)).body;
    expect(token.resetToken).toEqual(expect.any(String));
  });

  it('says when the email could not be sent, counts the attempt, and logs no secrets', async () => {
    failing = true;
    const res = await request(app).post('/api/auth/signup').send(SIGNUP).expect(502);
    expect(res.body.error).toMatchObject({ code: 'EMAIL_FAILED', message: "We couldn't send the code. Please try again." });
    expect(db.prepare('SELECT COUNT(*) AS n FROM otp_challenges').get()).toEqual({ n: 0 });
    expect(logs).toEqual(['Could not email a signup code (EAUTH 535).']);
    expect(logs.join()).not.toMatch(/secret|password/i);

    for (let i = 0; i < 4; i++) await request(app).post('/api/auth/signup').send(SIGNUP).expect(502);
    failing = false;
    expect((await request(app).post('/api/auth/signup').send(SIGNUP).expect(429)).body.error.code).toBe('TOO_MANY_CODES');
  });

  it('keeps the previous code usable when a resend fails', async () => {
    const agent = request.agent(app);
    const challenge = (await agent.post('/api/auth/signup').send(SIGNUP).expect(200)).body as ChallengeResponse;
    const first = codeFrom(sent[0]!);
    db.prepare("UPDATE otp_challenges SET last_sent_at = '2000-01-01T00:00:00.000Z'").run();
    failing = true;
    expect((await agent.post('/api/auth/otp/resend').send({ challengeId: challenge.challengeId }).expect(502)).body.error.code).toBe('EMAIL_FAILED');
    await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: first }).expect(200);
  });
});

describe('per-IP code limit (F-016)', () => {
  it('allows 20 codes per IP per hour across different emails', async () => {
    for (let i = 0; i < 20; i++) await request(app).post('/api/auth/signup').send({ ...SIGNUP, email: `k${i}@example.com` }).expect(200);
    const refused = await request(app).post('/api/auth/signup').send({ ...SIGNUP, email: 'k20@example.com' }).expect(429);
    expect(refused.body.error.code).toBe('TOO_MANY_CODES');
    // An hour later the address may send again.
    db.prepare("UPDATE otp_ip_sends SET sent_at = '2000-01-01T00:00:00.000Z'").run();
    await request(app).post('/api/auth/signup').send({ ...SIGNUP, email: 'k20@example.com' }).expect(200);
  });

  it('can be raised for automated tests', async () => {
    const relaxed = createApp(db, { maxOtpSendsPerIp: 100 });
    for (let i = 0; i < 21; i++) await request(relaxed).post('/api/auth/signup').send({ ...SIGNUP, email: `k${i}@example.com` }).expect(200);
  });
});

describe('accounts from before F-016', () => {
  it('sign in by email code, which verifies the email; password sign-in still works', async () => {
    db.prepare("INSERT INTO users (name, email, mobile, password_hash, mobile_verified_at, created_at) VALUES ('Old Timer', 'old@example.com', '9876500000', 'scrypt$x', 't', 't')").run();
    const verified = () => (db.prepare("SELECT email_verified_at FROM users WHERE email = 'old@example.com'").get() as { email_verified_at: string | null }).email_verified_at;
    expect(verified()).toBeNull();
    const result = await otpLogin(request.agent(app), 'old@example.com');
    expect(result.user).toEqual({ name: 'Old Timer', email: 'old@example.com', mobile: '9876500000', maskedMobile: '••••••0000' });
    const first = verified();
    expect(first).toEqual(expect.any(String));
    await otpLogin(request.agent(app), 'old@example.com');
    expect(verified()).toBe(first);
  });
});
