import { describe, expect, it } from 'vitest';
import { deliveryOptions } from './checkout.js';

const now = new Date('2026-10-06T10:00:00.000Z');

describe('deliveryOptions', () => {
  it('charges ₹49 for Standard below ₹999, with the shortfall', () => {
    const [standard, express] = deliveryOptions(879_00, now);
    expect(standard).toEqual({
      option: 'standard',
      label: 'Standard',
      pricePaise: 49_00,
      estimate: { from: '2026-10-09', to: '2026-10-11' },
      freeDeliveryShortfallPaise: 120_00,
    });
    expect(express).toEqual({ option: 'express', label: 'Express', pricePaise: 149_00, estimate: { from: '2026-10-07', to: '2026-10-08' } });
  });

  it('makes Standard free from ₹999', () => {
    expect(deliveryOptions(999_00, now)[0]).toMatchObject({ pricePaise: 0, freeDeliveryShortfallPaise: 0 });
    expect(deliveryOptions(999_00, now)[1]!.pricePaise).toBe(149_00);
  });
});
