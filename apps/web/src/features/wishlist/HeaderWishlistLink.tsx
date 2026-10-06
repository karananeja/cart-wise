import { Heart } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useWishlist } from './api';

export function HeaderWishlistLink() {
  const wishlist = useWishlist();
  const count = wishlist.data?.count ?? 0;
  const label = wishlist.data ? `Wishlist, ${count} ${count === 1 ? 'item' : 'items'}` : 'Wishlist';
  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to="/wishlist" aria-label={label}>
        <Heart aria-hidden />
        {count > 0 && (
          <span aria-hidden className="absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] leading-4.5 font-semibold text-primary-foreground tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
