import { expect, test } from '@playwright/test';

test('a shopper subscribes to the newsletter from the footer', async ({ page }) => {
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  const n = Math.floor(Math.random() * 1e9);
  await footer.getByRole('textbox', { name: 'Email for the newsletter' }).fill(`not-an-email`);
  await footer.getByRole('button', { name: 'Subscribe' }).click();
  await expect(footer.getByText('Enter a valid email address')).toBeVisible();

  await footer.getByRole('textbox', { name: 'Email for the newsletter' }).fill(`footer.${n}@example.com`);
  await footer.getByRole('button', { name: 'Subscribe' }).click();
  await expect(footer.getByRole('status')).toHaveText("You're subscribed. Thanks!");
});

test('footer help links open pages with the real rules', async ({ page }) => {
  await page.goto('/products');
  const footer = page.getByRole('contentinfo');
  await footer.getByRole('navigation', { name: 'Help' }).getByRole('link', { name: 'Returns & refunds' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Returns & refunds' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('within 7 days of delivery');
  await page.getByRole('navigation', { name: 'Help topics' }).getByRole('link', { name: 'Delivery' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Delivery' })).toBeVisible();
  await expect(page.getByRole('main')).toContainText('free on orders of ₹999 or more');
  await expect(page.getByRole('main')).toContainText('held for 10 minutes');
});

test('at 360 px the footer columns collapse and nothing overflows', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const footer = page.getByRole('contentinfo');
  await footer.scrollIntoViewIfNeeded();
  const allProducts = footer.getByRole('link', { name: 'All products' });
  await expect(allProducts).toBeHidden();
  await footer.locator('summary', { hasText: 'Shop' }).click();
  await expect(allProducts).toBeVisible();
  await expect(footer.getByRole('link', { name: 'Payments & EMI' })).toBeHidden();
  await expect(footer.getByRole('textbox', { name: 'Email for the newsletter' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0);
  await allProducts.click();
  await expect(page).toHaveURL(/\/products$/);
});
