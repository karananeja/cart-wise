import { expect, test, type APIRequestContext, type Page } from '@playwright/test';
import type { ListingResponse, ProductDetail } from '@store/shared';

const wishlistLink = (page: Page) => page.getByRole('link', { name: /^Wishlist(,|$)/ });
const cartLink = (page: Page) => page.getByRole('link', { name: /^Cart(,|$)/ });

/** A sized product with an in-stock size, from the seeded data. */
async function sizedProduct(request: APIRequestContext) {
  const listing = (await (await request.get('/api/products?category=womens-shoes&inStock=1')).json()) as ListingResponse;
  for (const item of listing.items) {
    const { product } = (await (await request.get(`/api/products/${item.slug}`)).json()) as { product: ProductDetail };
    const size = product.sizes.find((s) => s.availability.status === 'in_stock');
    if (size) return { product, size: size.label };
  }
  throw new Error('No sized product with an in-stock size');
}

test('save from a card and the product page; the wishlist survives a reload', async ({ page }) => {
  await page.goto('/c/laptops');
  await page.getByRole('button', { name: 'Save Apple MacBook Pro 14 Inch Space Grey to wishlist' }).click();
  await expect(page).toHaveURL(/\/c\/laptops$/);
  await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 1 item');

  await page.goto('/p/iphone-x');
  await page.getByRole('button', { name: 'Save iPhone X to wishlist' }).click();
  await expect(page.getByRole('button', { name: 'Remove iPhone X from wishlist' })).toHaveText('Saved');

  await page.goto('/wishlist');
  await page.reload();
  await expect(page.locator('main h3')).toHaveText(['iPhone X', 'Apple MacBook Pro 14 Inch Space Grey']);
});

test('move a sized product to the cart, and a cart line back to the wishlist', async ({ page, request }) => {
  const { product, size } = await sizedProduct(request);
  await page.goto(`/p/${product.slug}`);
  await page.getByRole('button', { name: `Save ${product.title} to wishlist` }).click();
  await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 1 item');

  await page.goto('/wishlist');
  await page.getByRole('button', { name: `Move ${product.title} to cart` }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose a size' });
  await dialog.getByText(size, { exact: true }).click();
  await dialog.getByRole('button', { name: 'Move to cart' }).click();
  await expect(page.getByText(`Moved ${product.title} to cart`)).toBeVisible();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');
  await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 0 items');

  await page.goto('/cart');
  await expect(page.getByText(`Size: ${size}`)).toBeVisible();
  await page.getByRole('button', { name: `Move ${product.title} to wishlist` }).click();
  await expect(page.getByText(`Moved ${product.title} to wishlist`)).toBeVisible();
  await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 1 item');
  await expect(page.getByRole('heading', { name: 'Your cart is empty' })).toBeVisible();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('hearts and the header fit on a phone', async ({ page }) => {
    await page.goto('/c/smartphones');
    await page.getByRole('button', { name: 'Save iPhone X to wishlist' }).click();
    await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 1 item');
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
  });
});
