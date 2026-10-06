import { useRef, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { formatPrice, type Order, type PaymentAttemptView } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useCancelAttempt, useStartPayment, useVerifyRazorpay } from './api';
import { failureMessage, paymentErrorMessage } from './messages';
import { PaymentFailure } from './PaymentFailure';
import { loadRazorpay } from './razorpayCheckout';

interface RazorpayPaymentProps {
  order: Order;
  onPaid: (order: Order) => void;
  /** The order changed underneath (hold expired, or paid after all): reload it. */
  onHoldEnded: () => void;
}

type Stage = 'idle' | 'opening' | 'open' | 'confirming';

/**
 * Pay through Razorpay Checkout in test mode (F-014 FR-10–FR-12, ADR-005). Razorpay collects the
 * card, UPI, netbanking or EMI details in its own window; the server verifies the result before
 * the order is confirmed. Demo bank offers and demo EMI don't apply here.
 */
export function RazorpayPayment({ order, onPaid, onHoldEnded }: RazorpayPaymentProps) {
  const start = useStartPayment(order.id);
  const verify = useVerifyRazorpay();
  const cancel = useCancelAttempt();
  const online = useOnlineStatus();
  const [stage, setStage] = useState<Stage>('idle');
  const [problem, setProblem] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const confirming = useRef(false);

  const settle = (result: { attempt: PaymentAttemptView; order?: Order }) => {
    setStage('idle');
    if (result.order?.status === 'confirmed') onPaid(result.order);
    else if (result.attempt.failureReason === 'hold_expired') onHoldEnded();
    else if (result.attempt.status === 'failed' && result.attempt.failureReason !== 'cancelled') setFailure(failureMessage(result.attempt.failureReason));
  };

  const onError = (error: unknown) => {
    setStage('idle');
    if (error instanceof ApiError && ['HOLD_EXPIRED', 'ORDER_NOT_PENDING'].includes(error.code)) onHoldEnded();
    // Closed after paying: the server found the payment, so the order is confirmed.
    else if (error instanceof ApiError && error.code === 'ATTEMPT_NOT_PENDING') onHoldEnded();
    else setProblem(paymentErrorMessage(error));
  };

  const openCheckout = (attempt: PaymentAttemptView) => {
    const gateway = attempt.gateway;
    if (!gateway || !window.Razorpay) return onError(undefined);
    confirming.current = false;
    const checkout = new window.Razorpay({
      key: gateway.keyId,
      order_id: gateway.orderId,
      amount: gateway.amountPaise,
      currency: 'INR',
      name: 'Cartwise',
      description: `Order ${order.id} · test mode`,
      prefill: gateway.prefill,
      theme: { color: '#171717' },
      handler: (response) => {
        confirming.current = true;
        setStage('confirming');
        verify.mutate(
          {
            attemptId: attempt.id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpayOrderId: response.razorpay_order_id,
            razorpaySignature: response.razorpay_signature,
          },
          { onSuccess: settle, onError },
        );
      },
      modal: {
        ondismiss: () => {
          if (confirming.current) return;
          setStage('confirming');
          cancel.mutate(attempt.id, { onSuccess: settle, onError });
        },
      },
    });
    checkout.open();
    setStage('open');
  };

  const pay = async () => {
    setProblem(undefined);
    setFailure(undefined);
    setStage('opening');
    try {
      await loadRazorpay();
    } catch {
      setStage('idle');
      setProblem("Razorpay couldn't be loaded. Check your connection and try again, or use the demo payment.");
      return;
    }
    start.mutate({ method: 'razorpay' }, { onSuccess: (result) => openCheckout(result.attempt), onError });
  };

  const busy = stage !== 'idle';
  const label = {
    idle: `Pay ${formatPrice(order.totals.totalPaise)} with Razorpay`,
    opening: 'Opening Razorpay…',
    open: 'Complete the payment in the Razorpay window',
    confirming: 'Confirming payment…',
  }[stage];

  return (
    <div className="flex flex-col gap-4">
      {failure && <PaymentFailure message={failure} onRetry={() => setFailure(undefined)} />}
      <div className="flex flex-col gap-1 rounded-lg border p-3 text-sm">
        <p className="font-medium">Razorpay · test mode — no real money</p>
        <p className="text-muted-foreground">
          Pay by card, UPI, netbanking or EMI in Razorpay's window. Use Razorpay's test cards or the UPI ID success@razorpay. Demo bank offers and demo EMI
          don't apply here.
        </p>
      </div>
      {problem && (
        <Alert variant="destructive">
          <AlertDescription>{problem}</AlertDescription>
        </Alert>
      )}
      {!online && (
        <Alert>
          <AlertDescription>You're offline. Reconnect to pay.</AlertDescription>
        </Alert>
      )}
      <Button size="lg" className="h-12 w-full" onClick={() => void pay()} disabled={busy || !online} aria-busy={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        {label}
      </Button>
      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden /> Your payment details go to Razorpay, never to this store.
      </p>
    </div>
  );
}
