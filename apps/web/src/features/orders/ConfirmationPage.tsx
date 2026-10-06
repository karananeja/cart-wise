import { CheckCircle2 } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router';
import { formatPrice } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryFallback } from '@/components/ErrorState';
import { NotFound } from '@/components/NotFound';
import { formatEstimate, useOrder } from '@/features/checkout/api';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { ApiError } from '@/lib/api';
import { emiCostText, instalments, notChargedNote, offerName } from '@/features/payment/emiText';

/** After a successful payment (spec FR-23). Reloadable; owner only (the API returns 404 otherwise). */
export function ConfirmationPage() {
  const { orderId = '' } = useParams();
  const order = useOrder(orderId);

  if (order.error instanceof ApiError && order.error.isNotFound) return <NotFound title="We couldn't find that order" />;
  if (!order.data) {
    return (
      <QueryFallback
        query={order}
        what="your order"
        loading={
          <div className="mx-auto flex w-full max-w-2xl flex-col gap-4" role="status" aria-label="Loading your order">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-64 rounded-xl" />
          </div>
        }
      />
    );
  }

  const o = order.data;
  // Not paid (yet): the payment page shows the right state for pending, expired and cancelled orders.
  if (!o.payment) return <Navigate to={`/checkout/pay/${o.id}`} replace />;

  const savings = o.totals.discountPaise + o.payment.offerDiscountPaise;
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <CheckCircle2 className="size-12 text-emerald-600 dark:text-emerald-400" aria-hidden />
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Order confirmed</h1>
        <p className="text-muted-foreground">
          Order number <span className="font-mono font-medium text-foreground">{o.id}</span>
        </p>
      </div>

      <section aria-labelledby="payment-details" className="flex flex-col gap-3 rounded-xl border p-5">
        <h2 id="payment-details" className="text-lg font-semibold">
          Payment
        </h2>
        <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
          <dt className="text-muted-foreground">Paid</dt>
          <dd className="text-right font-semibold tabular-nums">{formatPrice(o.payment.paidPaise)}</dd>
          <dt className="text-muted-foreground">Paid with</dt>
          <dd className="text-right">{o.payment.label}</dd>
          {savings > 0 && (
            <>
              <dt className="text-muted-foreground">You saved</dt>
              <dd className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">
                {formatPrice(savings)}
                {o.payment.offerDiscountPaise > 0 && (
                  <span className="block text-xs text-muted-foreground">
                    incl. {formatPrice(o.payment.offerDiscountPaise)} {offerName(o.payment).replace(/^B/, 'b')}
                  </span>
                )}
              </dd>
            </>
          )}
          {o.payment.emi && (
            <>
              <dt className="text-muted-foreground">EMI</dt>
              <dd className="text-right tabular-nums">
                {instalments(o.payment.emi)}
                <span className="block text-xs text-muted-foreground">{emiCostText(o.payment.emi)}</span>
              </dd>
            </>
          )}
        </dl>
        <p className="text-xs text-muted-foreground">{notChargedNote(o.payment)}</p>
      </section>

      <section aria-labelledby="delivery-details" className="flex flex-col gap-2 rounded-xl border p-5 text-sm">
        <h2 id="delivery-details" className="text-lg font-semibold">
          Delivery
        </h2>
        <p>
          {o.delivery.label} delivery · arrives <span className="font-medium">{formatEstimate(o.delivery.estimate)}</span>
        </p>
        <p className="text-muted-foreground">
          {o.address.fullName}, {o.address.line1}, {o.address.line2}, {o.address.city}, {o.address.state} {o.address.pincode}
        </p>
      </section>

      <section aria-labelledby="ordered-items" className="flex flex-col gap-2 rounded-xl border p-5">
        <h2 id="ordered-items" className="text-lg font-semibold">
          Items
        </h2>
        <ul className="flex flex-col divide-y">
          {o.lines.map((line) => (
            <li key={line.id} className="flex items-center gap-3 py-3">
              <ProductImage src={line.thumbnailUrl} alt="" className="size-14 shrink-0" />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">{line.title}</p>
                <p className="text-muted-foreground">
                  {line.size && <>Size {line.size} · </>}{line.option && <>{line.option} · </>}Qty {line.quantity}
                </p>
              </div>
              <p className="text-sm font-medium tabular-nums">{formatPrice(line.unitPricePaise * line.quantity)}</p>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:self-center">
        <Button asChild size="lg" className="h-12 w-full sm:w-fit">
          <Link to="/">Continue shopping</Link>
        </Button>
        <Button asChild size="lg" variant="outline" className="h-12 w-full sm:w-fit">
          <Link to={`/orders/${o.id}`}>View order</Link>
        </Button>
      </div>
    </div>
  );
}
