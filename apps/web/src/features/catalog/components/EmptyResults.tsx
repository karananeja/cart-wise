import { SlidersHorizontal } from 'lucide-react';
import type { ListingFacets, ListingParams, Relaxation } from '@store/shared';
import { Button } from '@/components/ui/button';
import { StatusMessage } from '@/components/StatusMessage';
import { clearFilterGroup, describeFilterGroup } from '../filterLabels';
import { CLEAR_ALL } from './ActiveFilterChips';

interface EmptyResultsProps {
  params: ListingParams;
  facets: ListingFacets | undefined;
  relaxations: Relaxation[];
  isCategoryPage: boolean;
  onChange: (changes: Partial<ListingParams>) => void;
}

/** No dead ends: name the filters and suggest the single removal that brings the most results back. */
export function EmptyResults({ params, facets, relaxations, isCategoryPage, onChange }: EmptyResultsProps) {
  // On a category page the category comes from the path, so it is not a removable filter here.
  const candidates = relaxations.filter((r) => r.total > 0 && !(isCategoryPage && r.filter === 'category'));
  const best = candidates[0];

  return (
    <StatusMessage
      icon={<SlidersHorizontal />}
      title="No products match these filters"
      description={
        best ? (
          <>
            Removing <strong className="font-medium text-foreground">{describeFilterGroup(best.filter, params, facets)}</strong> would show{' '}
            {best.total} {best.total === 1 ? 'product' : 'products'}.
          </>
        ) : (
          'Try removing some filters to see more products.'
        )
      }
      actions={
        <>
          {best && (
            <Button onClick={() => onChange(clearFilterGroup(best.filter))}>
              Show {best.total} {best.total === 1 ? 'product' : 'products'}
            </Button>
          )}
          <Button variant={best ? 'outline' : 'default'} onClick={() => onChange(isCategoryPage ? CLEAR_ALL : { ...CLEAR_ALL, category: undefined })}>
            Clear all filters
          </Button>
        </>
      }
    />
  );
}
