import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@/lib/analytics';
import { addUser } from '@/test/authServer';
import { expireOrder } from '@/test/checkoutServer';
import { setStock } from '@/test/cartServer';
import { renderRoute } from '@/test/render';
import { receivedEvents } from '@/test/server';

vi.mock('@/features/addresses/MapView', () => ({ default: () => <div>Map</div> }));

const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };

const post = (path: string, body: unknown) =>
  fetch(new URL(path, window.location.origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

const address = (line1: string, pincode = '560038') => ({
  fullName: 'Karan Aneja', mobile: '9876543210', pincode, line1, line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
});

beforeEach(async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
});

async function signedInWithCart({ addresses = ['Flat 4B'], pincode }: { addresses?: string[]; pincode?: string } = {}) {
  addUser(KARAN, { signedIn: true });
  for (const line1 of addresses) await post('/api/addresses', address(line1, pincode));
  await post('/api/cart/lines', { productSlug: 'product-2', quantity: 1 }); // Zenbook ₹80,000
}

describe('entering checkout', () => {
  it('sends guests to sign in and back to checkout', async () => {
    await post('/api/cart/lines', { productSlug: 'product-2' });
    const user = userEvent.setup();
    const { location } = renderRoute('/cart');
    // The summary and the mobile bar both carry the button (CSS shows one); use the first.
    await user.click((await screen.findAllByRole('link', { name: 'Proceed to checkout' }))[0]!);
    await waitFor(() => expect(location().pathname).toBe('/login'));
    expect(location().search).toBe('?returnTo=%2Fcheckout');
  });

  it('disables Proceed to checkout while the cart has problems', async () => {
    await post('/api/cart/lines', { productSlug: 'product-2', quantity: 3 });
    setStock('product-2', null, 1);
    renderRoute('/cart');
    const buttons = await screen.findAllByRole('button', { name: 'Proceed to checkout' });
    expect(buttons[0]).toBeDisabled();
    expect(screen.getAllByText('Fix the highlighted items to continue.').length).toBeGreaterThan(0);
  });
});

describe('checkout page', () => {
  it('preselects the default address and Standard, and shows the summary', async () => {
    await signedInWithCart();
    renderRoute('/checkout');
    const addressSection = await screen.findByRole('region', { name: 'Delivery address' });
    expect(within(addressSection).getByText(/Flat 4B, Indiranagar/)).toBeInTheDocument();
    expect(within(addressSection).getByText('Default')).toBeInTheDocument();

    const delivery = screen.getByRole('region', { name: 'Delivery' });
    expect(within(delivery).getByRole('radio', { name: /Standard/ })).toBeChecked();
    expect(within(delivery).getByText('Arrives Thu, 8 Oct – Fri, 9 Oct')).toBeInTheDocument();

    const summary = screen.getByRole('region', { name: 'Order summary' });
    expect(within(summary).getByText('Free')).toBeInTheDocument();
    expect(within(summary).getAllByText('₹80,000').length).toBeGreaterThan(0);
    expect(within(summary).getByText('Inclusive of all taxes')).toBeInTheDocument();

    flush();
    await waitFor(() => expect(receivedEvents.find((e) => e.name === 'checkout_started')?.properties).toEqual({ itemCount: 1, subtotalPaise: 80_000_00 }));
  });

  it('switches to Express and updates the total', async () => {
    await signedInWithCart();
    const user = userEvent.setup();
    const { location } = renderRoute('/checkout');
    await user.click(await screen.findByRole('radio', { name: /Express/ }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Order summary' })).getByText('₹149')).toBeInTheDocument());
    expect(location().search).toContain('delivery=express');
  });

  it('changes to another saved address', async () => {
    await signedInWithCart({ addresses: ['Flat 4B', 'Office Tower'] });
    const user = userEvent.setup();
    const { location } = renderRoute('/checkout');
    await user.click(await screen.findByRole('button', { name: 'Change' }));
    await user.click(await screen.findByRole('radio', { name: /Office Tower/ }));
    await waitFor(() => expect(within(screen.getByRole('region', { name: 'Delivery address' })).getByText(/Office Tower/)).toBeInTheDocument());
    expect(location().search).toMatch(/addressId=\d+/);
  });

  it('asks for an address when there is none, keeping checkout as the return', async () => {
    await signedInWithCart({ addresses: [] });
    renderRoute('/checkout?delivery=express');
    const add = await screen.findByRole('link', { name: 'Add delivery address' });
    expect(add.getAttribute('href')).toBe('/account/addresses/new?returnTo=%2Fcheckout%3Fdelivery%3Dexpress');
    expect(screen.getAllByRole('button', { name: 'Continue to payment' })[0]).toBeDisabled();
  });

  it('continues to payment, showing the hold countdown, and cancel returns to the cart', async () => {
    await signedInWithCart();
    const user = userEvent.setup();
    const { location } = renderRoute('/checkout');
    await user.click((await screen.findAllByRole('button', { name: 'Continue to payment' }))[0]!);

    await waitFor(() => expect(location().pathname).toBe('/checkout/pay/ORD-TEST0001'));
    expect(await screen.findByRole('heading', { name: 'Payment' })).toBeInTheDocument();
    expect(screen.getByText(/We're holding your items for/)).toHaveTextContent(/(9:5\d|10:00)/);

    await user.click(screen.getByRole('button', { name: 'Cancel and return to cart' }));
    await waitFor(() => expect(location().pathname).toBe('/cart'));
    expect(await screen.findByText('Order cancelled. Nothing was charged and your cart is unchanged.')).toBeInTheDocument();
  });

  it('sends the customer back to the cart when items changed', async () => {
    await signedInWithCart();
    const user = userEvent.setup();
    const { location } = renderRoute('/checkout');
    await screen.findAllByRole('button', { name: 'Continue to payment' });
    setStock('product-2', null, 0);
    await user.click(screen.getAllByRole('button', { name: 'Continue to payment' })[0]!);
    await waitFor(() => expect(location().pathname).toBe('/cart'));
    expect(await screen.findByText(/Some items changed while you were checking out/)).toBeInTheDocument();
  });
});

describe('payment page', () => {
  it('explains an expired hold', async () => {
    await signedInWithCart();
    const user = userEvent.setup();
    const { router } = renderRoute('/checkout');
    await user.click((await screen.findAllByRole('button', { name: 'Continue to payment' }))[0]!);
    await screen.findByRole('heading', { name: 'Payment' });
    expireOrder('ORD-TEST0001');
    await router.navigate('/cart');
    await screen.findByRole('heading', { name: /Your cart/ });
    await router.navigate('/checkout/pay/ORD-TEST0001');
    // The cached order shows first, then the refetch brings the expired status.
    expect(await screen.findByRole('heading', { name: 'Your hold expired' }, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to cart' })).toBeInTheDocument();
  });

  it('shows not found for unknown orders', async () => {
    addUser(KARAN, { signedIn: true });
    renderRoute('/checkout/pay/ORD-NOPE');
    expect(await screen.findByRole('heading', { name: "We couldn't find that order" })).toBeInTheDocument();
  });
});

describe('delivery zones (F-015)', () => {
  it('offers a remote address Standard only and moves an Express choice to Standard', async () => {
    await signedInWithCart({ pincode: '795001' });
    renderRoute('/checkout?delivery=express');
    const delivery = await screen.findByRole('region', { name: 'Delivery' });
    expect(await within(delivery).findByText("Express isn't available for this address, so Standard is selected.")).toBeInTheDocument();
    expect(within(delivery).getAllByRole('radio').map((r) => r.getAttribute('value'))).toEqual(['standard']);
    expect(within(delivery).getByRole('radio', { name: /Standard/ })).toBeChecked();
    expect(within(delivery).getByText('Arrives Mon, 12 Oct – Thu, 15 Oct')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Continue to payment' })[0]).toBeEnabled();
  });

  it("says when an address can't be served and keeps Continue disabled", async () => {
    await signedInWithCart({ pincode: '744101' });
    renderRoute('/checkout');
    const addressSection = await screen.findByRole('region', { name: 'Delivery address' });
    expect(within(addressSection).getByText("We don't deliver to this pincode yet")).toBeInTheDocument();
    expect(screen.getByText('Choose an address we deliver to, or add a new one.')).toBeInTheDocument();
    for (const button of screen.getAllByRole('button', { name: 'Continue to payment' })) expect(button).toBeDisabled();
  });
});
