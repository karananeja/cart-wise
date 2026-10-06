import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { clearRecentlyViewed, MAX_RECENTLY_VIEWED, recordProductView, reloadRecentlyViewed, useRecentlyViewed } from './recentlyViewed';

const slugs = () => renderHook(() => useRecentlyViewed()).result.current.map((p) => p.slug);

beforeEach(() => {
  localStorage.clear();
  reloadRecentlyViewed();
});

describe('recently viewed', () => {
  it('keeps the most recent first without duplicates', () => {
    recordProductView('a');
    recordProductView('b');
    recordProductView('a');
    expect(slugs()).toEqual(['a', 'b']);
  });

  it(`keeps at most ${MAX_RECENTLY_VIEWED}`, () => {
    for (let i = 1; i <= 25; i++) recordProductView(`p-${i}`);
    expect(slugs()).toHaveLength(20);
    expect(slugs()[0]).toBe('p-25');
    expect(slugs()).not.toContain('p-5');
  });

  it('survives a reload and can be cleared', () => {
    recordProductView('watch');
    reloadRecentlyViewed();
    expect(slugs()).toEqual(['watch']);
    clearRecentlyViewed();
    expect(slugs()).toEqual([]);
  });
});
