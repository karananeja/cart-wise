import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { formatPrice, ORDER_STATUS_LABELS, RETURN_REASONS, type Order, type OrderReturn } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { NotFound } from '@/components/NotFound';
import { formatEstimate } from '@/features/checkout/api';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useOrderDetails } from './api';
import { CancelOrderDialog } from './CancelOrderDialog';
import { DeliveryCode } from './DeliveryCode';
import { formatDate, formatDateTime, formatShortDate } from './format';
import { OrderTimeline } from './OrderTimeline';
import { ReturnItemsDialog } from './ReturnItemsDialog';

const RETURN_STATUS: Record<OrderReturn['status'], string> = {
  requested: 'Return requested',
  picked_up: 'Picked up',
  refunded: 'Refunded',
};

export const returnStateLabel = (state: Order['returnState']) => (state === 'all' ? 'Returned' : state === 'partial' ? 'Partly returned' : null);

/** One paid order: timeline, items, payment and refunds, and its next action (spec §5.3–§5.6). */
export function OrderPage() {
  const { orderId = '' } = useParams();
  const order = useOrderDetails(orderId);
  const online = useOnlineStatus();
  const [refusal, setRefusal] = useState<string>();

  if (order.error instanceof ApiError && order.error.isNotFound) return <NotFound title="We couldn't find that order" />;
  if (!order.data) {
    return order.isError ? (
      <ErrorState what="your order" onRetry={() => void order.refetch()} />
    ) : (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4" role="status" aria-label="Loading your order">
        <Skeleton className="h-20 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const o = order.data;
  // Not an order to the customer until paid: the payment page shows hold, expired and cancelled states.
  if (!o.payment) return <Navigate to={`/checkout/pay/${o.id}`} replace />;

  const returnOf = (lineId: number) => o.returns.find((r) => r.lines.some((l) => l.orderLineId === lineId));
  const badge = returnStateLabel(o.returnState);

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_18rem]">
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">
            <Link to="/account/orders" className="underline-offset-4 hover:underline">
              Your orders
            </Link>{' '}
            · Placed {formatDate(o.createdAt)}
          </p>
          <h1 className="font-mono text-2xl font-semibold tracking-tight sm:text-3xl">{o.id}</h1>
          <p className="flex flex-wrap items-center gap-2 font-medium">
            {ORDER_STATUS_LABELS[o.status]}
            {badge && <Badge variant="secondary">{badge}</Badge>}
          </p>
        </div>

        {o.deliveryCode && <DeliveryCode code={o.deliveryCode} />}

        {refusal && (
          <Alert role="alert">
            <AlertDescription>{refusal}</AlertDescription>
          </Alert>
        )}
        <NextAction
          order={o}
          offline={!online}
          onRefused={() => {
            setRefusal('This order has just shipped, so it can no longer be cancelled.');
            void order.refetch();
          }}
        />

        <section aria-labelledby="order-progress" className="flex flex-col gap-3 rounded-xl border p-5">
          <h2 id="order-progress" className="text-lg font-semibold">
            Progress
          </h2>
          <OrderTimeline order={o} />
          {o.status !== 'cancelled' && o.status !== 'delivered' && (
            <p className="text-sm text-muted-foreground">Estimated arrival {formatEstimate(o.delivery.estimate)}</p>
          )}
        </section>

        <section aria-labelledby="order-items" className="flex flex-col gap-2 rounded-xl border p-5">
          <h2 id="order-items" className="text-lg font-semibold">
            Items
          </h2>
          <ul className="flex flex-col divide-y">
            {o.lines.map((line) => {
              const ret = returnOf(line.id);
              const reason = ret?.lines.find((l) => l.orderLineId === line.id)?.reason;
              return (
                <li key={line.id} className="flex items-center gap-3 py-3">
                  <ProductImage src={line.thumbnailUrl} alt="" className="size-14 shrink-0" />
                  <div className="min-w-0 flex-1 text-sm">
                    <Link to={`/p/${line.slug}`} className="block truncate font-medium underline-offset-4 hover:underline">
                      {line.title}
                    </Link>
                    <p className="text-muted-foreground">
                      {line.size && <>Size {line.size} · </>}{line.option && <>{line.option} · </>}Qty {line.quantity}
                    </p>
                    {ret && (
                      <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="outline">{RETURN_STATUS[ret.status]}</Badge>
                        <span className="text-muted-foreground">{RETURN_REASONS.find((r) => r.id === reason)?.label}</span>
                      </p>
                    )}
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatPrice(line.unitPricePaise * line.quantity)}</p>
                </li>
              );
            })}
          </ul>
          {o.returns.length > 0 && <ReturnProgress returns={o.returns} />}
        </section>
      </div>

      <aside className="flex min-w-0 flex-col gap-6">
        <section aria-labelledby="order-payment" className="flex flex-col gap-3 rounded-xl border p-5 text-sm">
          <h2 id="order-payment" className="text-lg font-semibold">
            Payment
          </h2>
          <dl className="grid grid-cols-[1fr_auto] gap-y-2">
            <dt className="text-muted-foreground">Items</dt>
            <dd className="text-right tabular-nums">{formatPrice(o.totals.mrpPaise - o.totals.discountPaise)}</dd>
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-right tabular-nums">{o.totals.deliveryPaise ? formatPrice(o.totals.deliveryPaise) : 'Free'}</dd>
            {o.payment.offerDiscountPaise > 0 && (
              <>
                <dt className="text-muted-foreground">Bank offer</dt>
                <dd className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">−{formatPrice(o.payment.offerDiscountPaise)}</dd>
              </>
            )}
            <dt className="font-medium">Paid</dt>
            <dd className="text-right font-semibold tabular-nums">{formatPrice(o.payment.paidPaise)}</dd>
          </dl>
          <p className="text-muted-foreground">{o.payment.label}</p>
          {o.refunds.length > 0 && (
            <div className="flex flex-col gap-1 border-t pt-3">
              <h3 className="font-medium">Refunds</h3>
              <ul className="flex flex-col gap-1">
                {o.refunds.map((refund) => (
                  <li key={refund.id}>
                    {refund.status === 'refunded' && refund.refundedAt
                      ? `${formatPrice(refund.amountPaise)} refunded to ${refund.label} on ${formatShortDate(refund.refundedAt)}`
                      : `Refund of ${formatPrice(refund.amountPaise)} to ${refund.label} initiated`}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-muted-foreground">Demo refund — no money moves.</p>
            </div>
          )}
        </section>

        <section aria-labelledby="order-delivery" className="flex flex-col gap-2 rounded-xl border p-5 text-sm">
          <h2 id="order-delivery" className="text-lg font-semibold">
            Delivery
          </h2>
          <p>{o.delivery.label} delivery</p>
          <p className="text-muted-foreground">
            {o.address.fullName}, {o.address.line1}, {o.address.line2}, {o.address.city}, {o.address.state} {o.address.pincode}
          </p>
        </section>
      </aside>
    </div>
  );
}

/** One next action per state (spec §7). */
function NextAction({ order, offline, onRefused }: { order: Order; offline: boolean; onRefused: () => void }) {
  const { actions } = order;
  if (actions.canCancel) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <CancelOrderDialog order={order} disabled={offline} onRefused={onRefused} />
          <p className="text-sm text-muted-foreground">You can cancel until the order ships.</p>
        </div>
        {offline && <p className="text-sm text-muted-foreground">You're offline. Reconnect to make changes.</p>}
      </div>
    );
  }
  if (order.status === 'shipped' || order.status === 'out_for_delivery') {
    return <p className="text-sm text-muted-foreground">This order has shipped. You can return items once it's delivered.</p>;
  }
  if (actions.canReturn && actions.returnWindowEndsAt) {
    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <ReturnItemsDialog order={order} disabled={offline} />
          <p className="text-sm text-muted-foreground">Return window closes on {formatShortDate(actions.returnWindowEndsAt)}</p>
        </div>
        {offline && <p className="text-sm text-muted-foreground">You're offline. Reconnect to make changes.</p>}
      </div>
    );
  }
  if (order.status === 'delivered' && actions.returnWindowEndsAt && order.returnState !== 'all' && Date.parse(actions.returnWindowEndsAt) <= Date.now()) {
    return <p className="text-sm text-muted-foreground">The return window closed on {formatShortDate(actions.returnWindowEndsAt)}.</p>;
  }
  return null;
}

function ReturnProgress({ returns }: { returns: OrderReturn[] }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-3 text-sm">
      <h3 className="font-medium">Returns</h3>
      <ul className="flex flex-col gap-2">
        {returns.map((r) => (
          <li key={r.id} className="flex flex-col gap-0.5">
            <span>
              {r.lines.length} {r.lines.length === 1 ? 'item' : 'items'} · refund {formatPrice(r.refundPaise)} · <span className="font-medium">{RETURN_STATUS[r.status]}</span>
            </span>
            <span className="text-xs text-muted-foreground">
              Requested {formatDateTime(r.createdAt)}
              {r.pickedUpAt && <> · picked up {formatDateTime(r.pickedUpAt)}</>}
              {r.refundedAt && <> · refunded {formatDateTime(r.refundedAt)}</>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
