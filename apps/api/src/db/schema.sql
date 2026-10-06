-- Small key/value facts about the database itself (e.g. the price conversion rate used).
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

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

-- Accounts (F-006, ADR-003). Only verified accounts exist here; pending sign-ups live in
-- their OTP challenge until the code is entered.
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  mobile TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  mobile_verified_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Only a hash of the session token is stored.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);

-- Simulated one-time codes (stored hashed). `payload` holds pending sign-up details.
CREATE TABLE IF NOT EXISTS otp_challenges (
  id TEXT PRIMARY KEY,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup', 'login', 'reset')),
  mobile TEXT NOT NULL,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  payload TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  last_sent_at TEXT NOT NULL,
  consumed_at TEXT
);

CREATE TABLE IF NOT EXISTS otp_sends (
  mobile TEXT NOT NULL,
  sent_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS otp_sends_mobile ON otp_sends(mobile, sent_at);

CREATE TABLE IF NOT EXISTS password_resets (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  used_at TEXT
);

-- Account copies of browsing history, so it follows the shopper across devices.
CREATE TABLE IF NOT EXISTS user_recently_viewed (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  viewed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, slug)
);

CREATE TABLE IF NOT EXISTS user_search_history (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  query_key TEXT NOT NULL,
  query TEXT NOT NULL,
  searched_at TEXT NOT NULL,
  PRIMARY KEY (user_id, query_key)
);

-- Guest carts (F-004), identified by an anonymous random id held in a cookie.
CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
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

-- Guest wishlists (F-005): products, not sizes. Same anonymous-cookie pattern as carts.
CREATE TABLE IF NOT EXISTS wishlists (
  id TEXT PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS wishlist_items (
  wishlist_id TEXT NOT NULL REFERENCES wishlists(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  added_at TEXT NOT NULL,
  PRIMARY KEY (wishlist_id, product_id)
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
