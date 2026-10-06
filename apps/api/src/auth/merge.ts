import { MAX_PER_LINE, MAX_WISHLIST_ITEMS, normalizeQuery, type HistoryLists } from '@store/shared';
import { z } from 'zod';
import type { Db } from '../db/database.js';

export const MAX_ACCOUNT_RECENTLY_VIEWED = 20;
export const MAX_ACCOUNT_SEARCHES = 10;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export const historySchema = z.object({
  recentlyViewed: z.array(z.object({ slug: z.string().regex(SLUG).max(200), viewedAt: z.iso.datetime() })).max(MAX_ACCOUNT_RECENTLY_VIEWED).default([]),
  recentSearches: z.array(z.object({ query: z.string().max(200), searchedAt: z.iso.datetime() })).max(MAX_ACCOUNT_SEARCHES).default([]),
});

/** Carries a guest's cart, wishlist and history into an account at sign-in (spec §5.6). */
export function createMergeService(db: Db) {
  const now = () => new Date().toISOString();

  const guestCart = db.prepare('SELECT id FROM carts WHERE id = ? AND user_id IS NULL');
  const userCart = db.prepare('SELECT id FROM carts WHERE user_id = ?');
  const adoptCart = db.prepare('UPDATE carts SET user_id = ?, updated_at = ? WHERE id = ?');
  const guestLines = db.prepare('SELECT id, product_id, variant_id, quantity FROM cart_lines WHERE cart_id = ?');
  const matchingLine = db.prepare(
    'SELECT id, quantity FROM cart_lines WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id, 0) = IFNULL(?, 0)',
  );
  const available = db.prepare(`
    SELECT COALESCE(MAX(on_hand - reserved, 0), 0) AS n FROM inventory
    WHERE product_id = ? AND IFNULL(variant_id, 0) = IFNULL(?, 0)`);
  const setQuantity = db.prepare('UPDATE cart_lines SET quantity = ? WHERE id = ?');
  const moveLine = db.prepare('UPDATE cart_lines SET cart_id = ? WHERE id = ?');
  const deleteCart = db.prepare('DELETE FROM carts WHERE id = ?');
  const touchCart = db.prepare('UPDATE carts SET updated_at = ? WHERE id = ?');

  const guestWishlist = db.prepare('SELECT id FROM wishlists WHERE id = ? AND user_id IS NULL');
  const userWishlist = db.prepare('SELECT id FROM wishlists WHERE user_id = ?');
  const adoptWishlist = db.prepare('UPDATE wishlists SET user_id = ?, updated_at = ? WHERE id = ?');
  const countItems = db.prepare('SELECT COUNT(*) AS n FROM wishlist_items WHERE wishlist_id = ?');
  const copyItems = db.prepare(`
    INSERT OR IGNORE INTO wishlist_items (wishlist_id, product_id, added_at)
    SELECT ?, product_id, added_at FROM wishlist_items WHERE wishlist_id = ?`);
  const trimItems = db.prepare(`
    DELETE FROM wishlist_items WHERE wishlist_id = @id AND product_id NOT IN (
      SELECT product_id FROM wishlist_items WHERE wishlist_id = @id ORDER BY added_at DESC LIMIT ${MAX_WISHLIST_ITEMS})`);
  const deleteWishlist = db.prepare('DELETE FROM wishlists WHERE id = ?');
  const touchWishlist = db.prepare('UPDATE wishlists SET updated_at = ? WHERE id = ?');

  const upsertViewed = db.prepare(`
    INSERT INTO user_recently_viewed (user_id, slug, viewed_at) VALUES (?, ?, ?)
    ON CONFLICT (user_id, slug) DO UPDATE SET viewed_at = MAX(viewed_at, excluded.viewed_at)`);
  const trimViewed = db.prepare(`
    DELETE FROM user_recently_viewed WHERE user_id = @u AND slug NOT IN (
      SELECT slug FROM user_recently_viewed WHERE user_id = @u ORDER BY viewed_at DESC LIMIT ${MAX_ACCOUNT_RECENTLY_VIEWED})`);
  const listViewed = db.prepare('SELECT slug, viewed_at AS viewedAt FROM user_recently_viewed WHERE user_id = ? ORDER BY viewed_at DESC');
  const upsertSearch = db.prepare(`
    INSERT INTO user_search_history (user_id, query_key, query, searched_at) VALUES (?, ?, ?, ?)
    ON CONFLICT (user_id, query_key) DO UPDATE SET
      query = CASE WHEN excluded.searched_at > searched_at THEN excluded.query ELSE query END,
      searched_at = MAX(searched_at, excluded.searched_at)`);
  const trimSearches = db.prepare(`
    DELETE FROM user_search_history WHERE user_id = @u AND query_key NOT IN (
      SELECT query_key FROM user_search_history WHERE user_id = @u ORDER BY searched_at DESC LIMIT ${MAX_ACCOUNT_SEARCHES})`);
  const listSearches = db.prepare('SELECT query, searched_at AS searchedAt FROM user_search_history WHERE user_id = ? ORDER BY searched_at DESC');
  const removeViewed = db.prepare('DELETE FROM user_recently_viewed WHERE user_id = @u AND (@key IS NULL OR slug = @key)');
  const removeSearch = db.prepare('DELETE FROM user_search_history WHERE user_id = @u AND (@key IS NULL OR query_key = @key)');

  return {
    /**
     * Same product and size in both carts → the larger quantity (user decision, Q12), capped
     * at 10 and at current stock when there is any. Lines without stock are kept (flagged in
     * the cart), never dropped. Returns whether anything came across.
     */
    mergeCart: db.transaction((userId: number, guestCartId: string | undefined): boolean => {
      const guest = guestCartId ? (guestCart.get(guestCartId) as { id: string } | undefined) : undefined;
      if (!guest) return false;
      const lines = guestLines.all(guest.id) as { id: number; product_id: number; variant_id: number | null; quantity: number }[];
      const account = userCart.get(userId) as { id: string } | undefined;
      if (!lines.length) {
        deleteCart.run(guest.id);
        return false;
      }
      if (!account) {
        adoptCart.run(userId, now(), guest.id);
        return true;
      }
      for (const line of lines) {
        const match = matchingLine.get(account.id, line.product_id, line.variant_id) as { id: number; quantity: number } | undefined;
        if (!match) {
          moveLine.run(account.id, line.id);
          continue;
        }
        const stock = (available.get(line.product_id, line.variant_id) as { n: number }).n;
        const cap = stock > 0 ? Math.min(MAX_PER_LINE, stock) : MAX_PER_LINE;
        setQuantity.run(Math.min(Math.max(match.quantity, line.quantity), cap), match.id);
      }
      deleteCart.run(guest.id);
      touchCart.run(now(), account.id);
      return true;
    }),

    /** Union of both wishlists, newest first, keeping at most 100. */
    mergeWishlist: db.transaction((userId: number, guestWishlistId: string | undefined): boolean => {
      const guest = guestWishlistId ? (guestWishlist.get(guestWishlistId) as { id: string } | undefined) : undefined;
      if (!guest) return false;
      if ((countItems.get(guest.id) as { n: number }).n === 0) {
        deleteWishlist.run(guest.id);
        return false;
      }
      const account = userWishlist.get(userId) as { id: string } | undefined;
      if (!account) {
        adoptWishlist.run(userId, now(), guest.id);
        return true;
      }
      copyItems.run(account.id, guest.id);
      trimItems.run({ id: account.id });
      deleteWishlist.run(guest.id);
      touchWishlist.run(now(), account.id);
      return true;
    }),

    /** Merges this device's history into the account's and returns the combined lists. */
    syncHistory: db.transaction((userId: number, input: HistoryLists): HistoryLists => {
      for (const item of input.recentlyViewed) upsertViewed.run(userId, item.slug, item.viewedAt);
      trimViewed.run({ u: userId });
      for (const item of input.recentSearches) {
        const query = normalizeQuery(item.query);
        if (query) upsertSearch.run(userId, query.toLowerCase(), query, item.searchedAt);
      }
      trimSearches.run({ u: userId });
      return {
        recentlyViewed: listViewed.all(userId) as HistoryLists['recentlyViewed'],
        recentSearches: listSearches.all(userId) as HistoryLists['recentSearches'],
      };
    }),

    /** Removes one entry (or, with no key, the whole list) from the account copy, so it can't sync back. */
    removeHistory(userId: number, list: 'recentlyViewed' | 'recentSearches', key: string | null) {
      if (list === 'recentlyViewed') removeViewed.run({ u: userId, key });
      else removeSearch.run({ u: userId, key: key === null ? null : (normalizeQuery(key) ?? key).toLowerCase() });
    },
  };
}

export type MergeService = ReturnType<typeof createMergeService>;
