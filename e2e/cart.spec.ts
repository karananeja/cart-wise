import { createRequire } from 'node:module';
import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { ListingResponse, ProductDetail } from '@store/shared';

// The E2E API runs on its own database; tests change stock directly, as the Store Simulation
// Console (F-011) will.
const require = createRequire(import.meta.url);
const Database = require('../apps/api/node_modules/better-sqlite3') as typeof import('better-sqlite3');
function setStock(slug: string, size: string | null, onHand: number) {
  const db = new Database('apps/api/data/e2e.db');
  try {
    db.prepare(
      `UPDATE inventory SET on_hand = ?, reserved = 0
       WHERE product_id = (SELECT id FROM products WHERE slug = ?)
         AND IFNULL(variant_id, 0) = IFNULL((SELECT v.id FROM product_variants v JOIN products p ON p.id = v.product_id
                                             WHERE p.slug = ? AND v.label = ?), 0)`,
    ).run(onHand, slug, slug, size);
  } finally {
    db.close();
  }
}

/** An in-stock size (≥ 3 available) of a sized product, from the seeded data. */
async function sizedProduct(request: APIRequestContext) {
  const listing = (await (await request.get('/api/products?category=mens-shoes')).json()) as ListingResponse;
  for (const item of listing.items) {
    const { product } = (await (await request.get(`/api/products/${item.slug}`)).json()) as { product: ProductDetail };
    const size = product.sizes.find((s) => s.availability.status === 'in_stock');
    if (size) return { product, size: size.label };
  }
  throw new Error('No sized product with an in-stock size');
}

const cartLink = (page: Page) => page.getByRole('link', { name: /^Cart(,|$)/ });
const UNSIZED = 'apple-macbook-pro-14-inch-space-grey';

test('add unsized and sized products, adjust, remove and undo; the cart survives a reload', async ({ page, request }) => {
  await page.goto(`/p/${UNSIZED}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByText(/Added to cart/)).toBeVisible();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');

  // Quantity is adjusted in place on the product page; − at 1 takes it back out.
  const stepper = page.getByRole('group', { name: 'Quantity in cart' });
  await stepper.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 2 items');
  await stepper.getByRole('button', { name: 'Decrease quantity' }).click();
  await stepper.getByRole('button', { name: 'Remove from cart' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 0 items');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');

  const { product, size } = await sizedProduct(request);
  await page.goto(`/p/${product.slug}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('alert')).toHaveText('Please select a size');
  await page.getByRole('group', { name: 'Size' }).getByText(size, { exact: true }).click();
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: 'Go to cart' })).toBeVisible();
  await page.getByRole('link', { name: 'Go to cart' }).click();

  await expect(page).toHaveURL('/cart');
  const row = page.getByRole('listitem').filter({ hasText: product.title });
  await expect(row.getByText(`Size: ${size}`)).toBeVisible();
  await row.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(row.getByRole('status')).toHaveText('2');
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 3 items');

  await page.reload();
  await expect(row.getByRole('status')).toHaveText('2');

  await page.getByRole('button', { name: /^Remove Apple MacBook/ }).click();
  await expect(page.getByText('Removed Apple MacBook Pro 14 Inch Space Grey')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('link', { name: 'Apple MacBook Pro 14 Inch Space Grey' })).toBeVisible();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 3 items');
});

test('a stock drop flags the line instead of removing it', async ({ page }) => {
  // A phone: the line is one storage option, with stock of its own (F-013).
  const slug = 'iphone-x';
  const option = '128 GB';
  setStock(slug, option, 20);
  await page.goto(`/p/${slug}?option=${encodeURIComponent(option)}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('link', { name: 'Go to cart' }).click();
  const row = page.getByRole('listitem').filter({ hasText: 'iPhone X' });
  await row.getByRole('button', { name: 'Increase quantity' }).click();
  await expect(row.getByRole('status')).toHaveText('2');
  // The stepper updates optimistically; wait for the server to store 3 before stock drops.
  const saved = page.waitForResponse((r) => r.url().includes('/api/cart/lines/') && r.request().method() === 'PATCH' && r.ok() && r.request().postDataJSON()?.quantity === 3);
  await row.getByRole('button', { name: 'Increase quantity' }).click();
  await saved;
  await expect(row.getByRole('status')).toHaveText('3');

  setStock(slug, option, 1);
  await page.reload();
  await expect(page.getByText(/Some items need your attention/)).toBeVisible();
  await expect(row.getByText('Only 1 available — reduce quantity')).toBeVisible();
  await expect(row.getByRole('status')).toHaveText('3');

  setStock(slug, option, 0);
  await page.reload();
  await expect(row.getByText('Out of stock')).toBeVisible();
  setStock(slug, option, 20);
});

test('carts are per browser', async ({ browser, page }) => {
  await page.goto(`/p/${UNSIZED}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');

  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto('/cart');
  await expect(otherPage.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
  await other.close();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('cart fits the screen with a subtotal bar', async ({ page }) => {
    await page.goto(`/p/${UNSIZED}`);
    await page.getByRole('button', { name: 'Add to cart' }).click();
    await page.getByRole('link', { name: 'Go to cart' }).click();
    await expect(page.getByText(/^Subtotal \(1 item\)/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
