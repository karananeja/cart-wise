import { expect, test, type Page } from '@playwright/test';

const box = (page: Page) => page.getByRole('combobox', { name: 'Search products' });
const results = (page: Page) => page.locator('main ul li article h3');

async function search(page: Page, query: string) {
  await box(page).fill(query);
  await box(page).press('Enter');
  await expect(page).toHaveURL(new RegExp(`/search\\?q=${encodeURIComponent(query).replace(/%20/g, '\\+')}`));
}

test('suggestions lead straight to a category or product', async ({ page }) => {
  await page.goto('/');
  await box(page).fill('lap');
  const listbox = page.getByRole('listbox', { name: 'Search suggestions' });
  await expect(listbox.getByRole('option', { name: 'Laptops' })).toBeVisible();
  await expect(listbox.getByRole('group', { name: 'Products' }).getByRole('option')).toHaveCount(5);

  // ↓ highlights the first option (the category); Enter opens it.
  await box(page).press('ArrowDown');
  await box(page).press('Enter');
  await expect(page).toHaveURL('/c/laptops');

  await box(page).fill('macbook');
  await listbox.getByRole('option', { name: /MacBook Pro/ }).click();
  await expect(page).toHaveURL('/p/apple-macbook-pro-14-inch-space-grey');
});

test('search results filter, sort and keep the query in the URL', async ({ page }) => {
  await page.goto('/');
  await search(page, 'laptop');
  await expect(page.getByRole('heading', { level: 1, name: 'Results for “laptop”' })).toBeVisible();
  await expect(page.getByText('5 products')).toBeVisible();
  await expect(page.getByLabel('Sort by')).toHaveValue('relevance');

  await page.getByRole('complementary', { name: 'Filters' }).getByRole('checkbox', { name: /Apple/ }).click();
  await expect(page).toHaveURL(/\/search\?q=laptop&brand=apple$/);
  await expect(page.getByText('1 product', { exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/search\?q=laptop$/);
  await expect(page.getByText('5 products')).toBeVisible();

  await page.reload();
  await expect(box(page)).toHaveValue('laptop');
});

test('typos, plurals and partial words still find products', async ({ page }) => {
  await page.goto('/');
  await search(page, 'iphnoe');
  await expect(page.getByRole('heading', { level: 1, name: 'Results for “iphnoe”' })).toBeVisible();
  await expect(results(page).first()).toContainText('iPhone');

  await search(page, 'lapotp');
  await expect(page.getByText('5 products')).toBeVisible();

  await search(page, 'phone');
  await expect(results(page).filter({ hasText: /^iPhone/ }).first()).toBeVisible();
  await page.getByRole('complementary', { name: 'Filters' }).getByRole('radio', { name: /Smartphones/ }).click();
  await expect(page.getByText('16 products')).toBeVisible();
});

test('partial matches and no results are never a dead end', async ({ page }) => {
  await page.goto('/');
  await search(page, 'red leather office chair');
  await expect(page.getByText('Showing products that match some of your words.')).toBeVisible();
  await expect(results(page).first()).toContainText(/chair/i);

  await search(page, 'qwxzv');
  await expect(page.getByRole('heading', { name: 'No results for “qwxzv”' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Browse categories' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Top rated' })).toBeVisible();
});

test('recent searches survive a reload and can be repeated', async ({ page }) => {
  await page.goto('/');
  await search(page, 'watch');
  await search(page, 'perfume');
  await page.reload();

  await box(page).fill('');
  await box(page).focus();
  const recent = page.getByRole('listbox', { name: 'Recent searches' });
  await expect(recent.getByRole('option')).toHaveText(['perfume', 'watch']);
  await recent.getByRole('option', { name: 'watch' }).click();
  await expect(page).toHaveURL(/\/search\?q=watch$/);
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('search sits in its own row and fits the screen', async ({ page }) => {
    await page.goto('/');
    const searchBox = await box(page).boundingBox();
    expect(searchBox!.width).toBeGreaterThan(300);
    await box(page).fill('sho');
    await expect(page.getByRole('listbox', { name: 'Search suggestions' }).getByRole('option', { name: "Men's Shoes", exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
