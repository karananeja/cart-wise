import type { ProductSummary } from '@store/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductCard } from './ProductCard';

const GRID = 'grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4';

export function ProductGrid({ products }: { products: ProductSummary[] }) {
  return (
    <ul className={GRID}>
      {products.map((product, index) => (
        <li key={product.id} className="flex">
          <ProductCard product={product} eager={index < 4} />
        </li>
      ))}
    </ul>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-hidden>
      <Skeleton className="aspect-square rounded-xl" />
      <Skeleton className="h-3 w-1/3" />
      <Skeleton className="h-4 w-5/6" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className={GRID} role="status" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
