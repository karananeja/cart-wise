import { readFileSync } from 'node:fs';
import type { CatalogSnapshot } from '../catalog/dummyjson.js';
import { USD_TO_INR_RATE } from '../catalog/config.js';
import { mapCatalog } from '../catalog/mapping.js';
import { seedOnHand } from '../inventory/inventory.js';
import { SNAPSHOT_PATH } from '../paths.js';
import type { Db } from './database.js';

export function loadSnapshot(path = SNAPSHOT_PATH): CatalogSnapshot {
  return JSON.parse(readFileSync(path, 'utf8')) as CatalogSnapshot;
}

/** Replaces catalog and inventory with the snapshot contents. Idempotent. Analytics are kept. */
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
  const insertInventory = db.prepare(
    'INSERT INTO inventory (product_id, on_hand, reserved, updated_at) VALUES (?, ?, 0, ?)',
  );

  db.transaction(() => {
    db.exec('DELETE FROM inventory; DELETE FROM products; DELETE FROM categories;');
    for (const category of categories) insertCategory.run(category);
    for (const product of products) {
      insertProduct.run({
        ...product,
        imageUrls: JSON.stringify(product.imageUrls),
        specifications: JSON.stringify(product.specifications),
        tags: JSON.stringify(product.tags),
      });
      insertInventory.run(product.id, seedOnHand(product.id), now);
    }
  })();

  return { products: products.length, categories: categories.length };
}

export function isSeeded(db: Db): boolean {
  return (db.prepare('SELECT COUNT(*) AS n FROM products').get() as { n: number }).n > 0;
}
