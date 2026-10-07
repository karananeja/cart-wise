import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

const require = createRequire(import.meta.url);
const Database = require('../apps/api/node_modules/better-sqlite3') as typeof import('better-sqlite3');
function setStock(slug: string, onHand: number) {
  const db = new Database('apps/api/data/e2e.db');
  try {
    db.prepare('UPDATE inventory SET on_hand = ?, reserved = 0 WHERE product_id = (SELECT id FROM products WHERE slug = ?)').run(onHand, slug);
  } finally {
    db.close();
  }
}

async function enterDemoCode(page: Page) {
  const code = (await page.getByText(/Demo email to/).locator('..').textContent())!.match(/\d{6}/)![0];
  await page.getByLabel('6-digit code').fill(code);
}

const SLUG = 'apple-airpower-wireless-charger';

test('guest cart → sign up → add address → Express → payment hold → cancel back to the cart', async ({ page, request }) => {
  setStock(SLUG, 6);
  await page.goto(`/p/${SLUG}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('group', { name: 'Quantity in cart' }).getByRole('button', { name: 'Increase quantity' }).click();
  await expect(page.getByRole('link', { name: /^Cart, 2 items/ })).toBeVisible();

  await page.goto('/cart');
  await page.getByRole('link', { name: 'Proceed to checkout' }).first().click();
  await expect(page).toHaveURL(/\/login\?returnTo=%2Fcheckout/);
  await page.getByRole('link', { name: 'Create an account' }).click();
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Email', { exact: true }).fill(`asha.${n}@example.com`);
  await page.getByLabel('Mobile number').fill(`9${n}`);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByRole('button', { name: 'Continue' }).click();
  await enterDemoCode(page);

  // Back at checkout with no address yet.
  await expect(page).toHaveURL('/checkout');
  await page.getByRole('link', { name: 'Add delivery address' }).click();
  await page.getByRole('button', { name: 'Enter address manually instead' }).click();
  await page.getByLabel('Flat, house no., building').fill('Flat 4B, Lake View');
  await page.getByLabel('Area, street, locality').fill('Indiranagar');
  await page.getByLabel('Pincode').fill('560038');
  await page.getByLabel('City').fill('Bengaluru');
  await page.getByLabel('State').selectOption('Karnataka');
  await page.getByRole('button', { name: 'Save address' }).click();

  await expect(page).toHaveURL(/\/checkout\?addressId=\d+/);
  await expect(page.getByRole('region', { name: 'Delivery address' })).toContainText('Flat 4B, Lake View');
  await page.getByRole('radio', { name: /Express/ }).check();
  await expect(page.getByRole('region', { name: 'Order summary' })).toContainText('₹149');

  await page.getByRole('button', { name: 'Continue to payment' }).first().click();
  await expect(page).toHaveURL(/\/checkout\/pay\/ORD-[A-Z2-9]{8}$/);
  await expect(page.getByText(/We're holding your items for (9:5\d|10:00)/)).toBeVisible();

  // Another shopper now sees the held units as unavailable.
  const held = (await (await request.get(`/api/products/${SLUG}`)).json()).product.availability;
  expect(held).toEqual({ status: 'low_stock', available: 4 });

  await page.getByRole('button', { name: 'Cancel and return to cart' }).click();
  await expect(page).toHaveURL('/cart');
  await expect(page.getByText('Order cancelled. Nothing was charged and your cart is unchanged.')).toBeVisible();
  await expect(page.getByRole('link', { name: /^Cart, 2 items/ })).toBeVisible();
  const released = (await (await request.get(`/api/products/${SLUG}`)).json()).product.availability;
  expect(released).toEqual({ status: 'in_stock' });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('checkout keeps the total and button in a bottom bar', async ({ page }) => {
    setStock('apple-magsafe-battery-pack', 10);
    await page.goto('/p/apple-magsafe-battery-pack');
    await page.getByRole('button', { name: 'Add to cart' }).click();
    // The add must land before navigating away, or the request can be cut off under load.
    await expect(page.getByRole('banner').getByRole('link', { name: /^Cart, 1 item/ })).toBeVisible();
    await page.goto('/login?returnTo=%2Fcheckout');
    await page.getByRole('link', { name: 'Create an account' }).click();
    const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
    await page.getByLabel('Full name').fill('Asha Rao');
    await page.getByLabel('Email', { exact: true }).fill(`asha.m${n}@example.com`);
    await page.getByLabel('Mobile number').fill(`8${n}`);
    await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
    await page.getByRole('button', { name: 'Continue' }).click();
    await enterDemoCode(page);
    await expect(page).toHaveURL('/checkout');
    const bar = page.locator('.fixed.bottom-0').filter({ hasText: 'Total to pay' });
    await expect(bar).toBeVisible();
    await expect(bar.getByRole('button', { name: 'Continue to payment' })).toBeDisabled(); // no address yet
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
