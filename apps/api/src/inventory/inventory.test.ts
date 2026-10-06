import { describe, expect, it } from 'vitest';
import { deriveAvailability, seedOnHand, seedSizeOnHand } from './inventory.js';
import { SIZE_SETS, sizesFor } from './sizes.js';

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

describe('seedSizeOnHand', () => {
  const units = Array.from({ length: 30 }, (_, p) => Array.from({ length: 5 }, (_, s) => seedSizeOnHand(p + 1, s))).flat();

  it('is deterministic per product and size', () => {
    expect(seedSizeOnHand(7, 2)).toBe(seedSizeOnHand(7, 2));
  });

  it('includes sold-out and low sizes', () => {
    expect(units.filter((u) => u === 0).length).toBeGreaterThan(5);
    expect(units.filter((u) => u >= 1 && u <= 3).length).toBeGreaterThan(5);
    expect(units.every((u) => u >= 0 && u <= 15)).toBe(true);
  });
});

describe('sizes', () => {
  it('assigns the approved size sets to apparel and footwear only', () => {
    expect(sizesFor('mens-shirts')).toEqual(['S', 'M', 'L', 'XL', 'XXL']);
    expect(sizesFor('tops')).toEqual(['XS', 'S', 'M', 'L', 'XL']);
    expect(sizesFor('mens-shoes')).toEqual(['UK 6', 'UK 7', 'UK 8', 'UK 9', 'UK 10', 'UK 11']);
    expect(sizesFor('womens-shoes')[0]).toBe('UK 3');
    expect(sizesFor('laptops')).toEqual([]);
    expect(Object.keys(SIZE_SETS)).toHaveLength(5);
  });
});

describe('deriveAvailability', () => {
  it('is out of stock when nothing is available', () => {
    expect(deriveAvailability(0)).toEqual({ status: 'out_of_stock' });
  });

  it('is low stock from 1 to 5 available, and reports the count', () => {
    expect(deriveAvailability(1)).toEqual({ status: 'low_stock', available: 1 });
    expect(deriveAvailability(5)).toEqual({ status: 'low_stock', available: 5 });
  });

  it('is in stock above 5, without exposing the count', () => {
    expect(deriveAvailability(6)).toEqual({ status: 'in_stock' });
  });
});
