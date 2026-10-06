import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render';
import { getStock, setAutomation, setHeld, signInOperator } from '@/test/simServer';

const row = (title: string) => screen.findByRole('article', { name: title });

describe('simulation console', () => {
  it('shares one sign-in across tabs, with tab navigation', async () => {
    const user = userEvent.setup();
    const { location } = renderRoute('/sim');
    await waitFor(() => expect(location().pathname).toBe('/sim/orders'));
    expect(await screen.findByLabelText('Operator password')).toBeInTheDocument();

    signInOperator();
    const nav = screen.getByRole('navigation', { name: 'Simulation console' });
    await user.click(within(nav).getByRole('link', { name: 'Inventory' }));
    expect(location().pathname).toBe('/sim/inventory');
    expect(within(nav).getByRole('link', { name: 'Inventory' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('heading', { level: 1, name: 'Inventory' })).toBeInTheDocument();
  });
});

describe('inventory tab', () => {
  it('lists stock with on hand, held, available and status; filters and searches', async () => {
    signInOperator();
    const user = userEvent.setup();
    renderRoute('/sim/inventory');

    const mug = await row('Coffee Mug');
    expect(within(mug).getByText('On hand').nextSibling).toHaveTextContent('12');
    expect(within(mug).getByText('Held').nextSibling).toHaveTextContent('2');
    expect(within(mug).getByText('Available').nextSibling).toHaveTextContent('10');
    expect(within(mug).getByText('In stock')).toBeInTheDocument();
    expect(within(mug).getByText('2 held in checkout')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'Low stock' }));
    expect(await row('Desk Lamp')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('article', { name: 'Coffee Mug' })).not.toBeInTheDocument());

    await user.click(screen.getByRole('radio', { name: 'Sold out' }));
    expect(await row('Electric Kettle')).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: 'All' }));
    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'zzz');
    expect(await screen.findByText('No products match')).toBeInTheDocument();
  });

  it('pages with Show more', async () => {
    signInOperator();
    const user = userEvent.setup();
    renderRoute('/sim/inventory');
    await row('Coffee Mug');
    expect(screen.getAllByRole('article')).toHaveLength(20);
    await user.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await row('Filler Product 21')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show more' })).not.toBeInTheDocument();
  });

  it('changes stock with the stepper and the exact value, logging each change', async () => {
    signInOperator();
    const user = userEvent.setup();
    renderRoute('/sim/inventory');
    const lamp = await row('Desk Lamp');

    await user.click(within(lamp).getByRole('button', { name: 'Increase stock for Desk Lamp' }));
    await waitFor(() => expect(getStock(2)!.onHand).toBe(4));
    await waitFor(() => expect(within(lamp).getByLabelText('On hand for Desk Lamp')).toHaveValue('4'));

    const input = within(lamp).getByLabelText('On hand for Desk Lamp');
    await user.clear(input);
    await user.type(input, '0{Enter}');
    await waitFor(() => expect(getStock(2)!.onHand).toBe(0));
    expect(await within(lamp).findByText('Sold out')).toBeInTheDocument();
    expect(within(lamp).getByRole('button', { name: 'Decrease stock for Desk Lamp' })).toBeDisabled();

    const log = await screen.findByRole('list', { name: 'Recent changes' });
    await waitFor(() => expect(within(log).getAllByRole('listitem')).toHaveLength(2));
    expect(within(log).getAllByRole('listitem')[0]).toHaveTextContent(/Desk Lamp\s*4 → 0\s*· Manual/);
  });

  it('refuses going below the units held in checkout and reverts', async () => {
    signInOperator();
    setHeld(1, 5);
    const user = userEvent.setup();
    renderRoute('/sim/inventory');
    const mug = await row('Coffee Mug');
    const input = within(mug).getByLabelText('On hand for Coffee Mug');
    await user.clear(input);
    await user.type(input, '3{Enter}');
    expect(await within(mug).findByRole('alert')).toHaveTextContent("5 units are held in checkout — on hand can't go lower");
    expect(input).toHaveValue('12');
    expect(getStock(1)!.onHand).toBe(12);
  });

  it('shows per-size rows for sized products', async () => {
    signInOperator();
    const user = userEvent.setup();
    renderRoute('/sim/inventory');
    const tee = await row('Cotton Tee');
    expect(within(tee).queryByRole('button', { name: /stock for Cotton Tee$/ })).not.toBeInTheDocument();
    await user.click(within(tee).getByRole('button', { name: 'Show sizes' }));
    await user.click(within(tee).getByRole('button', { name: 'Increase stock for Cotton Tee size S' }));
    await waitFor(() => expect(getStock(4, 41)!.onHand).toBe(1));
    expect(getStock(4, 42)!.onHand).toBe(7);
  });
});

describe('simulation panel', () => {
  it('is off by default: Run once now is disabled with a hint', async () => {
    signInOperator();
    renderRoute('/sim/inventory');
    expect(await screen.findByText('Automation is off')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run once now' })).toBeDisabled();
    expect(screen.getByText('Turn on decrease or restock first')).toBeInTheDocument();
    expect(screen.getByText('No changes yet')).toBeInTheDocument();
    expect(screen.getByLabelText('Interval')).toHaveValue('60');
  });

  it('saves the switches and interval, shows the next tick and runs once', async () => {
    signInOperator();
    const user = userEvent.setup();
    renderRoute('/sim/inventory');
    await user.click(await screen.findByRole('switch', { name: 'Automatic decrease' }));
    expect(await screen.findByText(/Next tick in \d+s/)).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Interval'), '10 seconds');
    await waitFor(() => expect(screen.getByLabelText('Interval')).toHaveValue('10'));

    await user.click(screen.getByRole('button', { name: 'Run once now' }));
    const log = await screen.findByRole('list', { name: 'Recent changes' });
    expect(within(log).getByRole('listitem')).toHaveTextContent(/Coffee Mug\s*12 → 11\s*· Auto decrease/);
    // The stock list follows the automatic change.
    await waitFor(() => expect(within(screen.getByRole('article', { name: 'Coffee Mug' })).getByLabelText('On hand for Coffee Mug')).toHaveValue('11'));
  });

  it('restocks when restock is on', async () => {
    signInOperator();
    setAutomation({ autoRestock: true });
    const user = userEvent.setup();
    renderRoute('/sim/inventory');
    await user.click(await screen.findByRole('button', { name: 'Run once now' }));
    const log = await screen.findByRole('list', { name: 'Recent changes' });
    expect(within(log).getByRole('listitem')).toHaveTextContent(/Desk Lamp\s*3 → 10\s*· Auto restock/);
  });
});
