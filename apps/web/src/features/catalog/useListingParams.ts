import { useCallback, useEffect, useMemo } from 'react';
import { useLocation, useParams, useSearchParams } from 'react-router';
import { parseListingParams, serializeListingParams, type ListingParams } from '@store/shared';

/**
 * The URL is the single source of truth for listing state (FR-15). On category pages the
 * category comes from the path. Invalid or non-canonical query strings are replaced in place.
 */
export type ListingMode = 'all' | 'category' | 'search';

export function useListingParams() {
  const { categorySlug } = useParams();
  const { pathname } = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const mode: ListingMode = categorySlug ? 'category' : pathname === '/search' ? 'search' : 'all';

  const params = useMemo<ListingParams>(() => {
    // A query only applies on the search page; elsewhere it is dropped (in-category search is out of scope).
    const source = new URLSearchParams(searchParams);
    if (mode !== 'search') source.delete('q');
    const parsed = parseListingParams(source);
    return categorySlug ? { ...parsed, category: categorySlug } : parsed;
  }, [searchParams, categorySlug, mode]);

  const canonical = serializeListingParams(params, { omitCategory: Boolean(categorySlug) }).toString();

  useEffect(() => {
    if (canonical !== searchParams.toString()) setSearchParams(canonical, { replace: true, preventScrollReset: true });
  }, [canonical, searchParams, setSearchParams]);

  /** Applies changes; any filter or sort change returns to page 1 unless a page is given. */
  const update = useCallback(
    (changes: Partial<ListingParams>, options: { replace?: boolean } = {}) => {
      const next = { ...params, page: 1, ...changes };
      setSearchParams(serializeListingParams(next, { omitCategory: Boolean(categorySlug) }), {
        replace: options.replace,
        preventScrollReset: true,
      });
    },
    [params, categorySlug, setSearchParams],
  );

  return { params, update, mode, isCategoryPage: mode === 'category' };
}
