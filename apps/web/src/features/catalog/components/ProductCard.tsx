import { Link } from 'react-router';
import type { ProductSummary } from '@store/shared';
import { cn } from '@/lib/utils';
import { AvailabilityNote } from './AvailabilityNote';
import { Price } from './Price';
import { ProductImage } from './ProductImage';
import { Rating } from './Rating';

export function ProductCard({ product, eager }: { product: ProductSummary; eager?: boolean }) {
  const outOfStock = product.availability.status === 'out_of_stock';
  return (
    <article className="group relative flex flex-col gap-3">
      <ProductImage
        key={product.thumbnailUrl}
        src={product.thumbnailUrl}
        alt=""
        eager={eager}
        className={cn('transition group-hover:brightness-95', outOfStock && 'opacity-50 grayscale')}
      />
      <div className="flex flex-1 flex-col gap-1">
        {product.brand && <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{product.brand}</p>}
        <h3 className="line-clamp-2 text-sm leading-snug font-medium">
          <Link
            to={`/p/${product.slug}`}
            className="after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:ring-2 focus-visible:after:ring-ring"
          >
            {product.title}
          </Link>
        </h3>
        <Rating value={product.rating} />
        <div className="mt-auto pt-1">
          <Price pricePaise={product.pricePaise} mrpPaise={product.mrpPaise} discountPercent={product.discountPercent} />
          <AvailabilityNote availability={product.availability} />
        </div>
      </div>
    </article>
  );
}
