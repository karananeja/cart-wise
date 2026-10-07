import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { EmailSendError, type Mailer } from '../mail/mailer.js';

let db: Db;
let now: number;
let sent: { to: string; unsubscribeUrl: string }[];
let failing: boolean;
let logs: string[];

const fakeMailer: Mailer = {
  async sendOtp() {},
  sendsNewsletterWelcome: true,
  async sendNewsletterWelcome(to, unsubscribeUrl) {
    if (failing) throw new EmailSendError('HTTP 401');
    sent.push({ to, unsubscribeUrl });
  },
};

beforeEach(() => {
  db = openDatabase(':memory:');
  now = Date.parse('2026-10-07T10:00:00.000Z');
  sent = [];
  failing = false;
  logs = [];
});

const appWith = (options: Parameters<typeof createApp>[1] = {}) => createApp(db, { clock: () => now, log: (m) => logs.push(m), ...options });
const rows = () => db.prepare('SELECT * FROM newsletter_subscribers').all() as { email: string; token_hash: string; source: string; unsubscribed_at: string | null }[];
/** The token from the welcome email's unsubscribe link. */
const tokenFrom = (message: { unsubscribeUrl: string }) => new URL(message.unsubscribeUrl).searchParams.get('token')!;

describe('newsletter sign-up (F-018)', () => {
  it('saves a new address, normalised, with only a hash of the token', async () => {
    const app = appWith();
    const res = await request(app).post('/api/newsletter').send({ email: '  Karan@Example.com ' }).expect(200);
    expect(res.body).toEqual({ ok: true });
    const [row] = rows();
    expect(row).toMatchObject({ email: 'karan@example.com', source: 'footer', unsubscribed_at: null });
    expect(row!.token_hash).toMatch(/^[\w-]{43}$/);
  });

  it('gives an already-subscribed address the same answer and keeps one row', async () => {
    const app = appWith();
    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    const again = await request(app).post('/api/newsletter').send({ email: 'KARAN@example.com' }).expect(200);
    expect(again.body).toEqual({ ok: true });
    expect(rows()).toHaveLength(1);
  });

  it('rejects an invalid email with a field error', async () => {
    const res = await request(appWith()).post('/api/newsletter').send({ email: 'not-an-email' }).expect(400);
    expect(res.body.error).toMatchObject({ code: 'INVALID_EMAIL', details: { fields: { email: 'Enter a valid email address' } } });
    await request(appWith()).post('/api/newsletter').send({}).expect(400);
    expect(rows()).toHaveLength(0);
  });

  it('allows 10 sign-ups per IP per hour', async () => {
    const app = appWith();
    for (let i = 0; i < 10; i += 1) await request(app).post('/api/newsletter').send({ email: `shopper${i}@example.com` }).expect(200);
    const blocked = await request(app).post('/api/newsletter').send({ email: 'one-more@example.com' }).expect(429);
    expect(blocked.body.error.code).toBe('TOO_MANY_REQUESTS');
    expect(rows()).toHaveLength(10);
    now += 60 * 60 * 1000;
    await request(app).post('/api/newsletter').send({ email: 'one-more@example.com' }).expect(200);
  });
});

describe('newsletter welcome email and unsubscribe (F-018)', () => {
  it('sends no welcome when MSG91 has no newsletter template', async () => {
    const app = appWith({ mailer: { ...fakeMailer, sendsNewsletterWelcome: false } });
    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sent).toHaveLength(0);
    expect(rows()).toHaveLength(1);
  });

  it('emails a welcome with an unsubscribe link that opens the page and unsubscribes on POST only', async () => {
    const app = appWith({ mailer: fakeMailer, webBaseUrl: 'https://shop.example/' });
    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const [email] = sent;
    expect(email!.to).toBe('karan@example.com');
    expect(email!.unsubscribeUrl).toMatch(/^https:\/\/shop\.example\/newsletter\/unsubscribe\?token=/);
    const token = tokenFrom(email!);
    expect(rows()[0]!.token_hash).not.toBe(token);

    // Opening the link (or a mail scanner fetching it) only looks it up.
    expect((await request(app).get('/api/newsletter/unsubscribe').query({ token }).expect(200)).body).toEqual({ maskedEmail: 'k••••@example.com' });
    expect(rows()[0]!.unsubscribed_at).toBeNull();

    await request(app).post('/api/newsletter/unsubscribe').send({ token }).expect(200);
    expect(rows()[0]!.unsubscribed_at).toBe('2026-10-07T10:00:00.000Z');
    // The link is used up.
    await request(app).get('/api/newsletter/unsubscribe').query({ token }).expect(404);
    await request(app).post('/api/newsletter/unsubscribe').send({ token }).expect(404);
  });

  it('sends no second email to an active subscriber', async () => {
    const app = appWith({ mailer: fakeMailer });
    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    expect(sent[0]!.unsubscribeUrl).toMatch(/^http:\/\/localhost:5173\/newsletter\/unsubscribe\?token=/);
    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(sent).toHaveLength(1);
  });

  it('re-subscribes after unsubscribing with a new token and a new welcome', async () => {
    const app = appWith({ mailer: fakeMailer });
    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    await vi.waitFor(() => expect(sent).toHaveLength(1));
    const first = tokenFrom(sent[0]!);
    await request(app).post('/api/newsletter/unsubscribe').send({ token: first }).expect(200);

    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    const second = tokenFrom(sent[1]!);
    expect(second).not.toBe(first);
    expect(rows()).toHaveLength(1);
    expect(rows()[0]!.unsubscribed_at).toBeNull();
    await request(app).get('/api/newsletter/unsubscribe').query({ token: first }).expect(404);
    await request(app).get('/api/newsletter/unsubscribe').query({ token: second }).expect(200);
  });

  it('still subscribes when the welcome email fails, logging only the error code', async () => {
    failing = true;
    const app = appWith({ mailer: fakeMailer });
    await request(app).post('/api/newsletter').send({ email: 'karan@example.com' }).expect(200);
    await vi.waitFor(() => expect(logs).toEqual(['Could not email a newsletter welcome (HTTP 401).']));
    expect(rows()).toHaveLength(1);
  });

  it('answers 404 for unknown, missing or oversized tokens', async () => {
    const app = appWith();
    await request(app).get('/api/newsletter/unsubscribe').query({ token: 'nope' }).expect(404);
    await request(app).get('/api/newsletter/unsubscribe').expect(404);
    await request(app).post('/api/newsletter/unsubscribe').send({ token: 'nope' }).expect(404);
    await request(app).post('/api/newsletter/unsubscribe').send({ token: 'x'.repeat(500) }).expect(404);
  });
});
