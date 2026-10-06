import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { countActiveFilters, type ListingFacets, type ListingParams } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useProductListing } from '../api';
import { CLEAR_ALL } from './ActiveFilterChips';
import { FilterPanel, type FilterChange } from './FilterPanel';

interface MobileFilterSheetProps {
  params: ListingParams;
  facets: ListingFacets | undefined;
  isCategoryPage: boolean;
  onApply: (changes: Partial<ListingParams>, events: NonNullable<FilterChange['event']>[]) => void;
}

/**
 * Below the desktop breakpoint filters live in a bottom sheet. Changes are drafted and the
 * button previews the result count, so the list does not reload on every tap.
 */
export function MobileFilterSheet({ params, facets, isCategoryPage, onApply }: MobileFilterSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(params);
  const [events, setEvents] = useState<NonNullable<FilterChange['event']>[]>([]);
  const preview = useProductListing({ ...draft, page: 1 }, { enabled: open });
  const activeCount = countActiveFilters(params, { includeCategory: !isCategoryPage });

  const onOpenChange = (next: boolean) => {
    if (next) {
      setDraft(params);
      setEvents([]);
    }
    setOpen(next);
  };

  const change = ({ changes, event }: FilterChange) => {
    setDraft((d) => ({ ...d, ...changes }));
    if (event) setEvents((e) => [...e, event]);
  };

  const apply = () => {
    const { category, brands, priceMin, priceMax, rating, inStock } = draft;
    onApply({ category, brands, priceMin, priceMax, rating, inStock }, events);
    setOpen(false);
  };

  const total = preview.data?.total;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetTrigger asChild>
        <Button variant="outline" className="lg:hidden" aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : 'Filters'}>
          <SlidersHorizontal aria-hidden />
          Filters
          {activeCount > 0 && (
            <span className="ml-0.5 rounded-full bg-primary px-1.5 text-xs text-primary-foreground tabular-nums" aria-hidden>
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85dvh] rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription className="sr-only">Narrow the product list. Changes apply when you press Show results.</SheetDescription>
        </SheetHeader>
        <div className="overflow-y-auto px-4">
          <FilterPanel params={draft} facets={preview.data?.facets ?? facets} showCategory={!isCategoryPage} onChange={change} />
        </div>
        <SheetFooter className="flex-row border-t">
          <Button variant="outline" className="flex-1" onClick={() => setDraft((d) => ({ ...d, ...CLEAR_ALL, ...(isCategoryPage ? {} : { category: undefined }) }))}>
            Clear all
          </Button>
          <Button className="flex-1" onClick={apply} disabled={total === 0}>
            {total === undefined ? 'Show results' : total === 0 ? 'No results' : `Show ${total} ${total === 1 ? 'result' : 'results'}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
