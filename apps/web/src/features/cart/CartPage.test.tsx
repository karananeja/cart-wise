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

/** Adds items through the mock API, as a previous visit would have. */
async function seedCart(items: { productSlug: string; size?: string; quantity?: number }[]) {
  for (const item of items) {
    await fetch(new URL('/api/cart/lines', window.location.origin), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item),
    });
  }
}

const line = (title: RegExp | string) => screen.getByRole('link', { name: title }).closest('li')!;
const summary = () => screen.getByRole('region', { name: 'Order summary' });

describe('CartPage', () => {
  it('shows the empty state', async () => {
    renderRoute('/cart');
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/products');
  });

  it('lists lines with size and shows correct totals', async () => {
    await seedCart([{ productSlug: 'product-2', quantity: 2 }, { productSlug: 'check-shirt', size: 'L' }]);
    renderRoute('/cart');
    await screen.findByRole('heading', { name: /Your cart/ });

    expect(within(line('Check Shirt')).getByText('Size: L')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Check Shirt' })).toHaveAttribute('href', '/p/check-shirt?size=L');
    // Zenbook 2 × ₹80,000 (no discount) + shirt ₹90,000 (MRP ₹1,00,000)
    const s = within(summary());
    expect(s.getByText('3')).toBeInTheDocument();
    expect(s.getByText('₹2,60,000')).toBeInTheDocument();
    expect(s.getByText('−₹10,000')).toBeInTheDocument();
    expect(s.getByText('₹2,50,000')).toBeInTheDocument();
    expect(s.getByText('Calculated at checkout')).toBeInTheDocument();
  });

  it('changes quantity and stops at the stock limit with a reason', async () => {
    const user = userEvent.setup();
    await seedCart([{ productSlug: 'check-shirt', size: 'M' }]); // M has 2 left
    renderRoute('/cart');
    const row = await waitFor(() => line('Check Shirt'));
    const quantity = within(row).getByRole('group', { name: /Quantity for Check Shirt, size M/ });

    await user.click(within(quantity).getByRole('button', { name: 'Increase quantity' }));
    await waitFor(() => expect(within(quantity).getByRole('status')).toHaveTextContent('2'));
    expect(within(quantity).getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(within(row).getByText('Only 2 available')).toBeInTheDocument();
    await waitFor(() => expect(within(summary()).getAllByText('₹1,80,000').length).toBeGreaterThan(0));

    await user.click(within(quantity).getByRole('button', { name: 'Decrease quantity' }));
    await waitFor(() => expect(within(quantity).getByRole('status')).toHaveTextContent('1'));
    expect(within(quantity).getByRole('button', { name: 'Decrease quantity' })).toBeDisabled();
  });

  it('caps at 10 per line', async () => {
    await seedCart([{ productSlug: 'product-2', quantity: 10 }]);
    renderRoute('/cart');
    const row = await waitFor(() => line('Zenbook'));
    expect(within(row).getByRole('button', { name: 'Increase quantity' })).toBeDisabled();
    expect(within(row).getByText('Max 10 per order')).toBeInTheDocument();
  });

  it('removes a line with Undo, restoring size and quantity', async () => {
    const user = userEvent.setup();
    await seedCart([{ productSlug: 'check-shirt', size: 'L', quantity: 3 }, { productSlug: 'product-2' }]);
    renderRoute('/cart');
    await waitFor(() => line('Check Shirt'));

    await user.click(screen.getByRole('button', { name: 'Remove Check Shirt, size L' }));
    expect(screen.queryByRole('link', { name: 'Check Shirt' })).not.toBeInTheDocument();
    expect(screen.getByText('Removed Check Shirt')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    const restored = await waitFor(() => line('Check Shirt'));
    expect(within(restored).getByText('Size: L')).toBeInTheDocument();
    expect(within(restored).getByRole('status')).toHaveTextContent('3');

    flush();
    await waitFor(() => expect(receivedEvents.map((e) => [e.name, e.properties.source ?? e.properties.reason])).toEqual([
      ['cart_item_removed', 'removed'],
      ['cart_item_added', 'undo'],
    ]));
  });

  it('flags stock problems, keeps quantities and excludes them from the subtotal', async () => {
    await seedCart([{ productSlug: 'product-2', quantity: 4 }, { productSlug: 'product-1' }]);
    setStock('product-2', null, 2);
    setStock('product-1', null, 0);
    renderRoute('/cart');

    expect(await screen.findByText(/Some items need your attention/)).toBeInTheDocument();
    expect(within(line('Zenbook')).getByText('Only 2 available — reduce quantity')).toBeInTheDocument();
    expect(within(line('Zenbook')).getByRole('status')).toHaveTextContent('4');
    expect(within(line('MacBook Pro')).getByText('Out of stock')).toBeInTheDocument();
    expect(within(summary()).getByText('Items that need attention are not included.')).toBeInTheDocument();
    expect(within(summary()).getAllByText('₹0').length).toBeGreaterThan(0);
  });

  it('rolls back a failed change and explains it', async () => {
    const user = userEvent.setup();
    await seedCart([{ productSlug: 'product-2' }]);
    server.use(http.patch('*/api/cart/lines/:id', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'db down' } }, { status: 500 })));
    renderRoute('/cart');
    const row = await waitFor(() => line('Zenbook'));

    await user.click(within(row).getByRole('button', { name: 'Increase quantity' }));
    expect(await screen.findByText('Something went wrong. Please try again.')).toBeInTheDocument();
    expect(within(row).getByRole('status')).toHaveTextContent('1');
    expect(screen.queryByText(/db down/)).not.toBeInTheDocument();
  });

  it('shows a friendly error when the cart cannot load', async () => {
    server.use(http.get('*/api/cart', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 })));
    renderRoute('/cart');
    expect(await screen.findByRole('heading', { name: "We couldn't load your cart right now" })).toBeInTheDocument();
  });
});
