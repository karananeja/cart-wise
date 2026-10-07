import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flush } from '@/lib/analytics';
import { resetDeliveryPincodeCache, saveDeliveryPincode } from '@/lib/deliveryPincode';
import { addUser } from '@/test/authServer';
import { renderRoute } from '@/test/render';
import { receivedEvents } from '@/test/server';

const post = (path: string, body: unknown) =>
  fetch(new URL(path, window.location.origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

beforeEach(async () => {
  flush();
  await new Promise((resolve) => setTimeout(resolve, 20));
  receivedEvents.length = 0;
  localStorage.clear();
  resetDeliveryPincodeCache();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-06T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

const panel = () => screen.findByRole('region', { name: 'Delivery' });

async function check(pincode: string) {
  const user = userEvent.setup();
  renderRoute('/p/product-1'); // MacBook Pro, over ₹999: Standard is free
  const region = await panel();
  await user.type(within(region).getByLabelText('Check delivery to your pincode'), pincode);
  await user.click(within(region).getByRole('button', { name: 'Check' }));
  return { user, region };
}

describe('DeliveryCheck (F-015)', () => {
  it('shows metro dates for both options and records the check without the pincode', async () => {
    const { region } = await check('560 038');
    expect(within(region).getByText('560038')).toBeInTheDocument();
    expect(within(region).getByText(/Arrives by Fri, 9 Oct · Free/)).toBeInTheDocument();
    expect(within(region).getByText(/Arrives by Thu, 8 Oct · ₹149/)).toBeInTheDocument();
    expect(localStorage.getItem('store.deliveryPincode')).toBe('560038');

    flush();
    await waitFor(() =>
      expect(receivedEvents.find((e) => e.name === 'delivery_check_performed')?.properties).toEqual({
        zone: 'metro',
        serviceable: true,
        expressAvailable: true,
        source: 'typed',
      }),
    );
  });

  it('says Express is not available in a remote area', async () => {
    const { region } = await check('795001');
    expect(within(region).getByText(/Arrives by Thu, 15 Oct · Free/)).toBeInTheDocument();
    expect(within(region).getByText('Express not available here')).toBeInTheDocument();
  });

  it("says when it can't deliver, and still allows Add to cart", async () => {
    const { region } = await check('744101');
    expect(within(region).getByText("We don't deliver to 744101 yet.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add to cart/ })).toBeEnabled();
  });

  it('asks for a 6-digit pincode', async () => {
    const { region } = await check('012345');
    expect(within(region).getByText('Enter a 6-digit pincode')).toBeInTheDocument();
    expect(within(region).getByLabelText('Check delivery to your pincode')).toHaveAttribute('aria-invalid', 'true');
  });

  it('remembers the pincode and lets the shopper change it', async () => {
    saveDeliveryPincode('302001');
    const user = userEvent.setup();
    renderRoute('/p/product-1');
    const region = await panel();
    expect(within(region).getByText('302001')).toBeInTheDocument();
    expect(within(region).getByText(/Arrives by Sun, 11 Oct · Free/)).toBeInTheDocument();

    await user.click(within(region).getByRole('button', { name: 'Change pincode 302001' }));
    const input = within(region).getByLabelText('Check delivery to your pincode');
    await user.clear(input);
    await user.type(input, '110001{Enter}');
    expect(within(region).getByText('110001')).toBeInTheDocument();
  });

  it("starts a signed-in shopper from their default address's pincode", async () => {
    addUser({ name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' }, { signedIn: true });
    await post('/api/addresses', {
      fullName: 'Karan Aneja', mobile: '9876543210', pincode: '400001', line1: 'Flat 4B', line2: 'Fort', landmark: '', city: 'Mumbai', state: 'Maharashtra', type: 'home', latitude: null, longitude: null,
    });
    renderRoute('/p/product-1');
    const region = await panel();
    expect(await within(region).findByText('400001')).toBeInTheDocument();
  });
});
