import { describe, expect, it } from 'vitest';
import { allocatePaise, nextStatus } from './orders.js';

describe('nextStatus', () => {
  it('steps through the paid lifecycle', () => {
    expect(nextStatus('confirmed')).toBe('processing');
    expect(nextStatus('processing')).toBe('shipped');
    expect(nextStatus('shipped')).toBe('out_for_delivery');
    expect(nextStatus('out_for_delivery')).toBe('delivered');
    expect(nextStatus('delivered')).toBeNull();
    expect(nextStatus('cancelled')).toBeNull();
    expect(nextStatus('pending_payment')).toBeNull();
  });
});

describe('allocatePaise', () => {
  it('shares in proportion and adds up exactly', () => {
    expect(allocatePaise([3_000_00, 3_000_00], 600_00)).toEqual([300_00, 300_00]);
    expect(allocatePaise([1, 1, 1], 100)).toEqual([34, 33, 33]);
    const totals = [85_853, 1_299_00, 49_99];
    const shares = allocatePaise(totals, 150_00);
    expect(shares.reduce((a, b) => a + b, 0)).toBe(150_00);
    shares.forEach((share, i) => expect(Math.abs(share - (150_00 * totals[i]!) / totals.reduce((a, b) => a + b, 0))).toBeLessThan(1));
  });

  it('handles nothing to share and single lines', () => {
    expect(allocatePaise([500, 700], 0)).toEqual([0, 0]);
    expect(allocatePaise([12_345], 1_500_00)).toEqual([1_500_00]);
  });
});
