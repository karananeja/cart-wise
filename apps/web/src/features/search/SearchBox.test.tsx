import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeEach, describe, expect, it } from 'vitest';
import { addRecentSearch, reloadRecentSearches } from '@/lib/recentSearches';
import { renderRoute } from '@/test/render';
import { server } from '@/test/server';

const searchBox = () => screen.getByRole('combobox', { name: 'Search products' });

beforeEach(() => {
  localStorage.clear();
  reloadRecentSearches();
});

async function openAt(path = '/products') {
  const user = userEvent.setup();
  const utils = renderRoute(path);
  await screen.findByText(/\d+ products/);
  return { user, ...utils };
}

describe('SearchBox', () => {
  it('suggests categories and products while typing', async () => {
    const { user } = await openAt();
    await user.type(searchBox(), 'lap');

    const listbox = await screen.findByRole('listbox', { name: 'Search suggestions' });
    expect(await within(listbox).findByRole('option', { name: 'Laptops' })).toBeInTheDocument();
    expect(within(listbox).getByRole('group', { name: 'Categories' })).toBeInTheDocument();
    expect(within(listbox).getByRole('option', { name: /Search for “lap”/ })).toBeInTheDocument();
    expect(searchBox()).toHaveAttribute('aria-expanded', 'true');
  });

  it('opens a product suggestion with the keyboard', async () => {
    const { user, location } = await openAt();
    await user.type(searchBox(), 'mac');
    await screen.findByRole('option', { name: /MacBook Pro/ });

    await user.keyboard('{ArrowDown}');
    expect(searchBox()).toHaveAttribute('aria-activedescendant', screen.getByRole('option', { name: /MacBook Pro/ }).id);
    await user.keyboard('{Enter}');
    await waitFor(() => expect(location().pathname).toBe('/p/product-1'));
  });

  it('submits the typed query with Enter and records it as a recent search', async () => {
    const { user, location } = await openAt();
    await user.type(searchBox(), '  zen  book {Enter}');
    await waitFor(() => expect(location().pathname).toBe('/search'));
    expect(location().search).toBe('?q=zen+book');
    expect(JSON.parse(localStorage.getItem('store.recentSearches')!)[0].query).toBe('zen book');
  });

  it('ignores an empty submission', async () => {
    const { user, location } = await openAt();
    await user.click(searchBox());
    await user.keyboard('{Enter}');
    expect(location().pathname).toBe('/products');
  });

  it('closes with Escape', async () => {
    const { user } = await openAt();
    await user.type(searchBox(), 'lap');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(searchBox()).toHaveAttribute('aria-expanded', 'false');
  });

  it('shows recent searches on focus, repeats one, removes one and clears all', async () => {
    addRecentSearch('older');
    addRecentSearch('newer');
    const { user, location } = await openAt();

    await user.click(searchBox());
    const listbox = screen.getByRole('listbox', { name: 'Recent searches' });
    expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual(['newer', 'older']);

    await user.click(screen.getByRole('button', { name: 'Remove "older" from recent searches' }));
    expect(within(listbox).getAllByRole('option')).toHaveLength(1);

    await user.click(within(listbox).getByRole('option', { name: 'newer' }));
    await waitFor(() => expect(location().search).toBe('?q=newer'));

    await user.click(searchBox());
    await user.clear(searchBox());
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('removes the highlighted recent search with Shift+Delete', async () => {
    addRecentSearch('alpha');
    addRecentSearch('beta');
    const { user } = await openAt();
    await user.click(searchBox());
    await user.keyboard('{ArrowDown}{Shift>}{Delete}{/Shift}');
    const listbox = screen.getByRole('listbox', { name: 'Recent searches' });
    expect(within(listbox).getAllByRole('option').map((o) => o.textContent)).toEqual(['alpha']);
  });

  it('still lets you search when suggestions fail', async () => {
    server.use(http.get('*/api/search/suggestions', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 })));
    const { user, location } = await openAt();
    await user.type(searchBox(), 'lap');
    expect(await screen.findByRole('option', { name: /Search for “lap”/ })).toBeInTheDocument();
    await user.keyboard('{Enter}');
    await waitFor(() => expect(location().search).toBe('?q=lap'));
  });

  it('shows the current query on the results page', async () => {
    renderRoute('/search?q=zen');
    await screen.findByRole('heading', { level: 1, name: 'Results for “zen”' });
    expect(searchBox()).toHaveValue('zen');
  });
});
