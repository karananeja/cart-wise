import { Loader2 } from 'lucide-react';
import { formatPrice, type PaymentAttemptView } from '@store/shared';
import { STORE_NAME } from '@/app/store';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useUpiResponse } from './api';
import { paymentErrorMessage } from './messages';

interface DemoUpiAppProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  attempt: PaymentAttemptView;
  orderId: string;
}

/** A phone-style stand-in for the customer's UPI app. No PIN in this simulation (user decision). */
export function DemoUpiApp({ open, onOpenChange, attempt, orderId }: DemoUpiAppProps) {
  const respond = useUpiResponse();
  const answer = (approve: boolean) => respond.mutate({ attemptId: attempt.id, approve }, { onSuccess: () => onOpenChange(false) });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto max-w-xs rounded-[2rem] border-8 border-foreground/80 p-6 sm:max-w-xs">
        <p className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase">Demo UPI app</p>
        <DialogTitle className="text-center text-lg">Payment request</DialogTitle>
        <DialogDescription className="text-center">Simulated — no money moves.</DialogDescription>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 rounded-xl bg-muted p-4 text-sm">
          <dt className="text-muted-foreground">Pay to</dt>
          <dd className="text-right font-medium">{STORE_NAME}</dd>
          <dt className="text-muted-foreground">Order</dt>
          <dd className="text-right font-mono text-xs">{orderId}</dd>
          <dt className="text-muted-foreground">Amount</dt>
          <dd className="text-right text-lg font-semibold tabular-nums">{formatPrice(attempt.amountPaise)}</dd>
        </dl>
        {respond.isError && (
          <Alert variant="destructive">
            <AlertDescription>{paymentErrorMessage(respond.error)}</AlertDescription>
          </Alert>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Button variant="outline" disabled={respond.isPending} onClick={() => answer(false)}>
            Decline
          </Button>
          <Button disabled={respond.isPending} onClick={() => answer(true)}>
            {respond.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Approve
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
