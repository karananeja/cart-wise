import { createLocalList } from './localList';

export interface RecentlyViewedProduct {
  slug: string;
  viewedAt: string;
}

export const MAX_RECENTLY_VIEWED = 20;

/** Only the slug is kept; rails fetch current price and stock (F-003 spec FR-15). */
const recentlyViewed = createLocalList<RecentlyViewedProduct>({
  storageKey: 'store.recentlyViewed',
  max: MAX_RECENTLY_VIEWED,
  identity: (p) => p.slug,
  isItem: (v): v is RecentlyViewedProduct =>
    typeof v === 'object' && v !== null && typeof (v as RecentlyViewedProduct).slug === 'string',
});

export const recordProductView = (slug: string) => recentlyViewed.add({ slug, viewedAt: new Date().toISOString() });
export const clearRecentlyViewed = recentlyViewed.clear;
export const reloadRecentlyViewed = recentlyViewed.reload;
export const useRecentlyViewed = recentlyViewed.useList;
