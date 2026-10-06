import type { ReactNode } from 'react';
import { formatPrice, type CheckoutTotals } from '@store/shared';
import { instalments } from '@/features/payment/emiText';
import type { SummaryExtras } from '@/features/payment/summary';
import { cn } from '@/lib/utils';

interface OrderSummaryProps {
  totals: CheckoutTotals;
  /** Payment page (F-009, F-014): adds the chosen bank offer or No Cost EMI discount, the EMI plan and the amount to pay. */
  payment?: SummaryExtras;
  className?: string;
  children?: ReactNode;
}

export function OrderSummary({ totals, payment, className, children }: OrderSummaryProps) {
  const offer = payment?.bankOffer;
  const noCost = payment?.noCostDiscountPaise ?? 0;
  return (
    <section aria-labelledby="order-summary" className={cn('flex flex-col gap-3 rounded-xl border p-5', className)}>
      <h2 id="order-summary" className="text-lg font-semibold">
        Order summary
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm" aria-live="polite">
        <dt className="text-muted-foreground">Items</dt>
        <dd className="text-right tabular-nums">{totals.itemCount}</dd>
        <dt className="text-muted-foreground">Total MRP</dt>
        <dd className="text-right tabular-nums">{formatPrice(totals.mrpPaise)}</dd>
        {totals.discountPaise > 0 && (
          <>
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">−{formatPrice(totals.discountPaise)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Delivery</dt>
        <dd className="text-right tabular-nums">{totals.deliveryPaise === 0 ? 'Free' : formatPrice(totals.deliveryPaise)}</dd>
        {payment ? (
          <>
            <dt className="text-muted-foreground">Order total</dt>
            <dd className="text-right tabular-nums">{formatPrice(totals.totalPaise)}</dd>
            {offer && (
              <>
                <dt className="text-muted-foreground">Bank offer ({offer.bankName})</dt>
                <dd className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">−{formatPrice(offer.discountPaise)}</dd>
              </>
            )}
            {noCost > 0 && (
              <>
                <dt className="text-muted-foreground">No Cost EMI discount</dt>
                <dd className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">−{formatPrice(noCost)}</dd>
              </>
            )}
            <dt className="border-t pt-3 text-base font-semibold">{payment.emi ? 'Charged today' : 'Amount to pay'}</dt>
            <dd className="border-t pt-3 text-right text-base font-semibold tabular-nums">
              {formatPrice(totals.totalPaise - (offer?.discountPaise ?? 0) - noCost)}
            </dd>
            {payment.emi && (
              <>
                <dt className="text-muted-foreground">EMI</dt>
                <dd className="text-right tabular-nums">{instalments(payment.emi)}</dd>
              </>
            )}
          </>
        ) : (
          <>
            <dt className="border-t pt-3 text-base font-semibold">Total to pay</dt>
            <dd className="border-t pt-3 text-right text-base font-semibold tabular-nums">{formatPrice(totals.totalPaise)}</dd>
          </>
        )}
      </dl>
      <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
      {children}
    </section>
  );
}
