import { useEffect, useId, useRef, useState, type FocusEvent, type KeyboardEvent, type ReactNode } from 'react';
import { History, LayoutGrid, Loader2, Search, X } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router';
import { formatPrice, normalizeQuery, type ProductSummary } from '@store/shared';
import { Button } from '@/components/ui/button';
import { addRecentSearch, clearRecentSearches, removeRecentSearch, useRecentSearches } from '@/lib/recentSearches';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { cn } from '@/lib/utils';
import { useSearchSuggestions } from './api';

export type SearchSource = 'typed' | 'history';

/** History state set when a search is submitted; the results page uses it for analytics. */
export interface SearchNavigationState {
  searchSource?: SearchSource;
}

type Option =
  | { kind: 'recent'; query: string }
  | { kind: 'category'; slug: string; name: string }
  | { kind: 'product'; product: ProductSummary }
  | { kind: 'search'; query: string };

const MIN_SUGGESTION_LENGTH = 2;
const DEBOUNCE_MS = 150;

/**
 * Header search: a WAI-ARIA combobox. Empty and focused it lists recent searches; while typing
 * it suggests categories and products. Enter with nothing highlighted submits the query.
 */
export function SearchBox({ className }: { className?: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const listboxId = `${baseId}-listbox`;
  const optionId = (index: number) => `${baseId}-option-${index}`;

  const urlQuery = location.pathname === '/search' ? (new URLSearchParams(location.search).get('q') ?? '') : '';
  const [value, setValue] = useState(urlQuery);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Show the current query on the results page; clear the box elsewhere (spec FR-3). Never
  // while the box has focus: that would overwrite what the user is typing.
  useEffect(() => {
    if (document.activeElement !== inputRef.current) setValue(urlQuery);
  }, [urlQuery, location.pathname]);

  const trimmed = value.trim();
  const debounced = useDebouncedValue(trimmed, DEBOUNCE_MS);
  const recent = useRecentSearches();
  const showRecent = trimmed === '';
  const suggestions = useSearchSuggestions(debounced, open && !showRecent && debounced.length >= MIN_SUGGESTION_LENGTH);
  const suggestionData = trimmed.length >= MIN_SUGGESTION_LENGTH ? suggestions.data : undefined;

  const options: Option[] = showRecent
    ? recent.map((r) => ({ kind: 'recent', query: r.query }))
    : [
        ...(suggestionData?.categories ?? []).map((c): Option => ({ kind: 'category', ...c })),
        ...(suggestionData?.products ?? []).map((product): Option => ({ kind: 'product', product })),
        { kind: 'search', query: trimmed },
      ];
  const expanded = open && options.length > 0;

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  const finish = () => {
    close();
    inputRef.current?.blur();
  };

  const submit = (raw: string, source: SearchSource) => {
    const q = normalizeQuery(raw);
    if (!q) return;
    addRecentSearch(q);
    navigate(`/search?${new URLSearchParams({ q })}`, { state: { searchSource: source } satisfies SearchNavigationState });
    finish();
  };

  const activate = (option: Option) => {
    switch (option.kind) {
      case 'recent':
        return submit(option.query, 'history');
      case 'search':
        return submit(option.query, 'typed');
      case 'category':
        navigate(`/c/${option.slug}`);
        return finish();
      case 'product':
        navigate(`/p/${option.product.slug}`);
        return finish();
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    const count = options.length;
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setOpen(true);
        if (count) setActive((i) => (i + 1) % count);
        break;
      case 'ArrowUp':
        event.preventDefault();
        setOpen(true);
        if (count) setActive((i) => (i <= 0 ? count - 1 : i - 1));
        break;
      case 'Enter': {
        event.preventDefault();
        const option = expanded && active >= 0 ? options[active] : undefined;
        if (option) activate(option);
        else submit(value, 'typed');
        break;
      }
      case 'Escape':
        if (expanded) {
          event.preventDefault();
          close();
        }
        break;
      case 'Delete': {
        // Shift+Delete removes the highlighted recent search, as in browser address bars.
        const option = options[active];
        if (event.shiftKey && option?.kind === 'recent') {
          event.preventDefault();
          removeRecentSearch(option.query);
          setActive((i) => Math.min(i, count - 2));
        }
        break;
      }
    }
  };

  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) close();
  };

  const optionProps = (index: number) => ({
    id: optionId(index),
    role: 'option' as const,
    'aria-selected': index === active,
    onMouseDown: (e: React.MouseEvent) => e.preventDefault(), // keep focus in the input
    onMouseMove: () => setActive(index),
    onClick: () => activate(options[index]!),
    className: cn(
      'flex w-full cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-left text-sm',
      index === active && 'bg-muted',
    ),
  });

  const categoryCount = suggestionData?.categories.length ?? 0;
  const productCount = suggestionData?.products.length ?? 0;
  const loading = !showRecent && suggestions.isFetching && trimmed.length >= MIN_SUGGESTION_LENGTH;

  return (
    <div className={cn('relative', className)} onBlur={onBlur}>
      <form
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          submit(value, 'typed');
        }}
        className="relative"
      >
        <label htmlFor={`${baseId}-input`} className="sr-only">
          Search products
        </label>
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <input
          ref={inputRef}
          id={`${baseId}-input`}
          type="search"
          role="combobox"
          aria-expanded={expanded}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-activedescendant={expanded && active >= 0 ? optionId(active) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          maxLength={100}
          placeholder="Search products, brands and categories"
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          className="h-10 w-full rounded-full border border-input bg-muted/50 pr-10 pl-9 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:bg-background focus-visible:ring-3 focus-visible:ring-ring/50 [&::-webkit-search-cancel-button]:hidden"
        />
        <Button type="submit" variant="ghost" size="icon-sm" className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded-full" aria-label="Search">
          {loading ? <Loader2 className="animate-spin" aria-hidden /> : <Search aria-hidden />}
        </Button>
      </form>

      {expanded && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[min(70dvh,32rem)] overflow-y-auto rounded-xl border bg-popover p-2 text-popover-foreground shadow-lg">
          {showRecent && (
            <div className="flex items-center justify-between px-2 pt-1 pb-2">
              <p className="text-xs font-medium text-muted-foreground" id={`${baseId}-recent`}>
                Recent searches
              </p>
              <Button variant="link" size="xs" className="h-auto px-0" onMouseDown={(e) => e.preventDefault()} onClick={() => clearRecentSearches()}>
                Clear all
              </Button>
            </div>
          )}
          <div role="listbox" id={listboxId} aria-label={showRecent ? 'Recent searches' : 'Search suggestions'}>
            {showRecent
              ? options.map((option, index) =>
                  option.kind === 'recent' ? (
                    <div key={option.query} role="presentation" className="group relative">
                      <div {...optionProps(index)}>
                        <History className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="truncate pr-8">{option.query}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        tabIndex={-1}
                        className="absolute top-1/2 right-1 -translate-y-1/2"
                        aria-label={`Remove "${option.query}" from recent searches`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => removeRecentSearch(option.query)}
                      >
                        <X aria-hidden />
                      </Button>
                    </div>
                  ) : null,
                )
              : (
                  <>
                    {categoryCount > 0 && (
                      <Group label="Categories" id={`${baseId}-categories`}>
                        {options.slice(0, categoryCount).map((option, index) =>
                          option.kind === 'category' ? (
                            <div key={option.slug} {...optionProps(index)}>
                              <LayoutGrid className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                              <span>{option.name}</span>
                            </div>
                          ) : null,
                        )}
                      </Group>
                    )}
                    {productCount > 0 && (
                      <Group label="Products" id={`${baseId}-products`}>
                        {options.slice(categoryCount, categoryCount + productCount).map((option, i) =>
                          option.kind === 'product' ? (
                            <div key={option.product.id} {...optionProps(categoryCount + i)}>
                              <img src={option.product.thumbnailUrl} alt="" width={40} height={40} className="size-10 shrink-0 rounded-md bg-muted object-contain p-0.5 mix-blend-multiply" />
                              <span className="min-w-0 flex-1 truncate">{option.product.title}</span>
                              <span className="shrink-0 text-muted-foreground tabular-nums">{formatPrice(option.product.pricePaise)}</span>
                            </div>
                          ) : null,
                        )}
                      </Group>
                    )}
                    <div {...optionProps(options.length - 1)}>
                      <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="truncate">
                        Search for <strong className="font-medium">“{trimmed}”</strong>
                      </span>
                    </div>
                  </>
                )}
          </div>
        </div>
      )}
    </div>
  );
}

function Group({ label, id, children }: { label: string; id: string; children: ReactNode }) {
  return (
    <div role="group" aria-labelledby={id} className="mb-1 border-b pb-1">
      <div id={id} role="presentation" className="px-2 pt-1 pb-1 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}
