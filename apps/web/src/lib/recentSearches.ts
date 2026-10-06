import { normalizeQuery } from '@store/shared';
import { createLocalList } from './localList';

export interface RecentSearch {
  query: string;
  searchedAt: string;
}

export const MAX_RECENT_SEARCHES = 10;

/** Newest first, case-insensitive de-duplication, at most 10 (F-002 spec FR-13). */
const recentSearches = createLocalList<RecentSearch>({
  storageKey: 'store.recentSearches',
  max: MAX_RECENT_SEARCHES,
  identity: (r) => r.query.toLowerCase(),
  isItem: (v): v is RecentSearch => typeof v === 'object' && v !== null && typeof (v as RecentSearch).query === 'string',
});

export function addRecentSearch(query: string): void {
  const q = normalizeQuery(query);
  if (q) recentSearches.add({ query: q, searchedAt: new Date().toISOString() });
}

export const removeRecentSearch = (query: string) => recentSearches.remove(query.toLowerCase());
export const clearRecentSearches = recentSearches.clear;
/** Drops the cache so the next read comes from storage (another tab changed it, or tests). */
export const reloadRecentSearches = recentSearches.reload;
export const useRecentSearches = recentSearches.useList;

/** For account sync (F-006). */
export const recentSearchesStore = recentSearches;
