import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { reloadRecentlyViewed } from '@/lib/recentlyViewed';
import { renderRoute } from '@/test/render';
import { receivedEvents } from '@/test/server';

beforeEach(async () => {
  // Send anything earlier tests queued, so this test only sees its own events.
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
  localStorage.clear();
  reloadRecentlyViewed();
});

const sizeGroup = () => screen.getByRole('group', { name: 'Size' });

describe('ProductPage', () => {
  it('shows details, rating with review count, and unlabelled reviews', async () => {
    renderRoute('/p/product-1');
    expect(await screen.findByRole('heading', { level: 1, name: 'MacBook Pro' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Rated 4.6 out of 5 from 3 reviews' })).toBeInTheDocument();
    expect(screen.getByText('A product description.')).toBeInTheDocument();

    const reviews = screen.getByRole('region', { name: 'Customer reviews' });
    expect(within(reviews).getByText('Love it')).toBeInTheDocument();
    expect(within(reviews).getByText('Asha Rao')).toBeInTheDocument();
    expect(within(reviews).queryByText(/demo/i)).not.toBeInTheDocument();
  });

  it('has no size selector for products without sizes', async () => {
    renderRoute('/p/product-1');
    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro' });
    expect(screen.queryByRole('group', { name: 'Size' })).not.toBeInTheDocument();
    expect(screen.getByText('In stock')).toBeInTheDocument();
  });

  it('asks for a size, disables sold-out sizes, and reports stock for the chosen size', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/p/check-shirt');
    await screen.findByRole('heading', { level: 1, name: 'Check Shirt' });

    expect(screen.getByText('Select a size')).toBeInTheDocument();
    expect(within(sizeGroup()).getByRole('radio', { name: /^S\s*\(out of stock\)$/ })).toBeDisabled();
    expect(within(sizeGroup()).getByRole('radio', { name: /^XL\s*\(out of stock\)$/ })).toBeDisabled();

    await user.click(within(sizeGroup()).getByRole('radio', { name: 'M' }));
    expect(screen.getByText('Only 2 left in M')).toBeInTheDocument();
    expect(location().search).toBe('?size=M');

    await user.click(within(sizeGroup()).getByRole('radio', { name: 'L' }));
    expect(screen.getByText('In stock in L')).toBeInTheDocument();
  });

  it('restores a valid size from the URL and ignores sold-out or unknown ones', async () => {
    const { unmount } = renderRoute('/p/check-shirt?size=M');
    expect(await screen.findByText('Only 2 left in M')).toBeInTheDocument();
    expect(within(sizeGroup()).getByRole('radio', { name: 'M' })).toBeChecked();
    unmount();

    renderRoute('/p/check-shirt?size=XL');
    expect(await screen.findByText('Select a size')).toBeInTheDocument();

  });

  it('records product_viewed once, not again when the size changes', async () => {
    const user = userEvent.setup();
    renderRoute('/p/check-shirt');
    await screen.findByRole('heading', { level: 1, name: 'Check Shirt' });
    await user.click(within(sizeGroup()).getByRole('radio', { name: 'L' }));

    flush();
    await waitFor(() => expect(receivedEvents).toHaveLength(1));
    expect(receivedEvents[0]).toMatchObject({
      name: 'product_viewed',
      properties: { productId: 50, categorySlug: 'mens-shirts', pricePaise: 90_000_00, availability: 'in_stock' },
    });
  });

  it('remembers viewed products and shows them elsewhere, newest first', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/p/product-1');
    await screen.findByRole('heading', { level: 1, name: 'MacBook Pro' });
    expect(screen.queryByRole('region', { name: 'Recently viewed' })).not.toBeInTheDocument();

    await router.navigate('/p/product-2');
    await screen.findByRole('heading', { level: 1, name: 'Zenbook' });
    const onProduct = await screen.findByRole('region', { name: 'Recently viewed' });
    // The current product is left out.
    expect(within(onProduct).getAllByRole('link').map((l) => l.textContent)).toEqual(['MacBook Pro']);

    await router.navigate('/');
    await screen.findByRole('heading', { name: 'Shop by category' });
    const onHome = await screen.findByRole('region', { name: 'Recently viewed' });
    await waitFor(() => expect(within(onHome).getAllByRole('link').map((l) => l.textContent)).toEqual(['Zenbook', 'MacBook Pro']));

    await user.click(within(onHome).getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('region', { name: 'Recently viewed' })).not.toBeInTheDocument();
  });
});
