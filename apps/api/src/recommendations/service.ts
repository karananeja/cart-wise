import {
  BOUGHT_TOGETHER_MIN_ORDERS,
  CART_SUGGESTIONS_MAX,
  PAIRING_MAX,
  SIMILAR_MAX,
  type CartRecommendations,
  type HomeRecommendations,
  type ProductRecommendations,
  type RecommendedProduct,
} from '@store/shared';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import { deriveAvailability } from '../inventory/inventory.js';
import { pairsWell, similar, type Candidate } from './rules.js';

interface Row {
  id: number;
  slug: string;
  title: string;
  brand: string | null;
  category_slug: string;
  mrp_paise: number;
  price_paise: number;
  discount_percent: number;
  rating: number;
  review_count: number;
  thumbnail_url: string;
  tags: string;
  available: number;
  needs_size: number;
}

/**
 * Product discovery (F-012). Deterministic rules over the live catalog and real paid orders; the
 * whole catalog is small, so it is read per request and always reflects current stock.
 */
export function createRecommendationService(db: Db) {
  const catalog = db.prepare(`
    SELECT p.id, p.slug, p.title, p.brand, p.category_slug, p.mrp_paise, p.price_paise, p.discount_percent, p.rating,
      p.thumbnail_url, p.tags,
      (SELECT COUNT(*) FROM product_reviews r WHERE r.product_id = p.id) AS review_count,
      (SELECT COALESCE(SUM(MAX(i.on_hand - i.reserved, 0)), 0) FROM inventory i WHERE i.product_id = p.id) AS available,
      EXISTS (SELECT 1 FROM product_variants v WHERE v.product_id = p.id) AS needs_size
    FROM products p`);
  /** Other products in the same paid orders as this one, by number of distinct orders. */
  const coPurchased = db.prepare(`
    SELECT l2.product_id AS id, COUNT(DISTINCT l1.order_id) AS orders
    FROM order_lines l1
    JOIN orders o ON o.id = l1.order_id AND o.paid_at IS NOT NULL
    JOIN order_lines l2 ON l2.order_id = l1.order_id AND l2.product_id <> l1.product_id
    WHERE l1.product_id = ?
    GROUP BY l2.product_id HAVING orders >= ${BOUGHT_TOGETHER_MIN_ORDERS}
    ORDER BY orders DESC, l2.product_id`);
  const latestBought = db.prepare(`
    SELECT l.product_id AS id FROM orders o JOIN order_lines l ON l.order_id = o.id
    WHERE o.user_id = ? AND o.paid_at IS NOT NULL AND o.status <> 'cancelled'
    ORDER BY o.paid_at DESC, l.id LIMIT 1`);
  const everBought = db.prepare(`
    SELECT DISTINCT l.product_id AS id FROM orders o JOIN order_lines l ON l.order_id = o.id
    WHERE o.user_id = ? AND o.paid_at IS NOT NULL`);

  const toCandidate = (r: Row): Candidate => ({
    product: {
      id: r.id,
      slug: r.slug,
      title: r.title,
      brand: r.brand,
      categorySlug: r.category_slug,
      mrpPaise: r.mrp_paise,
      pricePaise: r.price_paise,
      discountPercent: r.discount_percent,
      rating: r.rating,
      reviewCount: r.review_count,
      thumbnailUrl: r.thumbnail_url,
      availability: deriveAvailability(r.available),
      needsSize: r.needs_size === 1,
    },
    tags: JSON.parse(r.tags) as string[],
    available: r.available,
  });

  const load = () => {
    const all = (catalog.all() as Row[]).map(toCandidate);
    return { all, byId: new Map(all.map((c) => [c.product.id, c])), bySlug: new Map(all.map((c) => [c.product.slug, c])) };
  };
  type Snapshot = ReturnType<typeof load>;

  /** Real co-purchases (≥2 paid orders) if any, else complementary categories, else nothing. */
  const pairing = (s: Snapshot, anchor: Candidate, exclude: Set<number> = new Set()): ProductRecommendations['pairing'] => {
    const together = (coPurchased.all(anchor.product.id) as { id: number }[])
      .map((r) => s.byId.get(r.id))
      .filter((c): c is Candidate => !!c && c.available > 0 && !exclude.has(c.product.id))
      .slice(0, PAIRING_MAX)
      .map((c) => c.product);
    if (together.length) return { kind: 'bought_together', items: together };
    const pairs = pairsWell(anchor, s.all, exclude);
    return pairs.length ? { kind: 'pairs_well', items: pairs } : null;
  };

  return {
    forProduct(slug: string): ProductRecommendations {
      const s = load();
      const anchor = s.bySlug.get(slug);
      if (!anchor) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
      return { pairing: pairing(s, anchor), similar: similar(anchor, s.all) };
    },

    forHome(viewedSlugs: string[], userId: number | null, cartProductIds: number[]): HomeRecommendations {
      const s = load();
      const viewed = viewedSlugs.map((slug) => s.bySlug.get(slug)).filter((c): c is Candidate => !!c);
      const viewedAnchor = viewed[0];
      const becauseViewedItems = viewedAnchor ? similar(viewedAnchor, s.all, new Set(viewed.map((c) => c.product.id))) : [];

      let becauseBought: HomeRecommendations['becauseBought'] = null;
      const latest = userId === null ? undefined : (latestBought.get(userId) as { id: number } | undefined);
      const boughtAnchor = latest && s.byId.get(latest.id);
      if (boughtAnchor && userId !== null) {
        const exclude = new Set([...(everBought.all(userId) as { id: number }[]).map((r) => r.id), ...cartProductIds]);
        const pair = pairing(s, boughtAnchor, exclude)?.items ?? [];
        const items = pair.length ? pair : similar(boughtAnchor, s.all, exclude, SIMILAR_MAX);
        if (items.length) becauseBought = { anchor: { slug: boughtAnchor.product.slug, title: boughtAnchor.product.title }, items };
      }

      return {
        becauseViewed: viewedAnchor && becauseViewedItems.length ? { anchor: { slug: viewedAnchor.product.slug, title: viewedAnchor.product.title }, items: becauseViewedItems } : null,
        becauseBought,
      };
    },

    /** Pairings for up to 3 cart products (newest first), merged, never anything already in the cart. */
    forCart(cartProductIds: number[]): CartRecommendations {
      const s = load();
      const inCart = new Set(cartProductIds);
      const items = new Map<number, RecommendedProduct>();
      for (const id of [...new Set(cartProductIds)].slice(0, 3)) {
        const anchor = s.byId.get(id);
        if (!anchor) continue;
        for (const item of pairing(s, anchor, inCart)?.items ?? []) if (!items.has(item.id)) items.set(item.id, item);
      }
      return { items: [...items.values()].slice(0, CART_SUGGESTIONS_MAX) };
    },
  };
}

export type RecommendationService = ReturnType<typeof createRecommendationService>;
