import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { reloadRecentlyViewed } from '@/lib/recentlyViewed';
import { setStock } from '@/test/cartServer';
import { renderRoute } from '@/test/render';
import { receivedEvents } from '@/test/server';

beforeEach(async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
  localStorage.clear();
  reloadRecentlyViewed();
});

const cartLink = () => within(screen.getAllByRole('banner')[0]!).getByRole('link', { name: /^Cart(,|$)/ });

describe('Add to cart', () => {
  it('adds an unsized product, then adjusts quantity in place with a separate Go to cart', async () => {
    const user = userEvent.setup();
    renderRoute('/p/product-1');
    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro' });
    await waitFor(() => expect(cartLink()).toHaveAccessibleName('Cart, 0 items'));

    await user.click(screen.getByRole('button', { name: 'Add to cart' }));

    const stepper = await screen.findByRole('group', { name: 'Quantity in cart' });
    expect(screen.queryByRole('button', { name: 'Add to cart' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to cart' })).toHaveAttribute('href', '/cart');
    expect(screen.getByText('Added to cart')).toBeInTheDocument();
    expect(within(stepper).getByRole('status')).toHaveTextContent('1');
    expect(cartLink()).toHaveAccessibleName('Cart, 1 item');

    await user.click(within(stepper).getByRole('button', { name: 'Increase quantity' }));
    await waitFor(() => expect(cartLink()).toHaveAccessibleName('Cart, 2 items'));
    expect(within(stepper).getByRole('status')).toHaveTextContent('2');

    await user.click(within(stepper).getByRole('button', { name: 'Decrease quantity' }));
    await waitFor(() => expect(cartLink()).toHaveAccessibleName('Cart, 1 item'));

    // − at 1 takes the item out and brings Add to cart back.
    await user.click(within(stepper).getByRole('button', { name: 'Remove from cart' }));
    expect(await screen.findByRole('button', { name: 'Add to cart' })).toBeInTheDocument();
    await waitFor(() => expect(cartLink()).toHaveAccessibleName('Cart, 0 items'));

    flush();
    const cartEvents = () => receivedEvents.filter((e) => e.name.startsWith('cart_'));
    await waitFor(() => expect(cartEvents().map((e) => e.name)).toEqual(['cart_item_added', 'cart_item_removed']));
    expect(cartEvents()[0]!.properties).toEqual({ productId: 1, size: null, option: null, quantity: 1, pricePaise: 90_000_00, source: 'product_page' });
  });

  it('stops + at the stock limit with the reason', async () => {
    const user = userEvent.setup();
    renderRoute('/p/check-shirt?size=M'); // M has 2 left
    await screen.findByRole('heading', { level: 1, name: 'Check Shirt' });
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    const stepper = await screen.findByRole('group', { name: 'Quantity in cart, size M' });
    await user.click(within(stepper).getByRole('button', { name: 'Increase quantity' }));
    await waitFor(() => expect(within(stepper).getByRole('button', { name: 'Increase quantity' })).toBeDisabled());
    expect(screen.getByText('Only 2 available')).toBeInTheDocument();
  });

  it('asks for a size first, focusing the sizes, and adds nothing', async () => {
    const user = userEvent.setup();
    renderRoute('/p/check-shirt');
    await screen.findByRole('heading', { level: 1, name: 'Check Shirt' });

    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Please select a size');
    const sizes = screen.getByRole('group', { name: 'Size' });
    expect(within(sizes).getByRole('radio', { name: 'M' })).toHaveFocus();
    expect(cartLink()).toHaveAccessibleName('Cart, 0 items');

    await user.click(within(sizes).getByRole('radio', { name: 'L' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('group', { name: 'Quantity in cart, size L' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Go to cart' })).toBeInTheDocument();

    // A different size is a different line, so it can be added too.
    await user.click(within(sizes).getByRole('radio', { name: 'M' }));
    expect(screen.getByRole('button', { name: 'Add to cart' })).toBeInTheDocument();
  });

  it('shows a disabled Out of stock button for sold-out products', async () => {
    renderRoute('/p/product-3');
    expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled();
  });

  it('explains a failed add without technical detail', async () => {
    const user = userEvent.setup();
    renderRoute('/p/product-1');
    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro' });
    setStock('product-1', null, 0);
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Sorry, this just sold out')).toBeInTheDocument();
  });
});
