import { describe, expect, it } from 'vitest';
import { deriveAvailability, seedOnHand } from './inventory.js';

describe('seedOnHand', () => {
  const ids = Array.from({ length: 194 }, (_, i) => i + 1);

  it('is deterministic', () => {
    expect(ids.map(seedOnHand)).toEqual(ids.map(seedOnHand));
  });

  it('produces out-of-stock, low-stock and normal stock across the catalog', () => {
    const stock = ids.map(seedOnHand);
    const out = stock.filter((s) => s === 0).length;
    const low = stock.filter((s) => s >= 1 && s <= 5).length;
    expect(out).toBeGreaterThan(3);
    expect(low).toBeGreaterThan(5);
    expect(stock.filter((s) => s > 5).length).toBeGreaterThan(140);
    expect(stock.every((s) => s >= 0 && s <= 60)).toBe(true);
  });
});

describe('deriveAvailability', () => {
  it('is out of stock when nothing is available', () => {
    expect(deriveAvailability(0, 0)).toEqual({ status: 'out_of_stock' });
    expect(deriveAvailability(3, 3)).toEqual({ status: 'out_of_stock' });
  });

  it('is low stock from 1 to 5 available, and reports the count', () => {
    expect(deriveAvailability(1, 0)).toEqual({ status: 'low_stock', available: 1 });
    expect(deriveAvailability(9, 4)).toEqual({ status: 'low_stock', available: 5 });
  });

  it('is in stock above 5, without exposing the count', () => {
    expect(deriveAvailability(6, 0)).toEqual({ status: 'in_stock' });
  });
});
