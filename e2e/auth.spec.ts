import { expect, test, type Page } from '@playwright/test';

const cartLink = (page: Page) => page.getByRole('link', { name: /^Cart(,|$)/ });
const wishlistLink = (page: Page) => page.getByRole('link', { name: /^Wishlist(,|$)/ });

/** A fresh account per test, so codes, limits and merges never collide. */
function newCustomer() {
  const n = Math.floor(Math.random() * 1e9).toString().padStart(9, '0');
  return { name: 'Asha Rao', email: `asha.${n}@example.com`, mobile: `9${n}`, password: 'correct horse battery' };
}

async function enterDemoCode(page: Page) {
  const banner = page.getByText(/Demo email to/);
  const code = (await banner.locator('..').textContent())!.match(/\d{6}/)![0];
  await page.getByLabel('6-digit code').fill(code);
}

async function signUp(page: Page, customer: ReturnType<typeof newCustomer>) {
  await page.getByLabel('Full name').fill(customer.name);
  await page.getByLabel('Email').fill(customer.email);
  // Mobile is optional (F-016): left blank when the customer has none.
  if (customer.mobile) await page.getByLabel('Mobile number (optional)').fill(customer.mobile);
  await page.getByLabel('Password', { exact: true }).fill(customer.password);
  await page.getByRole('button', { name: 'Continue' }).click();
  await enterDemoCode(page);
  // Signed in only once the verification round-trip has finished.
  await expect(page.getByRole('button', { name: `Account menu for ${customer.name.split(' ')[0]}` })).toBeVisible();
}

async function otpSignIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await enterDemoCode(page);
  await expect(page.getByRole('button', { name: 'Account menu for Asha' })).toBeVisible();
}

test('a guest signs up from a product page, keeps cart and wishlist, and lands back there', async ({ page }) => {
  const customer = newCustomer();
  await page.goto('/p/iphone-x');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('button', { name: 'Save iPhone X to wishlist' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');

  await page.getByRole('link', { name: 'Sign in' }).click();
  await page.getByRole('link', { name: 'Create an account' }).click();
  await signUp(page, customer);

  await expect(page).toHaveURL('/p/iphone-x');
  await expect(page.getByText('Welcome, Asha. We kept your cart and wishlist.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Account menu for Asha' })).toBeVisible();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');
  await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 1 item');

  // Sign out: this device becomes an empty guest.
  await page.getByRole('button', { name: 'Account menu for Asha' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page.getByText("You've signed out.")).toBeVisible();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 0 items');
  await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 0 items');

  // Signing back in with a code restores the account's items.
  await otpSignIn(page, customer.email);
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');
  await expect(wishlistLink(page)).toHaveAccessibleName('Wishlist, 1 item');
});

test('cart, wishlist and recently viewed follow the account to another browser', async ({ browser, page }) => {
  const customer = newCustomer();
  await page.goto('/signup');
  await signUp(page, customer);
  await expect(page.getByRole('button', { name: 'Account menu for Asha' })).toBeVisible();
  await page.goto('/p/essence-mascara-lash-princess');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');

  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto('/login?method=password');
  await second.getByLabel('Email').fill(customer.email);
  await second.getByLabel('Password', { exact: true }).fill(customer.password);
  await second.getByRole('button', { name: 'Sign in' }).click();
  await expect(cartLink(second)).toHaveAccessibleName('Cart, 1 item');
  await second.goto('/');
  await expect(second.getByRole('region', { name: 'Recently viewed' }).getByRole('heading', { name: 'Essence Mascara Lash Princess' })).toBeVisible();
  await other.close();
});

test('the guest cart merges with the account cart, larger quantity winning', async ({ page }) => {
  const customer = newCustomer();
  await page.goto('/signup');
  await signUp(page, customer);
  await page.goto('/p/apple-macbook-pro-14-inch-space-grey');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 1 item');
  await page.getByRole('button', { name: 'Account menu for Asha' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 0 items');

  // As a guest: the same laptop ×2, plus something new.
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await page.getByRole('group', { name: 'Quantity in cart' }).getByRole('button', { name: 'Increase quantity' }).click();
  // Let the update finish before a full page load (which would cancel it).
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 2 items');
  await page.goto('/p/iphone-x');
  await page.getByRole('button', { name: 'Add to cart' }).click();
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 3 items');

  await otpSignIn(page, customer.email);
  await expect(cartLink(page)).toHaveAccessibleName('Cart, 3 items');
});

test('forgot password signs in and signs out other devices', async ({ browser, page }) => {
  // Signed up without a mobile (F-016).
  const customer = { ...newCustomer(), mobile: '' };
  await page.goto('/signup');
  await signUp(page, customer);
  await expect(page.getByRole('button', { name: 'Account menu for Asha' })).toBeVisible();

  const other = await browser.newContext();
  const second = await other.newPage();
  await second.goto('/forgot-password');
  await second.getByLabel('Email').fill(customer.email);
  await second.getByRole('button', { name: 'Send code' }).click();
  await enterDemoCode(second);
  await second.getByLabel('New password').fill('a brand new secret');
  await second.getByRole('button', { name: 'Save and sign in' }).click();
  await expect(second.getByRole('button', { name: 'Account menu for Asha' })).toBeVisible();
  await other.close();

  await page.reload();
  await expect(page.getByRole('link', { name: 'Sign in' })).toBeVisible();
});

test.describe('mobile', () => {
  test.use({ viewport: { width: 360, height: 780 } });

  test('sign-in fits a phone and the header stays on one row', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('button', { name: 'Send code' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(360);
    const logo = await page.getByRole('link', { name: 'Cartwise' }).boundingBox();
    const signIn = await page.getByRole('link', { name: 'Sign in' }).boundingBox();
    expect(Math.abs(logo!.y - signIn!.y)).toBeLessThan(20);
  });
});

for (const width of [1280, 360]) {
  test(`the account menu shows a long email in full (${width} px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    const customer = { ...newCustomer(), name: 'Asha Rao' };
    customer.email = `asha.ramakrishnan.${customer.mobile}@very-long-company-domain.example.com`;
    await page.goto('/signup');
    await signUp(page, customer);
    await page.getByRole('button', { name: 'Account menu for Asha' }).click();
    const email = page.getByRole('menu').getByText(customer.email);
    await expect(email).toBeVisible();
    // Nothing clipped: the text fits its box, and the menu fits the screen.
    expect(await email.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    const box = (await page.getByRole('menu').boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
  });
}
