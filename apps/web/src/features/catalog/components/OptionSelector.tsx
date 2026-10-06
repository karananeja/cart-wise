import { useId } from 'react';
import { formatPrice, type ProductOption } from '@store/shared';
import { cn } from '@/lib/utils';

interface OptionSelectorProps {
  /** What the options are, e.g. "Storage" or "Configuration". */
  name: string;
  options: ProductOption[];
  value: string | undefined;
  onChange: (option: string) => void;
}

/**
 * One button per storage or memory option, each with its price, so shoppers compare without
 * clicking through (F-013 FR-4). Native radios; sold-out options stay visible but can't be chosen.
 */
export function OptionSelector({ name, options, value, onChange }: OptionSelectorProps) {
  const groupName = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">{name}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
          const soldOut = option.availability.status === 'out_of_stock';
          const selected = option.label === value;
          return (
            <label
              key={option.label}
              className={cn(
                'relative flex min-h-14 min-w-28 cursor-pointer flex-col items-start justify-center rounded-lg border px-3 py-2 text-sm transition',
                'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                selected ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground',
                soldOut && 'cursor-not-allowed border-dashed text-muted-foreground hover:border-input',
              )}
            >
              <input
                type="radio"
                name={groupName}
                value={option.label}
                checked={selected}
                disabled={soldOut}
                onChange={() => onChange(option.label)}
                className="sr-only"
              />
              <span className={cn('font-medium', soldOut && 'line-through')}>{option.label}</span>
              <span className={cn('tabular-nums', selected ? 'text-background/80' : 'text-muted-foreground')}>
                {soldOut ? 'Out of stock' : formatPrice(option.pricePaise)}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
