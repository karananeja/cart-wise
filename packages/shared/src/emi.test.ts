import { describe, expect, it } from 'vitest';
import { emiEligibility, emiFactor, emiPlan, emiQuote, lowestEmi } from './emi.js';
import { recogniseCard } from './payment.js';

const auroraCredit = recogniseCard('424242');

describe('emiPlan', () => {
  it('computes reducing-balance instalments, rounded to the rupee', () => {
    expect(emiFactor(14, 6)).toBeCloseTo(0.17354, 4);
    expect(emiPlan('aurora', 60_000_00, 3, false)).toEqual({
      tenure: 3, ratePercent: 14, noCost: false, chargedPaise: 60_000_00, discountPaise: 0, monthlyPaise: 20_468_00, interestPaise: 1_404_00, totalPaise: 61_404_00,
    });
    expect(emiPlan('aurora', 60_000_00, 6, false)).toMatchObject({ monthlyPaise: 10_412_00, interestPaise: 2_472_00 });
    expect(emiPlan('aurora', 60_000_00, 12, false)).toMatchObject({ monthlyPaise: 5_387_00 });
    expect(emiPlan('kestrel', 60_000_00, 6, false).ratePercent).toBe(16);
  });

  it('makes no-cost instalments add up exactly to the price, funded by a store discount', () => {
    const plan = emiPlan('aurora', 60_000_00, 6, true);
    expect(plan).toEqual({
      tenure: 6, ratePercent: 14, noCost: true, chargedPaise: 57_624_00, discountPaise: 2_376_00, monthlyPaise: 10_000_00, interestPaise: 0, totalPaise: 60_000_00,
    });
    // The bank's normal instalments on what is charged repay the price (within rupee rounding).
    expect(emiPlan('aurora', plan.chargedPaise, 6, false).totalPaise).toBeCloseTo(60_000_00, -3);
  });
});

describe('emiQuote', () => {
  it('offers EMI only on fictional banks’ credit cards from ₹3,000', () => {
    expect(emiEligibility(null, 5_000_00)).toEqual({ eligible: false, reason: 'NO_CARD' });
    expect(emiEligibility(auroraCredit, 2_999_00)).toEqual({ eligible: false, reason: 'BELOW_MINIMUM' });
    expect(emiEligibility(recogniseCard('400050'), 5_000_00)).toEqual({ eligible: false, reason: 'NOT_CREDIT' });
    expect(emiEligibility(recogniseCard('411111'), 5_000_00)).toEqual({ eligible: false, reason: 'BANK_NOT_SUPPORTED' });
    expect(emiQuote(recogniseCard('411111'), 5_000_00)).toEqual({ eligible: false, reason: 'BANK_NOT_SUPPORTED', bankName: null, plans: [] });
  });

  it('lists no-cost plans from ₹10,000 on the full total, and normal plans after the bank offer', () => {
    const small = emiQuote(auroraCredit, 5_000_00);
    expect(small.plans.map((p) => [p.tenure, p.noCost])).toEqual([[3, false], [6, false], [9, false], [12, false]]);
    const big = emiQuote(auroraCredit, 60_000_00, 1_500_00);
    expect(big.bankName).toBe('Aurora Bank');
    expect(big.plans.map((p) => [p.tenure, p.noCost, p.chargedPaise])).toEqual([
      [3, true, 58_627_00],
      [6, true, 57_624_00],
      [3, false, 58_500_00],
      [6, false, 58_500_00],
      [9, false, 58_500_00],
      [12, false, 58_500_00],
    ]);
  });
});

describe('lowestEmi', () => {
  it('is the 12-month amount at the lowest rate, with no-cost from ₹10,000', () => {
    expect(lowestEmi(2_999_00)).toBeNull();
    expect(lowestEmi(5_000_00)).toEqual({ monthlyPaise: emiPlan('aurora', 5_000_00, 12, false).monthlyPaise, noCostAvailable: false });
    expect(lowestEmi(60_000_00)).toEqual({ monthlyPaise: 5_387_00, noCostAvailable: true });
  });
});
