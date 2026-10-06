import { readFileSync } from 'node:fs';
import type { CatalogSnapshot } from '../catalog/dummyjson.js';
import { USD_TO_INR_RATE } from '../catalog/config.js';
import { mapCatalog } from '../catalog/mapping.js';
import { seedOnHand, seedSizeOnHand } from '../inventory/inventory.js';
import { sizesFor } from '../inventory/sizes.js';
import { SNAPSHOT_PATH } from '../paths.js';
import type { Db } from './database.js';

export function loadSnapshot(path = SNAPSHOT_PATH): CatalogSnapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as CatalogSnapshot;
}

/**
 * Replaces catalog, reviews, sizes and inventory with the snapshot contents plus
 * application-owned sizes and stock. Idempotent and deterministic. Analytics are kept.
 */
export function seedDatabase(db: Db, snapshot: CatalogSnapshot = loadSnapshot()): { products: number; categories: number } {
  const { products, categories } = mapCatalog(snapshot.products, USD_TO_INR_RATE);
  const now = new Date().toISOString();

  const insertCategory = db.prepare(
    'INSERT INTO categories (slug, name, image_url, sort_order) VALUES (@slug, @name, @imageUrl, @sortOrder)',
  );
  const insertProduct = db.prepare(`
    INSERT INTO products (id, slug, external_catalog_id, title, description, brand, brand_slug, category_slug,
      mrp_paise, price_paise, discount_percent, rating, thumbnail_url, image_urls, specifications, tags, catalog_order)
    VALUES (@id, @slug, @externalCatalogId, @title, @description, @brand, @brandSlug, @categorySlug,
      @mrpPaise, @pricePaise, @discountPercent, @rating, @thumbnailUrl, @imageUrls, @specifications, @tags, @catalogOrder)
  `);
  const insertReview = db.prepare(
    'INSERT INTO product_reviews (product_id, rating, comment, reviewer_name, sort_order) VALUES (?, ?, ?, ?, ?)',
  );
  const insertVariant = db.prepare('INSERT INTO product_variants (product_id, label, sort_order) VALUES (?, ?, ?)');
  const insertInventory = db.prepare(
    'INSERT INTO inventory (product_id, variant_id, on_hand, reserved, updated_at) VALUES (?, ?, ?, 0, ?)',
  );

  db.transaction(() => {
    db.exec(
      'DELETE FROM inventory; DELETE FROM product_variants; DELETE FROM product_reviews; DELETE FROM products; DELETE FROM categories;',
    );
    db.exec("DELETE FROM sqlite_sequence WHERE name IN ('inventory', 'product_variants', 'product_reviews');");
    for (const category of categories) insertCategory.run(category);
    for (const product of products) {
      insertProduct.run({
        ...product,
        imageUrls: JSON.stringify(product.imageUrls),
        specifications: JSON.stringify(product.specifications),
        tags: JSON.stringify(product.tags),
      });
      product.reviews.forEach((r, i) => insertReview.run(product.id, r.rating, r.comment, r.reviewerName, i));

      const sizes = sizesFor(product.categorySlug);
      if (sizes.length === 0) {
        insertInventory.run(product.id, null, seedOnHand(product.id), now);
        continue;
      }
      sizes.forEach((label, i) => {
        const variantId = insertVariant.run(product.id, label, i).lastInsertRowid;
        insertInventory.run(product.id, variantId, seedSizeOnHand(product.id, i), now);
      });
    }
  })();

  setPriceRate(db, USD_TO_INR_RATE);
  return { products: products.length, categories: categories.length };
}

const RATE_KEY = 'usd_to_inr_rate';

function setPriceRate(db: Db, rate: number) {
  db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value').run(RATE_KEY, String(rate));
}

/** The rate the stored prices were calculated with. Databases from before it was recorded used 1:1. */
export function storedPriceRate(db: Db): number {
  const row = db.prepare('SELECT value FROM app_settings WHERE key = ?').get(RATE_KEY) as { value: string } | undefined;
  return row ? Number(row.value) : 1;
}

/**
 * Re-prices products from the snapshot when the configured rate differs from the one the
 * database was priced with. Only prices change: stock, carts, wishlists and accounts are kept.
 * Returns whether anything was re-priced.
 */
export function repriceIfRateChanged(db: Db, snapshot: CatalogSnapshot = loadSnapshot()): boolean {
  if (!isSeeded(db) || storedPriceRate(db) === USD_TO_INR_RATE) return false;
  const { products } = mapCatalog(snapshot.products, USD_TO_INR_RATE);
  const update = db.prepare('UPDATE products SET mrp_paise = ?, price_paise = ?, discount_percent = ? WHERE id = ?');
  db.transaction(() => {
    for (const p of products) update.run(p.mrpPaise, p.pricePaise, p.discountPercent, p.id);
    setPriceRate(db, USD_TO_INR_RATE);
  })();
  return true;
}

export function isSeeded(db: Db): boolean {
  return (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n > 0;
}
