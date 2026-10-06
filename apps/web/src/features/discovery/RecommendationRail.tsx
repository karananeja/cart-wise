import { useId, type MouseEvent } from 'react';
import type { RecommendationKind, RecommendationSurface, RecommendedProduct } from '@store/shared';
import { ProductCard } from '@/features/catalog/components/ProductCard';
import { ProductCardSkeleton } from '@/features/catalog/components/ProductGrid';
import { trackRecommendation } from './api';

const ITEM = 'w-40 shrink-0 snap-start sm:w-48';

interface RecommendationRailProps {
  title: string;
  description?: string;
  /** undefined while loading: placeholders keep the space so nothing jumps. */
  items: RecommendedProduct[] | undefined;
  surface: RecommendationSurface;
  kind: RecommendationKind;
}

/**
 * A horizontal row of suggested products, styled like the catalog rails. Empty means hidden:
 * suggestions never show "nothing to suggest" (spec §13).
 */
export function RecommendationRail({ title, description, items, surface, kind }: RecommendationRailProps) {
  const headingId = useId();
  if (items && items.length === 0) return null;

  // Opening a product from the rail counts as a recommendation click; the wishlist heart doesn't.
  const onClick = (product: RecommendedProduct, position: number) => (event: MouseEvent) => {
    if ((event.target as HTMLElement).closest('a')) trackRecommendation(surface, kind, product.id, position);
  };

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div>
        <h2 id={headingId} className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]" aria-busy={!items || undefined}>
        {items
          ? items.map((product, i) => (
              <li key={product.id} className={`${ITEM} flex`} onClick={onClick(product, i + 1)}>
                <ProductCard product={product} />
              </li>
            ))
          : Array.from({ length: 6 }, (_, i) => (
              <li key={i} className={ITEM}>
                <ProductCardSkeleton />
              </li>
            ))}
      </ul>
    </section>
  );
}
