import { Loader2, TimerOff, XCircle } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { formatPrice } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { NotFound } from '@/components/NotFound';
import { StatusMessage } from '@/components/StatusMessage';
import { ApiError } from '@/lib/api';
import { formatEstimate, useCancelOrder, useOrder } from './api';
import { HoldCountdown } from './HoldCountdown';
import { OrderSummary } from './OrderSummary';

/**
 * The payment step. Until F-009 adds card, UPI and offers, it shows the held order with a
 * countdown and lets the customer cancel back to their (unchanged) cart (spec FR-16, FR-17).
 */
export function PaymentPage() {
  const { orderId = '' } = useParams();
  const order = useOrder(orderId);
  const cancel = useCancelOrder();
  const navigate = useNavigate();

  if (order.error instanceof ApiError && order.error.isNotFound) return <NotFound title="We couldn't find that order" />;
  if (!order.data) return order.isError ? <ErrorState what="your order" onRetry={() => void order.refetch()} /> : <Skeleton className="mx-auto h-96 w-full max-w-3xl" />;

  const o = order.data;
  const backToCart = (
    <Button asChild>
      <Link to="/cart">Back to cart</Link>
    </Button>
  );
  if (o.status === 'payment_expired') {
    return <StatusMessage icon={<TimerOff />} title="Your hold expired" description="The items are back on sale. Your cart is still here." actions={backToCart} />;
  }
  if (o.status === 'cancelled') {
    return <StatusMessage icon={<XCircle />} title="This order was cancelled" description="Nothing was charged. Your cart is unchanged." actions={backToCart} />;
  }

  return (
    <div className="mx-auto grid w-full max-w-4xl grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_20rem]">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">Order {o.id}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment</h1>
        </div>
        <HoldCountdown expiresAt={o.holdExpiresAt} onExpire={() => void order.refetch()} />
        <div className="flex flex-col gap-2 rounded-xl border p-5">
          <p className="text-sm text-muted-foreground">Amount to pay</p>
          <p className="text-3xl font-semibold tabular-nums">{formatPrice(o.totals.totalPaise)}</p>
          <p className="text-sm text-muted-foreground">Payment options will appear here.</p>
        </div>
        <div className="text-sm text-muted-foreground">
          <p>
            Delivering to {o.address.fullName}, {o.address.line1}, {o.address.city} {o.address.pincode}
          </p>
          <p>
            {o.delivery.label} delivery · arrives {formatEstimate(o.delivery.estimate)}
          </p>
        </div>
        <Button
          variant="outline"
          className="w-fit"
          disabled={cancel.isPending}
          onClick={() =>
            cancel.mutate(o.id, {
              onSuccess: () => navigate('/cart', { state: { authNotice: 'Order cancelled. Nothing was charged and your cart is unchanged.' } }),
            })
          }
        >
          {cancel.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Cancel and return to cart
        </Button>
      </div>
      <OrderSummary totals={o.totals} className="min-w-0">
        <ul className="flex flex-col gap-1 border-t pt-3 text-sm">
          {o.lines.map((line) => (
            <li key={`${line.productId}-${line.size}`} className="flex justify-between gap-2">
              <span className="truncate">
                {line.title}
                {line.size && ` (${line.size})`} × {line.quantity}
              </span>
              <span className="tabular-nums">{formatPrice(line.unitPricePaise * line.quantity)}</span>
            </li>
          ))}
        </ul>
      </OrderSummary>
    </div>
  );
}
