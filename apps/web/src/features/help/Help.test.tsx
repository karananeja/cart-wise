import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  DELIVERY_RULES,
  EMI_MIN_PAISE,
  formatPrice,
  FREE_DELIVERY_THRESHOLD_PAISE,
  NO_COST_MIN_PAISE,
  OFFERS,
  PAYMENT_HOLD_MS,
  RETURN_WINDOW_MS,
  ZONE_AREAS,
  ZONE_DAYS,
} from '@store/shared';
import { renderRoute } from '@/test/render';

const main = () => within(screen.getByRole('main'));
const text = () => screen.getByRole('main').textContent!.replace(/\s+/g, ' ');

describe('help pages (F-018)', () => {
  it('delivery: charges, free threshold, zone times, hold and delivery code from the shared rules', async () => {
    renderRoute('/help/delivery');
    expect(await screen.findByRole('heading', { level: 1, name: 'Delivery' })).toBeInTheDocument();
    expect(text()).toContain(`Standard: ${formatPrice(DELIVERY_RULES.standard.pricePaise)}, and free on orders of ${formatPrice(FREE_DELIVERY_THRESHOLD_PAISE)} or more`);
    expect(text()).toContain('₹999');
    expect(text()).toContain(`Express: ${formatPrice(DELIVERY_RULES.express.pricePaise)}`);
    const metro = main().getByRole('row', { name: new RegExp(ZONE_AREAS.metro) });
    expect(metro).toHaveTextContent(`${ZONE_DAYS.metro.standard!.minDays}–${ZONE_DAYS.metro.standard!.maxDays} days`);
    expect(main().getByRole('row', { name: new RegExp(ZONE_AREAS.remote) })).toHaveTextContent('Not available');
    expect(text()).toContain(ZONE_AREAS.unserviceable);
    expect(text()).toContain(`held for ${PAYMENT_HOLD_MS / 60_000} minutes`);
    expect(text()).toContain('10 minutes');
    expect(text()).toContain('delivery code');
    expect(main().getByRole('link', { name: 'Delivery' })).toHaveAttribute('aria-current', 'page');
  });

  it('returns: cancel before shipping, the return window, no delivery refund on returns, original method', async () => {
    renderRoute('/help/returns');
    expect(await screen.findByRole('heading', { level: 1, name: 'Returns & refunds' })).toBeInTheDocument();
    expect(text()).toContain('while it is “Order confirmed” or “Processing”');
    expect(text()).toContain(`within ${RETURN_WINDOW_MS / 86_400_000} days of delivery`);
    expect(text()).toContain('7 days');
    expect(text()).toContain("The delivery charge isn't refunded on returns.");
    expect(text()).toContain('original payment method');
    expect(text()).toContain('refunded through Razorpay');
  });

  it('payments: demo methods, bank offers and EMI minimums, no real money', async () => {
    renderRoute('/help/payments');
    expect(await screen.findByRole('heading', { level: 1, name: 'Payments & EMI' })).toBeInTheDocument();
    expect(text()).toContain('Only the first 6 and last 4 digits are sent');
    for (const offer of OFFERS) expect(text()).toContain(`${offer.headline} with ${offer.cardsLabel}, on orders of ${formatPrice(offer.minOrderPaise)} or more`);
    expect(text()).toContain(`on orders of ${formatPrice(EMI_MIN_PAISE)} or more`);
    expect(text()).toContain('₹3,000');
    expect(text()).toContain(`No-cost EMI is offered on orders of ${formatPrice(NO_COST_MIN_PAISE)} or more, over 3 or 6 months`);
    expect(text()).toContain('Choose 3, 6, 9 or 12 months');
    expect(text()).toContain('test mode only');
    expect(text()).toContain('no real money');
  });
});
