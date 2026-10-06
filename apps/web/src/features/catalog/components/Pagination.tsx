import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Page numbers to show: first, last, and a window around the current page, with gaps. */
export function pageItems(current: number, last: number): (number | 'gap')[] {
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  return sorted.flatMap((page, i) => (i > 0 && page - sorted[i - 1]! > 1 ? ['gap' as const, page] : [page]));
}

interface PaginationProps {
  page: number;
  lastPage: number;
  hrefFor: (page: number) => string;
}

export function Pagination({ page, lastPage, hrefFor }: PaginationProps) {
  if (lastPage <= 1) return null;
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1">
      <PageLink to={page > 1 ? hrefFor(page - 1) : undefined} label="Previous page">
        <ChevronLeft aria-hidden />
        <span className="hidden sm:inline">Previous</span>
      </PageLink>
      {pageItems(page, lastPage).map((item, i) =>
        item === 'gap' ? (
          <span key={`gap-${i}`} className="px-1 text-muted-foreground" aria-hidden>
            …
          </span>
        ) : (
          <Button key={item} asChild variant={item === page ? 'default' : 'ghost'} size="icon" className={cn('tabular-nums')}>
            <Link to={hrefFor(item)} preventScrollReset aria-current={item === page ? 'page' : undefined} aria-label={`Page ${item}`}>
              {item}
            </Link>
          </Button>
        ),
      )}
      <PageLink to={page < lastPage ? hrefFor(page + 1) : undefined} label="Next page">
        <span className="hidden sm:inline">Next</span>
        <ChevronRight aria-hidden />
      </PageLink>
    </nav>
  );
}

function PageLink({ to, label, children }: { to?: string; label: string; children: React.ReactNode }) {
  if (!to) {
    return (
      <Button variant="ghost" disabled aria-label={label}>
        {children}
      </Button>
    );
  }
  return (
    <Button asChild variant="ghost">
      <Link to={to} preventScrollReset aria-label={label}>
        {children}
      </Link>
    </Button>
  );
}
