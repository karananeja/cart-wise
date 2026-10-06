import type { ReactNode } from 'react';
import { formatPrice, type CheckoutTotals } from '@store/shared';
import { cn } from '@/lib/utils';

export function OrderSummary({ totals, className, children }: { totals: CheckoutTotals; className?: string; children?: ReactNode }) {
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
        <dt className="border-t pt-3 text-base font-semibold">Total to pay</dt>
        <dd className="border-t pt-3 text-right text-base font-semibold tabular-nums">{formatPrice(totals.totalPaise)}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
      {children}
    </section>
  );
}
