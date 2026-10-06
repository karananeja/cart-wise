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

-- Application-owned inventory, deliberately separate from catalog data (INV-1).
CREATE TABLE IF NOT EXISTS inventory (
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  on_hand INTEGER NOT NULL CHECK (on_hand >= 0),
  reserved INTEGER NOT NULL DEFAULT 0 CHECK (reserved >= 0),
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  properties TEXT NOT NULL,
  visitor_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  received_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS analytics_events_name ON analytics_events(name, occurred_at);
