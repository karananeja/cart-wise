import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { renderRoute } from '@/test/render';

describe('product page bank offer', () => {
  it('shows the best saving for the price', async () => {
    renderRoute('/p/headphones'); // ₹6,000: Aurora 10% = ₹600 beats Meridian ₹250 and Kestrel ₹300
    expect(await screen.findByText(/with Aurora Bank credit cards/)).toHaveTextContent('Save ₹600 with Aurora Bank credit cards');
  });

  it('is hidden when no offer applies at that price', async () => {
    renderRoute('/p/phone-case'); // ₹800, below every minimum
    await screen.findByRole('heading', { name: 'Phone Case' });
    expect(screen.queryByText(/^Save ₹/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'All offers' })).not.toBeInTheDocument();
  });

  it('is hidden when the product is out of stock', async () => {
    renderRoute('/p/sold-out-speaker');
    await screen.findByRole('heading', { name: 'Sold-out Speaker' });
    expect(screen.queryByText(/^Save ₹/)).not.toBeInTheDocument();
  });

  it('lists every offer with its terms in All offers', async () => {
    const user = userEvent.setup();
    renderRoute('/p/usb-cable'); // ₹1,200: only Kestrel (₹60)
    expect(await screen.findByText(/with Kestrel Bank credit cards/)).toHaveTextContent('Save ₹60');
    await user.click(screen.getByRole('button', { name: 'All offers' }));
    const panel = await screen.findByRole('dialog', { name: 'Bank offers' });
    expect(within(panel).getByText(/Demo offers from fictional banks/)).toHaveTextContent(/one offer per order/);
    expect(within(panel).getAllByText('Demo offer')).toHaveLength(3);
    expect(within(panel).getByText(/Aurora Bank credit cards · min. order ₹5,000 · max. discount ₹1,500/)).toBeInTheDocument();
    expect(within(panel).getByText('Flat ₹250 off')).toBeInTheDocument();
    expect(within(panel).getByText('5% instant discount')).toBeInTheDocument();
  });
});
