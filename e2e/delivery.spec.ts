import { expect, test, type Page } from '@playwright/test';

const SLUG = 'apple-airpower-wireless-charger';

/** Signs up through the API and saves one address; cookies land in the page's context. */
async function signedInWithAddress(page: Page, pincode: string) {
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  const challenge = await (await page.request.post('/api/auth/signup', {
    data: { name: 'Asha Rao', email: `delivery.${n}@example.com`, mobile: `8${n}`, password: 'correct horse battery' },
  })).json();
  expect((await page.request.post('/api/auth/verify', { data: { challengeId: challenge.challengeId, code: challenge.demoCode } })).ok()).toBe(true);
  expect(
    (await page.request.post('/api/addresses', {
      data: { fullName: 'Asha Rao', mobile: `8${n}`, pincode, line1: 'House 12', line2: 'Main Road', landmark: '', city: 'Imphal', state: 'Manipur', type: 'home', latitude: null, longitude: null },
    })).ok(),
  ).toBe(true);
}

test('a guest checks a pincode on the product page and it is remembered', async ({ page }) => {
  await page.goto(`/p/${SLUG}`);
  const delivery = page.getByRole('region', { name: 'Delivery' });
  await delivery.getByLabel('Check delivery to your pincode').fill('795001');
  await delivery.getByRole('button', { name: 'Check' }).click();
  await expect(delivery).toContainText('Delivery to 795001');
  await expect(delivery).toContainText('Express not available here');

  await page.reload();
  await expect(page.getByRole('region', { name: 'Delivery' })).toContainText('Delivery to 795001');
  await delivery.getByRole('button', { name: 'Change pincode 795001' }).click();
  await delivery.getByLabel('Check delivery to your pincode').fill('744101');
  await delivery.getByLabel('Check delivery to your pincode').press('Enter');
  await expect(delivery).toContainText("We don't deliver to 744101 yet.");
  await expect(page.getByRole('button', { name: 'Add to cart' })).toBeEnabled();
});

test('checkout follows the zone: remote gets Standard only; an unserviceable address cannot continue', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await signedInWithAddress(page, '795001');
  expect((await page.request.post('/api/cart/lines', { data: { productSlug: SLUG, quantity: 1 } })).ok()).toBe(true);

  await page.goto('/checkout?delivery=express');
  const delivery = page.getByRole('region', { name: 'Delivery', exact: true });
  await expect(delivery).toContainText("Express isn't available for this address, so Standard is selected.");
  await expect(delivery.getByRole('radio')).toHaveCount(1);
  await expect(delivery.getByRole('radio', { name: /Standard/ })).toBeChecked();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

  await page.request.post('/api/addresses', {
    data: { fullName: 'Asha Rao', mobile: '9876543210', pincode: '744101', line1: 'Hut 3', line2: 'Aberdeen Bazaar', landmark: '', city: 'Port Blair', state: 'Andaman and Nicobar Islands', type: 'home', latitude: null, longitude: null },
  });
  const addresses = (await (await page.request.get('/api/addresses')).json()).addresses as { id: number; pincode: string }[];
  const islands = addresses.find((a) => a.pincode === '744101')!;
  await page.goto(`/checkout?addressId=${islands.id}`);
  await expect(page.getByRole('region', { name: 'Delivery address' })).toContainText("We don't deliver to this pincode yet");
  for (const button of await page.getByRole('button', { name: 'Continue to payment' }).all()) await expect(button).toBeDisabled();
});
