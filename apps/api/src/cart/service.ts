import { randomBytes } from 'node:crypto';
import type { CartLineView, CartView } from '@store/shared';
import type { CatalogRepository } from '../catalog/repository.js';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import { deriveAvailability } from '../inventory/inventory.js';
import { buildCartView, lineIssue, maxQuantity } from './rules.js';

export const CART_LIFETIME_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

interface LineRow {
  id: number;
  product_id: number;
  slug: string;
  size: string | null;
  quantity: number;
  available: number;
}

export function createCartService(db: Db, catalog: CatalogRepository) {
  const now = () => new Date().toISOString();
  const cutoff = () => new Date(Date.now() - CART_LIFETIME_DAYS * DAY_MS).toISOString();

  const findCart = db.prepare('SELECT id FROM carts WHERE id = ? AND updated_at >= ?');
  const insertCart = db.prepare('INSERT INTO carts (id, created_at, updated_at) VALUES (?, ?, ?)');
  const touchCart = db.prepare('UPDATE carts SET updated_at = ? WHERE id = ?');
  const deleteExpired = db.prepare('DELETE FROM carts WHERE updated_at < ?');
  // Stock for the exact sellable unit: the size row for sized lines, the product row otherwise.
  const lineRows = db.prepare(`
    SELECT l.id, l.product_id, p.slug, v.label AS size, l.quantity,
      COALESCE((SELECT MAX(i.on_hand - i.reserved, 0) FROM inventory i
        WHERE i.product_id = l.product_id AND IFNULL(i.variant_id, 0) = IFNULL(l.variant_id, 0)), 0) AS available
    FROM cart_lines l
    JOIN products p ON p.id = l.product_id
    LEFT JOIN product_variants v ON v.id = l.variant_id
    WHERE l.cart_id = ?
    ORDER BY l.added_at DESC, l.id DESC`);
  const unitFor = db.prepare(`
    SELECT p.id AS productId, v.id AS variantId,
      COALESCE((SELECT MAX(i.on_hand - i.reserved, 0) FROM inventory i
        WHERE i.product_id = p.id AND IFNULL(i.variant_id, 0) = IFNULL(v.id, 0)), 0) AS available
    FROM products p LEFT JOIN product_variants v ON v.product_id = p.id AND v.label = ?
    WHERE p.slug = ?`);
  const sizeCount = db.prepare('SELECT COUNT(*) AS n FROM product_variants WHERE product_id = ?');
  const existingLine = db.prepare(
    'SELECT id, quantity FROM cart_lines WHERE cart_id = ? AND product_id = ? AND IFNULL(variant_id, 0) = IFNULL(?, 0)',
  );
  const insertLine = db.prepare(
    'INSERT INTO cart_lines (cart_id, product_id, variant_id, quantity, added_at) VALUES (?, ?, ?, ?, ?)',
  );
  const setQuantity = db.prepare('UPDATE cart_lines SET quantity = ? WHERE id = ?');
  const lineInCart = db.prepare(`
    SELECT l.id, l.quantity,
      COALESCE((SELECT MAX(i.on_hand - i.reserved, 0) FROM inventory i
        WHERE i.product_id = l.product_id AND IFNULL(i.variant_id, 0) = IFNULL(l.variant_id, 0)), 0) AS available
    FROM cart_lines l WHERE l.id = ? AND l.cart_id = ?`);
  const deleteLine = db.prepare('DELETE FROM cart_lines WHERE id = ? AND cart_id = ?');

  function view(cartId: string | undefined): CartView {
    if (!cartId || !findCart.get(cartId, cutoff())) return buildCartView([]);
    const rows = lineRows.all(cartId) as LineRow[];
    const summaries = new Map(catalog.findSummaries([...new Set(rows.map((r) => r.slug))]).map((s) => [s.id, s]));
    const lines = rows.flatMap((row): CartLineView[] => {
      const product = summaries.get(row.product_id);
      if (!product) return [];
      return [
        {
          id: row.id,
          product,
          size: row.size,
          quantity: row.quantity,
          availability: deriveAvailability(row.available),
          maxQuantity: maxQuantity(row.available),
          issue: lineIssue(row.quantity, row.available),
          linePricePaise: product.pricePaise * row.quantity,
          lineMrpPaise: product.mrpPaise * row.quantity,
        },
      ];
    });
    return buildCartView(lines);
  }

  /** Returns the existing live cart, or creates one. */
  function ensureCart(cartId: string | undefined): string {
    if (cartId && findCart.get(cartId, cutoff())) return cartId;
    const id = randomBytes(16).toString('base64url');
    insertCart.run(id, now(), now());
    return id;
  }

  return {
    view,

    add(cartId: string | undefined, input: { productSlug: string; size?: string | null; quantity: number }) {
      const size = input.size ?? null;
      const unit = unitFor.get(size, input.productSlug) as
        | { productId: number; variantId: number | null; available: number }
        | undefined;
      if (!unit) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      const sized = (sizeCount.get(unit.productId) as { n: number }).n > 0;
      if (sized && !size) throw new HttpError(400, 'SIZE_REQUIRED', 'Please select a size');
      if ((sized && unit.variantId === null) || (!sized && size)) throw new HttpError(400, 'INVALID_SIZE', 'That size is not available');
      if (unit.available <= 0) throw new HttpError(409, 'OUT_OF_STOCK', 'This item is out of stock');

      return db.transaction(() => {
        const id = ensureCart(cartId);
        const existing = existingLine.get(id, unit.productId, unit.variantId) as { id: number; quantity: number } | undefined;
        const max = maxQuantity(unit.available);
        const quantity = (existing?.quantity ?? 0) + input.quantity;
        if (quantity > max) throw new HttpError(409, 'QUANTITY_LIMIT', `You can add up to ${max}`, { max });
        if (existing) setQuantity.run(quantity, existing.id);
        else insertLine.run(id, unit.productId, unit.variantId, quantity, now());
        touchCart.run(now(), id);
        return id;
      })();
    },

    update(cartId: string | undefined, lineId: number, quantity: number) {
      const line = cartId ? (lineInCart.get(lineId, cartId) as { id: number; quantity: number; available: number } | undefined) : undefined;
      if (!line || !cartId) throw new HttpError(404, 'LINE_NOT_FOUND', 'That item is no longer in your cart');
      // Decreasing is always allowed so users can resolve stock problems themselves.
      if (quantity > line.quantity && quantity > maxQuantity(line.available)) {
        const max = maxQuantity(line.available);
        throw new HttpError(409, 'QUANTITY_LIMIT', `You can add up to ${max}`, { max });
      }
      setQuantity.run(quantity, line.id);
      touchCart.run(now(), cartId);
    },

    remove(cartId: string | undefined, lineId: number) {
      if (!cartId || deleteLine.run(lineId, cartId).changes === 0) {
        throw new HttpError(404, 'LINE_NOT_FOUND', 'That item is no longer in your cart');
      }
      touchCart.run(now(), cartId);
    },

    deleteExpired: () => deleteExpired.run(cutoff()).changes,
  };
}

export type CartService = ReturnType<typeof createCartService>;
