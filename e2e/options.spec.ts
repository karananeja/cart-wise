import { createRequire } from 'node:module';
import { expect, test } from '@playwright/test';
import type { Order, ProductDetail } from '@store/shared';

// Electronics options (F-013) end to end: choose a storage option, buy it, and see it on the order.
const require = createRequire(import.meta.url);
const Database = require('../apps/api/node_modules/better-sqlite3') as typeof import('better-sqlite3');

function withDb<T>(fn: (db: import('better-sqlite3').Database) => T): T {
  const db = new Database('apps/api/data/e2e.db');
  try {
    return fn(db);
  } finally {
    db.close();
  }
}
const setStock = (slug: string, onHand: number) =>
  withDb((db) => db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = ?)').run(onHand, slug));
const optionStock = (slug: string, label: string) =>
  withDb((db) =>
    db.prepare(`SELECT i.on_hand AS onHand, i.reserved FROM inventory i JOIN product_variants v ON v.id = i.variant_id
      JOIN products p ON p.id = v.product_id WHERE p.slug = ? AND v.label = ?`).get(slug, label),
  ) as { onHand: number; reserved: number };

const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

test('choose 256 GB → cart → checkout → pay → the order shows 256 GB at its price, and only that option sells', async ({ page }) => {
  const slug = 'samsung-galaxy-s8';
  setStock(slug, 10);
  const product = (await (await page.request.get(`/api/products/${slug}`)).json()).product as ProductDetail;
  const tier = product.options.find((o) => o.label === '256 GB')!;
  expect(tier.pricePaise).toBeGreaterThan(product.pricePaise);

  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  const challenge = await (await page.request.post('/api/auth/signup', {
    data: { name: 'Asha Rao', email: `opt.${n}@example.com`, mobile: `7${n}`, password: 'correct horse battery' },
  })).json();
  await page.request.post('/api/auth/verify', { data: { challengeId: challenge.challengeId, code: challenge.demoCode } });
  await page.request.post('/api/addresses', {
    data: { fullName: 'Asha Rao', mobile: `7${n}`, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null },
  });

  // Product page: the cheapest option is preselected; choosing another updates the price and URL.
  await page.goto(`/p/${slug}`);
  const storage = page.getByRole('group', { name: 'Storage' });
  await expect(storage.getByRole('radio', { name: /128 GB/ })).toBeChecked();
  await storage.getByText('256 GB').click();
  await expect(page).toHaveURL(/option=256\+GB/);
  await expect(page.getByText(rupees(tier.pricePaise)).first()).toBeVisible();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('group', { name: 'Quantity in cart, 256 GB' })).toBeVisible();

  // Cart line names the option and charges its price.
  await page.getByRole('link', { name: 'Go to cart' }).click();
  const line = page.getByRole('listitem').filter({ hasText: 'Samsung Galaxy S8' });
  await expect(line.getByText('256 GB', { exact: true })).toBeVisible();
  await expect(line.getByText(rupees(tier.pricePaise)).first()).toBeVisible();

  await page.goto('/checkout');
  await expect(page.getByText('256 GB · Qty 1')).toBeVisible();
  await page.getByRole('button', { name: 'Continue to payment' }).first().click();
  await expect(page).toHaveURL(/\/checkout\/pay\/ORD-[A-Z2-9]{8}$/);
  const orderId = page.url().split('/').pop()!;
  expect(optionStock(slug, '256 GB')).toEqual({ onHand: 10, reserved: 1 });

  await page.getByLabel('Card number').fill('5105105105105100');
  await page.getByLabel('Expiry (MM/YY)').fill('1230');
  await page.getByLabel('CVV').fill('123');
  await page.getByRole('button', { name: /^Pay ₹/ }).first().click();
  const code = (await page.getByRole('status').filter({ hasText: 'Demo bank SMS:' }).textContent())!.match(/\d{6}/)![0];
  await page.getByLabel('6-digit code').fill(code);

  await expect(page).toHaveURL(`/orders/${orderId}/confirmation`);
  await expect(page.getByText('256 GB · Qty 1')).toBeVisible();
  const order = (await (await page.request.get(`/api/orders/${orderId}`)).json()).order as Order;
  expect(order.lines).toEqual([expect.objectContaining({ slug, option: '256 GB', unitPricePaise: tier.pricePaise })]);
  expect(optionStock(slug, '256 GB')).toEqual({ onHand: 9, reserved: 0 });
  expect(optionStock(slug, '128 GB')).toEqual({ onHand: 10, reserved: 0 });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('laptop configurations wrap at 360 px without horizontal scroll', async ({ page }) => {
    setStock('huawei-matebook-x-pro', 10);
    await page.goto('/p/huawei-matebook-x-pro');
    const configuration = page.getByRole('group', { name: 'Configuration' });
    await expect(configuration.getByRole('radio', { name: /32 GB · 1 TB/ })).toBeAttached();
    await page.screenshot({ path: 'test-results/options-mobile.png', fullPage: false });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
