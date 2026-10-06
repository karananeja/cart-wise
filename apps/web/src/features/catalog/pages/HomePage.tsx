import { STORE_NAME } from '@/app/store';
import { ErrorState, OfflineState } from '@/components/ErrorState';
import { ContinueShopping } from '@/features/discovery/ContinueShopping';
import { useCategories } from '../api';
import { CategoryGrid, CategoryGridSkeleton } from '../components/CategoryGrid';
import { ProductRail } from '../components/ProductRail';
import { RecentlyViewedRail } from '../components/RecentlyViewedRail';

export function HomePage() {
  const categories = useCategories();

  return (
    <div className="flex flex-col gap-12">
      {/* The page heading comes first so the sections below (h2) are in order for screen readers. */}
      <h1 className="sr-only">{STORE_NAME}</h1>
      {/* Returning visitors pick up where they left off (F-012); first-time visitors see nothing here. */}
      <ContinueShopping />
      <section aria-labelledby="categories-heading" className="flex flex-col gap-5">
        <div>
          <h2 id="categories-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Shop by category
          </h2>
          <p className="text-muted-foreground">Everything from skincare to smartphones, in one place.</p>
        </div>
        {categories.data ? (
          <CategoryGrid categories={categories.data} />
        ) : categories.isError ? (
          <ErrorState what="categories" onRetry={() => void categories.refetch()} />
        ) : categories.fetchStatus === 'paused' ? (
          <OfflineState what="categories" />
        ) : (
          <CategoryGridSkeleton />
        )}
      </section>

      <RecentlyViewedRail showClear />

      {/* Factual rails only: no "trending" until there is real behavioural data (spec FR-6). */}
      <ProductRail
        title="Top rated"
        description="Highest-rated products that are in stock."
        params={{ sort: 'rating', inStock: true }}
        seeAllHref="/products?inStock=1&sort=rating"
      />
      <ProductRail
        title="Biggest discounts"
        description="The largest price drops available right now."
        params={{ sort: 'discount', inStock: true }}
        seeAllHref="/products?inStock=1&sort=discount"
      />
    </div>
  );
}
