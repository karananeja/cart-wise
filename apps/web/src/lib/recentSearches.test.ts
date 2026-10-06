import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addRecentSearch,
  clearRecentSearches,
  MAX_RECENT_SEARCHES,
  reloadRecentSearches,
  removeRecentSearch,
  useRecentSearches,
} from './recentSearches';

const queries = () => renderHook(() => useRecentSearches()).result.current.map((r) => r.query);

beforeEach(() => {
  localStorage.clear();
  reloadRecentSearches();
});

afterEach(() => vi.restoreAllMocks());

describe('recent searches', () => {
  it('keeps the newest first and merges duplicates case-insensitively', () => {
    addRecentSearch('shoes');
    addRecentSearch('laptop');
    addRecentSearch('  Shoes ');
    expect(queries()).toEqual(['Shoes', 'laptop']);
  });

  it(`keeps at most ${MAX_RECENT_SEARCHES}`, () => {
    for (let i = 1; i <= 12; i++) addRecentSearch(`query ${i}`);
    const list = queries();
    expect(list).toHaveLength(10);
    expect(list[0]).toBe('query 12');
    expect(list).not.toContain('query 2');
  });

  it('ignores blank queries', () => {
    addRecentSearch('   ');
    expect(queries()).toEqual([]);
  });

  it('removes one and clears all', () => {
    addRecentSearch('a1');
    addRecentSearch('b2');
    removeRecentSearch('a1');
    expect(queries()).toEqual(['b2']);
    clearRecentSearches();
    expect(queries()).toEqual([]);
  });

  it('persists to storage and survives a reload', () => {
    addRecentSearch('watch');
    reloadRecentSearches();
    expect(queries()).toEqual(['watch']);
  });

  it('updates subscribers', () => {
    const { result } = renderHook(() => useRecentSearches());
    act(() => addRecentSearch('phone'));
    expect(result.current.map((r) => r.query)).toEqual(['phone']);
  });

  it('works for the session when storage is blocked', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    reloadRecentSearches();
    expect(() => addRecentSearch('perfume')).not.toThrow();
    expect(queries()).toEqual(['perfume']);
  });

  it('tolerates corrupted storage', () => {
    localStorage.setItem('store.recentSearches', '{not json');
    reloadRecentSearches();
    expect(queries()).toEqual([]);
  });
});
