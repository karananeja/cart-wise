import { useEffect, useState, type FormEvent } from 'react';
import { Loader2, QrCode, Smartphone } from 'lucide-react';
import QRCode from 'qrcode';
import { formatPrice, isUpiId, offerDiscountPaise, OFFERS, type Order, type PaymentAttemptView } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/features/auth/components';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useAttempt, useCancelAttempt, useStartPayment } from './api';
import { DemoUpiApp } from './DemoUpiApp';
import { failureMessage, paymentErrorMessage } from './messages';
import { PaymentFailure } from './PaymentFailure';

interface UpiPaymentProps {
  order: Order;
  onPaid: (order: Order) => void;
  onHoldEnded: () => void;
}

type Way = 'upi_id' | 'upi_qr';

/** UPI by ID (collect request) or QR, approved in the in-page demo UPI app (spec FR-13–FR-17). */
export function UpiPayment({ order, onPaid, onHoldEnded }: UpiPaymentProps) {
  const [way, setWay] = useState<Way>('upi_id');
  const [upiId, setUpiId] = useState('');
  const [idError, setIdError] = useState<string>();
  const [attemptId, setAttemptId] = useState<string>();
  const [failure, setFailure] = useState<string>();
  const start = useStartPayment(order.id);
  const attempt = useAttempt(attemptId);
  const online = useOnlineStatus();
  const current = attempt.data?.attempt;
  const cardOfferWouldApply = OFFERS.some((offer) => offerDiscountPaise(offer, order.totals.totalPaise) > 0);

  // Follow the polled attempt to its outcome.
  useEffect(() => {
    if (!current || current.status === 'pending') return;
    if (current.status === 'succeeded' && attempt.data?.order) onPaid(attempt.data.order);
    if (current.status === 'failed') {
      setAttemptId(undefined);
      if (current.failureReason === 'hold_expired') onHoldEnded();
      else if (current.failureReason !== 'cancelled') setFailure(failureMessage(current.failureReason));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current?.status]);

  const begin = (input: { method: 'upi_id'; upiId: string } | { method: 'upi_qr' }) => {
    setFailure(undefined);
    start.mutate(input, {
      onSuccess: (result) => setAttemptId(result.attempt.id),
      onError: (error) => {
        if (error instanceof ApiError && ['HOLD_EXPIRED', 'ORDER_NOT_PENDING'].includes(error.code)) onHoldEnded();
      },
    });
  };

  const sendRequest = (event: FormEvent) => {
    event.preventDefault();
    const value = upiId.trim();
    if (!isUpiId(value)) {
      setIdError('Enter a UPI ID like name@bank');
      return;
    }
    setIdError(undefined);
    begin({ method: 'upi_id', upiId: value });
  };

  if (current?.status === 'pending') return <UpiPending attempt={current} order={order} />;

  return (
    <div className="flex flex-col gap-5">
      {failure && <PaymentFailure message={failure} onRetry={() => setFailure(undefined)} />}
      {cardOfferWouldApply && <p className="text-sm text-muted-foreground">Bank card offers don't apply to UPI payments.</p>}
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="sr-only">How do you want to pay by UPI?</legend>
        {(
          [
            ['upi_id', 'Pay by UPI ID', <Smartphone key="i" className="size-4" aria-hidden />],
            ['upi_qr', 'Scan QR code', <QrCode key="q" className="size-4" aria-hidden />],
          ] as const
        ).map(([value, label, icon]) => (
          <label
            key={value}
            className="flex cursor-pointer items-center gap-2 rounded-lg border p-3 text-sm font-medium has-[:checked]:border-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
          >
            <input type="radio" name="upi-way" value={value} checked={way === value} onChange={() => setWay(value)} />
            {icon}
            {label}
          </label>
        ))}
      </fieldset>

      {way === 'upi_id' ? (
        <form onSubmit={sendRequest} noValidate className="flex flex-col gap-4">
          <FormField label="UPI ID" placeholder="name@bank" autoComplete="off" value={upiId} error={idError} onChange={(e) => setUpiId(e.target.value)} />
          <Button type="submit" size="lg" className="h-12 w-full sm:w-fit" disabled={start.isPending || !online}>
            {start.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Send payment request
          </Button>
        </form>
      ) : (
        <Button type="button" size="lg" className="h-12 w-full sm:w-fit" disabled={start.isPending || !online} onClick={() => begin({ method: 'upi_qr' })}>
          {start.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Show QR code
        </Button>
      )}
      {start.isError && (
        <Alert variant="destructive">
          <AlertDescription>{paymentErrorMessage(start.error)}</AlertDescription>
        </Alert>
      )}
      {!online && (
        <Alert>
          <AlertDescription>You're offline. Reconnect to pay.</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function useSecondsLeft(until: string) {
  const left = () => Math.max(0, Math.round((Date.parse(until) - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(left);
  useEffect(() => {
    const timer = setInterval(() => setSeconds(left()), 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [until]);
  return seconds;
}

function UpiPending({ attempt, order }: { attempt: PaymentAttemptView; order: Order }) {
  const [appOpen, setAppOpen] = useState(false);
  const [qr, setQr] = useState<string>();
  const cancel = useCancelAttempt();
  const seconds = useSecondsLeft(attempt.expiresAt);
  const isQr = attempt.method === 'upi_qr';

  useEffect(() => {
    if (!attempt.qrUri) return;
    let live = true;
    void QRCode.toDataURL(attempt.qrUri, { margin: 1, width: 200 }).then((url) => live && setQr(url)).catch(() => undefined);
    return () => {
      live = false;
    };
  }, [attempt.qrUri]);

  return (
    <section aria-labelledby="upi-pending" className="flex flex-col items-start gap-4 rounded-xl border p-5">
      <h2 id="upi-pending" className="text-lg font-semibold">
        {isQr ? 'Scan to pay with any UPI app' : 'Approve the request in your UPI app'}
      </h2>
      <p className="text-sm text-muted-foreground" role="status">
        {isQr ? 'Waiting for payment' : `Request sent to ${attempt.label.replace(/^UPI · /, '')}`} · {formatPrice(attempt.amountPaise)} · expires in{' '}
        <span className="tabular-nums">
          {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
        </span>
      </p>
      {isQr && (
        <div className="flex flex-col items-start gap-2">
          {qr ? (
            <img src={qr} width={200} height={200} alt={`Demo UPI QR code to pay ${formatPrice(attempt.amountPaise)} for order ${order.id}`} className="rounded-lg border bg-white p-2" />
          ) : (
            <div className="size-[200px] animate-pulse rounded-lg bg-muted" aria-hidden />
          )}
          {attempt.qrUri && <code className="text-xs break-all text-muted-foreground">{attempt.qrUri}</code>}
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <Button type="button" onClick={() => setAppOpen(true)}>
          <Smartphone aria-hidden /> {isQr ? 'Simulate scan' : 'Open demo UPI app'}
        </Button>
        <Button type="button" variant="outline" disabled={cancel.isPending} onClick={() => cancel.mutate(attempt.id)}>
          Cancel request
        </Button>
      </div>
      {cancel.isError && (
        <Alert variant="destructive">
          <AlertDescription>{paymentErrorMessage(cancel.error)}</AlertDescription>
        </Alert>
      )}
      <DemoUpiApp open={appOpen} onOpenChange={setAppOpen} attempt={attempt} orderId={order.id} />
    </section>
  );
}
