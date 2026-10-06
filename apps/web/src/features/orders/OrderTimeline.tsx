import { Check, Circle, XCircle } from 'lucide-react';
import { ORDER_FLOW, ORDER_STATUS_LABELS, type Order, type OrderHistoryStatus } from '@store/shared';
import { cn } from '@/lib/utils';
import { formatDateTime } from './format';

interface Step {
  key: string;
  label: string;
  at: string | null;
  state: 'done' | 'current' | 'upcoming' | 'cancelled';
}

/** Lifecycle steps for an order: done ones with times, cancellation replacing what was still ahead. */
export function timelineSteps(order: Order): Step[] {
  const timeOf = (status: OrderHistoryStatus) => order.history.find((h) => h.status === status)?.at ?? null;
  const reached = ORDER_FLOW.filter((s) => timeOf(s) !== null);
  const last = reached[reached.length - 1];
  const cancelled = order.status === 'cancelled';
  const steps: Step[] = (cancelled ? reached : ORDER_FLOW).map((status) => ({
    key: status,
    label: ORDER_STATUS_LABELS[status],
    at: timeOf(status),
    state: timeOf(status) === null ? 'upcoming' : status === last && !cancelled ? 'current' : 'done',
  }));
  if (cancelled) steps.push({ key: 'cancelled', label: 'Cancelled', at: order.cancelledAt ?? timeOf('cancelled'), state: 'cancelled' });
  return steps;
}

const STATE_TEXT: Record<Step['state'], string> = { done: 'Done', current: 'Current step', upcoming: 'Not yet', cancelled: 'Cancelled' };

export function OrderTimeline({ order }: { order: Order }) {
  const steps = timelineSteps(order);
  return (
    <ol aria-label="Order progress" className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0" aria-current={step.state === 'current' ? 'step' : undefined}>
          {i < steps.length - 1 && <span className={cn('absolute top-6 left-[11px] h-full w-0.5', step.state === 'upcoming' ? 'bg-border' : 'bg-emerald-600/60')} aria-hidden />}
          <span
            className={cn(
              'relative z-10 flex size-6 shrink-0 items-center justify-center rounded-full border-2 [&_svg]:size-3.5',
              step.state === 'done' && 'border-emerald-600 bg-emerald-600 text-white',
              step.state === 'current' && 'border-emerald-600 bg-background text-emerald-600 ring-4 ring-emerald-600/20',
              step.state === 'upcoming' && 'border-border bg-background text-muted-foreground',
              step.state === 'cancelled' && 'border-destructive bg-destructive text-white',
            )}
            aria-hidden
          >
            {step.state === 'cancelled' ? <XCircle /> : step.state === 'upcoming' ? <Circle /> : <Check />}
          </span>
          <div className="flex min-w-0 flex-col text-sm">
            <span className={cn('font-medium', step.state === 'upcoming' && 'text-muted-foreground', step.state === 'current' && 'text-emerald-700 dark:text-emerald-400')}>
              {step.label}
              <span className="sr-only"> — {STATE_TEXT[step.state]}</span>
            </span>
            {step.at && <span className="text-xs text-muted-foreground">{formatDateTime(step.at)}</span>}
          </div>
        </li>
      ))}
    </ol>
  );
}
