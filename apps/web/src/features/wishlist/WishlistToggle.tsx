import { useState } from 'react';
import { Heart } from 'lucide-react';
import type { ProductSummary } from '@store/shared';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { cn } from '@/lib/utils';
import { useSavedIds, useToggleWishlist } from './api';

interface WishlistToggleProps {
  product: ProductSummary;
  /** `card`: round button over the image corner. `inline`: labelled button on the product page. */
  variant: 'card' | 'inline';
  className?: string;
}

function failureMessage(error: unknown) {
  return error instanceof ApiError && error.code === 'WISHLIST_FULL'
    ? 'Your wishlist is full — remove something to add more.'
    : "Couldn't update your wishlist. Please try again.";
}

/** Heart toggle: one tap saves, another removes (spec FR-1, FR-2). */
export function WishlistToggle({ product, variant, className }: WishlistToggleProps) {
  const saved = useSavedIds().has(product.id);
  const toggle = useToggleWishlist();
  const online = useOnlineStatus();
  const [error, setError] = useState<string>();
  const source = variant === 'card' ? 'product_card' : 'product_page';
  const label = saved ? `Remove ${product.title} from wishlist` : `Save ${product.title} to wishlist`;

  const onClick = () => {
    setError(undefined);
    toggle.mutate(
      saved ? { product, save: false, source } : { product, save: true, source },
      { onError: (e) => setError(failureMessage(e)) },
    );
  };

  const heart = <Heart aria-hidden className={cn(saved && 'fill-rose-500 text-rose-500')} />;
  const status = (
    <span role="status" className={variant === 'card' ? 'sr-only' : 'text-sm text-destructive'}>
      {error}
    </span>
  );

  if (variant === 'card') {
    return (
      <>
        <Button
          variant="outline"
          size="icon-lg"
          aria-pressed={saved}
          aria-label={label}
          disabled={!online}
          onClick={onClick}
          className={cn('relative z-10 rounded-full border-transparent bg-background/90 shadow-sm backdrop-blur hover:bg-background', className)}
        >
          {heart}
        </Button>
        {status}
      </>
    );
  }

  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <Button variant="outline" size="lg" className="h-12" aria-pressed={saved} aria-label={label} disabled={!online} onClick={onClick}>
        {heart}
        {saved ? 'Saved' : 'Save'}
      </Button>
      {status}
    </div>
  );
}
