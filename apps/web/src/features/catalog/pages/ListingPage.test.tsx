import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { listing, products } from '@/test/fixtures';
import { renderRoute } from '@/test/render';
import { receivedEvents, server } from '@/test/server';


beforeEach(() => {
  receivedEvents.length = 0;
});

async function waitForProducts(count: number) {
  await screen.findByText(`${count} ${count === 1 ? 'product' : 'products'}`);
}

describe('ListingPage', () => {
  it('shows the category heading, products and result count', async () => {
    renderRoute('/c/laptops');
    expect(await screen.findByRole('heading', { level: 1, name: 'Laptops' })).toBeInTheDocument();
    await waitForProducts(3);
    expect(screen.getByRole('link', { name: 'MacBook Pro' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'XPS 13' })).toBeInTheDocument();
  });

  it('restores filters from the URL', async () => {
    renderRoute('/c/laptops?brand=apple');
    await waitForProducts(1);
    const filters = screen.getByRole('complementary', { name: 'Filters' });
    expect(within(filters).getByRole('checkbox', { name: /Apple/ })).toBeChecked();
    expect(screen.getByRole('button', { name: 'Remove filter Apple' })).toBeInTheDocument();
  });

  it('applies a filter: updates the URL, shows a chip, and records filter_applied with the result count', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/c/laptops');
    await waitForProducts(3);

    const filters = screen.getByRole('complementary', { name: 'Filters' });
    await user.click(within(filters).getByRole('checkbox', { name: /Asus/ }));

    await waitForProducts(1);
    expect(location().search).toBe('?brand=asus');
    expect(screen.getByRole('button', { name: 'Remove filter Asus' })).toBeInTheDocument();

    flush();
    await waitFor(() => expect(receivedEvents).toHaveLength(1));
    expect(receivedEvents[0]).toMatchObject({
      name: 'filter_applied',
      properties: { filter: 'brand', value: 'asus', resultCount: 1, categorySlug: 'laptops' },
    });
  });

  it('removes a filter from its chip, and clears all', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/c/laptops?brand=apple&rating=4');
    await waitForProducts(1);

    await user.click(screen.getByRole('button', { name: 'Remove filter Apple' }));
    await waitForProducts(2);
    expect(location().search).toBe('?rating=4');

    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    await waitForProducts(3);
    expect(location().search).toBe('');
  });

  it('changes the sort and resets to page 1', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/products?page=2');
    await waitForProducts(4);
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price_asc');
    await waitFor(() => expect(location().search).toBe('?sort=price_asc'));
  });

  it('replaces invalid parameters with a clean URL', async () => {
    const { location } = renderRoute('/products?sort=cheapest&brand=Not%20Valid&page=zero');
    await waitForProducts(4);
    expect(location().search).toBe('');
  });

  it('suggests the filter to remove when nothing matches', async () => {
    server.use(
      http.get('*/api/products', ({ request }) => {
        const url = new URL(request.url);
        if (url.searchParams.get('brand'))
          return HttpResponse.json(listing([], { relaxations: [{ filter: 'brand', total: 3 }, { filter: 'rating', total: 0 }] }));
        return HttpResponse.json(listing(products.slice(0, 3)));
      }),
    );
    const user = userEvent.setup();
    const { location } = renderRoute('/c/laptops?brand=dell&rating=4');

    expect(await screen.findByRole('heading', { name: 'No products match these filters' })).toBeInTheDocument();
    expect(screen.getByText('Brand: Dell')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show 3 products' }));
    await waitForProducts(3);
    expect(location().search).toBe('?rating=4');
  });

  it('shows a friendly error with retry when the API fails, then recovers', async () => {
    let fail = true;
    server.use(
      http.get('*/api/products', () =>
        fail
          ? HttpResponse.json({ error: { code: 'INTERNAL', message: 'SQLITE_BUSY: database is locked' } }, { status: 500 })
          : HttpResponse.json(listing(products.slice(0, 3))),
      ),
    );
    const user = userEvent.setup();
    renderRoute('/c/laptops');

    expect(await screen.findByRole('heading', { name: "We couldn't load products right now" })).toBeInTheDocument();
    expect(screen.queryByText(/SQLITE/)).not.toBeInTheDocument();

    fail = false;
    await user.click(screen.getByRole('button', { name: /Try again/ }));
    await waitForProducts(3);
  });

  it('shows not found for an unknown category', async () => {
    renderRoute('/c/not-a-category');
    expect(await screen.findByRole('heading', { name: "We couldn't find that category" })).toBeInTheDocument();
  });

  it('links pagination pages with the current filters', async () => {
    server.use(http.get('*/api/products', () => HttpResponse.json(listing(products, { total: 60 }))));
    renderRoute('/c/laptops?brand=apple');
    const nav = await screen.findByRole('navigation', { name: 'Pagination' });
    expect(within(nav).getByRole('link', { name: 'Page 2' })).toHaveAttribute('href', '/c/laptops?brand=apple&page=2');
    expect(within(nav).getByRole('link', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });
});

