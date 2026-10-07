import { describe, expect, it } from 'vitest';
import { deliveryOptions } from './checkout.js';

const now = new Date('2026-10-06T10:00:00.000Z');

describe('deliveryOptions', () => {
  it('charges ₹49 for Standard below ₹999, with the shortfall (regional dates)', () => {
    const [standard, express] = deliveryOptions(879_00, now, 'regional');
    expect(standard).toEqual({
      option: 'standard',
      label: 'Standard',
      pricePaise: 49_00,
      estimate: { from: '2026-10-09', to: '2026-10-11' },
      freeDeliveryShortfallPaise: 120_00,
    });
    expect(express).toEqual({ option: 'express', label: 'Express', pricePaise: 149_00, estimate: { from: '2026-10-08', to: '2026-10-09' } });
  });

  it('makes Standard free from ₹999', () => {
    expect(deliveryOptions(999_00, now, 'regional')[0]).toMatchObject({ pricePaise: 0, freeDeliveryShortfallPaise: 0 });
    expect(deliveryOptions(999_00, now, 'regional')[1]!.pricePaise).toBe(149_00);
  });

  it('follows the zone: metro is faster, remote has no Express, unserviceable has nothing', () => {
    const metro = deliveryOptions(500_00, now, 'metro');
    expect(metro.map((o) => [o.option, o.estimate])).toEqual([
      ['standard', { from: '2026-10-08', to: '2026-10-09' }],
      ['express', { from: '2026-10-07', to: '2026-10-08' }],
    ]);
    const remote = deliveryOptions(500_00, now, 'remote');
    expect(remote.map((o) => [o.option, o.estimate])).toEqual([['standard', { from: '2026-10-12', to: '2026-10-15' }]]);
    expect(remote[0]!.pricePaise).toBe(49_00);
    expect(deliveryOptions(500_00, now, 'unserviceable')).toEqual([]);
  });
});
