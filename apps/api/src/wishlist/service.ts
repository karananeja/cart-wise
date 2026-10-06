import { randomBytes } from 'node:crypto';
import { MAX_WISHLIST_ITEMS, type WishlistView } from '@store/shared';
import type { CatalogRepository } from '../catalog/repository.js';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';

export const WISHLIST_LIFETIME_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createWishlistService(db: Db, catalog: CatalogRepository) {
  const now = () => new Date().toISOString();
  const cutoff = () => new Date(Date.now() - WISHLIST_LIFETIME_DAYS * DAY_MS).toISOString();

  const findWishlist = db.prepare('SELECT id FROM wishlists WHERE id = ? AND updated_at >= ?');
  const insertWishlist = db.prepare('INSERT INTO wishlists (id, created_at, updated_at) VALUES (?, ?, ?)');
  const touch = db.prepare('UPDATE wishlists SET updated_at = ? WHERE id = ?');
  const items = db.prepare(`
    SELECT p.slug, w.added_at AS addedAt FROM wishlist_items w JOIN products p ON p.id = w.product_id
    WHERE w.wishlist_id = ? ORDER BY w.added_at DESC, w.rowid DESC`);
  const productId = db.prepare('SELECT id FROM products WHERE slug = ?');
  const count = db.prepare('SELECT COUNT(*) AS n FROM wishlist_items WHERE wishlist_id = ?');
  const has = db.prepare('SELECT 1 FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?');
  const insertItem = db.prepare('INSERT INTO wishlist_items (wishlist_id, product_id, added_at) VALUES (?, ?, ?)');
  const deleteItem = db.prepare('DELETE FROM wishlist_items WHERE wishlist_id = ? AND product_id = ?');
  const deleteExpired = db.prepare('DELETE FROM wishlists WHERE updated_at < ?');

  const live = (id: string | undefined): id is string => Boolean(id && findWishlist.get(id, cutoff()));

  function requireProduct(slug: string): number {
    const row = productId.get(slug) as { id: number } | undefined;
    if (!row) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    return row.id;
  }

  return {
    view(wishlistId: string | undefined): WishlistView {
      if (!live(wishlistId)) return { items: [], count: 0 };
      const rows = items.all(wishlistId) as { slug: string; addedAt: string }[];
      const summaries = new Map(catalog.findSummaries(rows.map((r) => r.slug)).map((s) => [s.slug, s]));
      const list = rows.flatMap((r) => {
        const product = summaries.get(r.slug);
        return product ? [{ product, addedAt: r.addedAt }] : [];
      });
      return { items: list, count: list.length };
    },

    /** Idempotent. Creates the wishlist on first save; refuses beyond 100 items. */
    save(wishlistId: string | undefined, slug: string): string {
      const id = requireProduct(slug);
      return db.transaction(() => {
        let listId = wishlistId;
        if (!live(listId)) {
          listId = randomBytes(16).toString('base64url');
          insertWishlist.run(listId, now(), now());
        }
        if (!has.get(listId, id)) {
          if ((count.get(listId) as { n: number }).n >= MAX_WISHLIST_ITEMS) {
            throw new HttpError(409, 'WISHLIST_FULL', 'Your wishlist is full');
          }
          insertItem.run(listId, id, now());
        }
        touch.run(now(), listId);
        return listId;
      })();
    },

    /** Idempotent: removing something not saved is not an error. */
    remove(wishlistId: string | undefined, slug: string) {
      const id = requireProduct(slug);
      if (!live(wishlistId)) return;
      deleteItem.run(wishlistId, id);
      touch.run(now(), wishlistId);
    },

    deleteExpired: () => deleteExpired.run(cutoff()).changes,
  };
}

export type WishlistService = ReturnType<typeof createWishlistService>;
