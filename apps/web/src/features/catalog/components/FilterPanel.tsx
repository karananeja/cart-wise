import { createContext, useContext, useEffect, useId, useState, type FormEvent, type ReactNode } from 'react';
import type { FacetValue, ListingFacets, ListingParams } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { priceLabel, pricePresets, ratingLabel } from '../filterLabels';

export interface FilterChange {
  changes: Partial<ListingParams>;
  /** Present when the change adds or changes a filter (tracked as `filter_applied`). */
  event?: { filter: string; value: string };
}

interface FilterPanelProps {
  params: ListingParams;
  facets: ListingFacets | undefined;
  showCategory: boolean;
  onChange: (change: FilterChange) => void;
}

const COLLAPSED_COUNT = 8;

/**
 * The panel renders twice (desktop sidebar and mobile sheet), so control ids are prefixed per
 * instance; otherwise labels would point at the hidden copy.
 */
const IdPrefix = createContext('filters');
/** Radio value for "no filter" (Radix radio items need a non-empty value). */
const ALL = 'all';

export function FilterPanel({ params, facets, showCategory, onChange }: FilterPanelProps) {
  const prefix = useId();
  if (!facets) return null;
  return (
    <IdPrefix.Provider value={prefix}>
    <div className="flex flex-col divide-y">
      {showCategory && <CategoryFilter params={params} facets={facets} onChange={onChange} />}
      <PriceFilter params={params} facets={facets} onChange={onChange} />
      {facets.brands.length > 0 && <BrandFilter params={params} brands={facets.brands} onChange={onChange} />}
      <RatingFilter params={params} facets={facets} onChange={onChange} />
      <AvailabilityFilter params={params} count={facets.inStock} onChange={onChange} />
    </div>
    </IdPrefix.Provider>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const id = useId();
  return (
    <section aria-labelledby={id} className="py-5 first:pt-0">
      <h3 id={id} className="mb-3 text-sm font-semibold">
        {title}
      </h3>
      {children}
    </section>
  );
}

function Count({ value }: { value: number }) {
  return <span className="ml-auto text-xs text-muted-foreground tabular-nums">{value}</span>;
}

function ShowMore({ total, expanded, onToggle, noun }: { total: number; expanded: boolean; onToggle: () => void; noun: string }) {
  if (total <= COLLAPSED_COUNT) return null;
  return (
    <Button variant="link" size="sm" className="mt-1 h-auto px-0" onClick={onToggle} aria-expanded={expanded}>
      {expanded ? 'Show fewer' : `Show all ${total} ${noun}`}
    </Button>
  );
}

function CategoryFilter({ params, facets, onChange }: Omit<FilterPanelProps, 'showCategory'> & { facets: ListingFacets }) {
  const prefix = useContext(IdPrefix);
  const [expanded, setExpanded] = useState(false);
  // Categories that still have matches come first, so the collapsed list is never all disabled rows.
  const sorted = [...facets.categories].sort((a, b) => Number(a.count === 0) - Number(b.count === 0) || a.label.localeCompare(b.label));
  const selectedIndex = sorted.findIndex((c) => c.value === params.category);
  const visible = expanded || selectedIndex >= COLLAPSED_COUNT ? sorted : sorted.slice(0, COLLAPSED_COUNT);

  return (
    <Section title="Category">
      <RadioGroup
        value={params.category ?? ALL}
        onValueChange={(value) =>
          onChange(value !== ALL ? { changes: { category: value }, event: { filter: 'category', value } } : { changes: { category: undefined } })
        }
        className="gap-2"
      >
        <OptionRow id={`${prefix}-category-all`} label="All categories">
          <RadioGroupItem id={`${prefix}-category-all`} value={ALL} />
        </OptionRow>
        {visible.map((c) => (
          <OptionRow key={c.value} id={`${prefix}-category-${c.value}`} label={c.label} count={c.count} disabled={c.count === 0 && c.value !== params.category}>
            <RadioGroupItem id={`${prefix}-category-${c.value}`} value={c.value} disabled={c.count === 0 && c.value !== params.category} />
          </OptionRow>
        ))}
      </RadioGroup>
      <ShowMore total={sorted.length} expanded={expanded} onToggle={() => setExpanded((e) => !e)} noun="categories" />
    </Section>
  );
}

function OptionRow({ id, label, count, disabled, children }: { id: string; label: string; count?: number; disabled?: boolean; children: ReactNode }) {
  return (
    <div className={cn('flex items-center gap-2', disabled && 'opacity-50')}>
      {children}
      <Label htmlFor={id} className="flex-1 font-normal">
        {label}
        {count !== undefined && <Count value={count} />}
      </Label>
    </div>
  );
}

function PriceFilter({ params, facets, onChange }: Omit<FilterPanelProps, 'showCategory'> & { facets: ListingFacets }) {
  const prefix = useContext(IdPrefix);
  const presets = facets.price ? pricePresets(facets.price) : [];
  const [min, setMin] = useState(params.priceMin?.toString() ?? '');
  const [max, setMax] = useState(params.priceMax?.toString() ?? '');

  useEffect(() => {
    setMin(params.priceMin?.toString() ?? '');
    setMax(params.priceMax?.toString() ?? '');
  }, [params.priceMin, params.priceMax]);

  const apply = (priceMin?: number, priceMax?: number) => {
    if (priceMin === undefined && priceMax === undefined) {
      onChange({ changes: { priceMin: undefined, priceMax: undefined } });
      return;
    }
    const [lo, hi] = priceMin !== undefined && priceMax !== undefined && priceMin > priceMax ? [priceMax, priceMin] : [priceMin, priceMax];
    onChange({ changes: { priceMin: lo, priceMax: hi }, event: { filter: 'price', value: `${lo ?? ''}-${hi ?? ''}` } });
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const toNumber = (v: string) => (/^\d+$/.test(v.trim()) && Number(v) > 0 ? Number(v) : undefined);
    apply(toNumber(min), toNumber(max));
  };

  return (
    <Section title="Price">
      {presets.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-2">
          {presets.map((preset) => {
            const active = params.priceMin === preset.min && params.priceMax === preset.max;
            return (
              <li key={`${preset.min}-${preset.max}`}>
                <Button
                  variant={active ? 'default' : 'outline'}
                  size="sm"
                  aria-pressed={active}
                  onClick={() => (active ? apply(undefined, undefined) : apply(preset.min, preset.max))}
                >
                  {priceLabel(preset.min, preset.max)}
                </Button>
              </li>
            );
          })}
        </ul>
      )}
      <form onSubmit={submit} className="flex items-end gap-2" aria-label="Custom price range">
        <div className="grid flex-1 gap-1">
          <Label htmlFor={`${prefix}-price-min`} className="text-xs text-muted-foreground">
            Min ₹
          </Label>
          <Input id={`${prefix}-price-min`} inputMode="numeric" placeholder={facets.price ? String(facets.price.min) : 'Min'} value={min} onChange={(e) => setMin(e.target.value)} />
        </div>
        <div className="grid flex-1 gap-1">
          <Label htmlFor={`${prefix}-price-max`} className="text-xs text-muted-foreground">
            Max ₹
          </Label>
          <Input id={`${prefix}-price-max`} inputMode="numeric" placeholder={facets.price ? String(facets.price.max) : 'Max'} value={max} onChange={(e) => setMax(e.target.value)} />
        </div>
        <Button type="submit" variant="outline">
          Go
        </Button>
      </form>
    </Section>
  );
}

function BrandFilter({ params, brands, onChange }: { params: ListingParams; brands: FacetValue[]; onChange: FilterPanelProps['onChange'] }) {
  const prefix = useContext(IdPrefix);
  const [expanded, setExpanded] = useState(false);
  const selected = new Set(params.brands);
  // Selected brands stay visible even when the list is collapsed.
  const visible = expanded ? brands : brands.filter((b, i) => i < COLLAPSED_COUNT || selected.has(b.value));

  const toggle = (value: string, checked: boolean) => {
    const next = checked ? [...params.brands, value] : params.brands.filter((b) => b !== value);
    onChange({ changes: { brands: next }, event: checked ? { filter: 'brand', value } : undefined });
  };

  return (
    <Section title="Brand">
      <div className="flex flex-col gap-2">
        {visible.map((brand) => {
          const id = `${prefix}-brand-${brand.value}`;
          const disabled = brand.count === 0 && !selected.has(brand.value);
          return (
            <OptionRow key={brand.value} id={id} label={brand.label} count={brand.count} disabled={disabled}>
              <Checkbox id={id} checked={selected.has(brand.value)} disabled={disabled} onCheckedChange={(c) => toggle(brand.value, c === true)} />
            </OptionRow>
          );
        })}
      </div>
      <ShowMore total={brands.length} expanded={expanded} onToggle={() => setExpanded((e) => !e)} noun="brands" />
    </Section>
  );
}

function RatingFilter({ params, facets, onChange }: Omit<FilterPanelProps, 'showCategory'> & { facets: ListingFacets }) {
  const prefix = useContext(IdPrefix);
  return (
    <Section title="Customer rating">
      <RadioGroup
        value={params.rating ? String(params.rating) : ALL}
        onValueChange={(value) =>
          onChange(value !== ALL ? { changes: { rating: Number(value) as 3 | 4 }, event: { filter: 'rating', value } } : { changes: { rating: undefined } })
        }
        className="gap-2"
      >
        <OptionRow id={`${prefix}-rating-any`} label="Any rating">
          <RadioGroupItem id={`${prefix}-rating-any`} value={ALL} />
        </OptionRow>
        {facets.ratings.map((r) => {
          const disabled = r.count === 0 && params.rating !== r.value;
          return (
            <OptionRow key={r.value} id={`${prefix}-rating-${r.value}`} label={ratingLabel(r.value)} count={r.count} disabled={disabled}>
              <RadioGroupItem id={`${prefix}-rating-${r.value}`} value={String(r.value)} disabled={disabled} />
            </OptionRow>
          );
        })}
      </RadioGroup>
    </Section>
  );
}

function AvailabilityFilter({ params, count, onChange }: { params: ListingParams; count: number; onChange: FilterPanelProps['onChange'] }) {
  const prefix = useContext(IdPrefix);
  return (
    <Section title="Availability">
      <div className="flex items-center gap-3">
        <Switch
          id={`${prefix}-in-stock`}
          checked={params.inStock}
          onCheckedChange={(checked) => onChange({ changes: { inStock: checked }, event: checked ? { filter: 'inStock', value: '1' } : undefined })}
        />
        <Label htmlFor={`${prefix}-in-stock`} className="flex-1 font-normal">
          In stock only
          <Count value={count} />
        </Label>
      </div>
    </Section>
  );
}
