import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { emiPlan, formatPrice, type Order } from '@store/shared';
import { addUser } from '@/test/authServer';
import { paymentRequests, setRazorpayEnabled, GOOD_SIGNATURE } from '@/test/paymentServer';
import { renderRoute } from '@/test/render';
import type { RazorpayOptions } from './razorpayCheckout';

/** EMI on the product page and at payment, and the Razorpay tab (F-014). */
const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };
const post = (path: string, body: unknown) =>
  fetch(new URL(path, window.location.origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

async function heldOrder(slug = 'product-2'): Promise<Order> {
  addUser(KARAN, { signedIn: true });
  await post('/api/addresses', {
    fullName: 'Karan Aneja', mobile: '9876543210', pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
  });
  await post('/api/cart/lines', { productSlug: slug, quantity: 1 });
  const address = (await (await fetch(new URL('/api/addresses', window.location.origin))).json()) as { addresses: { id: number }[] };
  return ((await (await post('/api/orders', { addressId: address.addresses[0]!.id, delivery: 'standard' })).json()) as { order: Order }).order;
}

async function enterCard(user: UserEvent, number: string) {
  await user.type(screen.getByLabelText('Card number'), number);
  await user.type(screen.getByLabelText('Expiry (MM/YY)'), '1230');
  await user.type(screen.getByLabelText('CVV'), '123');
}

const ZENBOOK = 80_000_00;

describe('EMI on the product page', () => {
  it('shows the lowest monthly amount and No Cost EMI, with the plans per bank', async () => {
    const user = userEvent.setup();
    renderRoute('/p/product-2'); // Zenbook ₹80,000
    const line = await screen.findByText(/EMI from/);
    expect(line.parentElement).toHaveTextContent(`EMI from ${formatPrice(emiPlan('aurora', ZENBOOK, 12, false).monthlyPaise)}/month · No Cost EMI available`);
    await user.click(screen.getByRole('button', { name: 'View plans' }));
    const dialog = await screen.findByRole('dialog', { name: 'EMI plans' });
    expect(within(dialog).getByRole('heading', { name: 'Kestrel Bank · 16% p.a.' })).toBeInTheDocument();
    expect(within(dialog).getAllByText('No Cost')).toHaveLength(6);
  });

  it('is hidden below ₹3,000', async () => {
    renderRoute('/p/usb-cable'); // ₹1,200
    await screen.findByRole('heading', { level: 1, name: 'USB Cable' });
    expect(screen.queryByText(/EMI from/)).not.toBeInTheDocument();
  });
});

describe('EMI at payment', () => {
  it('pays No Cost EMI: the bank offer gives way, the summary shows the discount and plan, and only the plan is sent', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    const { location } = renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('radio', { name: /Aurora Bank — 10% instant discount/ }));
    await enterCard(user, '4242424242424242');

    await user.click(await screen.findByRole('radio', { name: 'Pay in EMI' }));
    const plans = screen.getByRole('group', { name: 'EMI plans from Aurora Bank (demo)' });
    const noCost = emiPlan('aurora', ZENBOOK, 6, true);
    const planText = `6 × ${formatPrice(noCost.monthlyPaise)}/month (last ${formatPrice(noCost.lastMonthlyPaise)})`;
    expect(noCost.monthlyPaise * 5 + noCost.lastMonthlyPaise).toBe(ZENBOOK);
    await user.click(within(plans).getByRole('radio', { name: new RegExp(`^${planText.replace(/[()]/g, '\\$&')} No Cost`) }));

    expect(screen.getByText('No Cost EMI is this order’s offer, so the bank offer was removed.')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'No offer' })).toBeChecked();
    const summary = screen.getByRole('region', { name: 'Order summary' });
    expect(within(summary).getByText('No Cost EMI discount').nextSibling).toHaveTextContent(`−${formatPrice(noCost.discountPaise)}`);
    expect(within(summary).getByText('Charged today').nextSibling).toHaveTextContent(formatPrice(noCost.chargedPaise));
    expect(within(summary).getByText(planText)).toBeInTheDocument();

    await user.click(screen.getAllByRole('button', { name: `Pay ${formatPrice(noCost.chargedPaise)}` })[0]!);
    const verification = await screen.findByRole('region', { name: 'Demo bank verification' });
    expect(paymentRequests.at(-1)).toMatchObject({ method: 'card', bin: '424242', last4: '4242', emi: { tenure: 6, noCost: true } });
    expect(paymentRequests.at(-1)).not.toHaveProperty('offerId');
    await user.type(within(verification).getByLabelText('6-digit code'), within(verification).getByText(/^\d{6}$/).textContent!);

    await waitFor(() => expect(location().pathname).toBe(`/orders/${order.id}/confirmation`));
    expect(await screen.findByText(planText)).toBeInTheDocument();
    expect(screen.getByText('No Cost EMI — no interest')).toBeInTheDocument();
    expect(screen.getByText(`incl. ${formatPrice(noCost.discountPaise)} No Cost EMI discount`)).toBeInTheDocument();
  });

  it('asks for a plan before paying in EMI, and keeps EMI for credit cards of the demo banks', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await screen.findByRole('radio', { name: 'No offer' });
    await enterCard(user, '4000500000001009'); // Aurora debit
    expect(await screen.findByText('EMI is available on credit cards only.')).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Pay in EMI' })).not.toBeInTheDocument();

    await user.clear(screen.getByLabelText('Card number'));
    await user.type(screen.getByLabelText('Card number'), '5105105105105100'); // Meridian credit
    await user.click(await screen.findByRole('radio', { name: 'Pay in EMI' }));
    await user.click(screen.getAllByRole('button', { name: /^Pay ₹/ })[0]!);
    expect(screen.getByRole('alert')).toHaveTextContent('Choose an EMI plan');
    expect(paymentRequests).toHaveLength(0);
  });
});

describe('Razorpay tab', () => {
  afterEach(() => {
    delete window.Razorpay;
  });

  /** Stands in for Razorpay Checkout: records the options and lets the test act as the customer. */
  function stubCheckout() {
    const opened: RazorpayOptions[] = [];
    window.Razorpay = class {
      constructor(readonly options: RazorpayOptions) {}
      open() {
        opened.push(this.options);
      }
    } as unknown as Window['Razorpay'];
    return opened;
  }

  it('is hidden unless Razorpay is configured', async () => {
    const order = await heldOrder();
    renderRoute(`/checkout/pay/${order.id}`);
    await screen.findByRole('tab', { name: 'UPI' });
    expect(screen.queryByRole('tab', { name: 'Razorpay' })).not.toBeInTheDocument();
  });

  it('opens Checkout with the order, and confirms only after the server verifies', async () => {
    setRazorpayEnabled(true);
    const opened = stubCheckout();
    const order = await heldOrder();
    const user = userEvent.setup();
    const { location } = renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('tab', { name: 'Razorpay' }));
    expect(screen.getByText('Razorpay · test mode — no real money')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: `Pay ${formatPrice(ZENBOOK)} with Razorpay` }));
    await waitFor(() => expect(opened).toHaveLength(1));
    const options = opened[0]!;
    expect(options).toMatchObject({ key: 'rzp_test_mock', amount: ZENBOOK, currency: 'INR', prefill: { email: 'karan@example.com' } });
    expect(screen.getByRole('button', { name: 'Complete the payment in the Razorpay window' })).toBeDisabled();

    options.handler({ razorpay_payment_id: 'pay_mock1', razorpay_order_id: options.order_id, razorpay_signature: GOOD_SIGNATURE });
    await waitFor(() => expect(location().pathname).toBe(`/orders/${order.id}/confirmation`));
    expect(await screen.findByText('Razorpay · Visa •••• 1111')).toBeInTheDocument();
    expect(screen.getByText('Razorpay test mode — no real money was charged.')).toBeInTheDocument();
  });

  it('shows a plain message when the verification fails, and lets the customer close Checkout and try again', async () => {
    setRazorpayEnabled(true);
    const opened = stubCheckout();
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('tab', { name: 'Razorpay' }));
    const payWith = `Pay ${formatPrice(ZENBOOK)} with Razorpay`;

    await user.click(screen.getByRole('button', { name: payWith }));
    await waitFor(() => expect(opened).toHaveLength(1));
    opened[0]!.handler({ razorpay_payment_id: 'pay_x', razorpay_order_id: opened[0]!.order_id, razorpay_signature: 'b'.repeat(64) });
    expect(await screen.findByText(/We couldn't confirm this payment with Razorpay/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: payWith }));
    await waitFor(() => expect(opened).toHaveLength(2));
    opened[1]!.modal.ondismiss();
    expect(await screen.findByRole('button', { name: payWith })).toBeEnabled();
  });

  it('explains when Razorpay cannot be loaded', async () => {
    setRazorpayEnabled(true);
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('tab', { name: 'Razorpay' }));
    const pay = user.click(screen.getByRole('button', { name: `Pay ${formatPrice(ZENBOOK)} with Razorpay` }));
    // jsdom doesn't fetch scripts: fail the one the page added, as a blocked network would.
    await waitFor(() => expect(document.querySelector('script[src*="checkout.razorpay.com"]')).not.toBeNull());
    document.querySelector('script[src*="checkout.razorpay.com"]')!.dispatchEvent(new Event('error'));
    await pay;
    expect(await screen.findByText(/Razorpay couldn't be loaded/)).toBeInTheDocument();
    expect(paymentRequests).toHaveLength(0);
  });
});
