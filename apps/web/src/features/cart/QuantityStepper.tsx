import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface QuantityStepperProps {
  quantity: number;
  /** Highest allowed quantity (min of the per-line cap and stock). */
  max: number;
  /** Accessible name for the group, e.g. "Quantity for Check Shirt, size M". */
  label: string;
  onChange: (quantity: number) => void;
  /** When given, − at quantity 1 removes the item instead of being disabled. */
  onRemove?: () => void;
  /** Shown beside the stepper when + is disabled at the limit. */
  limitReason?: string;
  disabled?: boolean;
  size?: 'default' | 'lg';
}

export function QuantityStepper({ quantity, max, label, onChange, onRemove, limitReason, disabled = false, size = 'default' }: QuantityStepperProps) {
  const atMax = quantity >= max;
  const removes = quantity <= 1 && onRemove !== undefined;
  const buttonSize = size === 'lg' ? 'icon-lg' : 'icon';

  return (
    <div className="flex items-center gap-3">
      <div role="group" aria-label={label} className={cn('inline-flex items-center rounded-lg border', size === 'lg' && 'h-12')}>
        <Button
          variant="ghost"
          size={buttonSize}
          disabled={disabled || (quantity <= 1 && !onRemove)}
          onClick={() => (removes ? onRemove() : onChange(quantity - 1))}
          aria-label={removes ? 'Remove from cart' : 'Decrease quantity'}
          className={cn(size === 'lg' && 'h-full w-12')}
        >
          {removes ? <Trash2 aria-hidden /> : <Minus aria-hidden />}
        </Button>
        <output aria-live="polite" className={cn('text-center font-medium tabular-nums', size === 'lg' ? 'w-10 text-base' : 'w-8 text-sm')}>
          {quantity}
        </output>
        <Button
          variant="ghost"
          size={buttonSize}
          disabled={disabled || atMax}
          onClick={() => onChange(quantity + 1)}
          aria-label="Increase quantity"
          className={cn(size === 'lg' && 'h-full w-12')}
        >
          <Plus aria-hidden />
        </Button>
      </div>
      {atMax && limitReason && <span className="text-xs text-muted-foreground">{limitReason}</span>}
    </div>
  );
}

/** Why + is disabled: the per-line cap, or real stock. */
export function limitReasonFor(max: number): string {
  return max >= 10 ? 'Max 10 per order' : `Only ${max} available`;
}
