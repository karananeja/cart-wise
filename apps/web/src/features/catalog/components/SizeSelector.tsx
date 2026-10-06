import type { ProductSize } from '@store/shared';
import { cn } from '@/lib/utils';

interface SizeSelectorProps {
  sizes: ProductSize[];
  value: string | undefined;
  onChange: (size: string) => void;
}

/**
 * One button per size (native radios, so keyboard and screen readers behave as a group).
 * Sold-out sizes stay visible, struck through and not selectable (F-003 spec FR-9).
 */
export function SizeSelector({ sizes, value, onChange }: SizeSelectorProps) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-sm font-medium">Size</legend>
      <div className="flex flex-wrap gap-2">
        {sizes.map((size) => {
          const soldOut = size.availability.status === 'out_of_stock';
          const selected = size.label === value;
          return (
            <label
              key={size.label}
              className={cn(
                'relative flex h-10 min-w-12 cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium transition',
                'has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                selected ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground',
                soldOut && 'cursor-not-allowed border-dashed text-muted-foreground line-through hover:border-input',
              )}
            >
              <input
                type="radio"
                name="size"
                value={size.label}
                checked={selected}
                disabled={soldOut}
                onChange={() => onChange(size.label)}
                className="sr-only"
              />
              {size.label}
              {soldOut && <span className="sr-only"> (out of stock)</span>}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
