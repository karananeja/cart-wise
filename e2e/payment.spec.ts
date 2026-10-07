import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';

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
const stock = (slug: string) =>
  withDb((db) => db.prepare('SELECT on_hand AS onHand, reserved FROM inventory WHERE product_id = (SELECT id FROM products WHERE slug = ?)').get(slug)) as {
    onHand: number;
    reserved: number;
  };

/** Signs up through the API (cookies land in the page's context) and adds an address. */
async function signedInCustomer(page: Page) {
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  const challenge = await (await page.request.post('/api/auth/signup', {
    data: { name: 'Asha Rao', email: `pay.${n}@example.com`, mobile: `8${n}`, password: 'correct horse battery' },
  })).json();
  expect((await page.request.post('/api/auth/verify', { data: { challengeId: challenge.challengeId, code: challenge.demoCode } })).ok()).toBe(true);
  const address = await page.request.post('/api/addresses', {
    data: { fullName: 'Asha Rao', mobile: `8${n}`, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null },
  });
  expect(address.ok()).toBe(true);
}

/** Cart with one unit → checkout → payment page. Returns the order id. */
async function toPayment(page: Page, slug: string): Promise<string> {
  await page.goto(`/p/${slug}`);
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: /^Cart, 1 item/ })).toBeVisible();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Continue to payment' }).first().click();
  await expect(page).toHaveURL(/\/checkout\/pay\/ORD-[A-Z2-9]{8}$/);
  return page.url().split('/').pop()!;
}

async function fillCard(page: Page, number: string) {
  await page.getByLabel('Card number').fill(number);
  await page.getByLabel('Expiry (MM/YY)').fill('1230');
  await page.getByLabel('CVV').fill('123');
}

async function enterBankCode(page: Page) {
  const code = (await page.getByRole('status').filter({ hasText: 'Demo bank SMS:' }).textContent())!.match(/\d{6}/)![0];
  await page.getByLabel('6-digit code').fill(code);
}

// Each test uses its own product (not used by other specs), as tests run in parallel.
const rupees = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

test('offer banner → choose Aurora offer → card + bank OTP → confirmation, cart emptied, stock sold once', async ({ page }) => {
  const slug = 'lenovo-yoga-920';
  setStock(slug, 6);
  await signedInCustomer(page);

  await page.goto(`/p/${slug}`);
  await expect(page.getByText('Save ₹1,500 with Aurora Bank credit cards')).toBeVisible();
  await page.getByRole('button', { name: 'All offers' }).click();
  await expect(page.getByRole('dialog', { name: 'Bank offers' })).toContainText('Kestrel Bank');
  await page.keyboard.press('Escape');

  const orderId = await toPayment(page, slug);
  const total = (await (await page.request.get(`/api/orders/${orderId}`)).json()).order.totals.totalPaise as number;
  await expect(page.getByText('Demo payment — no money is charged')).toBeVisible();

  // Track what leaves the browser.
  const bodies: string[] = [];
  page.on('request', (r) => {
    if (r.url().includes('/payments')) bodies.push(r.postData() ?? '');
  });

  await page.getByRole('radio', { name: /Aurora Bank — 10% instant discount/ }).check();
  await fillCard(page, '4242424242424242');
  await expect(page.getByText('Aurora Bank · Visa credit')).toBeVisible();
  await expect(page.getByText('Aurora Bank offer: −₹1,500')).toBeVisible();
  const payButton = page.getByRole('button', { name: `Pay ${rupees(total - 1_500_00)}` });
  await payButton.first().click();

  await expect(page.getByRole('heading', { name: 'Demo bank verification' })).toBeVisible();
  await enterBankCode(page);

  await expect(page).toHaveURL(`/orders/${orderId}/confirmation`);
  await expect(page.getByRole('heading', { name: 'Order confirmed' })).toBeVisible();
  await expect(page.getByText('Aurora Bank Visa •••• 4242')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Continue shopping' })).toBeVisible();

  expect(bodies.join('\n')).not.toContain('4242424242424242');
  expect(bodies.join('\n')).not.toMatch(/cvv|expiry|1230/i);
  expect(stock(slug)).toEqual({ onHand: 5, reserved: 0 });
  await expect(page.getByRole('banner').getByRole('link', { name: /^Cart, 0 items|^Cart$/ })).toBeVisible();

  // Reloading the payment page of a paid order goes to the confirmation.
  await page.goto(`/checkout/pay/${orderId}`);
  await expect(page).toHaveURL(`/orders/${orderId}/confirmation`);
});

test('a declined card fails with its reason; retrying with another card succeeds and keeps the hold', async ({ page }) => {
  const slug = 'apple-airpods';
  setStock(slug, 6);
  await signedInCustomer(page);
  const orderId = await toPayment(page, slug);

  await fillCard(page, '4000000000000002');
  await page.getByRole('button', { name: /^Pay ₹/ }).first().click();
  await enterBankCode(page);
  await expect(page.getByText('Your bank declined this payment.')).toBeVisible();
  expect(stock(slug)).toEqual({ onHand: 6, reserved: 1 });
  await expect(page.getByText(/We're holding your items for/)).toBeVisible();

  await page.getByRole('button', { name: 'Try again' }).click();
  await fillCard(page, '5105105105105100');
  await page.getByRole('button', { name: /^Pay ₹/ }).first().click();
  await enterBankCode(page);
  await expect(page).toHaveURL(`/orders/${orderId}/confirmation`);
  expect(stock(slug)).toEqual({ onHand: 5, reserved: 0 });
});

test('UPI ID request approved in the demo UPI app confirms the order', async ({ page }) => {
  const slug = 'amazon-echo-plus';
  setStock(slug, 6);
  await signedInCustomer(page);
  const orderId = await toPayment(page, slug);

  await page.getByRole('tab', { name: /UPI/ }).click();
  await page.getByRole('textbox', { name: 'UPI ID' }).fill('asha@okdemo');
  await page.getByRole('button', { name: 'Send payment request' }).click();
  await expect(page.getByRole('heading', { name: 'Approve the request in your UPI app' })).toBeVisible();
  await expect(page.getByText(/Request sent to asha@okdemo .* expires in [45]:\d\d/)).toBeVisible();

  await page.getByRole('button', { name: 'Open demo UPI app' }).click();
  const app = page.getByRole('dialog', { name: 'Payment request' });
  await expect(app).toContainText(orderId);
  await app.getByRole('button', { name: 'Approve' }).click();

  await expect(page).toHaveURL(`/orders/${orderId}/confirmation`);
  await expect(page.getByText('UPI · asha@okdemo')).toBeVisible();
});

test('UPI QR shows the demo payment URI; declining fails and the order stays payable', async ({ page }) => {
  const slug = 'apple-homepod-mini-cosmic-grey';
  setStock(slug, 6);
  await signedInCustomer(page);
  const orderId = await toPayment(page, slug);

  await page.getByRole('tab', { name: /UPI/ }).click();
  await page.getByRole('radio', { name: 'Scan QR code' }).check();
  await page.getByRole('button', { name: 'Show QR code' }).click();
  await expect(page.getByRole('img', { name: /Demo UPI QR code/ })).toBeVisible();
  await expect(page.getByText(new RegExp(`demo-payment://pay\\?orderId=${orderId}&amount=`))).toBeVisible();

  await page.getByRole('button', { name: 'Simulate scan' }).click();
  await page.getByRole('dialog', { name: 'Payment request' }).getByRole('button', { name: 'Decline' }).click();
  await expect(page.getByText('You declined the request.')).toBeVisible();
  expect(stock(slug)).toEqual({ onHand: 6, reserved: 1 });
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('the amount to pay and Pay button sit in a bottom bar, with no horizontal scroll', async ({ page }) => {
    const slug = 'apple-airpods-max-silver';
    setStock(slug, 6);
    await signedInCustomer(page);
    await toPayment(page, slug);
    const bar = page.locator('.fixed.bottom-0').filter({ hasText: 'Amount to pay' });
    await expect(bar.getByRole('button', { name: /^Pay ₹/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await page.getByRole('tab', { name: /UPI/ }).click();
    await page.getByRole('textbox', { name: 'UPI ID' }).fill('asha@okdemo');
    await page.getByRole('button', { name: 'Send payment request' }).click();
    await page.getByRole('button', { name: 'Open demo UPI app' }).click();
    await expect(page.getByRole('dialog', { name: 'Payment request' }).getByRole('button', { name: 'Approve' })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});
