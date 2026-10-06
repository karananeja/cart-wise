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

-- Delivery addresses (F-007). Owner-only; exactly one default per user is kept by the service.
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  pincode TEXT NOT NULL,
  line1 TEXT NOT NULL,
  line2 TEXT NOT NULL,
  landmark TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('home', 'work', 'other')),
  latitude REAL,
  longitude REAL,
  is_default INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS addresses_user ON addresses(user_id);

-- Orders (F-008). Created at Pending Payment to hold stock; lines and prices are a snapshot.
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  address TEXT NOT NULL,
  delivery TEXT NOT NULL,
  item_count INTEGER NOT NULL,
  mrp_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL,
  delivery_paise INTEGER NOT NULL,
  total_paise INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  hold_expires_at TEXT NOT NULL,
  hold_released_at TEXT,
  updated_at TEXT NOT NULL,
  -- Set when paid (F-009).
  payment_method TEXT,
  payment_label TEXT,
  offer_id TEXT,
  offer_discount_paise INTEGER NOT NULL DEFAULT 0,
  paid_paise INTEGER,
  paid_at TEXT,
  -- Lifecycle (F-010).
  delivered_at TEXT,
  cancelled_at TEXT,
  cancel_reason TEXT
);
CREATE INDEX IF NOT EXISTS orders_user ON orders(user_id, status);

CREATE TABLE IF NOT EXISTS order_lines (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER NOT NULL,
  variant_id INTEGER,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  size TEXT,
  thumbnail_url TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price_paise INTEGER NOT NULL,
  unit_mrp_paise INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS order_lines_order ON order_lines(order_id);

-- Simulated payment attempts (F-009). Only masked card details exist here: network, the
-- fictional bank and card type, and the last 4 digits. No full number, expiry or CVV.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  method TEXT NOT NULL CHECK (method IN ('card', 'upi_id', 'upi_qr')),
  status TEXT NOT NULL CHECK (status IN ('pending', 'succeeded', 'failed')),
  failure_reason TEXT,
  amount_paise INTEGER NOT NULL,
  discount_paise INTEGER NOT NULL DEFAULT 0,
  offer_id TEXT,
  card_network TEXT,
  card_bank TEXT,
  card_type TEXT,
  card_last4 TEXT,
  upi_id TEXT,
  otp_hash TEXT,
  otp_attempts INTEGER NOT NULL DEFAULT 0,
  visitor_id TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  completed_at TEXT
);
CREATE INDEX IF NOT EXISTS payment_attempts_order ON payment_attempts(order_id);
-- At most one attempt in progress per order.
CREATE UNIQUE INDEX IF NOT EXISTS payment_attempts_pending ON payment_attempts(order_id) WHERE status = 'pending';

-- Lifecycle steps with their time, for the order timeline (F-009 onwards).
CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS order_status_history_order ON order_status_history(order_id);

-- Delivery OTP (F-010, Q16). Kept readable: the customer is shown it to hand over at the door.
CREATE TABLE IF NOT EXISTS delivery_codes (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  issued_at TEXT NOT NULL
);

-- Returns (F-010, Q9): chosen lines, each returned at its full quantity, at most once.
CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('requested', 'picked_up', 'refunded')),
  created_at TEXT NOT NULL,
  picked_up_at TEXT,
  refunded_at TEXT
);
CREATE INDEX IF NOT EXISTS returns_order ON returns(order_id);

CREATE TABLE IF NOT EXISTS return_lines (
  return_id TEXT NOT NULL REFERENCES returns(id) ON DELETE CASCADE,
  order_line_id INTEGER NOT NULL UNIQUE REFERENCES order_lines(id) ON DELETE CASCADE,
  reason TEXT NOT NULL,
  refund_paise INTEGER NOT NULL
);

-- Simulated refunds to the original payment method (cancellations and returns).
CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  return_id TEXT UNIQUE REFERENCES returns(id) ON DELETE CASCADE,
  amount_paise INTEGER NOT NULL,
  label TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('initiated', 'refunded')),
  initiated_at TEXT NOT NULL,
  refunded_at TEXT
);
CREATE INDEX IF NOT EXISTS refunds_order ON refunds(order_id);

-- Demo operator sessions (F-010, Q14). Only a hash of the token is stored.
CREATE TABLE IF NOT EXISTS operator_sessions (
  token_hash TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
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
