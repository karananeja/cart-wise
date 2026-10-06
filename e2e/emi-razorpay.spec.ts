import { createRequire } from 'node:module';
import { expect, test, type Page } from '@playwright/test';
import type { Order, ProductDetail } from '@store/shared';
import { emiPlan } from '../packages/shared/src/emi.js';
import { formatPrice } from '../packages/shared/src/money.js';

// EMI (demo) and Razorpay (test mode, against the local fake in e2e/fake-razorpay-server.ts) — F-014.
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

async function signedInCustomer(page: Page) {
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  const challenge = await (await page.request.post('/api/auth/signup', {
    data: { name: 'Asha Rao', email: `emi.${n}@example.com`, mobile: `9${n}`, password: 'correct horse battery' },
  })).json();
  expect((await page.request.post('/api/auth/verify', { data: { challengeId: challenge.challengeId, code: challenge.demoCode } })).ok()).toBe(true);
  expect((await page.request.post('/api/addresses', {
    data: { fullName: 'Asha Rao', mobile: `9${n}`, pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null },
  })).ok()).toBe(true);
}

async function toPayment(page: Page, slug: string): Promise<string> {
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(page.getByRole('link', { name: /^Cart, 1 item/ })).toBeVisible();
  await page.goto('/checkout');
  await page.getByRole('button', { name: 'Continue to payment' }).first().click();
  await expect(page).toHaveURL(/\/checkout\/pay\/ORD-[A-Z2-9]{8}$/);
  expect(slug).toBeTruthy();
  return page.url().split('/').pop()!;
}

test('product page EMI → No Cost EMI on an Aurora credit card → bank OTP → the order shows the plan', async ({ page }) => {
  const slug = 'bedside-table-african-cherry';
  setStock(slug, 5);
  await signedInCustomer(page);
  const product = (await (await page.request.get(`/api/products/${slug}`)).json()).product as ProductDetail;

  await page.goto(`/p/${slug}`);
  await expect(page.getByText(/No Cost EMI available/)).toBeVisible();
  const orderId = await toPayment(page, slug);
  const total = product.pricePaise; // free delivery above ₹999
  const plan = emiPlan('aurora', total, 6, true);

  await page.getByLabel('Card number').fill('4242424242424242');
  await page.getByLabel('Expiry (MM/YY)').fill('1230');
  await page.getByLabel('CVV').fill('123');
  await page.getByRole('radio', { name: 'Pay in EMI' }).check();
  await page.getByRole('group', { name: 'EMI plans from Aurora Bank (demo)' }).getByRole('radio', { name: /^6 × .* No Cost/ }).check();
  await page.getByRole('button', { name: `Pay ${formatPrice(plan.chargedPaise)}` }).first().click();

  const code = (await page.getByRole('status').filter({ hasText: 'Demo bank SMS:' }).textContent())!.match(/\d{6}/)![0];
  await page.getByLabel('6-digit code').fill(code);
  await expect(page).toHaveURL(`/orders/${orderId}/confirmation`);
  await expect(page.getByText('No Cost EMI — no interest')).toBeVisible();

  const order = (await (await page.request.get(`/api/orders/${orderId}`)).json()).order as Order;
  expect(order.payment).toMatchObject({ paidPaise: plan.chargedPaise, offerId: 'no-cost-emi', emi: { tenure: 6, noCost: true } });
  expect(order.payment!.emi!.monthlyPaise * 5 + order.payment!.emi!.lastMonthlyPaise).toBe(total);
});

test('Razorpay (test mode): Checkout pays, the server verifies and confirms, and a cancellation is refunded through Razorpay', async ({ page }) => {
  const slug = 'wooden-bathroom-sink-with-mirror';
  setStock(slug, 5);
  await signedInCustomer(page);
  // Stand-in for checkout.js: "pays" on the fake Razorpay and hands back its signed response.
  await page.route('https://checkout.razorpay.com/v1/checkout.js', (route) =>
    route.fulfill({
      contentType: 'application/javascript',
      body: `window.Razorpay = function (options) {
        this.open = async function () {
          const res = await fetch('http://localhost:3199/__checkout/pay', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: options.order_id }) });
          const r = await res.json();
          options.handler({ razorpay_payment_id: r.razorpayPaymentId, razorpay_order_id: r.razorpayOrderId, razorpay_signature: r.razorpaySignature });
        };
      };`,
    }),
  );

  await page.goto(`/p/${slug}`);
  const orderId = await toPayment(page, slug);
  await page.getByRole('tab', { name: 'Razorpay' }).click();
  await expect(page.getByText('Razorpay · test mode — no real money')).toBeVisible();
  await page.getByRole('button', { name: /with Razorpay$/ }).click();

  await expect(page).toHaveURL(`/orders/${orderId}/confirmation`);
  await expect(page.getByText('Razorpay · Visa •••• 1111')).toBeVisible();
  await expect(page.getByText('Razorpay test mode — no real money was charged.')).toBeVisible();

  expect((await page.request.post(`/api/orders/${orderId}/cancel`, { data: {} })).ok()).toBe(true);
  await page.goto(`/orders/${orderId}`);
  await expect(page.getByText(/refunded to Razorpay · Visa •••• 1111/)).toBeVisible();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('EMI plans fit at 360 px', async ({ page }) => {
    const slug = 'bedside-table-african-cherry';
    setStock(slug, 5);
    await signedInCustomer(page);
    await page.goto(`/p/${slug}`);
    await toPayment(page, slug);
    await page.getByLabel('Card number').fill('6521500000001004');
    await page.getByRole('radio', { name: 'Pay in EMI' }).check();
    await expect(page.getByRole('group', { name: 'EMI plans from Kestrel Bank (demo)' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
