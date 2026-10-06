import { useEffect, useRef } from 'react';
import { XCircle } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** A failed attempt: the plain reason and Try again. Nothing is lost (spec FR-18). */
export function PaymentFailure({ message, onRetry }: { message: string; onRetry: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), [message]);
  return (
    <Alert variant="destructive" role="alert" ref={ref} tabIndex={-1}>
      <XCircle aria-hidden />
      <AlertTitle>Payment failed</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>{message} Your items are still held and your cart is unchanged.</span>
        <Button type="button" size="sm" variant="outline" className="w-fit" onClick={onRetry}>
          Try again
        </Button>
      </AlertDescription>
    </Alert>
  );
}
