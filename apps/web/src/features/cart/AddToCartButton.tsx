import { useEffect, useState } from 'react';
import { Loader2, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router';
import type { ProductDetail } from '@store/shared';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useAddToCart, useCart, useRemoveCartLine, useUpdateCartLine } from './api';
import { cartErrorMessage } from './messages';
import { limitReasonFor, QuantityStepper } from './QuantityStepper';

interface AddToCartButtonProps {
  product: ProductDetail;
  selectedSize: string | undefined;
  /** The option chosen on the page (F-013); preselected, so there is always one unless all sold out. */
  selectedOption?: string;
  /** Called instead of adding when the product needs a size and none is chosen. */
  onSizeRequired: () => void;
}

/**
 * The product page's primary action (PDP-2). Once this product and size (or option) is in the cart, the
 * button becomes a quantity stepper in place, with a separate Go to cart link (spec FR-5, as
 * changed at Gate 2 review). − at 1 takes the item out and brings the button back.
 */
export function AddToCartButton({ product, selectedSize, selectedOption, onSizeRequired }: AddToCartButtonProps) {
  const cart = useCart();
  const add = useAddToCart();
  const update = useUpdateCartLine();
  const remove = useRemoveCartLine();
  const online = useOnlineStatus();
  const [status, setStatus] = useState<string>();

  // A different size or option is a different line: clear messages when it changes.
  useEffect(() => setStatus(undefined), [selectedSize, selectedOption]);

  const sized = product.sizes.length > 0;
  const size = selectedSize ?? null;
  const chosen = product.options.find((o) => o.label === selectedOption);
  const option = chosen?.label ?? null;
  const line = cart.data?.lines.find((l) => l.product.id === product.id && l.size === size && l.option === option);
  const soldOut =
    product.availability.status === 'out_of_stock' ||
    product.sizes.find((s) => s.label === selectedSize)?.availability.status === 'out_of_stock' ||
    (product.options.length > 0 && (!chosen || chosen.availability.status === 'out_of_stock'));
  const onError = (error: unknown) => setStatus(cartErrorMessage(error));

  const onAdd = () => {
    if (sized && !selectedSize) {
      onSizeRequired();
      return;
    }
    setStatus(undefined);
    add.mutate(
      { productSlug: product.slug, size, option, quantity: 1, source: 'product_page', productId: product.id, pricePaise: chosen?.pricePaise ?? product.pricePaise },
      { onSuccess: () => setStatus('Added to cart'), onError },
    );
  };

  let action;
  if (line) {
    action = (
      <div className="flex flex-wrap items-center gap-3">
        <QuantityStepper
          size="lg"
          quantity={line.quantity}
          max={line.maxQuantity}
          label={`Quantity in cart${line.size ? `, size ${line.size}` : line.option ? `, ${line.option}` : ''}`}
          disabled={!online}
          onChange={(quantity) => {
            setStatus(undefined);
            update.mutate({ lineId: line.id, quantity }, { onError });
          }}
          onRemove={() => {
            setStatus(undefined);
            remove.mutate(
              { lineId: line.id, productId: product.id, size: line.size, option: line.option, quantity: line.quantity },
              { onSuccess: () => setStatus('Removed from cart'), onError },
            );
          }}
          limitReason={line.issue === 'none' ? limitReasonFor(line.maxQuantity) : undefined}
        />
        <Button asChild size="lg" variant="outline" className="h-12">
          <Link to="/cart">Go to cart</Link>
        </Button>
      </div>
    );
  } else if (soldOut) {
    action = (
      <Button size="lg" className="h-12 w-full sm:w-72" disabled>
        Out of stock
      </Button>
    );
  } else {
    action = (
      <Button size="lg" className="h-12 w-full sm:w-72" onClick={onAdd} disabled={add.isPending || !online} aria-busy={add.isPending}>
        {add.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <ShoppingCart aria-hidden />}
        Add to cart
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {action}
      <div aria-live="polite" className="min-h-5 text-sm">
        {line?.issue === 'exceeds_stock' && (
          <p className="font-medium text-amber-800 dark:text-amber-300">Only {line.maxQuantity} available — reduce quantity</p>
        )}
        {status && <p className={status.startsWith('Added') || status.startsWith('Removed') ? 'text-muted-foreground' : 'text-destructive'}>{status}</p>}
        {!online && !soldOut && <p className="text-muted-foreground">You're offline. Reconnect to change your cart.</p>}
      </div>
    </div>
  );
}
