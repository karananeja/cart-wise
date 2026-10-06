import request from 'supertest';
import { beforeEach, expect, it } from 'vitest';
import type { ChallengeResponse } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

let db: Db;
let now: number;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  now = Date.parse('2026-10-06T10:00:00.000Z');
  app = createApp(db, { fetch: async () => new Response('[]'), clock: () => now, operatorPassword: 'test-operator' });
});

it('needs the operator session for every operator route', async () => {
  for (const [method, path] of [
    ['get', '/api/sim/orders'],
    ['post', '/api/sim/orders/ORD-X/advance'],
    ['post', '/api/sim/orders/ORD-X/deliver'],
    ['post', '/api/sim/orders/ORD-X/delivery-code'],
    ['post', '/api/sim/returns/RET-X/pickup'],
    ['post', '/api/sim/returns/RET-X/refund'],
  ] as const) {
    const res = method === 'get' ? await request(app).get(path) : await request(app).post(path).send({});
    expect(res.status, path).toBe(401);
    expect(res.body.error.code).toBe('OPERATOR_REQUIRED');
  }
});

it('does not treat a signed-in customer as an operator', async () => {
  const agent = request.agent(app);
  const c = (await agent.post('/api/auth/signup').send({ name: 'Asha Rao', email: 'sim@example.com', mobile: '9400000001', password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: c.challengeId, code: c.demoCode }).expect(200);
  expect((await agent.get('/api/sim/session')).body).toEqual({ signedIn: false });
  await agent.get('/api/sim/orders').expect(401);
});

it('signs in with the password, signs out, and expires after 8 hours', async () => {
  const op = request.agent(app);
  expect((await op.post('/api/sim/session').send({ password: 'nope' }).expect(401)).body.error.code).toBe('WRONG_PASSWORD');
  await op.post('/api/sim/session').send({ password: 'test-operator' }).expect(200);
  expect((await op.get('/api/sim/session')).body).toEqual({ signedIn: true });
  await op.get('/api/sim/orders').expect(200);
  await op.delete('/api/sim/session').expect(200);
  await op.get('/api/sim/orders').expect(401);

  await op.post('/api/sim/session').send({ password: 'test-operator' }).expect(200);
  now += 8 * 60 * 60 * 1000 + 1;
  await op.get('/api/sim/orders').expect(401);
  // Only a hash of the token is stored.
  const stored = db.prepare('SELECT token_hash FROM operator_sessions').all() as { token_hash: string }[];
  expect(stored.length).toBeGreaterThan(0);
});

it('limits wrong passwords: 5 in 15 minutes', async () => {
  const op = request.agent(app);
  for (let i = 0; i < 5; i += 1) await op.post('/api/sim/session').send({ password: 'nope' }).expect(401);
  const res = await op.post('/api/sim/session').send({ password: 'test-operator' }).expect(429);
  expect(res.body.error).toMatchObject({ code: 'TOO_MANY_ATTEMPTS', details: { retryAfterSeconds: 900 } });
  now += 15 * 60 * 1000;
  await op.post('/api/sim/session').send({ password: 'test-operator' }).expect(200);
});
