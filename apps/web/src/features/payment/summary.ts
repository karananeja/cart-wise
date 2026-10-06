import type { EmiPlan } from '@store/shared';

/** What the payment page's order summary adds to the order totals (F-009, F-014). */
export interface SummaryExtras {
  bankOffer: { bankName: string; discountPaise: number } | null;
  noCostDiscountPaise: number;
  emi: EmiPlan | null;
}

export const NO_EXTRAS: SummaryExtras = { bankOffer: null, noCostDiscountPaise: 0, emi: null };
