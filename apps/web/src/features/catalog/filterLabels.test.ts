import { describe, expect, it } from 'vitest';
import { pageItems } from './components/Pagination';
import { priceLabel, pricePresets } from './filterLabels';

describe('pricePresets', () => {
  it('builds contiguous round-number ranges inside the price range', () => {
    expect(pricePresets({ min: 127, max: 997 })).toEqual([{ max: 250 }, { min: 250, max: 500 }, { min: 500 }]);
  });

  it('picks at most three bounds across a wide range', () => {
    const presets = pricePresets({ min: 1, max: 37000 });
    expect(presets).toHaveLength(4);
    expect(presets[0]).toEqual({ max: presets[1]!.min });
  });

  it('returns no presets when no round number falls inside the range', () => {
    expect(pricePresets({ min: 1027, max: 1907 })).toEqual([]);
  });
});

describe('priceLabel', () => {
  it('describes open and closed ranges', () => {
    expect(priceLabel(undefined, 500)).toBe('Under ₹500');
    expect(priceLabel(500, 1000)).toBe('₹500 – ₹1,000');
    expect(priceLabel(1000, undefined)).toBe('₹1,000 & above');
  });
});

describe('pageItems', () => {
  it('shows first, last and neighbours with gaps', () => {
    expect(pageItems(5, 10)).toEqual([1, 'gap', 4, 5, 6, 'gap', 10]);
    expect(pageItems(1, 3)).toEqual([1, 2, 3]);
    expect(pageItems(2, 4)).toEqual([1, 2, 3, 4]);
  });
});
