import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { CANCEL_REASONS, formatPrice, type CancelReason, type Order } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ApiError } from '@/lib/api';
import { useCancelPaidOrder } from './api';
import { orderActionError } from './messages';

/** Cancel before shipping: states the refund before confirming (spec FR-9, FR-10). */
export function CancelOrderDialog({ order, disabled, onRefused }: { order: Order; disabled?: boolean; onRefused: () => void }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<CancelReason | ''>('');
  const cancel = useCancelPaidOrder(order.id);
  const paid = order.payment!;

  const confirm = () =>
    cancel.mutate(reason ? { reason } : {}, {
      onSuccess: () => setOpen(false),
      onError: (e) => {
        if (e instanceof ApiError && e.code === 'NOT_CANCELLABLE') {
          setOpen(false);
          onRefused();
        }
      },
    });

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) cancel.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" disabled={disabled}>
          Cancel order
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this order?</DialogTitle>
          <DialogDescription>
            {formatPrice(paid.paidPaise)} will be refunded to {paid.label} straight away. Demo refund — no money moves.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="cancel-reason">Reason (optional)</Label>
          <select
            id="cancel-reason"
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={reason}
            onChange={(e) => setReason(e.target.value as CancelReason | '')}
          >
            <option value="">Choose a reason</option>
            {CANCEL_REASONS.map((r) => (
              <option key={r.id} value={r.id}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {cancel.isError && !(cancel.error instanceof ApiError && cancel.error.code === 'NOT_CANCELLABLE') && (
          <Alert variant="destructive">
            <AlertDescription>{orderActionError(cancel.error)}</AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Keep order
          </Button>
          <Button variant="destructive" onClick={confirm} disabled={cancel.isPending}>
            {cancel.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Yes, cancel order
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
