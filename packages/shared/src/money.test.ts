import { describe, expect, it } from 'vitest';
import { formatPrice, formatRupees } from './money.js';

describe('formatPrice', () => {
  it('shows whole rupees without decimals', () => {
    expect(formatPrice(129_999_00)).toBe('₹1,29,999');
  });

  it('shows paise with two decimals', () => {
    expect(formatPrice(999)).toBe('₹9.99');
    expect(formatPrice(1_234_50)).toBe('₹1,234.50');
  });

  it('formats rupee bounds', () => {
    expect(formatRupees(150000)).toBe('₹1,50,000');
  });
});
