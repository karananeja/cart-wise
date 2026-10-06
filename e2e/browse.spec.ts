import { expect, test, type Page } from '@playwright/test';

const filters = (page: Page) => page.getByRole('complementary', { name: 'Filters' });

function rupees(text: string): number {
  return Number(text.replace(/[^\d.]/g, ''));
}

test('browse: home → category → filter → sort → paginate → back', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Shop by category' })).toBeVisible();
  await page.getByRole('link', { name: 'Smartphones' }).first().click();

  await expect(page).toHaveURL(/\/c\/smartphones$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Smartphones' })).toBeVisible();

  await filters(page).getByRole('checkbox', { name: /Apple/ }).click();
  await expect(page).toHaveURL(/brand=apple/);
  await expect(page.getByRole('button', { name: 'Remove filter Apple' })).toBeVisible();
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  const cards = page.locator('main ul li article');
  await expect(cards.first()).toBeVisible();
  for (const brand of await cards.locator('p.uppercase').allTextContents()) expect(brand.toLowerCase()).toBe('apple');

  await page.getByLabel('Sort by').selectOption('price_desc');
  await expect(page).toHaveURL(/sort=price_desc/);
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  const prices = (await page.locator('main ul li article').getByText(/^Price/).allTextContents()).map(rupees);
  expect(prices.length).toBeGreaterThan(1);
  expect(prices).toEqual([...prices].sort((a, b) => b - a));

  // Pagination needs more than one page of results.
  await page.goto('/products?inStock=1');
  await expect(page.getByText(/^\d+ products$/)).toBeVisible();
  await page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: 'Page 2' }).click();
  await expect(page).toHaveURL(/\/products\?inStock=1&page=2$/);
  await expect(page.getByRole('link', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');

  await page.goBack();
  await expect(page).toHaveURL(/\/products\?inStock=1$/);
  await expect(page.getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  await expect(filters(page).getByRole('switch', { name: /In stock only/ })).toBeChecked();
});

test('a shared link reproduces filters, sort and page', async ({ page }) => {
  await page.goto('/products?brand=apple,samsung&rating=4&sort=rating');
  await expect(page.getByRole('button', { name: 'Remove filter Apple' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove filter Samsung' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Remove filter 4★ & up' })).toBeVisible();
  await expect(page.getByLabel('Sort by')).toHaveValue('rating');
});

test('out-of-stock products come after available ones', async ({ page }) => {
  await page.goto('/products?sort=price_asc');
  const lastPage = page.getByRole('navigation', { name: 'Pagination' }).getByRole('link', { name: /^Page \d+$/ }).last();
  const lastLabel = (await lastPage.getAttribute('aria-label'))!;
  await lastPage.click();
  await expect(page.getByRole('link', { name: lastLabel })).toHaveAttribute('aria-current', 'page');
  await expect(page.locator('main [aria-busy="true"]')).toHaveCount(0);
  const statuses = await page.locator('main ul li article').evaluateAll((articles) =>
    articles.map((a) => (a.textContent?.includes('Out of stock') ? 'out' : 'in')),
  );
  expect(statuses).toContain('out');
  expect(statuses.slice(statuses.indexOf('out')).every((s) => s === 'out')).toBe(true);
});

test('product card opens the product page; unknown product shows not found', async ({ page }) => {
  await page.goto('/c/laptops');
  await page.getByRole('link', { name: 'Apple MacBook Pro 14 Inch Space Grey' }).click();
  await expect(page).toHaveURL('/p/apple-macbook-pro-14-inch-space-grey');
  await expect(page.getByRole('heading', { level: 1, name: 'Apple MacBook Pro 14 Inch Space Grey' })).toBeVisible();
  await page.goto('/p/does-not-exist');
  await expect(page.getByRole('heading', { name: "We couldn't find that product" })).toBeVisible();
});

test('filters are keyboard operable', async ({ page }) => {
  await page.goto('/c/laptops');
  const apple = filters(page).getByRole('checkbox', { name: /Apple/ });
  await apple.focus();
  await page.keyboard.press('Space');
  await expect(page).toHaveURL(/brand=apple/);
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('filters open in a bottom sheet and apply on confirm; no horizontal scroll', async ({ page }) => {
    await page.goto('/c/smartphones');
    await expect(page.getByText(/^\d+ products$/)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    await expect(filters(page)).toBeHidden();

    await page.getByRole('button', { name: /Filters/ }).click();
    const sheet = page.getByRole('dialog', { name: 'Filters' });
    await sheet.getByRole('checkbox', { name: /Apple/ }).click();
    // Draft only: the page URL has not changed yet.
    await expect(page).toHaveURL(/\/c\/smartphones$/);
    await sheet.getByRole('button', { name: /^Show \d+ results?$/ }).click();

    await expect(page).toHaveURL(/brand=apple/);
    await expect(sheet).toBeHidden();
    await expect(page.getByRole('button', { name: /Filters, 1 active/ })).toBeVisible();
  });
});
