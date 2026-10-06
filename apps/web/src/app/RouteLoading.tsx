import { Skeleton } from '@/components/ui/skeleton';

/** First visit straight to a lazily loaded page: a quiet placeholder while its code loads. */
export function RouteLoading() {
  return (
    <div role="status" aria-label="Loading page" className="mx-auto flex w-full max-w-5xl flex-col gap-4 p-4 sm:p-8">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
