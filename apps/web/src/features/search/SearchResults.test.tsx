import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { flush } from '@/lib/analytics';
import { reloadRecentSearches } from '@/lib/recentSearches';
import { listing, products } from '@/test/fixtures';
import { renderRoute } from '@/test/render';
import { receivedEvents, server } from '@/test/server';

beforeEach(() => {
  receivedEvents.length = 0;
  localStorage.clear();
  reloadRecentSearches();
});

describe('search results', () => {
  it('shows results with Relevance as the default sort', async () => {
    renderRoute('/search?q=zen');
    expect(await screen.findByRole('heading', { level: 1, name: 'Results for “zen”' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Zenbook' })).toBeInTheDocument();
    expect(screen.getByLabelText('Sort by')).toHaveValue('relevance');
  });

  it('keeps the query when filters change', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/search?q=book');
    await screen.findByText(/\d+ products?/);
    await user.selectOptions(screen.getByLabelText('Sort by'), 'price_asc');
    await waitFor(() => expect(location().search).toBe('?q=book&sort=price_asc'));
  });

  it('explains partial matches', async () => {
    server.use(
      http.get('*/api/products', () =>
        HttpResponse.json(listing(products.slice(0, 2), { search: { query: 'red office chair', matchMode: 'partial' } })),
      ),
    );
    renderRoute('/search?q=red+office+chair');
    expect(
      await screen.findByText('No results for all of “red office chair”. Showing products that match some of your words.'),
    ).toBeInTheDocument();
  });

  it('offers categories and top-rated products when nothing matches', async () => {
    renderRoute('/search?q=qwxzv');
    expect(await screen.findByRole('heading', { name: 'No results for “qwxzv”' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Browse categories' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Laptops' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Top rated' })).toBeInTheDocument();
  });

  it('redirects /search without a query to all products', async () => {
    const { location } = renderRoute('/search?q=%20');
    await waitFor(() => expect(location().pathname).toBe('/products'));
  });

  it('records search_performed once per submitted search, and search_no_results when empty', async () => {
    const user = userEvent.setup();
    const { router } = renderRoute('/products');
    await screen.findByText(/\d+ products/);

    await user.type(screen.getByRole('combobox', { name: 'Search products' }), 'qwxzv{Enter}');
    await screen.findByRole('heading', { name: 'No results for “qwxzv”' });
    await user.type(screen.getByRole('combobox', { name: 'Search products' }), '{Control>}a{/Control}zen{Enter}');
    await screen.findByRole('heading', { level: 1, name: 'Results for “zen”' });
    await screen.findByRole('link', { name: 'Zenbook' });

    // Going back must not count the earlier search again.
    await router.navigate(-1);
    await screen.findByRole('heading', { name: 'No results for “qwxzv”' });

    flush();
    await waitFor(() => expect(receivedEvents).toHaveLength(3));
    expect(receivedEvents.map((e) => [e.name, e.properties])).toEqual([
      ['search_performed', { query: 'qwxzv', resultCount: 0, source: 'typed' }],
      ['search_no_results', { query: 'qwxzv' }],
      ['search_performed', { query: 'zen', resultCount: 1, source: 'typed' }],
    ]);
  });

  it('marks searches repeated from history', async () => {
    const user = userEvent.setup();
    renderRoute('/products');
    await screen.findByText(/\d+ products/);
    const box = screen.getByRole('combobox', { name: 'Search products' });
    await user.type(box, 'zen{Enter}');
    await screen.findByRole('link', { name: 'Zenbook' });
    await user.click(box);
    await user.clear(box);
    await user.click(screen.getByRole('option', { name: 'zen' }));
    await waitFor(() => {
      flush();
      expect(receivedEvents.map((e) => e.properties.source)).toEqual(['typed', 'history']);
    });
  });

  it('does not record a search for suggestion clicks', async () => {
    const user = userEvent.setup();
    renderRoute('/products');
    await screen.findByText(/\d+ products/);
    await user.type(screen.getByRole('combobox', { name: 'Search products' }), 'lap');
    await user.click(await screen.findByRole('option', { name: 'Laptops' }));
    await screen.findByRole('heading', { level: 1, name: 'Laptops' });
    flush();
    await new Promise((r) => setTimeout(r, 50));
    expect(receivedEvents.filter((e) => e.name.startsWith('search'))).toEqual([]);
  });
});
