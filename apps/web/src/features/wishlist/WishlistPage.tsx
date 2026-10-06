import { useState } from 'react';
import { Heart, Loader2 } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router';
import type { ProductDetail, ProductOption, ProductSummary } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ErrorState, OfflineState } from '@/components/ErrorState';
import { StatusMessage } from '@/components/StatusMessage';
import { catalogKeys } from '@/features/catalog/api';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { ProductGridSkeleton } from '@/features/catalog/components/ProductGrid';
import { RecentlyViewedRail } from '@/features/catalog/components/RecentlyViewedRail';
import { OptionSelector } from '@/features/catalog/components/OptionSelector';
import { SizeSelector } from '@/features/catalog/components/SizeSelector';
import { defaultOption } from '@/features/catalog/selection';
import { useAddToCart } from '@/features/cart/api';
import { cartErrorMessage } from '@/features/cart/messages';
import { apiGet } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useToggleWishlist, useWishlist } from './api';

export function WishlistPage() {
  const wishlist = useWishlist();
  const [moved, setMoved] = useState<string>();

  if (!wishlist.data) {
    if (wishlist.isError) return <ErrorState what="your wishlist" onRetry={() => void wishlist.refetch()} />;
    if (wishlist.fetchStatus === 'paused') return <OfflineState what="your wishlist" />;
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Wishlist</h1>
        <ProductGridSkeleton count={4} />
      </div>
    );
  }

  const { items, count } = wishlist.data;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
        Wishlist
        {count > 0 && <span className="ml-2 text-base font-normal text-muted-foreground">({count} {count === 1 ? 'item' : 'items'})</span>}
      </h1>
      <p role="status" aria-live="polite" className="text-sm">
        {moved && (
          <>
            Moved {moved} to cart ·{' '}
            <Link to="/cart" className="font-medium underline underline-offset-4">
              View cart
            </Link>
          </>
        )}
      </p>
      {items.length === 0 ? (
        <EmptyWishlist />
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
          {items.map(({ product }) => (
            <li key={product.id} className="flex flex-col gap-3">
              <ProductCard product={product} />
              <MoveToCart product={product} onMoved={() => setMoved(product.title)} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Adds to the cart (asking for a size or option when the product has them), then removes from
 * the wishlist. If the add fails the item stays saved and the reason is shown (spec FR-9).
 */
function MoveToCart({ product, onMoved }: { product: ProductSummary; onMoved: () => void }) {
  const queryClient = useQueryClient();
  const add = useAddToCart();
  const toggle = useToggleWishlist();
  const online = useOnlineStatus();
  const [detail, setDetail] = useState<ProductDetail>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();

  if (product.availability.status === 'out_of_stock') {
    return (
      <Button variant="outline" disabled className="w-full">
        Out of stock
      </Button>
    );
  }

  const move = (unit: { size?: string; option?: ProductOption } = {}) => {
    setError(undefined);
    add.mutate(
      {
        productSlug: product.slug,
        size: unit.size ?? null,
        option: unit.option?.label ?? null,
        quantity: 1,
        source: 'wishlist',
        productId: product.id,
        pricePaise: unit.option?.pricePaise ?? product.pricePaise,
      },
      {
        onSuccess: () => {
          setDetail(undefined);
          toggle.mutate({ product, save: false, source: 'moved_to_cart' });
          onMoved();
        },
        onError: (e) => setError(cartErrorMessage(e)),
      },
    );
  };

  const start = async () => {
    setError(undefined);
    setLoading(true);
    try {
      // Summaries don't carry sizes or options; the product query is usually already cached.
      const product_ = await queryClient.fetchQuery({
        queryKey: catalogKeys.product(product.slug),
        queryFn: ({ signal }) => apiGet<{ product: ProductDetail }>(`/products/${encodeURIComponent(product.slug)}`, signal).then((r) => r.product),
      });
      if (product_.sizes.length > 0 || product_.options.length > 0) setDetail(product_);
      else move();
    } catch (e) {
      setError(cartErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const busy = loading || add.isPending;
  return (
    <div className="flex flex-col gap-1">
      <Button className="w-full" onClick={() => void start()} disabled={busy || !online} aria-label={`Move ${product.title} to cart`}>
        {busy && <Loader2 className="animate-spin" aria-hidden />}
        Move to cart
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {detail && detail.options.length > 0 && (
        <OptionPickerDialog
          product={detail}
          busy={add.isPending}
          error={error}
          onCancel={() => {
            setDetail(undefined);
            setError(undefined);
          }}
          onConfirm={(option) => move({ option })}
        />
      )}
      {detail && detail.sizes.length > 0 && (
        <SizePickerDialog
          product={detail}
          busy={add.isPending}
          error={error}
          onCancel={() => {
            setDetail(undefined);
            setError(undefined);
          }}
          onConfirm={(size) => move({ size })}
        />
      )}
    </div>
  );
}

function SizePickerDialog({
  product,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  product: ProductDetail;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (size: string) => void;
}) {
  const [size, setSize] = useState<string>();
  const [prompt, setPrompt] = useState<string>();
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      {/* Bottom-anchored on small screens, centred on larger ones. */}
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <DialogHeader>
          <DialogTitle>Choose a size</DialogTitle>
          <DialogDescription>{product.title}</DialogDescription>
        </DialogHeader>
        <SizeSelector
          sizes={product.sizes}
          value={size}
          onChange={(s) => {
            setSize(s);
            setPrompt(undefined);
          }}
          error={prompt ?? error}
        />
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => (size ? onConfirm(size) : setPrompt('Please select a size'))} disabled={busy}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Move to cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Options come preselected at the cheapest in-stock one, as on the product page (F-013 D2, FR-15). */
function OptionPickerDialog({
  product,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  product: ProductDetail;
  busy: boolean;
  error?: string;
  onCancel: () => void;
  onConfirm: (option: ProductOption) => void;
}) {
  const [label, setLabel] = useState(() => defaultOption(product.options)?.label);
  const option = product.options.find((o) => o.label === label);
  const name = product.optionName ?? 'option';
  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-sm:top-auto max-sm:bottom-0 max-sm:translate-y-0 max-sm:rounded-b-none">
        <DialogHeader>
          <DialogTitle>Choose {name.toLowerCase()}</DialogTitle>
          <DialogDescription>{product.title}</DialogDescription>
        </DialogHeader>
        <OptionSelector name={name} options={product.options} value={label} onChange={setLabel} />
        {error && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => option && onConfirm(option)} disabled={busy || !option}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            Move to cart
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmptyWishlist() {
  return (
    <div className="flex flex-col gap-10">
      <StatusMessage
        icon={<Heart />}
        title="Your wishlist is empty"
        description="Tap the heart on any product to save it for later."
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
