import { Link } from 'react-router';
import type { Category } from '@store/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { ProductImage } from './ProductImage';

const GRID = 'grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8';

export function CategoryGrid({ categories }: { categories: Category[] }) {
  return (
    <ul className={GRID}>
      {categories.map((category) => (
        <li key={category.slug}>
          <Link to={`/c/${category.slug}`} className="group flex flex-col items-center gap-2 rounded-xl p-1 text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <ProductImage key={category.imageUrl} src={category.imageUrl} alt="" className="w-full transition group-hover:brightness-95" />
            <span className="text-xs leading-tight font-medium sm:text-sm">{category.name}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function CategoryGridSkeleton() {
  return (
    <div className={GRID} role="status" aria-label="Loading categories">
      {Array.from({ length: 8 }, (_, i) => (
        <div key={i} className="flex flex-col items-center gap-2" aria-hidden>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
