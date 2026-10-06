import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { DEFAULT_LISTING_PARAMS, type ListingParams } from '@store/shared';
import { ErrorState } from '@/components/ErrorState';
import { useProductListing } from '../api';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './ProductGrid';

interface ProductRailProps {
  title: string;
  description: string;
  params: Partial<ListingParams>;
  seeAllHref: string;
}

const RAIL_SIZE = 8;
const ITEM = 'w-40 shrink-0 snap-start sm:w-48';

/** Horizontal row of products backed by a listing query, with a link to the full list. */
export function ProductRail({ title, description, params, seeAllHref }: ProductRailProps) {
  const listing = useProductListing({ ...DEFAULT_LISTING_PARAMS, ...params, pageSize: RAIL_SIZE });
  const headingId = `rail-${title.toLowerCase().replace(/\W+/g, '-')}`;

  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h2 id={headingId} className="text-xl font-semibold tracking-tight">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Link to={seeAllHref} className="inline-flex shrink-0 items-center gap-1 text-sm font-medium hover:underline">
          See all <ArrowRight className="size-4" aria-hidden />
        </Link>
      </div>
      {listing.isError ? (
        <ErrorState what="these products" onRetry={() => void listing.refetch()} />
      ) : (
        <ul className="-mx-4 flex snap-x gap-4 overflow-x-auto px-4 pb-2 [scrollbar-width:thin]">
          {listing.data
            ? listing.data.items.map((product) => (
                <li key={product.id} className={`${ITEM} flex`}>
                  <ProductCard product={product} />
                </li>
              ))
            : Array.from({ length: 6 }, (_, i) => (
                <li key={i} className={ITEM}>
                  <ProductCardSkeleton />
                </li>
              ))}
        </ul>
      )}
    </section>
  );
}
