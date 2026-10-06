import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import type { Address, ChallengeResponse } from '@store/shared';
import { createApp } from '../app.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  app = createApp(db, { fetch: async () => new Response('[]') });
});

let mobileCounter = 0;
async function signedIn() {
  const agent = request.agent(app);
  mobileCounter += 1;
  const mobile = `98765${String(mobileCounter).padStart(5, '0')}`;
  const challenge = (await agent.post('/api/auth/signup').send({ name: 'Karan Aneja', email: `k${mobileCounter}@example.com`, mobile, password: 'correct horse battery' }))
    .body as ChallengeResponse;
  await agent.post('/api/auth/verify').send({ challengeId: challenge.challengeId, code: challenge.demoCode }).expect(200);
  return agent;
}

const address = (overrides: Record<string, unknown> = {}) => ({
  fullName: 'Karan Aneja',
  mobile: '9876543210',
  pincode: '560038',
  line1: 'Flat 4B, Lake View',
  line2: '12th Main, Indiranagar',
  landmark: 'Near the metro',
  city: 'Bengaluru',
  state: 'Karnataka',
  type: 'home',
  latitude: 12.9784,
  longitude: 77.6408,
  ...overrides,
});

const ids = (list: Address[]) => list.map((a) => [a.line1, a.isDefault]);

describe('addresses', () => {
  it('require sign-in', async () => {
    await request(app).get('/api/addresses').expect(401);
    await request(app).post('/api/addresses').send(address()).expect(401);
  });

  it('makes the first address the default and lists default first, then newest', async () => {
    const agent = await signedIn();
    await agent.post('/api/addresses').send(address({ line1: 'A' })).expect(200);
    await agent.post('/api/addresses').send(address({ line1: 'B', type: 'work' })).expect(200);
    const list = (await agent.post('/api/addresses').send(address({ line1: 'C' })).expect(200)).body.addresses as Address[];
    expect(ids(list)).toEqual([['A', true], ['C', false], ['B', false]]);
    expect(list[0]).toMatchObject({ pincode: '560038', state: 'Karnataka', latitude: 12.9784 });
  });

  it('validates fields', async () => {
    const agent = await signedIn();
    const res = await agent.post('/api/addresses').send(address({ pincode: '0123', state: 'Atlantis', line1: '' })).expect(400);
    expect(Object.keys(res.body.error.details.fields).sort()).toEqual(['line1', 'pincode', 'state']);
  });

  it('switches the default, keeping exactly one', async () => {
    const agent = await signedIn();
    await agent.post('/api/addresses').send(address({ line1: 'A' }));
    const b = ((await agent.post('/api/addresses').send(address({ line1: 'B' }))).body.addresses as Address[]).find((a) => a.line1 === 'B')!;
    const list = (await agent.post(`/api/addresses/${b.id}/default`).send({}).expect(200)).body.addresses as Address[];
    expect(ids(list)).toEqual([['B', true], ['A', false]]);
  });

  it('promotes the newest remaining address when the default is deleted, and Undo can restore it as default', async () => {
    const agent = await signedIn();
    const first = ((await agent.post('/api/addresses').send(address({ line1: 'A' }))).body.addresses as Address[])[0]!;
    await agent.post('/api/addresses').send(address({ line1: 'B' }));
    await agent.post('/api/addresses').send(address({ line1: 'C' }));

    const removed = (await agent.delete(`/api/addresses/${first.id}`).expect(200)).body as { addresses: Address[]; promotedId: number };
    expect(ids(removed.addresses)).toEqual([['C', true], ['B', false]]);
    expect(removed.promotedId).toBe(removed.addresses[0]!.id);

    const restored = (await agent.post('/api/addresses').send({ ...address({ line1: 'A' }), makeDefault: true }).expect(200)).body.addresses as Address[];
    expect(restored.filter((a) => a.isDefault).map((a) => a.line1)).toEqual(['A']);
  });

  it('updates an address', async () => {
    const agent = await signedIn();
    const [a] = (await agent.post('/api/addresses').send(address())).body.addresses as Address[];
    const list = (await agent.put(`/api/addresses/${a!.id}`).send(address({ landmark: 'Opposite the park', type: 'other' })).expect(200)).body.addresses as Address[];
    expect(list[0]).toMatchObject({ landmark: 'Opposite the park', type: 'other', isDefault: true });
  });

  it('refuses an 11th address', async () => {
    const agent = await signedIn();
    for (let i = 0; i < 10; i++) await agent.post('/api/addresses').send(address({ line1: `Flat ${i}` })).expect(200);
    expect((await agent.post('/api/addresses').send(address()).expect(409)).body.error.code).toBe('ADDRESS_LIMIT');
  });

  it("never exposes or changes another account's addresses", async () => {
    const owner = await signedIn();
    const [a] = (await owner.post('/api/addresses').send(address())).body.addresses as Address[];
    const other = await signedIn();
    expect((await other.get('/api/addresses')).body.addresses).toEqual([]);
    await other.put(`/api/addresses/${a!.id}`).send(address()).expect(404);
    await other.delete(`/api/addresses/${a!.id}`).expect(404);
    await other.post(`/api/addresses/${a!.id}/default`).send({}).expect(404);
    expect(((await owner.get('/api/addresses')).body.addresses as Address[]).length).toBe(1);
  });
});
