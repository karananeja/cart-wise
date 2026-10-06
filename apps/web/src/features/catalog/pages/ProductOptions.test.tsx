import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { product } from '@/test/fixtures';
import { renderRoute } from '@/test/render';
import { receivedEvents } from '@/test/server';
import { ProductCard } from '../components/ProductCard';

/** Electronics options (F-013): galaxy-phone has 128 GB (₹30,000), 256 GB (₹33,000, 2 left), 512 GB (sold out). */
beforeEach(async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
  localStorage.clear();
});

const purchasePrice = () => screen.getAllByText(/^₹/, { selector: 'p > span' })[0]!;

describe('product options', () => {
  it('preselects the cheapest in-stock option and shows every option with its price', async () => {
    renderRoute('/p/galaxy-phone');
    const group = await screen.findByRole('group', { name: 'Storage' });
    const radios = within(group).getAllByRole('radio');
    expect(radios.map((r) => (r as HTMLInputElement).value)).toEqual(['128 GB', '256 GB', '512 GB']);
    expect(within(group).getByRole('radio', { name: /128 GB/ })).toBeChecked();
    expect(within(group).getByRole('radio', { name: /256 GB/ }).closest('label')).toHaveTextContent('₹33,000');
    // Sold-out options stay visible but can't be chosen.
    expect(within(group).getByRole('radio', { name: /512 GB/ })).toBeDisabled();
    expect(within(group).getByRole('radio', { name: /512 GB/ }).closest('label')).toHaveTextContent('Out of stock');
    expect(purchasePrice()).toHaveTextContent('₹30,000');
    expect(screen.getByText('In stock in 128 GB')).toBeInTheDocument();
  });

  it('updates price and availability with the option, and keeps it in the URL', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/p/galaxy-phone');
    const group = await screen.findByRole('group', { name: 'Storage' });
    await user.click(within(group).getByRole('radio', { name: /256 GB/ }));
    expect(location().search).toBe('?option=256+GB');
    expect(purchasePrice()).toHaveTextContent('₹33,000');
    expect(screen.getByText('₹36,300').closest('s')).not.toBeNull();
    expect(screen.getByText('Only 2 left in 256 GB')).toBeInTheDocument();
  });

  it('ignores a sold-out or unknown option in the URL', async () => {
    renderRoute('/p/galaxy-phone?option=512%20GB');
    const group = await screen.findByRole('group', { name: 'Storage' });
    expect(within(group).getByRole('radio', { name: /128 GB/ })).toBeChecked();
  });

  it('adds the chosen option at its price, as its own cart line', async () => {
    const user = userEvent.setup();
    renderRoute('/p/galaxy-phone?option=256%20GB');
    await screen.findByRole('group', { name: 'Storage' });
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByRole('group', { name: 'Quantity in cart, 256 GB' })).toBeInTheDocument();

    // Another option is a different line: Add to cart comes back for it.
    await user.click(within(screen.getByRole('group', { name: 'Storage' })).getByRole('radio', { name: /128 GB/ }));
    expect(await screen.findByRole('button', { name: 'Add to cart' })).toBeInTheDocument();

    flush();
    await waitFor(() => expect(receivedEvents.filter((e) => e.name === 'cart_item_added')).toHaveLength(1));
    expect(receivedEvents.find((e) => e.name === 'cart_item_added')!.properties).toEqual({
      productId: 70,
      size: null,
      option: '256 GB',
      quantity: 1,
      pricePaise: 33_000_00,
      source: 'product_page',
    });
  });

  it('shows the cart line with its option and option price', async () => {
    const user = userEvent.setup();
    renderRoute('/p/galaxy-phone?option=256%20GB');
    await screen.findByRole('group', { name: 'Storage' });
    await user.click(screen.getByRole('button', { name: 'Add to cart' }));
    await screen.findByRole('group', { name: 'Quantity in cart, 256 GB' });
    await user.click(screen.getByRole('link', { name: 'Go to cart' }));

    const item = (await screen.findByRole('heading', { level: 2, name: 'Galaxy Phone' })).closest('li')!;
    expect(within(item).getByText('256 GB')).toBeInTheDocument();
    expect(within(item).getByRole('link', { name: 'Galaxy Phone' })).toHaveAttribute('href', '/p/galaxy-phone?option=256%20GB');
    expect(within(item).getAllByText('₹33,000').length).toBeGreaterThan(0);
  });
});

describe('starting price', () => {
  it('reads "From" on cards for products with options', () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <ProductCard product={product({ id: 9, pricePaise: 30_000_00, mrpPaise: 30_000_00, discountPercent: 0, hasOptions: true })} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('₹30,000').closest('span')).toHaveTextContent('From ₹30,000');
  });
});
