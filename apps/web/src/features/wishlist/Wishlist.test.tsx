import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { setStock } from '@/test/cartServer';
import { renderRoute } from '@/test/render';
import { receivedEvents, server } from '@/test/server';

beforeEach(async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
});

const wishlistLink = () => screen.getByRole('link', { name: /^Wishlist(,|$)/ });
const cartLink = () => screen.getByRole('link', { name: /^Cart(,|$)/ });

async function save(slug: string) {
  await fetch(new URL(`/api/wishlist/items/${slug}`, window.location.origin), { method: 'PUT' });
}

describe('saving', () => {
  it('saves from a product card without opening the product, and every heart agrees', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/c/laptops');
    await screen.findByText('3 products');

    const heart = screen.getByRole('button', { name: 'Save MacBook Pro to wishlist' });
    expect(heart).toHaveAttribute('aria-pressed', 'false');
    await user.click(heart);

    expect(location().pathname).toBe('/c/laptops');
    expect(screen.getByRole('button', { name: 'Remove MacBook Pro from wishlist' })).toHaveAttribute('aria-pressed', 'true');
    await waitFor(() => expect(wishlistLink()).toHaveAccessibleName('Wishlist, 1 item'));

    await user.click(screen.getByRole('button', { name: 'Remove MacBook Pro from wishlist' }));
    await waitFor(() => expect(wishlistLink()).toHaveAccessibleName('Wishlist, 0 items'));

    flush();
    await waitFor(() =>
      expect(receivedEvents.map((e) => [e.name, e.properties.source])).toEqual([
        ['wishlist_added', 'product_card'],
        ['wishlist_removed', 'product_card'],
      ]),
    );
  });

  it('saves from the product page', async () => {
    const user = userEvent.setup();
    renderRoute('/p/product-3'); // out of stock: can still be saved
    await screen.findByRole('heading', { level: 1, name: 'XPS 13' });
    await user.click(screen.getByRole('button', { name: 'Save XPS 13 to wishlist' }));
    expect(screen.getByRole('button', { name: 'Remove XPS 13 from wishlist' })).toHaveTextContent('Saved');
    await waitFor(() => expect(wishlistLink()).toHaveAccessibleName('Wishlist, 1 item'));
  });

  it('rolls back and explains when saving fails', async () => {
    server.use(http.put('*/api/wishlist/items/:slug', () => HttpResponse.json({ error: { code: 'WISHLIST_FULL', message: 'x' } }, { status: 409 })));
    const user = userEvent.setup();
    renderRoute('/p/product-1');
    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro' });
    await user.click(screen.getByRole('button', { name: 'Save MacBook Pro to wishlist' }));
    expect(await screen.findByText('Your wishlist is full — remove something to add more.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save MacBook Pro to wishlist' })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('wishlist page', () => {
  it('shows the empty state', async () => {
    renderRoute('/wishlist');
    expect(await screen.findByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/products');
  });

  it('lists saved products newest first, out-of-stock ones without Move to cart', async () => {
    await save('product-1');
    await save('product-3');
    renderRoute('/wishlist');
    await screen.findByRole('heading', { name: /Wishlist/ });
    const titles = (await screen.findAllByRole('heading', { level: 3 })).map((h) => h.textContent);
    expect(titles).toEqual(['XPS 13', 'MacBook Pro']);
    expect(screen.getByRole('button', { name: 'Out of stock' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Move MacBook Pro to cart' })).toBeEnabled();
  });

  it('moves an unsized product to the cart and out of the wishlist', async () => {
    await save('product-1');
    const user = userEvent.setup();
    renderRoute('/wishlist');
    await user.click(await screen.findByRole('button', { name: 'Move MacBook Pro to cart' }));

    expect(await screen.findByText(/Moved MacBook Pro to cart/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View cart' })).toHaveAttribute('href', '/cart');
    await waitFor(() => expect(cartLink()).toHaveAccessibleName('Cart, 1 item'));
    await waitFor(() => expect(wishlistLink()).toHaveAccessibleName('Wishlist, 0 items'));

    flush();
    await waitFor(() =>
      expect(receivedEvents.map((e) => [e.name, e.properties.source])).toEqual([
        ['cart_item_added', 'wishlist'],
        ['wishlist_removed', 'moved_to_cart'],
      ]),
    );
  });

  it('asks for an option for products with options, preselecting the cheapest in stock (F-013)', async () => {
    await save('galaxy-phone');
    const user = userEvent.setup();
    renderRoute('/wishlist');
    expect(await screen.findByText('From')).toBeInTheDocument();
    await user.click(await screen.findByRole('button', { name: 'Move Galaxy Phone to cart' }));
    const dialog = await screen.findByRole('dialog', { name: 'Choose storage' });
    expect(within(dialog).getByRole('radio', { name: /128 GB/ })).toBeChecked();
    expect(within(dialog).getByRole('radio', { name: /512 GB/ })).toBeDisabled();
    await user.click(within(dialog).getByRole('radio', { name: /256 GB/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Move to cart' }));
    expect(await screen.findByText(/Moved Galaxy Phone to cart/)).toBeInTheDocument();
    await waitFor(() => expect(cartLink()).toHaveAccessibleName('Cart, 1 item'));
  });

  it('asks for a size for sized products, with sold-out sizes disabled', async () => {
    await save('check-shirt');
    const user = userEvent.setup();
    renderRoute('/wishlist');
    await user.click(await screen.findByRole('button', { name: 'Move Check Shirt to cart' }));

    const dialog = await screen.findByRole('dialog', { name: 'Choose a size' });
    expect(within(dialog).getByRole('radio', { name: /^S\s*\(out of stock\)$/ })).toBeDisabled();
    await user.click(within(dialog).getByRole('button', { name: 'Move to cart' }));
    expect(within(dialog).getByRole('alert')).toHaveTextContent('Please select a size');

    await user.click(within(dialog).getByRole('radio', { name: 'L' }));
    await user.click(within(dialog).getByRole('button', { name: 'Move to cart' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(cartLink()).toHaveAccessibleName('Cart, 1 item'));
    expect(await screen.findByRole('heading', { name: 'Your wishlist is empty' })).toBeInTheDocument();
  });

  it('keeps the item and explains when it cannot be added', async () => {
    await save('product-1');
    setStock('product-1', null, 0);
    const user = userEvent.setup();
    renderRoute('/wishlist');
    await user.click(await screen.findByRole('button', { name: 'Move MacBook Pro to cart' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Sorry, this just sold out');
    expect(screen.getByRole('heading', { level: 3, name: 'MacBook Pro' })).toBeInTheDocument();
  });
});

describe('cart → wishlist', () => {
  it('moves a cart line to the wishlist, with Undo restoring the line', async () => {
    await fetch(new URL('/api/cart/lines', window.location.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productSlug: 'product-2', quantity: 2 }),
    });
    const user = userEvent.setup();
    renderRoute('/cart');
    await user.click(await screen.findByRole('button', { name: 'Move Zenbook to wishlist' }));

    expect(await screen.findByText('Moved Zenbook to wishlist')).toBeInTheDocument();
    await waitFor(() => expect(wishlistLink()).toHaveAccessibleName('Wishlist, 1 item'));
    expect(screen.queryByRole('link', { name: 'Zenbook' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    const row = (await screen.findByRole('link', { name: 'Zenbook' })).closest('li')!;
    expect(within(row).getByRole('status')).toHaveTextContent('2');
  });
});
