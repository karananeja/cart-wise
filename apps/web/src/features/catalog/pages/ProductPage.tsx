import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState } from '@/components/ErrorState';
import { NotFound } from '@/components/NotFound';
import { ApiError } from '@/lib/api';
import { useProduct } from '../api';
import { AvailabilityNote } from '../components/AvailabilityNote';
import { Price } from '../components/Price';
import { ProductGallery } from '../components/ProductGallery';
import { Rating } from '../components/Rating';

/**
 * Minimal product view so listing cards lead somewhere real (spec FR-16).
 * F-003 replaces this with the full product page.
 */
export function ProductPage() {
  const { productSlug = '' } = useParams();
  const product = useProduct(productSlug);

  if (product.error instanceof ApiError && product.error.isNotFound) return <NotFound title="We couldn't find that product" />;
  if (product.isError) return <ErrorState what="this product" onRetry={() => void product.refetch()} />;
  if (!product.data) {
    if (product.fetchStatus === 'paused') return <OfflineState what="this product" />;
    return (
      <div className="grid gap-8 md:grid-cols-2" role="status" aria-label="Loading product">
        <Skeleton className="aspect-square rounded-xl" />
        <div className="flex flex-col gap-3">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  const p = product.data;
  return (
    <div className="flex flex-col gap-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/">Home</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to={`/c/${p.categorySlug}`}>{p.categoryName}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="line-clamp-1">{p.title}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <article className="grid gap-8 md:grid-cols-2">
        <ProductGallery images={p.imageUrls.length ? p.imageUrls : [p.thumbnailUrl]} title={p.title} />
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            {p.brand && <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">{p.brand}</p>}
            <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{p.title}</h1>
            <Rating value={p.rating} />
          </div>
          <Price pricePaise={p.pricePaise} mrpPaise={p.mrpPaise} discountPercent={p.discountPercent} size="lg" />
          <AvailabilityNote availability={p.availability} />
          {p.availability.status === 'in_stock' && <p className="text-sm text-emerald-700 dark:text-emerald-400">In stock</p>}
          <p className="leading-relaxed text-muted-foreground">{p.description}</p>
          {p.specifications.length > 0 && (
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-t pt-4 text-sm">
              {p.specifications.map((spec) => (
                <div key={spec.label} className="contents">
                  <dt className="text-muted-foreground">{spec.label}</dt>
                  <dd>{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}
          <Link to={`/c/${p.categorySlug}`} className="mt-2 inline-flex items-center gap-1 text-sm font-medium hover:underline">
            <ArrowLeft className="size-4" aria-hidden /> More in {p.categoryName}
          </Link>
        </div>
      </article>
    </div>
  );
}
