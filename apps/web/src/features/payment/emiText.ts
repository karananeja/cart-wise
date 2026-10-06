import { formatPrice, NO_COST_EMI_OFFER_ID, type EmiPlan, type OrderPayment } from '@store/shared';

/** "6 × ₹10,000/month", or "6 × ₹13,333/month (last ₹13,335)" when rounding moves into the last one. */
export function instalments(plan: { tenure: number; monthlyPaise: number; lastMonthlyPaise?: number }): string {
  const base = `${plan.tenure} × ${formatPrice(plan.monthlyPaise)}/month`;
  return plan.lastMonthlyPaise && plan.lastMonthlyPaise !== plan.monthlyPaise ? `${base} (last ${formatPrice(plan.lastMonthlyPaise)})` : base;
}

/** What the plan costs beyond the price, in plain words. */
export function emiCostText(plan: Pick<EmiPlan, 'noCost' | 'interestPaise'>): string {
  return plan.noCost ? 'No Cost EMI — no interest' : `${formatPrice(plan.interestPaise)} interest to the bank`;
}

/** How the order's discount is described: a bank offer, No Cost EMI, or Razorpay's offer. */
export function offerName(payment: Pick<OrderPayment, 'offerId' | 'provider'>): string {
  if (payment.offerId === NO_COST_EMI_OFFER_ID) return 'No Cost EMI discount';
  if (payment.provider === 'razorpay') return 'Razorpay offer';
  return 'Bank offer';
}

export const notChargedNote = (payment: Pick<OrderPayment, 'provider'>) =>
  payment.provider === 'razorpay' ? 'Razorpay test mode — no real money was charged.' : 'Demo payment — no money was charged.';
