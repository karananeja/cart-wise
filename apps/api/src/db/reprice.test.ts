import request from 'supertest';
import { expect, it } from 'vitest';
import { createApp } from '../app.js';
import { USD_TO_INR_RATE } from '../catalog/config.js';
import { openDatabase } from './database.js';
import { repriceIfRateChanged, seedDatabase, storedPriceRate } from './seed.js';

it('converts prices at ₹96 per $1', () => {
  expect(USD_TO_INR_RATE).toBe(96);
});

it('re-prices an older database in place, keeping stock and carts', async () => {
  const db = openDatabase(':memory:');
  seedDatabase(db);
  const app = createApp(db);
  const agent = request.agent(app);
  await agent.post('/api/cart/lines').send({ productSlug: 'essence-mascara-lash-princess' }).expect(200);

  // Simulate a database priced at the old 1:1 rate.
  db.prepare("UPDATE products SET mrp_paise = 999, price_paise = 894 WHERE slug = 'essence-mascara-lash-princess'").run();
  db.prepare("UPDATE app_settings SET value = '1' WHERE key = 'usd_to_inr_rate'").run();
  const stockBefore = db.prepare('SELECT on_hand FROM inventory ORDER BY id').all();

  expect(repriceIfRateChanged(db)).toBe(true);
  expect(storedPriceRate(db)).toBe(96);
  expect(db.prepare('SELECT on_hand FROM inventory ORDER BY id').all()).toEqual(stockBefore);
  const cart = (await agent.get('/api/cart')).body;
  expect(cart.lines[0].product).toMatchObject({ mrpPaise: 95904, pricePaise: 85853 });
  expect(repriceIfRateChanged(db)).toBe(false);
});
