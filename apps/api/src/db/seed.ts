import { readFileSync } from 'node:fs';
import type { CatalogSnapshot } from '../catalog/dummyjson.js';
import { USD_TO_INR_RATE } from '../catalog/config.js';
import { mapCatalog } from '../catalog/mapping.js';
import { seedOnHand, seedOptionOnHand, seedSizeOnHand } from '../inventory/inventory.js';
import { optionsFor, tierPrices } from '../inventory/options.js';
import { sizesFor } from '../inventory/sizes.js';
import { SNAPSHOT_PATH } from '../paths.js';
import type { Db } from './database.js';

export function loadSnapshot(path = SNAPSHOT_PATH): CatalogSnapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as CatalogSnapshot;
}

/**
 * Replaces catalog, reviews, sizes, options and inventory with the snapshot contents plus
 * application-owned sizes, options and stock. Idempotent and deterministic. Analytics, carts,
 * orders and holds are kept: their variant ids are remapped by label (see `remapUnits`).
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
  const insertVariant = db.prepare(`
    INSERT INTO product_variants (product_id, kind, label, sort_order, mrp_paise, price_paise, discount_percent)
    VALUES (@productId, @kind, @label, @sortOrder, @mrpPaise, @pricePaise, @discountPercent)`);
  const insertInventory = db.prepare(
    'INSERT INTO inventory (product_id, variant_id, on_hand, reserved, updated_at) VALUES (?, ?, ?, 0, ?)',
  );

  saveVariantLabels(db);
  // Off so deleting variants doesn't cascade away cart lines; they are remapped below instead.
  db.pragma('foreign_keys = OFF');
  try {
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
        const options = optionsFor(product.categorySlug);
        if (sizes.length === 0 && options.length === 0) {
          insertInventory.run(product.id, null, seedOnHand(product.id), now);
          continue;
        }
        sizes.forEach((label, i) => {
          const variantId = insertVariant.run({
            productId: product.id, kind: 'size', label, sortOrder: i, mrpPaise: null, pricePaise: null, discountPercent: null,
          }).lastInsertRowid;
          insertInventory.run(product.id, variantId, seedSizeOnHand(product.id, i), now);
        });
        options.forEach((tier, i) => {
          const variantId = insertVariant.run({
            productId: product.id,
            kind: 'option',
            label: tier.label,
            sortOrder: i,
            ...tierPrices(product, tier.stepPercent),
            discountPercent: product.discountPercent,
          }).lastInsertRowid;
          insertInventory.run(product.id, variantId, seedOptionOnHand(product.id, i), now);
        });
      }
      remapUnits(db);
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }

  setPriceRate(db, USD_TO_INR_RATE);
  return { products: products.length, categories: categories.length };
}

/**
 * Keeps the labels behind the current variant ids so references can follow them across a reseed.
 * Also called before a schema upgrade drops the seeded tables; an existing copy is kept.
 */
export function saveVariantLabels(db: Db) {
  const hasVariants = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'product_variants'").get();
  if (hasVariants) db.exec('CREATE TABLE IF NOT EXISTS variant_remap AS SELECT id, product_id, label FROM product_variants');
}

/**
 * After a reseed, points carts, orders and the stock log at the new variant ids by product and
 * label, and rebuilds held stock from unpaid orders, so nothing moves to the wrong size or loses
 * its hold. Cart lines whose size or option no longer exists are removed. Lines of products that
 * gained options (F-013) move to the base tier, whose price is the one they showed before.
 */
function remapUnits(db: Db) {
  const remapTable = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'variant_remap'").get();
  if (remapTable) {
    const newId = (table: string) => `(SELECT nv.id FROM variant_remap o
      JOIN product_variants nv ON nv.product_id = o.product_id AND nv.label = o.label
      WHERE o.id = ${table}.variant_id AND o.product_id = ${table}.product_id)`;
    db.exec(`DELETE FROM cart_lines WHERE variant_id IS NOT NULL AND ${newId('cart_lines')} IS NULL`);
    // Two steps through negative ids, so cart lines never collide on their unique unit index mid-update.
    for (const table of ['cart_lines', 'order_lines', 'inventory_log']) {
      db.exec(`UPDATE ${table} SET variant_id = -${newId(table)} WHERE variant_id IS NOT NULL`);
      db.exec(`UPDATE ${table} SET variant_id = -variant_id WHERE variant_id < 0`);
    }
    db.exec('DROP TABLE variant_remap');
  }
  const baseOption = (table: string) => `(SELECT v.id FROM product_variants v
    WHERE v.product_id = ${table}.product_id AND v.kind = 'option' ORDER BY v.sort_order LIMIT 1)`;
  db.exec(`UPDATE cart_lines SET variant_id = ${baseOption('cart_lines')} WHERE variant_id IS NULL AND ${baseOption('cart_lines')} IS NOT NULL`);
  db.exec(`UPDATE order_lines SET variant_id = ${baseOption('order_lines')}
    WHERE variant_id IS NULL AND size IS NULL AND ${baseOption('order_lines')} IS NOT NULL`);
  const held = `COALESCE((SELECT SUM(ol.quantity) FROM order_lines ol JOIN orders o ON o.id = ol.order_id
    WHERE o.status = 'pending_payment' AND o.hold_released_at IS NULL
      AND ol.product_id = inventory.product_id AND IFNULL(ol.variant_id, 0) = IFNULL(inventory.variant_id, 0)), 0)`;
  db.exec(`UPDATE inventory SET reserved = ${held}, on_hand = MAX(on_hand, ${held})`);
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
  const updateOption = db.prepare(`
    UPDATE product_variants SET mrp_paise = ?, price_paise = ?, discount_percent = ? WHERE product_id = ? AND label = ? AND kind = 'option'`);
  db.transaction(() => {
    for (const p of products) {
      update.run(p.mrpPaise, p.pricePaise, p.discountPercent, p.id);
      for (const tier of optionsFor(p.categorySlug)) {
        const prices = tierPrices(p, tier.stepPercent);
        updateOption.run(prices.mrpPaise, prices.pricePaise, p.discountPercent, p.id, tier.label);
      }
    }
    setPriceRate(db, USD_TO_INR_RATE);
  })();
  return true;
}

export function isSeeded(db: Db): boolean {
  return (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n > 0;
}
