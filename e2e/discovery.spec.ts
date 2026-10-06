import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const Database = require('../apps/api/node_modules/better-sqlite3') as typeof import('better-sqlite3');
const setStock = (slug: string, onHand: number) => {
  const db = new Database('apps/api/data/e2e.db');
  try {
    db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = ?)').run(onHand, slug);
  } finally {
    db.close();
  }
};

/** Signs up, adds an address and pays for the given products, all through the API. */
async function paidOrder(page: Page, slugs: string[]) {
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  const challenge = await (await page.request.post('/api/auth/signup', {
    data: { name: 'Asha Rao', email: `disc.${n}@example.com`, mobile: `6${n}`, password: 'correct horse battery' },
  })).json();
  await page.request.post('/api/auth/verify', { data: { challengeId: challenge.challengeId, code: challenge.demoCode } });
  await page.request.post('/api/addresses', {
    data: { fullName: 'Asha Rao', mobile: `6${n}`, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null },
  });
  for (const slug of slugs) expect((await page.request.post('/api/cart/lines', { data: { productSlug: slug, quantity: 1 } })).ok()).toBe(true);
  const order = (await (await page.request.post('/api/orders', { data: { delivery: 'standard' } })).json()).order;
  const attempt = (await (await page.request.post(`/api/orders/${order.id}/payments`, { data: { method: 'card', bin: '411111', last4: '1111' } })).json()).attempt;
  expect((await page.request.post(`/api/payments/${attempt.id}/verify`, { data: { otp: attempt.demoCode } })).ok()).toBe(true);
}

test('phone page pairs accessories → Add both → cart suggests more → home picks up where you left off', async ({ page }) => {
  setStock('realme-xt', 10);
  await page.goto('/p/realme-xt');
  const pairing = page.getByRole('region', { name: 'Pairs well with' });
  await expect(pairing).toBeVisible();
  await expect(page.getByRole('region', { name: 'You may also like' })).toBeVisible();
  await expect(pairing.getByText(/Total for \d items: ₹/)).toBeVisible();

  // This product plus its ticked companions.
  const items = 1 + (await pairing.getByRole('checkbox').count());
  await pairing.getByRole('button', { name: items === 3 ? 'Add all 3 to cart' : 'Add both to cart' }).click();
  await expect(pairing.getByText(`Added ${items} items to your cart`)).toBeVisible();
  await expect(page.getByRole('link', { name: new RegExp(`^Cart, ${items} items`) })).toBeVisible();

  await page.goto('/cart');
  await expect(page.getByRole('listitem').filter({ hasText: 'Realme XT' })).toBeVisible();
  const cartRail = page.getByRole('region', { name: 'Pairs well with your cart' });
  await expect(cartRail).toBeVisible();
  // The suggestions come after the checkout action.
  const checkout = page.getByRole('link', { name: 'Proceed to checkout' }).first();
  expect((await cartRail.boundingBox())!.y).toBeGreaterThan((await checkout.boundingBox())!.y);

  await page.goto('/');
  await expect(page.getByRole('region', { name: 'Still in your cart' })).toContainText(`${items} items`);
  await expect(page.getByRole('region', { name: 'Because you viewed Realme XT' })).toBeVisible();
});

test('two real orders with the same pair turn "Pairs well with" into "Frequently bought together"', async ({ browser, page }) => {
  setStock('vivo-x21', 20);
  setStock('selfie-stick-monopod', 20);
  for (let i = 0; i < 2; i += 1) {
    const shopper = await (await browser.newContext()).newPage();
    await paidOrder(shopper, ['vivo-x21', 'selfie-stick-monopod']);
  }
  await page.goto('/p/vivo-x21');
  const together = page.getByRole('region', { name: 'Frequently bought together' });
  await expect(together).toBeVisible();
  await expect(together.getByRole('checkbox', { name: 'Include Selfie Stick Monopod' })).toBeChecked();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('discovery sections fit at 360 px', async ({ page }) => {
    setStock('oppo-k1', 10);
    await page.goto('/p/oppo-k1');
    await expect(page.getByRole('region', { name: 'You may also like' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
