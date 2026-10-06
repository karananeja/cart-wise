import { useEffect, useState } from 'react';
import { Check, Loader2, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import type { ProductDetail } from '@store/shared';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useAddToCart, useCart } from './api';
import { cartErrorMessage } from './messages';

interface AddToCartButtonProps {
  product: ProductDetail;
  selectedSize: string | undefined;
  /** Called instead of adding when the product needs a size and none is chosen. */
  onSizeRequired: () => void;
}

/**
 * The product page's primary action (PDP-2): Add to cart, then Go to cart once this product
 * and size is in the cart (spec FR-5).
 */
export function AddToCartButton({ product, selectedSize, onSizeRequired }: AddToCartButtonProps) {
  const cart = useCart();
  const add = useAddToCart();
  const online = useOnlineStatus();
  const [added, setAdded] = useState(false);

  // A different size is a different line: forget the "added" notice when the size changes.
  useEffect(() => setAdded(false), [selectedSize]);

  const sized = product.sizes.length > 0;
  const size = selectedSize ?? null;
  const inCart = cart.data?.lines.some((line) => line.product.id === product.id && line.size === size) ?? false;
  const soldOut =
    product.availability.status === 'out_of_stock' ||
    product.sizes.find((s) => s.label === selectedSize)?.availability.status === 'out_of_stock';

  const onAdd = () => {
    if (sized && !selectedSize) {
      onSizeRequired();
      return;
    }
    add.mutate(
      { productSlug: product.slug, size, quantity: 1, source: 'product_page', productId: product.id, pricePaise: product.pricePaise },
      { onSuccess: () => setAdded(true) },
    );
  };

  let button;
  if (soldOut) {
    button = (
      <Button size="lg" className="h-12 w-full sm:w-72" disabled>
        Out of stock
      </Button>
    );
  } else if (inCart) {
    button = (
      <Button asChild size="lg" variant={added ? 'outline' : 'default'} className="h-12 w-full sm:w-72">
        <Link to="/cart">Go to cart</Link>
      </Button>
    );
  } else {
    button = (
      <Button size="lg" className="h-12 w-full sm:w-72" onClick={onAdd} disabled={add.isPending || !online} aria-busy={add.isPending}>
        {add.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ShoppingCart aria-hidden />}
        Add to cart
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {button}
      <div aria-live="polite" className="text-sm">
        {added && inCart && (
          <p className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400">
            <Check className="size-4" aria-hidden /> Added to cart ·{' '}
            <Link to="/cart" className="font-medium underline underline-offset-4">
              View cart
            </Link>
          </p>
        )}
        {add.isError && !inCart && <p className="text-destructive">{cartErrorMessage(add.error)}</p>}
        {!online && !soldOut && !inCart && <p className="text-muted-foreground">You're offline. Reconnect to add items.</p>}
      </div>
    </div>
  );
}
