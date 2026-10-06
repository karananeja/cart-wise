import { useEffect } from 'react';
import type { HistoryLists } from '@store/shared';
import { apiSend } from '@/lib/api';
import { recentSearchesStore } from '@/lib/recentSearches';
import { recentlyViewedStore } from '@/lib/recentlyViewed';
import { useMe } from './api';

const post = (lists: HistoryLists) => apiSend<HistoryLists>('POST', '/auth/sync', lists);

/**
 * While signed in, recently viewed and recent searches also live on the account (spec FR-18):
 * merged once when the user appears, then each new entry is mirrored. Failures are ignored;
 * the local lists keep working either way.
 */
export function HistorySync() {
  const { data } = useMe();
  const userKey = data?.user?.email;

  useEffect(() => {
    if (!userKey) return;
    let active = true;
    post({ recentlyViewed: recentlyViewedStore.get(), recentSearches: recentSearchesStore.get() })
      .then((merged) => {
        if (!active) return;
        recentlyViewedStore.setAll(merged.recentlyViewed);
        recentSearchesStore.setAll(merged.recentSearches);
      })
      .catch(() => undefined);
    const unsubscribe = [
      recentlyViewedStore.onAdd((item) => void post({ recentlyViewed: [item], recentSearches: [] }).catch(() => undefined)),
      recentSearchesStore.onAdd((item) => void post({ recentlyViewed: [], recentSearches: [item] }).catch(() => undefined)),
    ];
    return () => {
      active = false;
      unsubscribe.forEach((stop) => stop());
    };
  }, [userKey]);

  return null;
}
