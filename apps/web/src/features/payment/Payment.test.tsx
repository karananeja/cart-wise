import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Order } from '@store/shared';
import { addUser } from '@/test/authServer';
import { view as cartView } from '@/test/cartServer';
import { getOrder } from '@/test/checkoutServer';
import { paymentRequests } from '@/test/paymentServer';
import { renderRoute } from '@/test/render';

const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };

const post = (path: string, body: unknown) =>
  fetch(new URL(path, window.location.origin), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

/** A signed-in customer with a held order for `slug`; returns the order. */
async function heldOrder(slug = 'product-2'): Promise<Order> {
  addUser(KARAN, { signedIn: true });
  await post('/api/addresses', {
    fullName: 'Karan Aneja', mobile: '9876543210', pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null,
  });
  await post('/api/cart/lines', { productSlug: slug, quantity: 1 });
  const address = (await (await fetch(new URL('/api/addresses', window.location.origin))).json()) as { addresses: { id: number }[] };
  const res = await post('/api/orders', { addressId: address.addresses[0]!.id, delivery: 'standard' });
  return ((await res.json()) as { order: Order }).order;
}

async function enterCard(user: UserEvent, number: string) {
  await user.type(screen.getByLabelText('Card number'), number);
  await user.type(screen.getByLabelText('Expiry (MM/YY)'), '1230');
  await user.type(screen.getByLabelText('CVV'), '123');
}

const payButton = (name: RegExp | string) => screen.getAllByRole('button', { name })[0]!;

describe('card payment', () => {
  it('applies the chosen offer, sends only the first 6 and last 4 digits, verifies and confirms', async () => {
    const order = await heldOrder(); // Zenbook ₹80,000, free delivery
    const user = userEvent.setup();
    const { location } = renderRoute(`/checkout/pay/${order.id}`);

    expect(await screen.findByText(/Demo payment — no money is charged/)).toBeInTheDocument();
    const aurora = screen.getByRole('radio', { name: /Aurora Bank — 10% instant discount/ });
    expect(aurora).not.toBeChecked();
    expect(screen.getByRole('radio', { name: 'No offer' })).not.toBeChecked();
    await user.click(aurora);
    await enterCard(user, '4242424242424242');

    expect(await screen.findByText('Aurora Bank offer: −₹1,500')).toBeInTheDocument();
    expect(screen.getByText('Aurora Bank · Visa credit')).toBeInTheDocument();
    const summary = screen.getByRole('region', { name: 'Order summary' });
    await waitFor(() => expect(within(summary).getByText('Bank offer (Aurora Bank)')).toBeInTheDocument());
    await user.click(payButton('Pay ₹78,500'));

    const verification = await screen.findByRole('region', { name: 'Demo bank verification' });
    expect(paymentRequests).toHaveLength(1);
    const sent = paymentRequests[0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['bin', 'last4', 'method', 'offerId', 'visitorId']);
    expect(sent).toMatchObject({ method: 'card', bin: '424242', last4: '4242', offerId: 'aurora-credit-10' });
    expect(JSON.stringify(sent)).not.toMatch(/4242424242424242|1230|12\/30|"123"/);

    const code = within(verification).getByText(/^\d{6}$/).textContent!;
    await user.type(within(verification).getByLabelText('6-digit code'), code);

    await waitFor(() => expect(location().pathname).toBe(`/orders/${order.id}/confirmation`));
    expect(await screen.findByRole('heading', { name: 'Order confirmed' })).toBeInTheDocument();
    expect(screen.getByText('Aurora Bank Visa •••• 4242')).toBeInTheDocument();
    expect(screen.getByText('₹78,500')).toBeInTheDocument();
    expect(screen.getByText(/incl. ₹1,500 bank offer/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Continue shopping' })).toHaveAttribute('href', '/');
    expect(cartView().lines).toHaveLength(0);
  });

  it('explains a chosen offer that does not match the card, and offers the one it qualifies for', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('radio', { name: /Aurora Bank/ }));
    await enterCard(user, '5105105105105100'); // Meridian Mastercard credit

    expect(await screen.findByText(/This offer needs an Aurora Bank credit card\./)).toBeInTheDocument();
    expect(payButton(/^Pay /)).toHaveTextContent('Pay ₹80,000');
    expect(screen.getByText(/Your card qualifies for the Meridian Bank offer \(−₹250\)/)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Apply' }));
    expect(screen.getByRole('radio', { name: /Meridian Bank/ })).toBeChecked();
    await waitFor(() => expect(payButton(/^Pay /)).toHaveTextContent('Pay ₹79,750'));
  });

  it('suggests the matching offer when none is chosen', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await screen.findByRole('radio', { name: /Aurora Bank/ });
    await enterCard(user, '4242424242424242');
    expect(await screen.findByText(/Your card qualifies for the Aurora Bank offer \(−₹1,500\)/)).toBeInTheDocument();
    expect(payButton(/^Pay /)).toHaveTextContent('Pay ₹80,000');
  });

  it('disables offers the order does not reach, with how much more is needed', async () => {
    const order = await heldOrder('usb-cable'); // ₹1,200
    renderRoute(`/checkout/pay/${order.id}`);
    const aurora = await screen.findByRole('radio', { name: /Aurora Bank/ });
    await waitFor(() => expect(aurora).toBeDisabled());
    expect(screen.getByText('Add ₹3,800 more to qualify')).toBeInTheDocument();
    expect(screen.getByText('Add ₹1,300 more to qualify')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /Kestrel Bank/ })).toBeEnabled();
    expect(screen.getByText('Save ₹60')).toBeInTheDocument();
  });

  it('refuses an invalid card number in the browser', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await screen.findByLabelText('Card number');
    await enterCard(user, '4242424242424241');
    await user.click(payButton(/^Pay /));
    expect(await screen.findByText('Enter a valid card number')).toBeInTheDocument();
    expect(paymentRequests).toHaveLength(0);
  });

  it('fails a declined card with its reason; Try again keeps everything', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await screen.findByLabelText('Card number');
    await enterCard(user, '4000000000000002');
    await user.click(payButton(/^Pay /));
    const verification = await screen.findByRole('region', { name: 'Demo bank verification' });
    await user.type(within(verification).getByLabelText('6-digit code'), within(verification).getByText(/^\d{6}$/).textContent!);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Payment failed');
    expect(alert).toHaveTextContent('Your bank declined this payment.');
    expect(getOrder(order.id)!.status).toBe('pending_payment');
    expect(cartView().lines).toHaveLength(1);
    await user.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Card number')).toHaveValue('4000 0000 0000 0002');
  });

  it('counts wrong codes and fails after three', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await screen.findByLabelText('Card number');
    await enterCard(user, '4242424242424242');
    await user.click(payButton(/^Pay /));
    await screen.findByRole('region', { name: 'Demo bank verification' });

    await user.type(screen.getByLabelText('6-digit code'), '000000');
    expect(await screen.findByText('That code is not right. 2 attempts left.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('6-digit code'), '000000');
    expect(await screen.findByText('That code is not right. 1 attempt left.')).toBeInTheDocument();
    await user.type(screen.getByLabelText('6-digit code'), '000000');
    expect(await screen.findByRole('alert')).toHaveTextContent('Verification failed — too many wrong codes.');
  });

  it('cancelling verification returns to the card form without an error', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await screen.findByLabelText('Card number');
    await enterCard(user, '4242424242424242');
    await user.click(payButton(/^Pay /));
    await screen.findByRole('region', { name: 'Demo bank verification' });
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByLabelText('Card number')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('UPI payment', () => {
  it('sends a request to a UPI ID and confirms when approved in the demo app', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    const { location } = renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('tab', { name: 'UPI' }));
    expect(screen.getByText("Bank card offers don't apply to UPI payments.")).toBeInTheDocument();

    await user.type(screen.getByLabelText('UPI ID'), 'karan');
    await user.click(screen.getByRole('button', { name: 'Send payment request' }));
    expect(await screen.findByText('Enter a UPI ID like name@bank')).toBeInTheDocument();
    await user.type(screen.getByLabelText('UPI ID'), '@okdemo');
    await user.click(screen.getByRole('button', { name: 'Send payment request' }));

    expect(await screen.findByRole('heading', { name: 'Approve the request in your UPI app' })).toBeInTheDocument();
    expect(screen.getByText(/Request sent to karan@okdemo/)).toHaveTextContent(/Request sent to karan@okdemo · ₹80,000 · expires in (4:5\d|5:00)/);
    await user.click(screen.getByRole('button', { name: 'Open demo UPI app' }));
    const app = await screen.findByRole('dialog', { name: 'Payment request' });
    expect(within(app).getByText('₹80,000')).toBeInTheDocument();
    await user.click(within(app).getByRole('button', { name: 'Approve' }));

    await waitFor(() => expect(location().pathname).toBe(`/orders/${order.id}/confirmation`));
    expect(await screen.findByText('UPI · karan@okdemo')).toBeInTheDocument();
  });

  it('shows the reason when the request is declined', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('tab', { name: 'UPI' }));
    await user.type(screen.getByLabelText('UPI ID'), 'karan@okdemo');
    await user.click(screen.getByRole('button', { name: 'Send payment request' }));
    await user.click(await screen.findByRole('button', { name: 'Open demo UPI app' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Decline' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('You declined the request.');
    expect(screen.getByLabelText('UPI ID')).toBeInTheDocument();
  });

  it('withdraws a request with Cancel request', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('tab', { name: 'UPI' }));
    await user.type(screen.getByLabelText('UPI ID'), 'karan@okdemo');
    await user.click(screen.getByRole('button', { name: 'Send payment request' }));
    await user.click(await screen.findByRole('button', { name: 'Cancel request' }));
    expect(await screen.findByRole('button', { name: 'Send payment request' })).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows a demo QR code and confirms after a simulated scan', async () => {
    const order = await heldOrder();
    const user = userEvent.setup();
    const { location } = renderRoute(`/checkout/pay/${order.id}`);
    await user.click(await screen.findByRole('tab', { name: 'UPI' }));
    await user.click(screen.getByRole('radio', { name: 'Scan QR code' }));
    await user.click(screen.getByRole('button', { name: 'Show QR code' }));

    expect(await screen.findByRole('img', { name: `Demo UPI QR code to pay ₹80,000 for order ${order.id}` })).toBeInTheDocument();
    expect(screen.getByText(`demo-payment://pay?orderId=${order.id}&amount=80000.00`)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Simulate scan' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Approve' }));
    await waitFor(() => expect(location().pathname).toBe(`/orders/${order.id}/confirmation`));
  });
});

describe('after payment', () => {
  it('sends a paid order from the payment page to its confirmation', async () => {
    const order = await heldOrder();
    const start = await post(`/api/orders/${order.id}/payments`, { method: 'upi_id', upiId: 'karan@okdemo' });
    const { attempt } = (await start.json()) as { attempt: { id: string } };
    await post(`/api/payments/${attempt.id}/upi-response`, { approve: true });

    const { location } = renderRoute(`/checkout/pay/${order.id}`);
    await waitFor(() => expect(location().pathname).toBe(`/orders/${order.id}/confirmation`));
    expect(await screen.findByRole('heading', { name: 'Order confirmed' })).toBeInTheDocument();
  });

  it('shows not found for an unknown order confirmation', async () => {
    addUser(KARAN, { signedIn: true });
    renderRoute('/orders/ORD-NOPE/confirmation');
    expect(await screen.findByRole('heading', { name: "We couldn't find that order" })).toBeInTheDocument();
  });
});
