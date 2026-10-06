import { SearchX } from 'lucide-react';
import { StatusMessage } from '@/components/StatusMessage';
import { useCategories } from '@/features/catalog/api';
import { CategoryGrid, CategoryGridSkeleton } from '@/features/catalog/components/CategoryGrid';
import { ProductRail } from '@/features/catalog/components/ProductRail';

/** Nothing matched even partially: tips plus ways to keep shopping (spec FR-17). */
export function NoSearchResults({ query }: { query: string }) {
  const categories = useCategories();
  return (
    <div className="flex flex-col gap-10">
      <StatusMessage
        icon={<SearchX />}
        title={`No results for “${query}”`}
        description={
          <ul className="flex flex-col gap-1">
            <li>Check the spelling.</li>
            <li>Try fewer or more general words, like “shoes” instead of “red running shoes”.</li>
            <li>Or browse a category below.</li>
          </ul>
        }
        className="py-8"
      />
      <section aria-labelledby="browse-categories" className="flex flex-col gap-4">
        <h2 id="browse-categories" className="text-xl font-semibold tracking-tight">
          Browse categories
        </h2>
        {categories.data ? <CategoryGrid categories={categories.data} /> : <CategoryGridSkeleton />}
      </section>
      <ProductRail
        title="Top rated"
        description="Highest-rated products that are in stock."
        params={{ sort: 'rating', inStock: true }}
        seeAllHref="/products?inStock=1&sort=rating"
      />
    </div>
  );
}
