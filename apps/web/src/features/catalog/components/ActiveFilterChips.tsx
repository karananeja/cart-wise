import { X } from 'lucide-react';
import type { ListingFacets, ListingParams } from '@store/shared';
import { Button } from '@/components/ui/button';
import { brandLabel, categoryLabel, priceLabel, ratingLabel } from '../filterLabels';

interface Chip {
  key: string;
  label: string;
  remove: Partial<ListingParams>;
}

export function activeFilterChips(params: ListingParams, facets: ListingFacets | undefined, showCategory: boolean): Chip[] {
  const chips: Chip[] = [];
  if (showCategory && params.category) {
    chips.push({ key: 'category', label: categoryLabel(params.category, facets), remove: { category: undefined } });
  }
  for (const brand of params.brands) {
    chips.push({ key: `brand-${brand}`, label: brandLabel(brand, facets), remove: { brands: params.brands.filter((b) => b !== brand) } });
  }
  if (params.priceMin !== undefined || params.priceMax !== undefined) {
    chips.push({ key: 'price', label: priceLabel(params.priceMin, params.priceMax), remove: { priceMin: undefined, priceMax: undefined } });
  }
  if (params.rating) chips.push({ key: 'rating', label: ratingLabel(params.rating), remove: { rating: undefined } });
  if (params.inStock) chips.push({ key: 'inStock', label: 'In stock only', remove: { inStock: false } });
  return chips;
}

export const CLEAR_ALL: Partial<ListingParams> = {
  brands: [],
  priceMin: undefined,
  priceMax: undefined,
  rating: undefined,
  inStock: false,
};

interface ActiveFilterChipsProps {
  params: ListingParams;
  facets: ListingFacets | undefined;
  showCategory: boolean;
  onRemove: (changes: Partial<ListingParams>) => void;
}

export function ActiveFilterChips({ params, facets, showCategory, onRemove }: ActiveFilterChipsProps) {
  const chips = activeFilterChips(params, facets, showCategory);
  if (!chips.length) return null;
  return (
    <div className="flex flex-wrap items-center gap-2" aria-label="Active filters" role="group">
      {chips.map((chip) => (
        <Button key={chip.key} variant="secondary" size="sm" className="rounded-full" onClick={() => onRemove(chip.remove)} aria-label={`Remove filter ${chip.label}`}>
          {chip.label}
          <X aria-hidden />
        </Button>
      ))}
      <Button variant="link" size="sm" onClick={() => onRemove(showCategory ? { ...CLEAR_ALL, category: undefined } : CLEAR_ALL)}>
        Clear all
      </Button>
    </div>
  );
}
