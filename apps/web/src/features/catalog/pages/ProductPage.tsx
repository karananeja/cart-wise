import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { ProductDetail } from '@store/shared';
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
import { AddToCartButton } from '@/features/cart/AddToCartButton';
import { DeliveryCheck } from '@/features/delivery/DeliveryCheck';
import { ProductDiscovery } from '@/features/discovery/ProductDiscovery';
import { EmiBanner } from '@/features/payment/EmiBanner';
import { OfferBanner } from '@/features/payment/OfferBanner';
import { WishlistToggle } from '@/features/wishlist/WishlistToggle';
import { ApiError } from '@/lib/api';
import { track } from '@/lib/analytics';
import { recordProductView } from '@/lib/recentlyViewed';
import { useProduct } from '../api';
import { Price } from '../components/Price';
import { ProductGallery } from '../components/ProductGallery';
import { Rating } from '../components/Rating';
import { RecentlyViewedRail } from '../components/RecentlyViewedRail';
import { ReviewList } from '../components/ReviewList';
import { OptionSelector } from '../components/OptionSelector';
import { SizeSelector } from '../components/SizeSelector';
import { useSelectedOption, useSelectedSize } from '../selection';

export function ProductPage() {
  const { productSlug = '' } = useParams();
  const product = useProduct(productSlug);
  const selectedSize = useSelectedSize(product.data);
  const selectedOption = useSelectedOption(product.data);
  useTrackProductView(product.data);

  if (product.error instanceof ApiError && product.error.isNotFound) return <NotFound title="We couldn't find that product" />;
  if (product.isError) return <ErrorState what="this product" onRetry={() => void product.refetch()} />;
  if (!product.data) {
    if (product.fetchStatus === 'paused') return <OfflineState what="this product" />;
    return <ProductPageSkeleton />;
  }

  const p = product.data;
  // F-015: delivery dates come from our own rules (Delivery panel), so the catalog's "Shipping" text would contradict them.
  const specifications = p.specifications.filter((spec) => spec.label !== 'Shipping');
  return (
    <div className="flex flex-col gap-12">
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

        <article className="grid gap-8 md:grid-cols-2 lg:gap-12">
          <ProductGallery images={p.imageUrls.length ? p.imageUrls : [p.thumbnailUrl]} title={p.title} />
          <PurchasePanel product={p} />
        </article>
      </div>

      <section aria-labelledby="details-heading" className="grid gap-6 md:grid-cols-2 lg:gap-12">
        <div className="flex flex-col gap-3">
          <h2 id="details-heading" className="text-xl font-semibold tracking-tight">
            Product details
          </h2>
          <p className="leading-relaxed text-muted-foreground">{p.description}</p>
        </div>
        {specifications.length > 0 && (
          <dl className="grid h-fit grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-xl border p-4 text-sm">
            {specifications.map((spec) => (
              <div key={spec.label} className="contents">
                <dt className="text-muted-foreground">{spec.label}</dt>
                <dd>{spec.value}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      <ProductDiscovery product={p} selectedSize={selectedSize?.label} selectedOption={selectedOption?.label} />
      <ReviewList reviews={p.reviews} rating={p.rating} />
      <RecentlyViewedRail excludeSlug={p.slug} />
    </div>
  );
}

function PurchasePanel({ product: p }: { product: ProductDetail }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const selected = useSelectedSize(p);
  const option = useSelectedOption(p);
  const sizeGroup = useRef<HTMLFieldSetElement>(null);
  const [sizeError, setSizeError] = useState<string>();

  const requireSize = () => {
    setSizeError('Please select a size');
    sizeGroup.current?.querySelector<HTMLInputElement>('input:not(:disabled)')?.focus();
  };

  const selectSize = (label: string) => {
    setSizeError(undefined);
    const next = new URLSearchParams(searchParams);
    next.set('size', label);
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  const selectOption = (label: string) => {
    const next = new URLSearchParams(searchParams);
    next.set('option', label);
    setSearchParams(next, { replace: true, preventScrollReset: true });
  };

  // Price, discount and card offer follow the chosen option (F-013 FR-6); with every option sold
  // out, the starting price shows.
  const shown = option ?? p;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-1.5">
        {p.brand && <p className="text-sm font-medium tracking-wide text-muted-foreground uppercase">{p.brand}</p>}
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{p.title}</h1>
        <a href="#reviews" className="w-fit hover:underline">
          <Rating value={p.rating} count={p.reviewCount} />
        </a>
      </div>
      <Price
        pricePaise={shown.pricePaise}
        mrpPaise={shown.mrpPaise}
        discountPercent={shown.discountPercent}
        size="lg"
        from={p.hasOptions && !option}
      />
      <div className="flex flex-col gap-1.5">
        <OfferBanner pricePaise={shown.pricePaise} outOfStock={p.availability.status === 'out_of_stock'} />
        <EmiBanner pricePaise={shown.pricePaise} outOfStock={p.availability.status === 'out_of_stock'} />
      </div>
      {p.sizes.length > 0 && (
        <SizeSelector ref={sizeGroup} sizes={p.sizes} value={selected?.label} onChange={selectSize} error={sizeError} />
      )}
      {p.options.length > 0 && (
        <OptionSelector name={p.optionName ?? 'Option'} options={p.options} value={option?.label} onChange={selectOption} />
      )}
      <AvailabilityLine product={p} selectedSize={selected?.label} selectedOption={option?.label} />
      <div className="flex flex-wrap items-start gap-3">
        <AddToCartButton product={p} selectedSize={selected?.label} selectedOption={option?.label} onSizeRequired={requireSize} />
        <WishlistToggle product={p} variant="inline" />
      </div>
      {/* F-015: our own delivery rules replace the catalog's generic "Ships in…" line here. */}
      <DeliveryCheck pricePaise={shown.pricePaise} />
    </div>
  );
}

/** Real application inventory only (INV-3). Announced politely when the size or option changes. */
function AvailabilityLine({ product: p, selectedSize, selectedOption }: { product: ProductDetail; selectedSize?: string; selectedOption?: string }) {
  const size = p.sizes.find((s) => s.label === selectedSize) ?? p.options.find((o) => o.label === selectedOption);
  const availability = size?.availability ?? p.availability;
  let text: string;
  let tone = 'text-emerald-700 dark:text-emerald-400';

  if (availability.status === 'out_of_stock') {
    text = 'Out of stock';
    tone = 'text-muted-foreground';
  } else if (p.sizes.length > 0 && !size) {
    text = 'Select a size';
    tone = 'text-muted-foreground';
  } else if (availability.status === 'low_stock') {
    text = size ? `Only ${availability.available} left in ${size.label}` : `Only ${availability.available} left`;
    tone = 'text-amber-700 dark:text-amber-400';
  } else {
    text = size ? `In stock in ${size.label}` : 'In stock';
  }

  return (
    <p className={`text-sm font-medium ${tone}`} aria-live="polite">
      {text}
    </p>
  );
}

/** product_viewed once per product shown, plus recently viewed; size and option changes do not count. */
function useTrackProductView(product: ProductDetail | undefined) {
  const tracked = useRef<number | undefined>(undefined);
  useEffect(() => {
    if (!product || tracked.current === product.id) return;
    tracked.current = product.id;
    track('product_viewed', {
      productId: product.id,
      categorySlug: product.categorySlug,
      pricePaise: product.pricePaise,
      availability: product.availability.status,
    });
    recordProductView(product.slug);
  }, [product]);
}

function ProductPageSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-2" role="status" aria-label="Loading product">
      <Skeleton className="aspect-square rounded-xl" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-24 w-full" />
      </div>
    </div>
  );
}
