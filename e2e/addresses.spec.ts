import { expect, test, type Page } from '@playwright/test';

const PLACE = {
  label: 'Indiranagar, Bengaluru',
  latitude: 12.9784,
  longitude: 77.6408,
  pincode: '560038',
  area: 'Indiranagar',
  city: 'Bengaluru',
  state: 'Karnataka',
};

/** Never call OpenStreetMap from tests: blank tiles and a fake geocoder at the network layer. */
async function stubMaps(page: Page) {
  const blankPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
  await page.route('https://tile.openstreetmap.org/**', (route) => route.fulfill({ contentType: 'image/png', body: blankPng }));
  await page.route('**/api/geo/search**', (route) => route.fulfill({ json: { places: [PLACE] } }));
  await page.route('**/api/geo/reverse**', (route) => route.fulfill({ json: { place: { ...PLACE, label: 'HAL 2nd Stage, Bengaluru', area: 'HAL 2nd Stage' } } }));
}

async function signUp(page: Page) {
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  await page.goto('/signup');
  await page.getByLabel('Full name').fill('Asha Rao');
  await page.getByLabel('Email', { exact: true }).fill(`asha.${n}@example.com`);
  await page.getByLabel('Mobile number').fill(`9${n}`);
  await page.getByLabel('Password', { exact: true }).fill('correct horse battery');
  await page.getByRole('button', { name: 'Continue' }).click();
  const code = (await page.getByText(/Demo email to/).locator('..').textContent())!.match(/\d{6}/)![0];
  await page.getByLabel('6-digit code').fill(code);
  await expect(page.getByRole('button', { name: 'Account menu for Asha' })).toBeVisible();
}

test('add an address by search and map, then manage defaults with undo', async ({ page }) => {
  await stubMaps(page);
  await signUp(page);
  await page.goto('/account/addresses');
  await page.getByRole('link', { name: 'Add address' }).click();

  await page.getByLabel('Search for your area, street or landmark').fill('Indiranagar');
  await page.getByRole('button', { name: /^Indiranagar, Bengaluru/ }).click();
  await expect(page.getByText('Indiranagar, Bengaluru 560038')).toBeVisible();

  // Tapping the map moves the pin and looks the spot up.
  await page.locator('.leaflet-container').click({ position: { x: 120, y: 120 } });
  await expect(page.getByText('HAL 2nd Stage, Bengaluru 560038')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm location' }).click();

  await expect(page.getByLabel('Area, street, locality')).toHaveValue('HAL 2nd Stage');
  await expect(page.getByLabel('Full name')).toHaveValue('Asha Rao');
  await page.getByLabel('Flat, house no., building').fill('Flat 4B, Lake View');
  await page.getByRole('button', { name: 'Save address' }).click();
  await expect(page.getByRole('article', { name: 'Home address, Flat 4B, Lake View' }).getByText('Default')).toBeVisible();

  // A manual work address, then make it the default.
  await page.getByRole('link', { name: 'Add address' }).click();
  await page.getByRole('button', { name: 'Enter address manually instead' }).click();
  await page.getByLabel('Flat, house no., building').fill('22 Park Street');
  await page.getByLabel('Area, street, locality').fill('Park Street');
  await page.getByLabel('Pincode').fill('700016');
  await page.getByLabel('City').fill('Kolkata');
  await page.getByLabel('State').selectOption('West Bengal');
  await page.getByRole('radio', { name: 'Work' }).check({ force: true });
  await page.getByRole('button', { name: 'Save address' }).click();
  await page.getByRole('button', { name: 'Set Work address, 22 Park Street as default' }).click();
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Work address, 22 Park Street');

  // Deleting the default promotes the other one; Undo puts it back as default.
  await page.getByRole('button', { name: 'Delete Work address, 22 Park Street' }).click();
  await expect(page.getByText('Flat 4B, Lake View, Bengaluru is now your default address.')).toBeVisible();
  await page.getByRole('button', { name: 'Undo' }).click();
  await expect(page.getByRole('article').first()).toHaveAccessibleName('Work address, 22 Park Street');
  await expect(page.getByRole('article', { name: 'Work address, 22 Park Street' }).getByText('Default')).toBeVisible();
});

test('the map code loads only on the address screens', async ({ page }) => {
  await stubMaps(page);
  const leafletRequests: string[] = [];
  page.on('request', (request) => {
    if (/MapView|leaflet/i.test(request.url())) leafletRequests.push(request.url());
  });
  await page.goto('/products');
  await expect(page.getByText(/^\d+ products$/)).toBeVisible();
  expect(leafletRequests).toEqual([]);
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('the location step fits a phone', async ({ page }) => {
    await stubMaps(page);
    await signUp(page);
    await page.goto('/account/addresses/new');
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText('© OpenStreetMap')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
