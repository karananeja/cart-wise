import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { ListingResponse, ProductDetail } from '@store/shared';

/** Finds a sized product in the seeded data with both a sold-out and a low-stock size. */
async function sizedProductWithMixedStock(request: APIRequestContext): Promise<ProductDetail> {
  for (const category of ['mens-shirts', 'mens-shoes', 'womens-shoes', 'womens-dresses', 'tops']) {
    const listing = (await (await request.get(`/api/products?category=${category}`)).json()) as ListingResponse;
    for (const item of listing.items) {
      const { product } = (await (await request.get(`/api/products/${item.slug}`)).json()) as { product: ProductDetail };
      const statuses = product.sizes.map((s) => s.availability.status);
      if (statuses.includes('out_of_stock') && statuses.includes('low_stock')) return product;
    }
  }
  throw new Error('Seed data has no sized product with both a sold-out and a low-stock size');
}

const sizes = (page: Page) => page.getByRole('group', { name: 'Size' });

test('sized product: choose a size, see real stock, keep it on reload', async ({ page, request }) => {
  const product = await sizedProductWithMixedStock(request);
  const soldOut = product.sizes.find((s) => s.availability.status === 'out_of_stock')!;
  const low = product.sizes.find((s) => s.availability.status === 'low_stock')!;

  await page.goto(`/p/${product.slug}`);
  await expect(page.getByText('Select a size')).toBeVisible();
  await expect(sizes(page).getByRole('radio', { name: new RegExp(`^${soldOut.label}\\s*\\(out of stock\\)`) })).toBeDisabled();

  await sizes(page).getByText(low.label, { exact: true }).click();
  await expect(page.getByText(`Only ${low.availability.available} left in ${low.label}`)).toBeVisible();
  await expect(page).toHaveURL(new RegExp(`size=${encodeURIComponent(low.label).replace(/%20/g, '\\+')}`));

  await page.reload();
  await expect(page.getByText(`Only ${low.availability.available} left in ${low.label}`)).toBeVisible();
});

test('unsized product shows reviews whose average is the rating, and no size selector', async ({ page }) => {
  await page.goto('/p/essence-mascara-lash-princess');
  await expect(page.getByRole('img', { name: 'Rated 4.0 out of 5 from 3 reviews' })).toBeVisible();
  await expect(sizes(page)).toHaveCount(0);
  const reviews = page.getByRole('region', { name: 'Customer reviews' });
  await expect(reviews.getByRole('listitem')).toHaveCount(3);
  await expect(reviews).toContainText('Eleanor Collins');
  await expect(page.locator('body')).not.toContainText('@x.dummyjson.com');
});

test('gallery: next button and arrow keys change the image', async ({ page }) => {
  await page.goto('/p/apple-macbook-pro-14-inch-space-grey');
  await page.getByRole('button', { name: 'Next image' }).click();
  await expect(page.getByAltText(/image 2 of 3/)).toBeVisible();
  await page.getByRole('group', { name: /images$/ }).press('ArrowRight');
  await expect(page.getByAltText(/image 3 of 3/)).toBeVisible();
});

test('recently viewed follows you around and survives a reload', async ({ page }) => {
  await page.goto('/p/iphone-x');
  await expect(page.getByRole('heading', { level: 1, name: 'iPhone X' })).toBeVisible();
  await page.goto('/p/essence-mascara-lash-princess');
  await expect(page.getByRole('heading', { level: 1, name: 'Essence Mascara Lash Princess' })).toBeVisible();

  // On a product page the current product is left out.
  const onProduct = page.getByRole('region', { name: 'Recently viewed' });
  await expect(onProduct.getByRole('heading', { level: 3 })).toHaveText(['iPhone X']);

  await page.goto('/');
  await page.reload();
  const onHome = page.getByRole('region', { name: 'Recently viewed' });
  await expect(onHome.getByRole('heading', { level: 3 })).toHaveText(['Essence Mascara Lash Princess', 'iPhone X']);
  await onHome.getByRole('button', { name: 'Clear' }).click();
  await expect(onHome).toHaveCount(0);
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('product page fits the screen and stacks the purchase panel under the gallery', async ({ page, request }) => {
    const product = await sizedProductWithMixedStock(request);
    await page.goto(`/p/${product.slug}`);
    await expect(sizes(page)).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const gallery = await page.getByRole('group', { name: /images$/ }).boundingBox();
    const title = await page.getByRole('heading', { level: 1 }).boundingBox();
    expect(title!.y).toBeGreaterThan(gallery!.y + gallery!.height);
  });
});
