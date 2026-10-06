import { useEffect, useRef } from 'react';
import { Link } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { serializeListingParams, type ListingParams, type ListingResponse } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState, OfflineState } from '@/components/ErrorState';
import { NotFound } from '@/components/NotFound';
import { ApiError } from '@/lib/api';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { useCategories, useProductListing } from '../api';
import { ActiveFilterChips } from '../components/ActiveFilterChips';
import { EmptyResults } from '../components/EmptyResults';
import { FilterPanel, type FilterChange } from '../components/FilterPanel';
import { MobileFilterSheet } from '../components/MobileFilterSheet';
import { Pagination } from '../components/Pagination';
import { ProductGrid, ProductGridSkeleton } from '../components/ProductGrid';
import { SortSelect } from '../components/SortSelect';
import { useListingParams } from '../useListingParams';

type FilterEvent = NonNullable<FilterChange['event']>;

export function ListingPage() {
  const { params, update, isCategoryPage } = useListingParams();
  const listing = useProductListing(params);
  const categories = useCategories();
  const resultsRef = useRef<HTMLDivElement>(null);
  const pendingEvents = useRef<FilterEvent[]>([]);
  // Keeps the last good result on screen if a later request fails.
  const lastGood = useRef<ListingResponse | undefined>(undefined);
  if (listing.data && !listing.isPlaceholderData) lastGood.current = listing.data;
  const data = listing.data ?? (listing.isError ? lastGood.current : undefined);

  const applyChanges = (changes: Partial<ListingParams>, events: FilterEvent[] = []) => {
    pendingEvents.current = events;
    update(changes);
  };

  // filter_applied fires once the filtered result has arrived, so it can carry the result count.
  useEffect(() => {
    if (!listing.data || listing.isPlaceholderData || !pendingEvents.current.length) return;
    for (const event of pendingEvents.current) {
      track('filter_applied', { ...event, resultCount: listing.data.total, categorySlug: params.category ?? null });
    }
    pendingEvents.current = [];
  }, [listing.data, listing.isPlaceholderData, params.category]);

  // A page beyond the end is corrected to the last real page.
  const serverPage = listing.data && !listing.isPlaceholderData ? listing.data.page : undefined;
  useEffect(() => {
    if (serverPage !== undefined && serverPage !== params.page) update({ page: serverPage }, { replace: true });
  }, [serverPage, params.page, update]);

  // Bring the top of the results into view when the page number changes.
  const previousPage = useRef(params.page);
  useEffect(() => {
    if (previousPage.current !== params.page) resultsRef.current?.scrollIntoView({ block: 'start' });
    previousPage.current = params.page;
  }, [params.page]);

  if (listing.error instanceof ApiError && listing.error.isNotFound) {
    return <NotFound title="We couldn't find that category" />;
  }

  const categoryName = isCategoryPage
    ? (categories.data?.find((c) => c.slug === params.category)?.name ??
      data?.facets.categories.find((c) => c.value === params.category)?.label)
    : undefined;
  const title = isCategoryPage ? categoryName : 'All products';
  const basePath = isCategoryPage ? `/c/${params.category}` : '/products';
  const hrefFor = (page: number) => {
    const qs = serializeListingParams({ ...params, page }, { omitCategory: isCategoryPage }).toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };
  const updating = listing.isPlaceholderData && listing.isFetching;

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-3">
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link to="/">Home</Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            {isCategoryPage ? (
              <>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link to="/products">All products</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{categoryName ?? '…'}</BreadcrumbPage>
                </BreadcrumbItem>
              </>
            ) : (
              <BreadcrumbItem>
                <BreadcrumbPage>All products</BreadcrumbPage>
              </BreadcrumbItem>
            )}
          </BreadcrumbList>
        </Breadcrumb>
        {title ? <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1> : <Skeleton className="h-8 w-48" />}
      </header>

      <div className="grid gap-8 lg:grid-cols-[15rem_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          {data ? (
            <FilterPanel
              params={params}
              facets={data.facets}
              showCategory={!isCategoryPage}
              onChange={({ changes, event }) => applyChanges(changes, event ? [event] : [])}
            />
          ) : (
            <div className="flex flex-col gap-3" aria-hidden>
              {Array.from({ length: 6 }, (_, i) => (
                <Skeleton key={i} className="h-5 w-full" />
              ))}
            </div>
          )}
        </aside>

        <div ref={resultsRef} className="flex scroll-mt-24 flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground" aria-live="polite" aria-atomic="true">
              {data ? `${data.total} ${data.total === 1 ? 'product' : 'products'}` : ''}
            </p>
            <div className="flex items-center gap-2">
              <MobileFilterSheet params={params} facets={data?.facets} isCategoryPage={isCategoryPage} onApply={applyChanges} />
              <SortSelect value={params.sort} onChange={(sort) => update({ sort })} />
            </div>
          </div>

          <ActiveFilterChips params={params} facets={data?.facets} showCategory={!isCategoryPage} onRemove={(changes) => applyChanges(changes)} />

          {listing.isError && data && (
            <Alert>
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
                We couldn't update the results. Showing what we loaded before.
                <Button size="sm" variant="outline" onClick={() => void listing.refetch()}>
                  <RefreshCw aria-hidden /> Try again
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {data ? (
            data.total === 0 ? (
              <EmptyResults
                params={params}
                facets={data.facets}
                relaxations={data.relaxations}
                isCategoryPage={isCategoryPage}
                onChange={(changes) => applyChanges(changes)}
              />
            ) : (
              <div className={cn('flex flex-col gap-10 transition-opacity', updating && 'pointer-events-none opacity-60')} aria-busy={updating}>
                <ProductGrid products={data.items} />
                <Pagination page={data.page} lastPage={Math.ceil(data.total / data.pageSize)} hrefFor={hrefFor} />
              </div>
            )
          ) : listing.isError ? (
            <ErrorState what="products" onRetry={() => void listing.refetch()} />
          ) : listing.fetchStatus === 'paused' ? (
            <OfflineState what="products" />
          ) : (
            <ProductGridSkeleton />
          )}
        </div>
      </div>
    </div>
  );
}
