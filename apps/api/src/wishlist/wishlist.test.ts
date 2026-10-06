import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { MAX_WISHLIST_ITEMS, type WishlistView } from '@store/shared';
import { createApp } from '../app.js';
import { createCatalogRepository } from '../catalog/repository.js';
import { openDatabase, type Db } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { createWishlistService } from './service.js';

let db: Db;
let app: ReturnType<typeof createApp>;

beforeEach(() => {
  db = openDatabase(':memory:');
  seedDatabase(db);
  app = createApp(db);
});

const slugs = (view: WishlistView) => view.items.map((i) => i.product.slug);

describe('wishlist', () => {
  it('starts empty without creating a wishlist or cookie', async () => {
    const res = await request(app).get('/api/wishlist').expect(200);
    expect(res.body).toEqual({ items: [], count: 0 });
    expect(res.headers['set-cookie']).toBeUndefined();
  });

  it('saves on first PUT with an HTTP-only cookie, newest first, idempotently', async () => {
    const agent = request.agent(app);
    const first = await agent.put('/api/wishlist/items/iphone-x').expect(200);
    expect(String(first.headers['set-cookie'])).toMatch(/wishlist_id=[\w-]{20,}.*HttpOnly/);

    await agent.put('/api/wishlist/items/essence-mascara-lash-princess').expect(200);
    const again = (await agent.put('/api/wishlist/items/iphone-x').expect(200)).body as WishlistView;
    expect(again.count).toBe(2);
    expect(slugs(again)).toEqual(['essence-mascara-lash-princess', 'iphone-x']);
    expect(again.items[0]!.product).toHaveProperty('pricePaise');
  });

  it('removes idempotently and isolates browsers', async () => {
    const a = request.agent(app);
    await a.put('/api/wishlist/items/iphone-x');
    expect(((await request.agent(app).get('/api/wishlist')).body as WishlistView).count).toBe(0);
    await request(app).delete('/api/wishlist/items/iphone-x').expect(200);
    expect(((await a.get('/api/wishlist')).body as WishlistView).count).toBe(1);

    expect(((await a.delete('/api/wishlist/items/iphone-x').expect(200)).body as WishlistView).count).toBe(0);
    await a.delete('/api/wishlist/items/iphone-x').expect(200);
  });

  it('allows saving out-of-stock products and shows current availability', async () => {
    db.prepare("UPDATE inventory SET on_hand = 0 WHERE product_id = (SELECT id FROM products WHERE slug = 'iphone-x')").run();
    const view = (await request.agent(app).put('/api/wishlist/items/iphone-x').expect(200)).body as WishlistView;
    expect(view.items[0]!.product.availability).toEqual({ status: 'out_of_stock' });
  });

  it(`refuses more than ${MAX_WISHLIST_ITEMS} products`, async () => {
    const agent = request.agent(app);
    const all = db.prepare('SELECT slug FROM products ORDER BY id LIMIT 101').all() as { slug: string }[];
    for (const { slug } of all.slice(0, 100)) await agent.put(`/api/wishlist/items/${slug}`).expect(200);
    const full = await agent.put(`/api/wishlist/items/${all[100]!.slug}`).expect(409);
    expect(full.body.error.code).toBe('WISHLIST_FULL');
    // Re-saving something already there is still fine.
    await agent.put(`/api/wishlist/items/${all[0]!.slug}`).expect(200);
  });

  it('404s for unknown products', async () => {
    expect((await request.agent(app).put('/api/wishlist/items/nope').expect(404)).body.error.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('expires wishlists untouched for 90 days', async () => {
    const agent = request.agent(app);
    await agent.put('/api/wishlist/items/iphone-x');
    db.prepare("UPDATE wishlists SET updated_at = '2000-01-01T00:00:00.000Z'").run();
    expect(((await agent.get('/api/wishlist')).body as WishlistView).count).toBe(0);
    expect(createWishlistService(db, createCatalogRepository(db)).deleteExpired()).toBe(1);
  });
});
