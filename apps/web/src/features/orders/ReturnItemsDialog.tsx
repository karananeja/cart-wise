import { useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { allocatePaise, formatPrice, RETURN_REASONS, type Order, type ReturnReason } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { useRequestReturn } from './api';
import { orderActionError } from './messages';

/**
 * Each line's refund: its total minus its share of the bank offer, shared over all lines
 * (spec FR-12). The same rule as the server, so the preview matches what is refunded.
 */
export function lineRefunds(order: Order): Map<number, number> {
  const totals = order.lines.map((l) => l.unitPricePaise * l.quantity);
  const shares = allocatePaise(totals, order.payment?.offerDiscountPaise ?? 0);
  return new Map(order.lines.map((l, i) => [l.id, totals[i]! - shares[i]!]));
}

/** Choose items → give reasons → confirm the refund (spec FR-11). */
export function ReturnItemsDialog({ order, disabled }: { order: Order; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<'choose' | 'confirm'>('choose');
  const [reasons, setReasons] = useState<Map<number, ReturnReason | ''>>(new Map());
  const [showErrors, setShowErrors] = useState(false);
  const request = useRequestReturn(order.id);
  const refunds = useMemo(() => lineRefunds(order), [order]);

  const returned = new Set(order.returns.flatMap((r) => r.lines.map((l) => l.orderLineId)));
  const returnable = order.lines.filter((l) => !returned.has(l.id));
  const selected = [...reasons.keys()];
  const missingReason = selected.some((id) => !reasons.get(id));
  const total = selected.reduce((sum, id) => sum + (refunds.get(id) ?? 0), 0);

  const reset = () => {
    setStep('choose');
    setReasons(new Map());
    setShowErrors(false);
    request.reset();
  };

  const toggle = (id: number, on: boolean) =>
    setReasons((current) => {
      const next = new Map(current);
      if (on) next.set(id, '');
      else next.delete(id);
      return next;
    });

  const proceed = () => {
    setShowErrors(true);
    if (selected.length && !missingReason) setStep('confirm');
  };

  const submit = () =>
    request.mutate(
      selected.map((id) => ({ orderLineId: id, reason: reasons.get(id) as ReturnReason })),
      { onSuccess: () => setOpen(false) },
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button disabled={disabled}>Return items</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        {step === 'choose' ? (
          <>
            <DialogHeader>
              <DialogTitle>Return items</DialogTitle>
              <DialogDescription>Choose the items to return and tell us why. Each item is returned in full.</DialogDescription>
            </DialogHeader>
            <fieldset className="flex flex-col gap-3">
              <legend className="sr-only">Items to return</legend>
              {returnable.map((line) => {
                const checked = reasons.has(line.id);
                const reasonId = `return-reason-${line.id}`;
                const reasonMissing = showErrors && checked && !reasons.get(line.id);
                return (
                  <div key={line.id} className="flex flex-col gap-2 rounded-lg border p-3">
                    <label className="flex cursor-pointer items-center gap-3 text-sm">
                      <input type="checkbox" checked={checked} onChange={(e) => toggle(line.id, e.target.checked)} />
                      <ProductImage src={line.thumbnailUrl} alt="" className="size-10 shrink-0" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{line.title}</span>
                        <span className="text-muted-foreground">
                          {line.size && <>Size {line.size} · </>}Qty {line.quantity} · refund {formatPrice(refunds.get(line.id) ?? 0)}
                        </span>
                      </span>
                    </label>
                    {checked && (
                      <div className="flex flex-col gap-1 pl-7">
                        <label htmlFor={reasonId} className="text-sm font-medium">
                          Reason for {line.title}
                        </label>
                        <select
                          id={reasonId}
                          className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm aria-invalid:border-destructive"
                          value={reasons.get(line.id)}
                          aria-invalid={reasonMissing || undefined}
                          aria-describedby={reasonMissing ? `${reasonId}-error` : undefined}
                          onChange={(e) => setReasons((current) => new Map(current).set(line.id, e.target.value as ReturnReason))}
                        >
                          <option value="">Choose a reason</option>
                          {RETURN_REASONS.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        {reasonMissing && (
                          <p id={`${reasonId}-error`} className="text-xs text-destructive">
                            Choose a reason
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </fieldset>
            {showErrors && !selected.length && <p className="text-sm text-destructive">Choose at least one item.</p>}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={proceed}>Continue</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Confirm your return</DialogTitle>
              <DialogDescription>
                {formatPrice(total)} will be refunded to {order.payment?.label} once the items are picked up.
              </DialogDescription>
            </DialogHeader>
            <ul className="flex flex-col gap-1 text-sm">
              {selected.map((id) => {
                const line = order.lines.find((l) => l.id === id)!;
                return (
                  <li key={id} className="flex justify-between gap-3">
                    <span className="truncate">
                      {line.title} · {RETURN_REASONS.find((r) => r.id === reasons.get(id))?.label}
                    </span>
                    <span className="tabular-nums">{formatPrice(refunds.get(id) ?? 0)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-muted-foreground">
              Refunds are what you paid for these items{order.payment?.offerDiscountPaise ? ', less their share of the bank offer' : ''}. The delivery charge isn't refunded. Demo refund — no money moves.
            </p>
            {request.isError && (
              <Alert variant="destructive">
                <AlertDescription>{orderActionError(request.error)}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep('choose')}>
                Back
              </Button>
              <Button onClick={submit} disabled={request.isPending}>
                {request.isPending && <Loader2 className="animate-spin" aria-hidden />}
                Request return
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
