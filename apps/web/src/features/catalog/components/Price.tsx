import { formatPrice } from '@store/shared';
import { cn } from '@/lib/utils';

interface PriceProps {
  pricePaise: number;
  mrpPaise: number;
  discountPercent: number;
  size?: 'default' | 'lg';
}

export function Price({ pricePaise, mrpPaise, discountPercent, size = 'default' }: PriceProps) {
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
      <span className={cn('font-semibold tabular-nums', size === 'lg' ? 'text-2xl' : 'text-base')}>
        <span className="sr-only">Price </span>
        {formatPrice(pricePaise)}
      </span>
      {discountPercent > 0 && (
        <>
          <s className="text-sm text-muted-foreground tabular-nums">
            <span className="sr-only">Original price </span>
            {formatPrice(mrpPaise)}
          </s>
          <span className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{discountPercent}% off</span>
        </>
      )}
    </p>
  );
}
