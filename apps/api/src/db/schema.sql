CREATE TABLE IF NOT EXISTS categories (
  slug TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);

-- Catalog snapshot imported from the upstream provider (ADR-002).
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  external_catalog_id TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  brand TEXT,
  brand_slug TEXT,
  category_slug TEXT NOT NULL REFERENCES categories(slug),
  mrp_paise INTEGER NOT NULL,
  price_paise INTEGER NOT NULL,
  discount_percent INTEGER NOT NULL,
  rating REAL NOT NULL,
  thumbnail_url TEXT NOT NULL,
  image_urls TEXT NOT NULL,
  specifications TEXT NOT NULL,
  tags TEXT NOT NULL,
  catalog_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS products_category ON products(category_slug);

-- Imported with the catalog; emails and dates are not kept.
CREATE TABLE IF NOT EXISTS product_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL,
  comment TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  sort_order INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS product_reviews_product ON product_reviews(product_id);

-- Application-owned sizes (Q4); never imported.
CREATE TABLE IF NOT EXISTS product_variants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  UNIQUE (product_id, label)
);

-- Application-owned inventory, deliberately separate from catalog data (INV-1). One row per
-- sellable unit: variant_id is NULL for products without sizes.
CREATE TABLE IF NOT EXISTS inventory (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at TEXT NOT NULL,
  UNIQUE (product_id, variant_id)
);
CREATE INDEX IF NOT EXISTS inventory_product ON inventory(product_id);

-- Guest carts (F-004), identified by an anonymous random id held in a cookie.
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- No prices: carts always show current catalog prices.
CREATE TABLE IF NOT EXISTS cart_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id INTEGER REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
  added_at TEXT NOT NULL
);
-- NULLs are distinct in a plain UNIQUE, so unsized lines need the expression.
CREATE UNIQUE INDEX IF NOT EXISTS cart_lines_unit ON cart_lines(cart_id, product_id, IFNULL(variant_id, 0));

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  properties TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_events_name ON analytics_events(name, occurred_at);
