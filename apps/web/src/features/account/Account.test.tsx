import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { addUser } from '@/test/authServer';
import { seedOrder } from '@/test/ordersServer';
import { renderRoute } from '@/test/render';
import { server } from '@/test/server';

const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery', memberSince: '2026-03-15T09:00:00.000Z' };

const send = (method: string, path: string, body?: unknown) =>
  fetch(new URL(path, window.location.origin), { method, headers: { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body) });

const tile = (name: string) => screen.findByRole('region', { name });

describe('account overview (F-017)', () => {
  it('sends guests to sign in first', async () => {
    const { location } = renderRoute('/account');
    await waitFor(() => expect(location().pathname).toBe('/login'));
    expect(location().search).toBe('?returnTo=%2Faccount');
  });

  it('shows the profile: initials, name, email, masked mobile and member since', async () => {
    addUser(KARAN, { signedIn: true });
    renderRoute('/account');
    const profile = await screen.findByRole('region', { name: 'Profile' });
    expect(within(profile).getByText('KA')).toBeInTheDocument();
    expect(within(profile).getByText('Karan Aneja')).toBeInTheDocument();
    expect(within(profile).getByText('karan@example.com')).toBeInTheDocument();
    expect(within(profile).getByText('Mobile ••••••3210')).toBeInTheDocument();
    expect(within(profile).getByText('Member since Mar 2026')).toBeInTheDocument();
    expect(within(profile).getByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });

  it('leaves the mobile out when there is none', async () => {
    addUser({ ...KARAN, mobile: null }, { signedIn: true });
    renderRoute('/account');
    const profile = await screen.findByRole('region', { name: 'Profile' });
    expect(within(profile).queryByText(/Mobile/)).not.toBeInTheDocument();
  });

  it('shows an empty state with one link in each tile, and no recently viewed section', async () => {
    addUser(KARAN, { signedIn: true });
    renderRoute('/account');
    const order = await tile('Latest order');
    expect(await within(order).findByText('No orders yet')).toBeInTheDocument();
    expect(within(order).getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/products');
    const address = await tile('Default address');
    expect(await within(address).findByText('No saved address')).toBeInTheDocument();
    expect(within(address).getByRole('link', { name: 'Add address' })).toHaveAttribute('href', '/account/addresses/new?returnTo=%2Faccount');
    const wishlist = await tile('Wishlist');
    expect(await within(wishlist).findByText('Save items you like with ♡')).toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Recently viewed' })).not.toBeInTheDocument();
  });

  it('shows the latest order, default address and wishlist, each linking onward', async () => {
    addUser(KARAN, { signedIn: true });
    seedOrder({ id: 'ORD-OLDER111', createdAt: '2026-10-01T10:00:00.000Z' });
    seedOrder({ id: 'ORD-NEWER222', status: 'out_for_delivery', createdAt: '2026-10-05T10:00:00.000Z', deliveryCode: '4321' });
    await send('POST', '/api/addresses', {
      fullName: 'Karan Aneja', mobile: '9876543210', pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
    });
    await send('PUT', '/api/wishlist/items/product-1');
    await send('PUT', '/api/wishlist/items/product-2');
    renderRoute('/account');

    const order = await tile('Latest order');
    expect(await within(order).findByRole('link', { name: 'ORD-NEWER222' })).toHaveAttribute('href', '/orders/ORD-NEWER222');
    expect(within(order).queryByText('ORD-OLDER111')).not.toBeInTheDocument();
    expect(within(order).getByText(/Out for delivery/)).toBeInTheDocument();
    expect(within(order).getByText('4321')).toBeInTheDocument();
    expect(within(order).getByRole('link', { name: 'View all orders' })).toHaveAttribute('href', '/account/orders');

    const address = await tile('Default address');
    expect(await within(address).findByText('Flat 4B, Indiranagar')).toBeInTheDocument();
    expect(within(address).getByText('Bengaluru 560038')).toBeInTheDocument();
    expect(within(address).getByRole('link', { name: 'Manage' })).toHaveAttribute('href', '/account/addresses');

    const wishlist = await tile('Wishlist');
    expect(await within(wishlist).findByText('2 saved items')).toBeInTheDocument();
    expect(within(wishlist).getAllByRole('img')).toHaveLength(2);
    expect(within(wishlist).getByRole('link', { name: 'View wishlist' })).toHaveAttribute('href', '/wishlist');
  });

  it('keeps the other tiles when orders fail to load, and retries', async () => {
    addUser(KARAN, { signedIn: true });
    let fail = true;
    server.use(http.get('*/api/orders', () => (fail ? HttpResponse.json({ error: { code: 'X', message: 'x' } }, { status: 500 }) : undefined)));
    const user = userEvent.setup();
    renderRoute('/account');
    const order = await tile('Latest order');
    expect(await within(order).findByText("Couldn't load your orders.", {}, { timeout: 5000 })).toBeInTheDocument();
    expect(await within(await tile('Default address')).findByText('No saved address')).toBeInTheDocument();
    fail = false;
    await user.click(within(order).getByRole('button', { name: 'Retry' }));
    expect(await within(order).findByText('No orders yet')).toBeInTheDocument();
  });

  it('marks the current page in the account sidebar', async () => {
    addUser(KARAN, { signedIn: true });
    const { unmount } = renderRoute('/account');
    const nav = await screen.findByRole('navigation', { name: 'Account' });
    expect(within(nav).getByRole('link', { name: 'Overview' })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).getByRole('link', { name: 'Orders' })).not.toHaveAttribute('aria-current');
    expect(within(nav).getByRole('link', { name: 'Wishlist' })).toHaveAttribute('href', '/wishlist');
    unmount();

    renderRoute('/account/orders');
    const ordersNav = await screen.findByRole('navigation', { name: 'Account' });
    expect(within(ordersNav).getByRole('link', { name: 'Orders' })).toHaveAttribute('aria-current', 'page');
    expect(within(ordersNav).getByRole('link', { name: 'Overview' })).not.toHaveAttribute('aria-current');
  });
});
