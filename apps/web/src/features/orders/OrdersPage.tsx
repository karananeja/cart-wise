import { Loader2, Package } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import { formatPrice, ORDER_STATUS_LABELS, type OrderSummary } from '@store/shared';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { StatusMessage } from '@/components/StatusMessage';
import { useMe } from '@/features/auth/api';
import { formatEstimate } from '@/features/checkout/api';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { useOrders } from './api';
import { DeliveryCode } from './DeliveryCode';
import { formatDate } from './format';
import { returnStateLabel } from './OrderPage';

/** Your orders: paid orders, newest first, 10 at a time (spec FR-4–FR-6). */
export function OrdersPage() {
  const me = useMe();
  const orders = useOrders();

  if (!me.isPending && !me.data?.user) return <Navigate to="/login?returnTo=%2Faccount%2Forders" replace />;

  const list = orders.data?.pages.flatMap((p) => p.orders) ?? [];
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Your orders</h1>
      {orders.isPending || me.isPending ? (
        <div className="flex flex-col gap-4" role="status" aria-label="Loading your orders">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      ) : orders.isError && !list.length ? (
        <ErrorState what="your orders" onRetry={() => void orders.refetch()} />
      ) : !list.length ? (
        <StatusMessage
          icon={<Package />}
          title="No orders yet"
          description="When you place an order, it will appear here."
          actions={
            <Button asChild>
              <Link to="/">Start shopping</Link>
            </Button>
          }
        />
      ) : (
        <>
          <ul className="flex flex-col gap-4">
            {list.map((order) => (
              <li key={order.id}>
                <OrderCard order={order} />
              </li>
            ))}
          </ul>
          {orders.hasNextPage && (
            <Button variant="outline" className="w-fit self-center" disabled={orders.isFetchingNextPage} onClick={() => void orders.fetchNextPage()}>
              {orders.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden />}
              Show more
            </Button>
          )}
        </>
      )}
    </div>
  );
}

function statusDetail(order: OrderSummary): string {
  if (order.status === 'delivered' && order.deliveredAt) return `Delivered ${formatDate(order.deliveredAt)}`;
  if (order.status === 'cancelled' && order.cancelledAt) return `Cancelled ${formatDate(order.cancelledAt)}`;
  if (order.status === 'cancelled') return 'Cancelled';
  return `${ORDER_STATUS_LABELS[order.status]} · arrives ${formatEstimate(order.estimate)}`;
}

function OrderCard({ order }: { order: OrderSummary }) {
  const shown = order.thumbnails.slice(0, 3);
  const more = order.thumbnails.length - shown.length;
  const badge = returnStateLabel(order.returnState);
  return (
    <article aria-labelledby={`order-${order.id}`} className="relative flex flex-col gap-3 rounded-xl border p-4 transition-colors hover:bg-muted/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col">
          <h2 id={`order-${order.id}`} className="font-mono text-sm font-semibold">
            <Link to={`/orders/${order.id}`} className="after:absolute after:inset-0 after:content-['']">
              {order.id}
            </Link>
          </h2>
          <p className="text-xs text-muted-foreground">Placed {formatDate(order.createdAt)}</p>
        </div>
        <p className="text-sm font-semibold tabular-nums">{formatPrice(order.paidPaise)}</p>
      </div>
      <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
        {statusDetail(order)}
        {badge && <Badge variant="secondary">{badge}</Badge>}
      </p>
      <div className="flex items-center gap-2">
        {shown.map((t, i) => (
          <ProductImage key={i} src={t.thumbnailUrl} alt={t.title} className="size-12 shrink-0" />
        ))}
        {more > 0 && <span className="text-sm text-muted-foreground">+{more}</span>}
        <span className="sr-only">
          {order.itemCount} {order.itemCount === 1 ? 'item' : 'items'}
        </span>
      </div>
      {order.deliveryCode && (
        <div className="relative z-10">
          <DeliveryCode code={order.deliveryCode} compact />
        </div>
      )}
    </article>
  );
}
