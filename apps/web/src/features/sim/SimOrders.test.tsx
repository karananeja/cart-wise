import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { getOrder } from '@/test/checkoutServer';
import { seedOrder } from '@/test/ordersServer';
import { renderRoute } from '@/test/render';
import { OPERATOR_PASSWORD, signInOperator } from '@/test/simServer';

const NOW = new Date().toISOString();
const row = (id: string) => screen.findByRole('article', { name: id });

describe('demo operator page', () => {
  it('signs in with the operator password', async () => {
    seedOrder({ id: 'ORD-SIM00001' });
    const user = userEvent.setup();
    renderRoute('/sim/orders');
    expect(await screen.findByText(/Demo operator — simulation only/)).toBeInTheDocument();

    await user.type(await screen.findByLabelText('Operator password'), 'wrong');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByText('That password is not right.')).toBeInTheDocument();

    await user.clear(screen.getByLabelText('Operator password'));
    await user.type(screen.getByLabelText('Operator password'), OPERATOR_PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await row('ORD-SIM00001')).toHaveTextContent('Bengaluru');

    await user.click(screen.getByRole('button', { name: 'Sign out' }));
    expect(await screen.findByLabelText('Operator password')).toBeInTheDocument();
  });

  it('advances an order step by step and delivers it with the customer code', async () => {
    signInOperator();
    seedOrder({ id: 'ORD-SIM00002' });
    const user = userEvent.setup();
    renderRoute('/sim/orders');

    for (const step of ['processing', 'shipped', 'out for delivery']) {
      await user.click(within(await row('ORD-SIM00002')).getByRole('button', { name: `Advance to ${step}` }));
    }
    const card = await row('ORD-SIM00002');
    await waitFor(() => expect(within(card).getByText('Out for delivery')).toBeInTheDocument());
    expect(within(card).queryByRole('button', { name: /Advance to/ })).not.toBeInTheDocument();
    const code = getOrder('ORD-SIM00002')!.deliveryCode!;

    await user.type(within(card).getByLabelText('Delivery code'), '0000');
    await user.click(within(card).getByRole('button', { name: 'Mark delivered' }));
    expect(await within(card).findByRole('alert')).toHaveTextContent('Wrong code. 2 attempts left.');

    await user.clear(within(card).getByLabelText('Delivery code'));
    await user.type(within(card).getByLabelText('Delivery code'), code);
    await user.click(within(card).getByRole('button', { name: 'Mark delivered' }));
    await waitFor(() => expect(within(card).getByText('Delivered')).toBeInTheDocument());
    expect(getOrder('ORD-SIM00002')?.status).toBe('delivered');
  });

  it('blocks delivery after 3 wrong codes until a new code is issued', async () => {
    signInOperator();
    seedOrder({ id: 'ORD-SIM00003', status: 'out_for_delivery', deliveryCode: '1111' });
    const user = userEvent.setup();
    renderRoute('/sim/orders');
    const card = await row('ORD-SIM00003');
    for (let i = 0; i < 3; i += 1) {
      await user.clear(within(card).getByLabelText('Delivery code'));
      await user.type(within(card).getByLabelText('Delivery code'), '0000');
      await user.click(within(card).getByRole('button', { name: 'Mark delivered' }));
      await waitFor(() => expect(within(card).getByRole('alert')).toBeInTheDocument());
    }
    expect(await within(card).findAllByText('Delivery is blocked after 3 wrong codes. Issue a new code.')).not.toHaveLength(0);
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Mark delivered' })).toBeDisabled());

    await user.click(within(card).getByRole('button', { name: 'Issue new code' }));
    await waitFor(() => expect(within(card).getByRole('button', { name: 'Mark delivered' })).toBeEnabled());
    expect(getOrder('ORD-SIM00003')?.deliveryCode).not.toBe('1111');
  });

  it('picks up a return and completes its refund', async () => {
    signInOperator();
    seedOrder({
      id: 'ORD-SIM00004',
      status: 'delivered',
      deliveredAt: NOW,
      returns: [{ id: 'RET-9', status: 'requested', lines: [{ orderLineId: 12, reason: 'damaged', refundPaise: 914_29 }], refundPaise: 914_29, createdAt: NOW, pickedUpAt: null, refundedAt: null }],
    });
    const user = userEvent.setup();
    renderRoute('/sim/orders');
    const card = await row('ORD-SIM00004');
    expect(card).toHaveTextContent('Return RET-9 · 1 item · ₹914.29 · Requested');
    await user.click(within(card).getByRole('button', { name: 'Mark picked up' }));
    await user.click(await within(card).findByRole('button', { name: 'Complete refund' }));
    await waitFor(() => expect(card).toHaveTextContent('Refunded'));
    expect(getOrder('ORD-SIM00004')?.refunds[0]).toMatchObject({ status: 'refunded', amountPaise: 914_29 });
  });
});
