import { useSyncExternalStore } from 'react';

interface LocalListOptions<T> {
  storageKey: string;
  max: number;
  /** Items with the same identity are treated as one (the newest wins). */
  identity: (item: T) => string;
  isItem: (value: unknown) => value is T;
}

/**
 * A small newest-first list persisted in localStorage, bounded and de-duplicated. If storage is
 * blocked or corrupt it still works for the session in memory and never throws.
 */
export function createLocalList<T>({ storageKey, max, identity, isItem }: LocalListOptions<T>) {
  const empty: T[] = [];
  let cache: T[] | null = null;
  const listeners = new Set<() => void>();
  const addListeners = new Set<(item: T) => void>();

  function read(): T[] {
    if (cache) return cache;
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(storageKey) ?? '[]');
      cache = Array.isArray(parsed) ? parsed.filter(isItem).slice(0, max) : [];
    } catch {
      cache = [];
    }
    return cache;
  }

  function write(list: T[]) {
    cache = list;
    try {
      localStorage.setItem(storageKey, JSON.stringify(list));
    } catch {
      // Storage unavailable: the list lasts for this session only.
    }
    listeners.forEach((listener) => listener());
  }

  function reload() {
    cache = null;
    listeners.forEach((listener) => listener());
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', (event) => {
      if (event.key === storageKey) reload();
    });
  }

  return {
    add(item: T) {
      const id = identity(item);
      write([item, ...read().filter((existing) => identity(existing) !== id)].slice(0, max));
      addListeners.forEach((listener) => listener(item));
    },
    /** Replaces the whole list (e.g. with the account's merged copy); does not notify add-listeners. */
    setAll(items: T[]) {
      write(items.filter(isItem).slice(0, max));
    },
    /** Called with each newly added item (used to mirror additions to the account). */
    onAdd(listener: (item: T) => void) {
      addListeners.add(listener);
      return () => {
        addListeners.delete(listener);
      };
    },
    remove(id: string) {
      write(read().filter((existing) => identity(existing) !== id));
    },
    clear: () => write([]),
    reload,
    get: read,
    useList: () => useSyncExternalStore(subscribe, read, () => empty),
  };
}
