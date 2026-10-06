import { createRequire } from 'node:module';
import { expect, test, type Browser, type Page } from '@playwright/test';

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
const onHand = (slug: string) =>
  (withDb((db) => db.prepare('SELECT on_hand AS n FROM inventory WHERE product_id = (SELECT id FROM products WHERE slug = ?)').get(slug)) as { n: number }).n;

/** Signs up and adds an address through the API; cookies land in the page's context. */
async function signedInCustomer(page: Page) {
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  const challenge = await (await page.request.post('/api/auth/signup', {
    data: { name: 'Asha Rao', email: `orders.${n}@example.com`, mobile: `7${n}`, password: 'correct horse battery' },
  })).json();
  expect((await page.request.post('/api/auth/verify', { data: { challengeId: challenge.challengeId, code: challenge.demoCode } })).ok()).toBe(true);
  expect(
    (await page.request.post('/api/addresses', {
      data: { fullName: 'Asha Rao', mobile: `7${n}`, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null },
    })).ok(),
  ).toBe(true);
}

/** Cart → order → card payment, through the API (the payment UI has its own E2E). Returns the order id. */
async function paidOrder(page: Page, slugs: string[]): Promise<string> {
  for (const slug of slugs) expect((await page.request.post('/api/cart/lines', { data: { productSlug: slug, quantity: 1 } })).ok()).toBe(true);
  const order = (await (await page.request.post('/api/orders', { data: { delivery: 'standard' } })).json()).order;
  const attempt = (await (await page.request.post(`/api/orders/${order.id}/payments`, { data: { method: 'card', bin: '411111', last4: '1111' } })).json()).attempt;
  expect((await page.request.post(`/api/payments/${attempt.id}/verify`, { data: { otp: attempt.demoCode } })).ok()).toBe(true);
  return order.id as string;
}

async function operatorPage(browser: Browser): Promise<Page> {
  const op = await (await browser.newContext()).newPage();
  await op.goto('/sim/orders');
  await expect(op.getByText('Demo operator — simulation only.')).toBeVisible();
  await op.getByLabel('Operator password').fill('wrong');
  await op.getByRole('button', { name: 'Sign in' }).click();
  await expect(op.getByText('That password is not right.')).toBeVisible();
  await op.getByLabel('Operator password').fill('demo-operator');
  await op.getByRole('button', { name: 'Sign in' }).click();
  await expect(op.getByRole('heading', { name: 'Order simulation' })).toBeVisible();
  return op;
}

const timelineStep = (page: Page, label: string) => page.getByRole('list', { name: 'Order progress' }).getByRole('listitem').filter({ hasText: label });

test('pay → view order → operator ships → delivery code (wrong, then right) → return one item → pickup → refund', async ({ page, browser }) => {
  const slugs = ['table-lamp', 'plant-pot'];
  for (const slug of slugs) setStock(slug, 10);
  await signedInCustomer(page);
  const orderId = await paidOrder(page, slugs);

  await page.goto(`/orders/${orderId}/confirmation`);
  await page.getByRole('link', { name: 'View order' }).click();
  await expect(page).toHaveURL(`/orders/${orderId}`);
  await expect(timelineStep(page, 'Order confirmed')).toContainText('Current step');
  await expect(page.getByRole('button', { name: 'Cancel order' })).toBeVisible();

  const op = await operatorPage(browser);
  const row = op.getByRole('article', { name: orderId });
  await row.getByRole('button', { name: 'Advance to processing' }).click();
  await row.getByRole('button', { name: 'Advance to shipped' }).click();
  await page.reload();
  await expect(timelineStep(page, 'Shipped')).toContainText('Current step');
  await expect(page.getByRole('button', { name: 'Cancel order' })).toHaveCount(0);
  await expect(page.getByText("This order has shipped. You can return items once it's delivered.")).toBeVisible();

  await row.getByRole('button', { name: 'Advance to out for delivery' }).click();
  await page.reload();
  const codeText = await page.getByText(/Share code \d{4} with the delivery partner/).first().textContent();
  const code = codeText!.match(/\d{4}/)![0];
  // The same code is on the order list card.
  await page.goto('/account/orders');
  await expect(page.getByRole('article', { name: orderId })).toContainText(`Share code ${code}`);

  const wrong = code === '0000' ? '1111' : '0000';
  await row.getByLabel('Delivery code').fill(wrong);
  await row.getByRole('button', { name: 'Mark delivered' }).click();
  await expect(row.getByText('Wrong code. 2 attempts left.')).toBeVisible();
  await row.getByLabel('Delivery code').fill(code);
  await row.getByRole('button', { name: 'Mark delivered' }).click();
  await expect(row).toContainText(/Delivered/);

  await page.goto(`/orders/${orderId}`);
  await expect(timelineStep(page, 'Delivered')).toContainText(/Current step|Done/);
  await expect(page.getByText(/Return window closes on/)).toBeVisible();

  // Return the lamp only.
  await page.getByRole('button', { name: 'Return items' }).click();
  const dialog = page.getByRole('dialog', { name: 'Return items' });
  await dialog.getByRole('checkbox', { name: /Table Lamp/i }).check();
  await dialog.getByLabel(/Reason for Table Lamp/i).selectOption({ label: 'Damaged or defective' });
  await dialog.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('dialog', { name: 'Confirm your return' }).getByRole('button', { name: 'Request return' }).click();
  await expect(page.getByText('Return requested').first()).toBeVisible();
  await expect(page.getByText('Partly returned')).toBeVisible();
  const stockBeforePickup = onHand('table-lamp');

  await op.reload();
  await row.getByRole('button', { name: 'Mark picked up' }).click();
  await expect(row.getByRole('button', { name: 'Complete refund' })).toBeVisible();
  expect(onHand('table-lamp')).toBe(stockBeforePickup + 1);
  await page.reload();
  await expect(page.getByText(/Refund of ₹[\d,.]+ to Visa •••• 1111 initiated/)).toBeVisible();

  await row.getByRole('button', { name: 'Complete refund' }).click();
  await expect(row).toContainText(/Refunded/);
  await page.reload();
  await expect(page.getByText(/₹[\d,.]+ refunded to Visa •••• 1111 on/)).toBeVisible();
});

test('cancelling while Processing refunds at once and puts the stock back', async ({ page, browser }) => {
  const slug = 'decoration-swing';
  setStock(slug, 7);
  await signedInCustomer(page);
  const orderId = await paidOrder(page, [slug]);
  expect(onHand(slug)).toBe(6);

  const op = await operatorPage(browser);
  await op.getByRole('article', { name: orderId }).getByRole('button', { name: 'Advance to processing' }).click();
  await expect(op.getByRole('article', { name: orderId }).getByRole('button', { name: 'Advance to shipped' })).toBeVisible();

  await page.goto(`/orders/${orderId}`);
  await page.getByRole('button', { name: 'Cancel order' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancel this order?' });
  await expect(dialog).toContainText('Visa •••• 1111');
  await dialog.getByLabel('Reason (optional)').selectOption({ label: 'Changed my mind' });
  await dialog.getByRole('button', { name: 'Yes, cancel order' }).click();

  await expect(timelineStep(page, 'Cancelled')).toBeVisible();
  await expect(page.getByText(/₹[\d,.]+ refunded to Visa •••• 1111 on/)).toBeVisible();
  expect(onHand(slug)).toBe(7);
  await page.goto('/account/orders');
  await expect(page.getByRole('article', { name: orderId })).toContainText('Cancelled');
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('the return dialog fits long item names without overflowing', async ({ page, browser }) => {
    const slugs = ['knoll-saarinen-executive-conference-chair', 'olay-ultra-moisture-shea-butter-body-wash'];
    for (const slug of slugs) setStock(slug, 10);
    await signedInCustomer(page);
    const orderId = await paidOrder(page, slugs);
    const op = await operatorPage(browser);
    const row = op.getByRole('article', { name: orderId });
    for (const step of ['processing', 'shipped', 'out for delivery']) await row.getByRole('button', { name: `Advance to ${step}` }).click();
    await page.goto(`/orders/${orderId}`);
    const code = (await page.getByText(/Share code \d{4}/).first().textContent())!.match(/\d{4}/)![0];
    await row.getByLabel('Delivery code').fill(code);
    await row.getByRole('button', { name: 'Mark delivered' }).click();
    await expect(row).toContainText(/Delivered/);

    await page.reload();
    await page.getByRole('button', { name: 'Return items' }).click();
    const choose = page.getByRole('dialog', { name: 'Return items' });
    for (const box of await choose.getByRole('checkbox').all()) await box.check();
    const fits = (dialog: typeof choose) => dialog.evaluate((el) => el.scrollWidth <= el.clientWidth);
    expect(await fits(choose)).toBe(true);
    for (const select of await choose.getByRole('combobox').all()) await select.selectOption({ label: 'Size or fit issue' });
    await choose.getByRole('button', { name: 'Continue' }).click();
    const confirm = page.getByRole('dialog', { name: 'Confirm your return' });
    await expect(confirm.getByText('Knoll Saarinen Executive Conference Chair')).toBeVisible();
    expect(await fits(confirm)).toBe(true);
    await expect(confirm.getByRole('button', { name: 'Back' })).toBeInViewport();
  });

  test('orders list and order page fit at 360 px', async ({ page }) => {
    const slug = 'family-tree-photo-frame';
    setStock(slug, 10);
    await signedInCustomer(page);
    await page.goto('/account/orders');
    await expect(page.getByRole('heading', { name: 'No orders yet' })).toBeVisible();
    const orderId = await paidOrder(page, [slug]);
    await page.reload();
    await page.getByRole('article', { name: orderId }).getByRole('link', { name: orderId }).click();
    await expect(page.getByRole('list', { name: 'Order progress' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
