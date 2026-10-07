import { describe, expect, it } from 'vitest';
import { amountInWords, DELIVERY_GST_RATE, GST_RATES, gstRate, invoiceNumber, isIntraState, numberInWords, SELLER, splitInclusive } from './gst.js';

describe('gstRate (FR-5)', () => {
  it('uses the category table', () => {
    expect(gstRate('groceries', 100_00)).toBe(5);
    expect(gstRate('laptops', 80_000_00)).toBe(18);
    expect(gstRate('womens-jewellery', 5_000_00)).toBe(3);
    expect(gstRate('motorcycle', 2_00_000_00)).toBe(40);
    expect(gstRate('vehicle', 10_00_000_00)).toBe(40);
    expect(DELIVERY_GST_RATE).toBe(18);
  });

  it('puts apparel and footwear at 5% up to ₹2,500 a unit and 18% above', () => {
    for (const slug of ['mens-shirts', 'tops', 'womens-dresses', 'mens-shoes', 'womens-shoes']) {
      expect(gstRate(slug, 2_000_00)).toBe(5);
      expect(gstRate(slug, 2_500_00)).toBe(5);
      expect(gstRate(slug, 2_500_01)).toBe(18);
      expect(gstRate(slug, 3_000_00)).toBe(18);
    }
  });

  it('defaults to 18% for unknown or missing categories', () => {
    expect(gstRate('spaceships', 100_00)).toBe(18);
    expect(gstRate(null, 100_00)).toBe(18);
  });

  it('covers every catalog category', () => {
    expect(Object.keys(GST_RATES)).toHaveLength(24);
  });
});

describe('splitInclusive (FR-6)', () => {
  it('backs the tax out of an inclusive price, rounding the taxable value', () => {
    // ₹1,000 at 18%: 100000 × 100 / 118 = 84745.76… → 84746.
    expect(splitInclusive(1_000_00, 18, false)).toEqual({ amountPaise: 1_000_00, ratePercent: 18, taxablePaise: 84746, taxPaise: 15254, cgstPaise: 0, sgstPaise: 0, igstPaise: 15254 });
  });

  it('halves the tax into CGST and SGST within the state, the odd paisa to SGST', () => {
    // ₹105.01 at 5%: taxable round(10001) = 10001, tax 500 → 250 + 250.
    expect(splitInclusive(105_01, 5, true)).toMatchObject({ taxablePaise: 10001, taxPaise: 500, cgstPaise: 250, sgstPaise: 250, igstPaise: 0 });
    // ₹100 at 18%: taxable 8475, tax 1525 → 762 + 763.
    expect(splitInclusive(100_00, 18, true)).toMatchObject({ taxablePaise: 8475, taxPaise: 1525, cgstPaise: 762, sgstPaise: 763, igstPaise: 0 });
  });

  it('always reconciles to the amount', () => {
    for (const rate of [3, 5, 18, 40]) {
      for (const amount of [1, 99, 49_00, 1_234_57, 2_500_01, 12_34_567_89]) {
        for (const intra of [true, false]) {
          const s = splitInclusive(amount, rate, intra);
          expect(s.taxablePaise + s.taxPaise).toBe(amount);
          expect(s.cgstPaise + s.sgstPaise + s.igstPaise).toBe(s.taxPaise);
        }
      }
    }
  });
});

describe('seller and numbering', () => {
  it('treats Karnataka as intra-state, case-insensitively', () => {
    expect(SELLER.state).toBe('Karnataka');
    expect(isIntraState('Karnataka')).toBe(true);
    expect(isIntraState(' karnataka ')).toBe(true);
    expect(isIntraState('Maharashtra')).toBe(false);
  });

  it('shows a GSTIN that is not a real one', () => {
    expect(SELLER.gstin).toBe('DEMO — not registered');
  });

  it('derives the invoice number from the order id', () => {
    expect(invoiceNumber('ORD-7KQ2M9XA')).toBe('INV-7KQ2M9XA');
  });
});

describe('amount in words', () => {
  it('uses the Indian system', () => {
    expect(numberInWords(0)).toBe('zero');
    expect(numberInWords(15)).toBe('fifteen');
    expect(numberInWords(90)).toBe('ninety');
    expect(numberInWords(101)).toBe('one hundred one');
    expect(numberInWords(2_500)).toBe('two thousand five hundred');
    expect(numberInWords(1_00_000)).toBe('one lakh');
    expect(numberInWords(12_34_567)).toBe('twelve lakh thirty-four thousand five hundred sixty-seven');
    expect(numberInWords(1_00_00_000)).toBe('one crore');
    expect(numberInWords(123_45_67_890)).toBe('one hundred twenty-three crore forty-five lakh sixty-seven thousand eight hundred ninety');
  });

  it('says rupees and paise', () => {
    expect(amountInWords(7_200_00)).toBe('Rupees seven thousand two hundred only');
    expect(amountInWords(1_23_456_78)).toBe('Rupees one lakh twenty-three thousand four hundred fifty-six and seventy-eight paise only');
    expect(amountInWords(5)).toBe('Rupees zero and five paise only');
  });
});
