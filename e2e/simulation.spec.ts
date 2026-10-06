import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

/*
 * Runs in its own Playwright project after every other spec (playwright.config.ts): automatic
 * restock picks random low-stock items, which could otherwise refill another spec's product.
 */

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

const topUpOtherLowStock = (keep: string) => {
  const db = new Database('apps/api/data/e2e.db');
  try {
    db.prepare(`UPDATE inventory SET on_hand = reserved + 50
      WHERE on_hand - reserved <= 5 AND product_id <> (SELECT id FROM products WHERE slug = ?)`).run(keep);
  } finally {
    db.close();
  }
};

const SLUG = 'black-whisk';
const TITLE = 'Black Whisk';

async function signIn(page: Page) {
  await page.goto('/sim/inventory');
  await page.getByLabel('Operator password').fill('demo-operator');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory', level: 1 })).toBeVisible();
}

test('operator sells a product out by hand, the storefront and cart react, and restock brings it back', async ({ page, browser }) => {
  setStock(SLUG, 8);

  // A shopper has it in their cart.
  const shopper = await (await browser.newContext()).newPage();
  await shopper.goto(`/p/${SLUG}`);
  await shopper.getByRole('button', { name: 'Add to cart' }).click();
  await expect(shopper.getByRole('link', { name: /^Cart, 1 item/ })).toBeVisible();

  await signIn(page);
  await expect(page.getByRole('navigation', { name: 'Simulation console' }).getByRole('link', { name: 'Inventory' })).toHaveAttribute('aria-current', 'page');
  await page.getByRole('searchbox', { name: 'Search products' }).fill('black whisk');
  const row = page.getByRole('article', { name: TITLE });
  await expect(row).toContainText('In stock');

  await row.getByRole('button', { name: `Decrease stock for ${TITLE}` }).click();
  await expect(row.getByLabel(`On hand for ${TITLE}`)).toHaveValue('7');
  await row.getByLabel(`On hand for ${TITLE}`).fill('0');
  await row.getByLabel(`On hand for ${TITLE}`).press('Enter');
  await expect(row).toContainText('Sold out');
  await expect(page.getByRole('list', { name: 'Recent changes' })).toContainText(/Black Whisk\s*7 → 0\s*· Manual/);

  // The storefront and the shopper's cart reflect real stock.
  await shopper.goto(`/p/${SLUG}`);
  await expect(shopper.getByText(/out of stock|sold out/i).first()).toBeVisible();
  await shopper.goto('/cart');
  await expect(shopper.getByText(/Some items need your attention/)).toBeVisible();

  // Restock: switch it on, run one tick now, switch it off again before any timer could fire.
  // The filter radios are visually hidden inside styled labels; click the label as a user does.
  await page.locator('label').filter({ has: page.getByRole('radio', { name: 'Sold out' }) }).click();
  await expect(page.getByRole('radio', { name: 'Sold out' })).toBeChecked();
  await expect(row).toBeVisible();
  await page.getByRole('switch', { name: 'Automatic restock' }).click();
  await expect(page.getByText(/Next tick in \d+s/)).toBeVisible();
  // Ticks pick up to 3 random low units. This project runs alone, so top up every other low
  // unit first: the tick must then pick this one.
  topUpOtherLowStock(SLUG);
  await page.getByRole('button', { name: 'Run once now' }).click();
  await page.getByRole('switch', { name: 'Automatic restock' }).click();
  await expect(page.getByText('Automation is off')).toBeVisible();
  await expect(page.getByRole('list', { name: 'Recent changes' })).toContainText(/Black Whisk\s*0 → \d+\s*· Auto restock/);

  // Back on sale for everyone, and the shopper's cart line is fine again.
  expect((await (await shopper.request.get(`/api/products/${SLUG}`)).json()).product.availability).toEqual({ status: 'in_stock' });
  await shopper.goto('/cart');
  await expect(shopper.getByText(/Some items need your attention/)).toHaveCount(0);
});

test('Run once now is disabled while automation is off; tabs switch between Orders and Inventory', async ({ page }) => {
  await signIn(page);
  await expect(page.getByRole('button', { name: 'Run once now' })).toBeDisabled();
  await expect(page.getByText('Turn on decrease or restock first')).toBeVisible();
  await page.getByRole('navigation', { name: 'Simulation console' }).getByRole('link', { name: 'Orders' }).click();
  await expect(page.getByRole('heading', { name: 'Order simulation' })).toBeVisible();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('the inventory tab fits at 360 px', async ({ page }) => {
    await signIn(page);
    await expect(page.getByRole('article').first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
