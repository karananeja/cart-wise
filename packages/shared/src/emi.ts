/**
 * Simulated EMI (F-014, user decisions D1 and D2, 2026-10-06). The fictional banks finance the
 * amount at their rate on the reducing balance. No-cost EMI is funded by the store: an upfront
 * discount sized so the bank's instalments on what is charged add up exactly to the price.
 */
import { BANKS, type BankId, type RecognisedCard } from './payment.js';

export const EMI_RATES: Record<BankId, number> = { aurora: 14, meridian: 15, kestrel: 16 };
export const EMI_TENURES = [3, 6, 9, 12] as const;
export const NO_COST_TENURES = [3, 6] as const;
export const EMI_MIN_PAISE = 3_000_00;
export const NO_COST_MIN_PAISE = 10_000_00;
/** The no-cost discount is recorded as the order's offer (one offer per order). */
export const NO_COST_EMI_OFFER_ID = 'no-cost-emi';

export type EmiTenure = (typeof EMI_TENURES)[number];

export interface EmiPlan {
  tenure: number;
  ratePercent: number;
  noCost: boolean;
  /** Charged to the card today (the bank pays the store this). */
  chargedPaise: number;
  /** Store-funded discount; 0 for normal EMI. */
  discountPaise: number;
  monthlyPaise: number;
  /** Interest the customer pays the bank; 0 for no-cost EMI. */
  interestPaise: number;
  /** What the customer repays in total. */
  totalPaise: number;
}

export type EmiIneligibility = 'NO_CARD' | 'NOT_CREDIT' | 'BANK_NOT_SUPPORTED' | 'BELOW_MINIMUM';

export interface EmiQuote {
  eligible: boolean;
  reason?: EmiIneligibility;
  bankName: string | null;
  plans: EmiPlan[];
}

const toRupee = (paise: number) => Math.round(paise / 100) * 100;

/** Monthly payment per unit of principal: r(1+r)^n / ((1+r)^n − 1), with r the monthly rate. */
export function emiFactor(ratePercent: number, tenure: number): number {
  const r = ratePercent / 1200;
  const growth = (1 + r) ** tenure;
  return (r * growth) / (growth - 1);
}

export function isEmiTenure(n: number): n is EmiTenure {
  return (EMI_TENURES as readonly number[]).includes(n);
}

export function isNoCostTenure(n: number): boolean {
  return (NO_COST_TENURES as readonly number[]).includes(n);
}

/** One plan for this amount. For no-cost EMI the customer repays exactly `amountPaise`. */
export function emiPlan(bank: BankId, amountPaise: number, tenure: number, noCost: boolean): EmiPlan {
  const ratePercent = EMI_RATES[bank];
  const k = emiFactor(ratePercent, tenure);
  if (noCost) {
    const chargedPaise = toRupee(amountPaise / (tenure * k));
    return {
      tenure,
      ratePercent,
      noCost: true,
      chargedPaise,
      discountPaise: amountPaise - chargedPaise,
      monthlyPaise: toRupee(amountPaise / tenure),
      interestPaise: 0,
      totalPaise: amountPaise,
    };
  }
  const monthlyPaise = toRupee(amountPaise * k);
  return {
    tenure,
    ratePercent,
    noCost: false,
    chargedPaise: amountPaise,
    discountPaise: 0,
    monthlyPaise,
    interestPaise: monthlyPaise * tenure - amountPaise,
    totalPaise: monthlyPaise * tenure,
  };
}

/** EMI is for the fictional banks' credit cards, on orders of ₹3,000 or more. */
export function emiEligibility(card: RecognisedCard | null, orderTotalPaise: number): { eligible: boolean; reason?: EmiIneligibility } {
  if (orderTotalPaise < EMI_MIN_PAISE) return { eligible: false, reason: 'BELOW_MINIMUM' };
  if (!card) return { eligible: false, reason: 'NO_CARD' };
  if (!card.bank) return { eligible: false, reason: 'BANK_NOT_SUPPORTED' };
  if (card.cardType !== 'credit') return { eligible: false, reason: 'NOT_CREDIT' };
  return { eligible: true };
}

/**
 * Plans for a card: normal EMI on the amount after the chosen bank offer (D2 allows both), and
 * no-cost EMI on the full total (it is the order's only offer), from ₹10,000.
 */
export function emiQuote(card: RecognisedCard | null, orderTotalPaise: number, offerDiscountPaise = 0): EmiQuote {
  const eligibility = emiEligibility(card, orderTotalPaise);
  const bank = card?.bank ?? null;
  if (!eligibility.eligible || !bank) return { ...eligibility, bankName: bank ? BANKS[bank] : null, plans: [] };
  const plans: EmiPlan[] = [];
  if (orderTotalPaise >= NO_COST_MIN_PAISE) for (const n of NO_COST_TENURES) plans.push(emiPlan(bank, orderTotalPaise, n, true));
  for (const n of EMI_TENURES) plans.push(emiPlan(bank, orderTotalPaise - offerDiscountPaise, n, false));
  return { eligible: true, bankName: BANKS[bank], plans };
}

/** For the product page: the lowest monthly amount (12 months, lowest rate). Null below the minimum. */
export function lowestEmi(pricePaise: number): { monthlyPaise: number; noCostAvailable: boolean } | null {
  if (pricePaise < EMI_MIN_PAISE) return null;
  const longest = 12;
  const monthlyPaise = Math.min(...(Object.keys(EMI_RATES) as BankId[]).map((b) => emiPlan(b, pricePaise, longest, false).monthlyPaise));
  return { monthlyPaise, noCostAvailable: pricePaise >= NO_COST_MIN_PAISE };
}

export const EMI_INELIGIBILITY_MESSAGES: Record<EmiIneligibility, string> = {
  NO_CARD: 'Enter a credit card to see EMI plans.',
  NOT_CREDIT: 'EMI is available on credit cards only.',
  BANK_NOT_SUPPORTED: 'EMI is available on Aurora, Meridian and Kestrel Bank credit cards.',
  BELOW_MINIMUM: 'EMI is available on orders of ₹3,000 or more.',
};
