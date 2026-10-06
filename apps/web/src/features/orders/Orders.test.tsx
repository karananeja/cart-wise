import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { addUser } from '@/test/authServer';
import { getOrder } from '@/test/checkoutServer';
import { seedOrder } from '@/test/ordersServer';
import { renderRoute } from '@/test/render';
import { server } from '@/test/server';

const KARAN = { name: 'Karan Aneja', email: 'karan@example.com', mobile: '9876543210', password: 'correct horse battery' };
const DAY = 24 * 60 * 60 * 1000;
const ago = (ms: number) => new Date(Date.now() - ms).toISOString();

const history = (...steps: string[]) =>
  [{ status: 'payment_successful', at: ago(5 * DAY) }, ...steps.map((status) => ({ status, at: ago(4 * DAY) }))] as never;

describe('Your orders', () => {
  it('shows an empty state with no orders', async () => {
    addUser(KARAN, { signedIn: true });
    renderRoute('/account/orders');
    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Start shopping' })).toHaveAttribute('href', '/');
  });

  it('lists paid orders newest first, with status, total, delivery code and Show more', async () => {
    addUser(KARAN, { signedIn: true });
    for (let i = 1; i <= 11; i += 1) seedOrder({ id: `ORD-LIST00${String(i).padStart(2, '0')}`, createdAt: ago(i * DAY) });
    seedOrder({ id: 'ORD-OUTNOW01', createdAt: ago(0), status: 'out_for_delivery', deliveryCode: '4831', history: history('confirmed', 'processing', 'shipped', 'out_for_delivery') });
    const user = userEvent.setup();
    renderRoute('/account/orders');

    const cards = await screen.findAllByRole('article');
    expect(cards).toHaveLength(10);
    expect(within(cards[0]!).getByRole('link', { name: 'ORD-OUTNOW01' })).toHaveAttribute('href', '/orders/ORD-OUTNOW01');
    expect(within(cards[0]!).getByText(/Out for delivery · arrives/)).toBeInTheDocument();
    expect(within(cards[0]!).getByRole('img', { name: 'delivery code 4 8 3 1' })).toBeInTheDocument();
    expect(within(cards[1]!).getByText('₹6,400')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show more' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(12));
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('sends guests to sign in', async () => {
    const { location } = renderRoute('/account/orders');
    await waitFor(() => expect(location().pathname).toBe('/login'));
    expect(location().search).toBe('?returnTo=%2Faccount%2Forders');
  });
});

describe('order page', () => {
  it('shows the timeline, payment and items, and cancels with an immediate refund', async () => {
    addUser(KARAN, { signedIn: true });
    seedOrder({ id: 'ORD-CANCEL01', status: 'processing', history: history('confirmed', 'processing') });
    const user = userEvent.setup();
    renderRoute('/orders/ORD-CANCEL01');

    const progress = await screen.findByRole('list', { name: 'Order progress' });
    const steps = within(progress).getAllByRole('listitem');
    expect(steps.map((s) => s.textContent?.split(' — ')[0])).toEqual(['Order confirmed', 'Processing', 'Shipped', 'Out for delivery', 'Delivered']);
    expect(steps[1]).toHaveAttribute('aria-current', 'step');
    expect(within(steps[3]!).getByText(/Not yet/)).toBeInTheDocument();
    expect(screen.getByText('Aurora Bank Visa •••• 4242')).toBeInTheDocument();
    expect(screen.getByText('−₹600')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Cancel order' }));
    const dialog = await screen.findByRole('dialog', { name: 'Cancel this order?' });
    expect(dialog).toHaveTextContent('₹6,400 will be refunded to Aurora Bank Visa •••• 4242 straight away');
    await user.selectOptions(within(dialog).getByLabelText('Reason (optional)'), 'changed_mind');
    await user.click(within(dialog).getByRole('button', { name: 'Yes, cancel order' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByText(/₹6,400 refunded to Aurora Bank Visa •••• 4242 on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    const after = within(screen.getByRole('list', { name: 'Order progress' })).getAllByRole('listitem');
    expect(after.map((s) => s.textContent?.split(' — ')[0])).toEqual(['Order confirmed', 'Processing', 'Cancelled']);
    expect(getOrder('ORD-CANCEL01')?.cancelReason).toBe('changed_mind');
  });

  it('explains when the order shipped meanwhile', async () => {
    addUser(KARAN, { signedIn: true });
    seedOrder({ id: 'ORD-RACE0001' });
    server.use(http.post('*/api/orders/:id/cancel', () => HttpResponse.json({ error: { code: 'NOT_CANCELLABLE', message: 'x' } }, { status: 409 })));
    const user = userEvent.setup();
    renderRoute('/orders/ORD-RACE0001');
    await user.click(await screen.findByRole('button', { name: 'Cancel order' }));
    await user.click(await screen.findByRole('button', { name: 'Yes, cancel order' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This order has just shipped, so it can no longer be cancelled.');
  });

  it('offers no cancel once shipped, and shows the delivery code when out for delivery', async () => {
    addUser(KARAN, { signedIn: true });
    seedOrder({ id: 'ORD-SHIP0001', status: 'shipped', history: history('confirmed', 'processing', 'shipped') });
    seedOrder({ id: 'ORD-OFD00001', status: 'out_for_delivery', deliveryCode: '2719', history: history('confirmed', 'processing', 'shipped', 'out_for_delivery') });
    const first = renderRoute('/orders/ORD-SHIP0001');
    expect(await screen.findByText(/You can return items once it's delivered/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cancel order' })).not.toBeInTheDocument();
    first.unmount();

    renderRoute('/orders/ORD-OFD00001');
    expect(await screen.findByRole('img', { name: 'delivery code 2 7 1 9' })).toBeInTheDocument();
    expect(screen.getByText(/with the delivery partner/)).toBeInTheDocument();
  });

  it('returns chosen items with reasons and shows the refund share before confirming', async () => {
    addUser(KARAN, { signedIn: true });
    seedOrder({ id: 'ORD-RETURN01', status: 'delivered', deliveredAt: ago(DAY), history: history('confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered') });
    const user = userEvent.setup();
    renderRoute('/orders/ORD-RETURN01');

    expect(await screen.findByText(/Return window closes on/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Return items' }));
    const dialog = await screen.findByRole('dialog', { name: 'Return items' });
    // ₹6,000 of ₹7,000 carries 6/7 of the ₹600 offer: ₹514.29, so ₹5,485.71 back.
    await user.click(within(dialog).getByRole('checkbox', { name: /Galaxy Phone/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));
    expect(within(dialog).getByText('Choose a reason', { selector: 'p' })).toBeInTheDocument();
    expect(within(dialog).getByLabelText('Reason for Galaxy Phone')).toHaveAttribute('aria-invalid', 'true');
    await user.selectOptions(within(dialog).getByLabelText('Reason for Galaxy Phone'), 'damaged');
    await user.click(within(dialog).getByRole('button', { name: 'Continue' }));

    const confirm = await screen.findByRole('dialog', { name: 'Confirm your return' });
    expect(confirm).toHaveTextContent('₹5,485.71 will be refunded to Aurora Bank Visa •••• 4242 once the items are picked up');
    expect(confirm).toHaveTextContent("The delivery charge isn't refunded");
    await user.click(within(confirm).getByRole('button', { name: 'Request return' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findAllByText('Return requested')).toHaveLength(2); // item badge and return progress
    expect(screen.getByText('Partly returned')).toBeInTheDocument();
    expect(getOrder('ORD-RETURN01')?.returns[0]?.lines).toEqual([{ orderLineId: 11, reason: 'damaged', refundPaise: 5_485_71 }]);
  });

  it('shows return and refund progress, and a closed window', async () => {
    addUser(KARAN, { signedIn: true });
    const at = ago(9 * DAY);
    seedOrder({
      id: 'ORD-CLOSED01',
      status: 'delivered',
      deliveredAt: ago(8 * DAY),
      history: history('confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'),
      returns: [{ id: 'RET-1', status: 'picked_up', lines: [{ orderLineId: 12, reason: 'size_fit', refundPaise: 914_29 }], refundPaise: 914_29, createdAt: at, pickedUpAt: at, refundedAt: null }],
      refunds: [{ id: 'RF-1', returnId: 'RET-1', amountPaise: 914_29, label: 'Aurora Bank Visa •••• 4242', status: 'initiated', initiatedAt: at, refundedAt: null }],
    });
    renderRoute('/orders/ORD-CLOSED01');
    expect(await screen.findByText(/The return window closed on/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Return items' })).not.toBeInTheDocument();
    expect(screen.getByText('Refund of ₹914.29 to Aurora Bank Visa •••• 4242 initiated')).toBeInTheDocument();
    expect(screen.getAllByText('Picked up')).toHaveLength(2); // item badge and return progress
    expect(screen.getByText('Size or fit issue')).toBeInTheDocument();
  });

  it('sends unpaid orders to the payment page and shows not found for unknown ones', async () => {
    addUser(KARAN, { signedIn: true });
    seedOrder({ id: 'ORD-UNPAID01', status: 'pending_payment', payment: null, history: [] });
    const { location, unmount } = renderRoute('/orders/ORD-UNPAID01');
    await waitFor(() => expect(location().pathname).toBe('/checkout/pay/ORD-UNPAID01'));
    unmount();
    renderRoute('/orders/ORD-NOPE0001');
    expect(await screen.findByText("We couldn't find that order")).toBeInTheDocument();
  });
});
