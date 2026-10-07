import { screen, waitFor, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Category } from '@store/shared';
import { renderRoute } from '@/test/render';
import { server } from '@/test/server';

const footer = () => screen.getByRole('contentinfo');
const column = (name: string) => within(footer()).getByRole('navigation', { name });
const links = (element: HTMLElement) => within(element).getAllByRole('link').map((a) => [a.textContent, a.getAttribute('href')]);

const category = (slug: string, productCount: number): Category => ({ slug, name: slug[0]!.toUpperCase() + slug.slice(1), imageUrl: `https://img.test/${slug}.webp`, productCount });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('site footer (F-018)', () => {
  it('shows the brand, link columns, newsletter and the bottom bar', async () => {
    renderRoute('/');
    expect(within(footer()).getByText('Cartwise')).toBeInTheDocument();
    expect(within(footer()).getByText('Everyday finds, delivered across India.')).toBeInTheDocument();
    for (const name of ['Shop', 'Your account', 'Help', 'Newsletter']) expect(within(footer()).getByRole('heading', { name })).toBeInTheDocument();
    expect(links(column('Your account'))).toEqual([
      ['Account', '/account'],
      ['Orders', '/account/orders'],
      ['Wishlist', '/wishlist'],
      ['Cart', '/cart'],
      ['Addresses', '/account/addresses'],
    ]);
    expect(links(column('Help'))).toEqual([
      ['Delivery', '/help/delivery'],
      ['Returns & refunds', '/help/returns'],
      ['Payments & EMI', '/help/payments'],
    ]);
    expect(within(footer()).getByRole('textbox', { name: 'Email for the newsletter' })).toBeInTheDocument();
    expect(within(footer()).getByText(/Products, ratings, reviews, stock levels and payments are simulated/)).toBeInTheDocument();
    expect(within(footer()).getByText(`© ${new Date().getFullYear()} Cartwise demo`)).toBeInTheDocument();
    expect(within(footer()).getByRole('link', { name: /Store simulation/ })).toHaveAttribute('href', '/sim');
    await waitFor(() => expect(within(column('Shop')).getByRole('link', { name: 'Laptops' })).toBeInTheDocument());
  });

  it('lists the 6 largest categories, largest first, then All products', async () => {
    server.use(
      http.get('*/api/categories', () =>
        HttpResponse.json({
          categories: [category('tiny', 1), category('shoes', 40), category('bags', 12), category('watches', 25), category('lamps', 2), category('phones', 30), category('decor', 12), category('toys', 8)],
        }),
      ),
    );
    renderRoute('/');
    await waitFor(() => expect(links(column('Shop'))).toHaveLength(7));
    expect(links(column('Shop'))).toEqual([
      ['Shoes', '/c/shoes'],
      ['Phones', '/c/phones'],
      ['Watches', '/c/watches'],
      ['Bags', '/c/bags'],
      ['Decor', '/c/decor'],
      ['Toys', '/c/toys'],
      ['All products', '/products'],
    ]);
  });

  it('shows only All products when categories fail to load', async () => {
    server.use(http.get('*/api/categories', () => HttpResponse.json({ error: { code: 'INTERNAL', message: 'x' } }, { status: 500 })));
    renderRoute('/cart');
    await screen.findByRole('heading', { level: 1 });
    expect(links(column('Shop'))).toEqual([['All products', '/products']]);
  });

  it('shows social icons and app badges as decoration that says "coming soon" and cannot be focused', () => {
    renderRoute('/');
    const social = within(footer()).getByRole('group', { name: 'Follow us · coming soon' });
    const apps = within(footer()).getByRole('group', { name: 'Get the app · coming soon' });
    for (const name of ['Instagram', 'X', 'YouTube', 'Facebook']) expect(within(social).getByText(name)).toBeInTheDocument();
    for (const name of ['App Store', 'Google Play']) expect(within(apps).getByText(name)).toBeInTheDocument();
    for (const group of [social, apps]) {
      expect(within(group).queryAllByRole('link')).toHaveLength(0);
      expect(within(group).queryAllByRole('button')).toHaveLength(0);
      expect(group.querySelectorAll('a, button, input, [tabindex]')).toHaveLength(0);
    }
  });

  it('turns the link columns into collapsed native sections on narrow screens', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    renderRoute('/');
    const sections = footer().querySelectorAll('details');
    expect(sections).toHaveLength(3);
    expect([...sections].map((d) => d.querySelector('summary')!.textContent)).toEqual(['Shop', 'Your account', 'Help']);
    expect([...sections].every((d) => !d.open)).toBe(true);
    // The newsletter stays visible as the footer's one action.
    expect(within(footer()).getByRole('textbox', { name: 'Email for the newsletter' })).toBeVisible();
  });
});
