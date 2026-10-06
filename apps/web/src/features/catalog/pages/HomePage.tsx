import { ErrorState, OfflineState } from '@/components/ErrorState';
import { useCategories } from '../api';
import { CategoryGrid, CategoryGridSkeleton } from '../components/CategoryGrid';
import { ProductRail } from '../components/ProductRail';

export function HomePage() {
  const categories = useCategories();

  return (
    <div className="flex flex-col gap-12">
      <section aria-labelledby="categories-heading" className="flex flex-col gap-5">
        <div>
          <h1 id="categories-heading" className="text-2xl font-semibold tracking-tight sm:text-3xl">
            Shop by category
          </h1>
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
