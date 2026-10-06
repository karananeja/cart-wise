import { useSyncExternalStore } from 'react';
import { normalizeQuery } from '@store/shared';

export interface RecentSearch {
  query: string;
  searchedAt: string;
}

const STORAGE_KEY = 'store.recentSearches';
export const MAX_RECENT_SEARCHES = 10;
const EMPTY: RecentSearch[] = [];

let cache: RecentSearch[] | null = null;
const listeners = new Set<() => void>();

function isRecentSearch(value: unknown): value is RecentSearch {
  return typeof value === 'object' && value !== null && typeof (value as RecentSearch).query === 'string';
}

/** Reads once and caches. Unreadable or blocked storage gives an empty list (spec FR-16). */
function read(): RecentSearch[] {
  if (cache) return cache;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    cache = Array.isArray(parsed) ? parsed.filter(isRecentSearch).slice(0, MAX_RECENT_SEARCHES) : [];
  } catch {
    cache = [];
  }
  return cache;
}

/** Updates the in-memory list even when storage is blocked, so the session still behaves. */
function write(list: RecentSearch[]) {
  cache = list;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Storage unavailable: history lasts for this session only.
  }
  listeners.forEach((listener) => listener());
}

/** Newest first, case-insensitive de-duplication, at most 10 (spec FR-13). */
export function addRecentSearch(query: string): void {
  const q = normalizeQuery(query);
  if (!q) return;
  const rest = read().filter((r) => r.query.toLowerCase() !== q.toLowerCase());
  write([{ query: q, searchedAt: new Date().toISOString() }, ...rest].slice(0, MAX_RECENT_SEARCHES));
}

export function removeRecentSearch(query: string): void {
  write(read().filter((r) => r.query !== query));
}

export function clearRecentSearches(): void {
  write([]);
}

/** Drops the cache so the next read comes from storage (another tab changed it, or tests). */
export function reloadRecentSearches(): void {
  cache = null;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key === STORAGE_KEY) reloadRecentSearches();
  });
}

export function useRecentSearches(): RecentSearch[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
