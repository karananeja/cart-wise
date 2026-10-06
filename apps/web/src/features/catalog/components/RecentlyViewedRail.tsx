import { useQuery } from '@tanstack/react-query';
import type { ProductSummary } from '@store/shared';
import { Button } from '@/components/ui/button';
import { apiGet } from '@/lib/api';
import { clearRecentlyViewed, useRecentlyViewed } from '@/lib/recentlyViewed';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductGrid';

const ITEM = 'w-40 shrink-0 snap-start sm:w-48';
const RAIL_LIMIT = 12;

interface RecentlyViewedRailProps {
  /** Leave out the product currently on screen. */
  excludeSlug?: string;
  showClear?: boolean;
}

/**
 * Products this browser viewed recently, with current price and stock fetched fresh.
 * Hidden when empty or when loading fails: it is a convenience, never a blocker.
 */
export function RecentlyViewedRail({ excludeSlug, showClear = false }: RecentlyViewedRailProps) {
  const slugs = useRecentlyViewed()
    .map((p) => p.slug)
    .filter((slug) => slug !== excludeSlug)
    .slice(0, RAIL_LIMIT);
  const query = useQuery({
    queryKey: ['products', 'batch', slugs.join(',')],
    queryFn: ({ signal }) => apiGet<{ items: ProductSummary[] }>(`/products/batch?slugs=${slugs.join(',')}`, signal).then((r) => r.items),
    enabled: slugs.length > 0,
    retry: false,
  });

  if (slugs.length === 0 || query.isError || (query.data && query.data.length === 0)) return null;

  return (
    <section aria-labelledby="recently-viewed" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <h2 id="recently-viewed" className="text-xl font-semibold tracking-tight">
          Recently viewed
        </h2>
        {showClear && (
          <Button variant="link" size="sm" className="h-auto px-0" onClick={clearRecentlyViewed}>
            Clear
          </Button>
        )}
      </div>
      <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
        {query.data
          ? query.data.map((product) => (
              <li key={product.id} className={`${ITEM} flex`}>
                <ProductCard product={product} />
              </li>
            ))
          : slugs.slice(0, 6).map((slug) => (
              <li key={slug} className={ITEM}>
                <ProductCardSkeleton />
              </li>
            ))}
      </ul>
    </section>
  );
}
