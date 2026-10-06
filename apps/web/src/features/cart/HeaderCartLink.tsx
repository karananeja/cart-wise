import { ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { useCart } from './api';

export function HeaderCartLink() {
  const cart = useCart();
  const count = cart.data?.totalQuantity ?? 0;
  const label = cart.data ? `Cart, ${count} ${count === 1 ? 'item' : 'items'}` : 'Cart';
  return (
    <Button asChild variant="ghost" size="icon" className="relative">
      <Link to="/cart" aria-label={label}>
        <ShoppingCart aria-hidden />
        {/* Hidden until loaded, so it never flashes "0". */}
        {count > 0 && (
          <span aria-hidden className="absolute -top-1 -right-1 flex min-w-4.5 items-center justify-center rounded-full bg-primary px-1 text-[0.65rem] leading-4.5 font-semibold text-primary-foreground tabular-nums">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </Link>
    </Button>
  );
}
