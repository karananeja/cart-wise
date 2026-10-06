import { useState } from 'react';
import { CreditCard, Info, Landmark, Loader2, Smartphone, TimerOff, XCircle } from 'lucide-react';
import { Link, Navigate, useNavigate, useParams } from 'react-router';
import { formatPrice, type Order } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { QueryFallback } from '@/components/ErrorState';
import { NotFound } from '@/components/NotFound';
import { StatusMessage } from '@/components/StatusMessage';
import { formatEstimate, useCancelOrder, useOrder } from '@/features/checkout/api';
import { HoldCountdown } from '@/features/checkout/HoldCountdown';
import { OrderSummary } from '@/features/checkout/OrderSummary';
import { ApiError } from '@/lib/api';
import { usePaymentConfig } from './api';
import { CardPayment } from './CardPayment';
import { RazorpayPayment } from './RazorpayPayment';
import { NO_EXTRAS, type SummaryExtras } from './summary';
import { UpiPayment } from './UpiPayment';

/**
 * The payment step for a held order: the demo Card (bank offers, EMI) and UPI, simulated (F-009,
 * F-014), and Razorpay in test mode when configured (ADR-005). Failures keep the order, the hold
 * and the cart; success confirms the order.
 */
export function PaymentPage() {
  const { orderId = '' } = useParams();
  const order = useOrder(orderId);
  const cancel = useCancelOrder();
  const navigate = useNavigate();
  const [tab, setTab] = useState('card');
  const [extras, setExtras] = useState<SummaryExtras>(NO_EXTRAS);
  const razorpayEnabled = usePaymentConfig().data?.razorpay.enabled === true;

  if (order.error instanceof ApiError && order.error.isNotFound) return <NotFound title="We couldn't find that order" />;
  if (!order.data) return <QueryFallback query={order} what="your order" loading={<Skeleton className="mx-auto h-96 w-full max-w-3xl" />} />;

  const o = order.data;
  const backToCart = (
    <Button asChild>
      <Link to="/cart">Back to cart</Link>
    </Button>
  );
  // Paid: the confirmation right after payment, the order page once it has moved on.
  if (o.payment) return <Navigate to={o.status === 'confirmed' ? `/orders/${o.id}/confirmation` : `/orders/${o.id}`} replace />;
  if (o.status === 'payment_expired') {
    return <StatusMessage icon={<TimerOff />} title="Your hold expired" description="The items are back on sale. Your cart is still here." actions={backToCart} />;
  }
  if (o.status === 'cancelled') {
    return <StatusMessage icon={<XCircle />} title="This order was cancelled" description="Nothing was charged. Your cart is unchanged." actions={backToCart} />;
  }

  const onPaid = (paid: Order) => navigate(`/orders/${paid.id}/confirmation`, { replace: true });
  const onHoldEnded = () => void order.refetch();

  return (
    <div className="mx-auto grid w-full max-w-5xl grid-cols-1 items-start gap-8 pb-24 lg:grid-cols-[1fr_22rem] lg:pb-0">
      <div className="flex min-w-0 flex-col gap-5">
        <div>
          <p className="text-sm text-muted-foreground">Order {o.id}</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Payment</h1>
        </div>
        <HoldCountdown expiresAt={o.holdExpiresAt} onExpire={() => void order.refetch()} />
        <p className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2 text-sm text-muted-foreground">
          <Info className="size-4 shrink-0" aria-hidden /> Demo payment — no money is charged. Banks, cards and the UPI app are simulated
          {razorpayEnabled ? '; Razorpay runs in test mode.' : '.'}
        </p>

        <Tabs
          value={tab}
          onValueChange={(value) => {
            setTab(value);
            if (value !== 'card') setExtras(NO_EXTRAS);
          }}
        >
          <TabsList aria-label="Payment method" className="w-full sm:w-fit">
            <TabsTrigger value="card">
              <CreditCard aria-hidden /> Card
            </TabsTrigger>
            <TabsTrigger value="upi">
              <Smartphone aria-hidden /> UPI
            </TabsTrigger>
            {razorpayEnabled && (
              <TabsTrigger value="razorpay">
                <Landmark aria-hidden /> Razorpay
              </TabsTrigger>
            )}
          </TabsList>
          <TabsContent value="card">
            <CardPayment order={o} onSummaryChange={setExtras} onPaid={onPaid} onHoldEnded={onHoldEnded} />
          </TabsContent>
          <TabsContent value="upi">
            <UpiPayment order={o} onPaid={onPaid} onHoldEnded={onHoldEnded} />
          </TabsContent>
          {razorpayEnabled && (
            <TabsContent value="razorpay">
              <RazorpayPayment order={o} onPaid={onPaid} onHoldEnded={onHoldEnded} />
            </TabsContent>
          )}
        </Tabs>

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
      <OrderSummary totals={o.totals} payment={extras} className="min-w-0 lg:sticky lg:top-24">
        <ul className="flex flex-col gap-1 border-t pt-3 text-sm">
          {o.lines.map((line) => (
            <li key={line.id} className="flex justify-between gap-2">
              <span className="truncate">
                {line.title}
                {(line.size ?? line.option) && ` (${line.size ?? line.option})`} × {line.quantity}
              </span>
              <span className="tabular-nums">{formatPrice(line.unitPricePaise * line.quantity)}</span>
            </li>
          ))}
        </ul>
      </OrderSummary>
    </div>
  );
}
