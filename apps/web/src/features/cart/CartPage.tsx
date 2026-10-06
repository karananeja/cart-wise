import { useState } from 'react';
import { AlertTriangle, Heart, ShoppingCart, Trash2, WifiOff } from 'lucide-react';
import { Link } from 'react-router';
import { formatPrice, type CartLineView, type CartView } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState } from '@/components/ErrorState';
import { StatusMessage } from '@/components/StatusMessage';
import { UndoToast, useTimedNotice } from '@/components/UndoToast';
import { Price } from '@/features/catalog/components/Price';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { RecentlyViewedRail } from '@/features/catalog/components/RecentlyViewedRail';
import { CartDiscovery } from '@/features/discovery/CartDiscovery';
import { useToggleWishlist } from '@/features/wishlist/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { cn } from '@/lib/utils';
import { useAddToCart, useCart, useRemoveCartLine, useUpdateCartLine } from './api';
import { cartErrorMessage } from './messages';
import { limitReasonFor, QuantityStepper } from './QuantityStepper';

interface RemovedLine {
  key: number;
  /** What the toast says, e.g. "Removed X" or "Moved X to wishlist". */
  message: string;
  title: string;
  productSlug: string;
  productId: number;
  pricePaise: number;
  size: string | null;
  quantity: number;
}

export function CartPage() {
  const cart = useCart();
  const online = useOnlineStatus();
  const update = useUpdateCartLine();
  const remove = useRemoveCartLine();
  const add = useAddToCart();
  const saveToWishlist = useToggleWishlist();
  const [error, setError] = useState<string>();
  // Undo is offered for a few seconds after a removal.
  const [removed, setRemoved] = useTimedNotice<RemovedLine>();

  if (!cart.data) {
    if (cart.isError) return <ErrorState what="your cart" onRetry={() => void cart.refetch()} />;
    if (cart.fetchStatus === 'paused') return <OfflineState what="your cart" />;
    return <CartSkeleton />;
  }

  const view = cart.data;
  const onError = (e: unknown) => setError(cartErrorMessage(e));

  const changeQuantity = (line: CartLineView, quantity: number) => {
    setError(undefined);
    update.mutate({ lineId: line.id, quantity }, { onError });
  };

  const removeLine = (line: CartLineView, message = `Removed ${line.product.title}`) => {
    setError(undefined);
    setRemoved({
      key: Date.now(),
      message,
      title: line.product.title,
      productSlug: line.product.slug,
      productId: line.product.id,
      pricePaise: line.product.pricePaise,
      size: line.size,
      quantity: line.quantity,
    });
    remove.mutate(
      { lineId: line.id, productId: line.product.id, size: line.size, quantity: line.quantity },
      {
        onError: (e) => {
          setRemoved(undefined);
          onError(e);
        },
      },
    );
  };

  // Save first; only take the line out of the cart once the product is safely saved.
  const moveToWishlist = (line: CartLineView) => {
    setError(undefined);
    saveToWishlist.mutate(
      { product: line.product, save: true, source: 'cart' },
      { onSuccess: () => removeLine(line, `Moved ${line.product.title} to wishlist`), onError },
    );
  };

  const undo = () => {
    if (!removed) return;
    const { productSlug, size, quantity, productId, pricePaise } = removed;
    setRemoved(undefined);
    add.mutate({ productSlug, size, quantity, source: 'undo', productId, pricePaise }, { onError });
  };

  return (
    <div className="flex flex-col gap-6 pb-20 lg:pb-0">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Your cart
        {view.totalQuantity > 0 && (
          <span className="ml-2 text-base font-normal text-muted-foreground">
            ({view.totalQuantity} {view.totalQuantity === 1 ? 'item' : 'items'})
          </span>
        )}
      </h1>

      {!online && (
        <Alert>
          <WifiOff aria-hidden />
          <AlertDescription>You're offline. Your cart is shown as last loaded; changes are paused until you reconnect.</AlertDescription>
        </Alert>
      )}
      <div aria-live="assertive">
        {error && (
          <Alert variant="destructive">
            <AlertTriangle aria-hidden />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>

      {view.lines.length === 0 ? (
        <EmptyCart />
      ) : (
        <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
          <section aria-label="Cart items" className="flex flex-col gap-4">
            {view.hasIssues && (
              <Alert>
                <AlertTriangle aria-hidden />
                <AlertDescription>Some items need your attention. They are not included in the subtotal until resolved.</AlertDescription>
              </Alert>
            )}
            <ul className="flex flex-col divide-y rounded-xl border">
              {view.lines.map((line) => (
                <CartLine
                  key={line.id}
                  line={line}
                  disabled={!online}
                  onQuantity={(q) => changeQuantity(line, q)}
                  onRemove={() => removeLine(line)}
                  onMoveToWishlist={() => moveToWishlist(line)}
                />
              ))}
            </ul>
            <Link to="/products" className="w-fit text-sm font-medium hover:underline">
              Continue shopping
            </Link>
          </section>
          <CartSummary cart={view} />
        </div>
      )}

      {/* After the lines and the checkout action, never between them (F-012 FR-10). */}
      <CartDiscovery cart={view} />

      {view.lines.length > 0 && <MobileSubtotalBar cart={view} />}
      <UndoToast notice={removed} onUndo={undo} onDismiss={() => setRemoved(undefined)} />
    </div>
  );
}

function CartLine({
  line,
  disabled,
  onQuantity,
  onRemove,
  onMoveToWishlist,
}: {
  line: CartLineView;
  disabled: boolean;
  onQuantity: (quantity: number) => void;
  onRemove: () => void;
  onMoveToWishlist: () => void;
}) {
  const { product } = line;
  const href = `/p/${product.slug}${line.size ? `?size=${encodeURIComponent(line.size)}` : ''}`;
  const unavailable = line.issue === 'out_of_stock';

  return (
    <li className={cn('flex gap-4 p-4', line.issue !== 'none' && 'bg-amber-50/60 dark:bg-amber-950/20')}>
      <Link to={href} className={cn('w-20 shrink-0 sm:w-24', unavailable && 'opacity-50 grayscale')} tabIndex={-1} aria-hidden>
        <ProductImage key={product.thumbnailUrl} src={product.thumbnailUrl} alt="" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <div className="min-w-0 flex-1">
            {product.brand && <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{product.brand}</p>}
            <h2 className="text-sm leading-snug font-medium">
              <Link to={href} className="hover:underline">
                {product.title}
              </Link>
            </h2>
            {line.size && <p className="text-sm text-muted-foreground">Size: {line.size}</p>}
          </div>
        </div>
        <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} discountPercent={product.discountPercent} />
        <LineIssue line={line} />
        <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-2">
          {!unavailable && (
            <QuantityStepper
              quantity={line.quantity}
              max={line.maxQuantity}
              label={`Quantity for ${product.title}${line.size ? `, size ${line.size}` : ''}`}
              disabled={disabled}
              onChange={onQuantity}
              limitReason={line.issue === 'none' ? limitReasonFor(line.maxQuantity) : undefined}
            />
          )}
          <Button variant="ghost" size="sm" onClick={onRemove} disabled={disabled} aria-label={`Remove ${product.title}${line.size ? `, size ${line.size}` : ''}`}>
            <Trash2 aria-hidden /> Remove
          </Button>
          <Button variant="ghost" size="sm" onClick={onMoveToWishlist} disabled={disabled} aria-label={`Move ${product.title} to wishlist`}>
            <Heart aria-hidden /> Move to wishlist
          </Button>
          {!unavailable && (
            <p className="ml-auto text-sm font-semibold tabular-nums">
              <span className="sr-only">Line total </span>
              {formatPrice(line.linePricePaise)}
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function LineIssue({ line }: { line: CartLineView }) {
  if (line.issue === 'out_of_stock') {
    return <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Out of stock{line.size ? ` in ${line.size}` : ''}</p>;
  }
  if (line.issue === 'exceeds_stock') {
    return <p className="text-sm font-medium text-amber-800 dark:text-amber-300">Only {line.maxQuantity} available — reduce quantity</p>;
  }
  return null;
}

function CartSummary({ cart }: { cart: CartView }) {
  const { totals } = cart;
  return (
    <section aria-labelledby="summary-heading" className="flex flex-col gap-3 rounded-xl border p-5 lg:sticky lg:top-24">
      <h2 id="summary-heading" className="text-lg font-semibold">
        Order summary
      </h2>
      <dl className="grid grid-cols-[1fr_auto] gap-y-2 text-sm">
        <dt className="text-muted-foreground">Items</dt>
        <dd className="text-right tabular-nums">{totals.itemCount}</dd>
        <dt className="text-muted-foreground">Total MRP</dt>
        <dd className="text-right tabular-nums">{formatPrice(totals.mrpPaise)}</dd>
        {totals.discountPaise > 0 && (
          <>
            <dt className="text-muted-foreground">Discount</dt>
            <dd className="text-right text-emerald-700 tabular-nums dark:text-emerald-400">−{formatPrice(totals.discountPaise)}</dd>
          </>
        )}
        <dt className="text-muted-foreground">Delivery</dt>
        <dd className="text-right text-muted-foreground">Calculated at checkout</dd>
        <dt className="border-t pt-3 text-base font-semibold">Subtotal</dt>
        <dd className="border-t pt-3 text-right text-base font-semibold tabular-nums">{formatPrice(totals.subtotalPaise)}</dd>
      </dl>
      <p className="text-xs text-muted-foreground">Inclusive of all taxes</p>
      {cart.hasIssues && <p className="text-xs text-amber-800 dark:text-amber-300">Items that need attention are not included.</p>}
      <CheckoutButton cart={cart} />
    </section>
  );
}

/** The cart's primary action; disabled, with the reason, when the cart can't be bought yet. */
function CheckoutButton({ cart, className }: { cart: CartView; className?: string }) {
  const blocked = cart.hasIssues || cart.totals.itemCount === 0;
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      {blocked ? (
        <Button size="lg" className="h-11 w-full" disabled>
          Proceed to checkout
        </Button>
      ) : (
        <Button asChild size="lg" className="h-11 w-full">
          <Link to="/checkout">Proceed to checkout</Link>
        </Button>
      )}
      {cart.hasIssues && <p className="text-xs text-muted-foreground">Fix the highlighted items to continue.</p>}
    </div>
  );
}

function MobileSubtotalBar({ cart }: { cart: CartView }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
      <p className="flex flex-col text-sm">
        <span className="text-muted-foreground">
          Subtotal ({cart.totals.itemCount} {cart.totals.itemCount === 1 ? 'item' : 'items'})
        </span>
        <span className="text-base font-semibold tabular-nums">{formatPrice(cart.totals.subtotalPaise)}</span>
      </p>
      <CheckoutButton cart={cart} className="flex-1 [&_p]:hidden" />
    </div>
  );
}

function EmptyCart() {
  return (
    <div className="flex flex-col gap-10">
      <StatusMessage
        icon={<ShoppingCart />}
        title="Your cart is empty"
        description="Find something you like and add it here."
        actions={
          <Button asChild>
            <Link to="/products">Start shopping</Link>
          </Button>
        }
      />
      <RecentlyViewedRail />
    </div>
  );
}

function CartSkeleton() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-label="Loading your cart">
      <Skeleton className="h-8 w-40" />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-4">
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-4">
              <Skeleton className="size-24 rounded-xl" />
              <div className="flex flex-1 flex-col gap-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-4 w-1/3" />
                <Skeleton className="h-8 w-32" />
              </div>
            </div>
          ))}
        </div>
        <Skeleton className="h-56 rounded-xl" />
      </div>
    </div>
  );
}
