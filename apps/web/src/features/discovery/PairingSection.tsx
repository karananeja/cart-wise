import { Fragment, useId, useState } from 'react';
import { Link } from 'react-router';
import { Loader2, Plus } from 'lucide-react';
import { formatPrice, PAIRING_TITLES, type PairingKind, type ProductDetail, type RecommendedProduct } from '@store/shared';
import { Button } from '@/components/ui/button';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { useAddToCart } from '@/features/cart/api';
import { cartErrorMessage } from '@/features/cart/messages';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { trackRecommendation } from './api';

interface PairingSectionProps {
  product: ProductDetail;
  /** The size chosen on the page, when the product has sizes. */
  selectedSize?: string;
  /** The option chosen on the page, when the product has options (F-013). */
  selectedOption?: string;
  pairing: { kind: PairingKind; items: RecommendedProduct[] };
}

const buttonLabel = (count: number) => (count === 2 ? 'Add both to cart' : `Add all ${count} to cart`);
const reasonText = (error: unknown) => cartErrorMessage(error).replace(/\.$/, '').toLowerCase();

/**
 * "Frequently bought together" (real co-purchases) or "Pairs well with" (category map), with a
 * one-tap add for this product and the ticked companions (spec FR-7, FR-8). Companions with sizes
 * or options link to their page instead: those are never picked blindly. This product is added in
 * the size or option chosen on the page.
 */
export function PairingSection({ product, selectedSize, selectedOption, pairing }: PairingSectionProps) {
  const headingId = useId();
  const [unticked, setUnticked] = useState<Set<number>>(new Set());
  const [message, setMessage] = useState<{ tone: 'ok' | 'warn'; text: string }>();
  const [busy, setBusy] = useState(false);
  const add = useAddToCart();
  const online = useOnlineStatus();

  const companions = pairing.items;
  const ticked = companions.filter((c) => !c.needsSize && !unticked.has(c.id));
  const option = product.options.find((o) => o.label === selectedOption);
  const productPrice = option?.pricePaise ?? product.pricePaise;
  const total = productPrice + ticked.reduce((sum, c) => sum + c.pricePaise, 0);
  const needsPageSize = product.sizes.length > 0 && !selectedSize;
  const soldOut = product.availability.status === 'out_of_stock';
  const position = (c: RecommendedProduct) => companions.indexOf(c) + 1;

  const toggle = (id: number, on: boolean) =>
    setUnticked((current) => {
      const next = new Set(current);
      if (on) next.delete(id);
      else next.add(id);
      return next;
    });

  const addAll = async () => {
    setBusy(true);
    setMessage(undefined);
    const queue = [
      {
        item: product,
        size: product.sizes.length > 0 ? (selectedSize ?? null) : null,
        option: option?.label ?? null,
        pricePaise: productPrice,
        companion: false,
      },
      ...ticked.map((c) => ({ item: c, size: null, option: null, pricePaise: c.pricePaise, companion: true })),
    ];
    const added: string[] = [];
    const failed: string[] = [];
    // One at a time: the cart applies its rules (stock, limits) to each item in turn.
    for (const { item, size, option: chosen, pricePaise, companion } of queue) {
      try {
        await add.mutateAsync({ productSlug: item.slug, size, option: chosen, quantity: 1, source: 'recommendation', productId: item.id, pricePaise });
        added.push(item.title);
        if (companion) trackRecommendation('product', pairing.kind, item.id, position(item as RecommendedProduct));
      } catch (error) {
        failed.push(`${item.title} (${reasonText(error)})`);
      }
    }
    setBusy(false);
    if (!failed.length) setMessage({ tone: 'ok', text: `Added ${added.length} ${added.length === 1 ? 'item' : 'items'} to your cart` });
    else if (!added.length) setMessage({ tone: 'warn', text: `Couldn't add ${failed.join(', ')}` });
    else setMessage({ tone: 'warn', text: `Added ${added.join(', ')}; couldn't add ${failed.join(', ')}` });
  };

  const disabledReason = soldOut ? 'This item is out of stock' : needsPageSize ? 'Choose a size above first' : !online ? "You're offline" : undefined;
  const hintId = useId();

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4 rounded-xl border p-4 sm:p-5">
      <h2 id={headingId} className="text-xl font-semibold tracking-tight">
        {PAIRING_TITLES[pairing.kind]}
      </h2>
      <ul className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
        <PairItem product={product} label="This item" pricePaise={productPrice} detail={option?.label} />
        {companions.map((c) => (
          <Fragment key={c.id}>
            <li aria-hidden className="flex items-center justify-center text-muted-foreground">
              <Plus className="size-5" />
            </li>
            <PairItem
              product={c}
              onOpen={() => trackRecommendation('product', pairing.kind, c.id, position(c))}
              control={
                c.needsSize ? (
                  <Link
                    to={`/p/${c.slug}`}
                    className="text-sm font-medium underline-offset-4 hover:underline"
                    onClick={() => trackRecommendation('product', pairing.kind, c.id, position(c))}
                  >
                    {c.hasOptions ? 'Choose option' : 'Choose size'}
                  </Link>
                ) : (
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={!unticked.has(c.id)} onChange={(e) => toggle(c.id, e.target.checked)} />
                    <span className="sr-only">Include {c.title}</span>
                    <span aria-hidden>Include</span>
                  </label>
                )
              }
            />
          </Fragment>
        ))}
      </ul>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-sm">
          Total for {ticked.length + 1} {ticked.length === 0 ? 'item' : 'items'}:{' '}
          <span className="text-base font-semibold tabular-nums" aria-live="polite">
            {formatPrice(total)}
          </span>
        </p>
        {/* With no companion ticked the group adds nothing the page's own Add to cart doesn't, so it
            offers no second, identically named button. */}
        {ticked.length === 0 ? (
          <p className="text-sm text-muted-foreground">Tick an item to add them together.</p>
        ) : (
          <Button variant="outline" onClick={() => void addAll()} disabled={busy || !!disabledReason} aria-describedby={disabledReason ? hintId : undefined}>
            {busy && <Loader2 className="animate-spin" aria-hidden />}
            {buttonLabel(ticked.length + 1)}
          </Button>
        )}
        {ticked.length > 0 && disabledReason && (
          <p id={hintId} className="text-sm text-muted-foreground">
            {disabledReason}
          </p>
        )}
      </div>
      <div aria-live="polite">
        {message && <p className={message.tone === 'ok' ? 'text-sm text-emerald-700 dark:text-emerald-400' : 'text-sm text-amber-700 dark:text-amber-400'}>{message.text}</p>}
      </div>
    </section>
  );
}

function PairItem({
  product,
  label,
  pricePaise,
  detail,
  control,
  onOpen,
}: {
  product: ProductDetail | RecommendedProduct;
  label?: string;
  /** This item's price in the chosen option; companions show their (starting) price. */
  pricePaise?: number;
  /** The chosen option, e.g. "256 GB". */
  detail?: string;
  control?: React.ReactNode;
  onOpen?: () => void;
}) {
  return (
    <li className="flex flex-1 items-center gap-3 rounded-lg bg-muted/40 p-3 sm:flex-col sm:items-start">
      <ProductImage src={product.thumbnailUrl} alt="" className="size-16 shrink-0 sm:size-20" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {label ? (
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
        ) : null}
        {onOpen ? (
          <Link to={`/p/${product.slug}`} onClick={onOpen} className="line-clamp-2 text-sm font-medium hover:underline">
            {product.title}
          </Link>
        ) : (
          <p className="line-clamp-2 text-sm font-medium">{product.title}</p>
        )}
        <p className="text-sm tabular-nums">
          {pricePaise === undefined && product.hasOptions && <span className="text-muted-foreground">From </span>}
          {formatPrice(pricePaise ?? product.pricePaise)}
          {detail && <span className="text-muted-foreground"> · {detail}</span>}
        </p>
        {control}
      </div>
    </li>
  );
}
