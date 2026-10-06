import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Database.Database;

/**
 * Bumped when seeded tables change shape. Older databases have their catalog and inventory
 * tables dropped and are re-seeded from the snapshot; analytics events are kept.
 */
export const SCHEMA_VERSION = 2;
const SEEDED_TABLES = ['inventory', 'product_variants', 'product_reviews', 'products', 'categories'];

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Opens (or creates) the database and applies the schema. Pass ':memory:' in tests. */
export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  if ((db.pragma('user_version', { simple: true }) as number) < SCHEMA_VERSION) {
    db.pragma('foreign_keys = OFF');
    for (const table of SEEDED_TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
    db.pragma('foreign_keys = ON');
    db.pragma(`user_version = ${SCHEMA_VERSION}`);
  }
  db.exec(schema);
  upgradeInPlace(db);
  return db;
}

/**
 * Additive changes to tables that hold user data (never dropped). Idempotent, so it runs on
 * every open; fresh databases already have these from schema.sql.
 */
function upgradeInPlace(db: Db) {
  ensureColumn(db, 'carts', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
  ensureColumn(db, 'wishlists', 'user_id', 'INTEGER REFERENCES users(id) ON DELETE CASCADE');
  // Order payment fields (F-009).
  ensureColumn(db, 'orders', 'payment_method', 'TEXT');
  ensureColumn(db, 'orders', 'payment_label', 'TEXT');
  ensureColumn(db, 'orders', 'offer_id', 'TEXT');
  ensureColumn(db, 'orders', 'offer_discount_paise', 'INTEGER NOT NULL DEFAULT 0');
  ensureColumn(db, 'orders', 'paid_paise', 'INTEGER');
  ensureColumn(db, 'orders', 'paid_at', 'TEXT');
  // Account id on server analytics events (MVP wrap-up decision, 2026-10-06).
  ensureColumn(db, 'analytics_events', 'user_id', 'INTEGER');
  // Lifecycle (F-010).
  ensureColumn(db, 'orders', 'delivered_at', 'TEXT');
  ensureColumn(db, 'orders', 'cancelled_at', 'TEXT');
  ensureColumn(db, 'orders', 'cancel_reason', 'TEXT');
  // One cart and one wishlist per account.
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS carts_user ON carts(user_id) WHERE user_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user ON wishlists(user_id) WHERE user_id IS NOT NULL');
}

function ensureColumn(db: Db, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
