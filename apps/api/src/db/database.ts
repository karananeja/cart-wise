import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { saveVariantLabels } from './seed.js';

export type Db = Database.Database;

/**
 * Bumped when seeded tables change shape. Older databases have their catalog and inventory
 * tables dropped and are re-seeded from the snapshot; analytics events are kept.
 */
export const SCHEMA_VERSION = 3;
const SEEDED_TABLES = ['inventory', 'product_variants', 'product_reviews', 'products', 'categories'];

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Opens (or creates) the database and applies the schema. Pass ':memory:' in tests. */
export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  // Transactions take the write lock when they begin (BEGIN IMMEDIATE). A deferred transaction that
  // reads, then writes after another connection (the seed script, a test helper) has committed
  // fails at once with "database is locked", which no busy timeout can wait out; an immediate one
  // just waits its turn (better-sqlite3's default 5 s). Nested transactions still use savepoints.
  const transaction = db.transaction.bind(db);
  db.transaction = ((fn: Parameters<typeof transaction>[0]) => transaction(fn).immediate) as typeof db.transaction;
  db.pragma('foreign_keys = ON');
  if ((db.pragma('user_version', { simple: true }) as number) < SCHEMA_VERSION) {
    // Carts and orders point at variant ids; the reseed remaps them by label (seed.ts).
    saveVariantLabels(db);
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
  // EMI and Razorpay (F-014).
  rebuildPaymentAttempts(db);
  for (const [column, definition] of [
    ['payment_provider', 'TEXT'],
    ['emi_tenure', 'INTEGER'],
    ['emi_monthly_paise', 'INTEGER'],
    ['emi_interest_paise', 'INTEGER'],
    ['emi_no_cost', 'INTEGER NOT NULL DEFAULT 0'],
    ['gateway_payment_id', 'TEXT'],
  ]) ensureColumn(db, 'orders', column!, definition!);
  ensureColumn(db, 'refunds', 'gateway_refund_id', 'TEXT');
  ensureColumn(db, 'refunds', 'failure', 'TEXT');
  // Electronics options (F-013).
  ensureColumn(db, 'order_lines', 'option_label', 'TEXT');
  // Lifecycle (F-010).
  ensureColumn(db, 'orders', 'delivered_at', 'TEXT');
  ensureColumn(db, 'orders', 'cancelled_at', 'TEXT');
  ensureColumn(db, 'orders', 'cancel_reason', 'TEXT');
  // One cart and one wishlist per account.
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS carts_user ON carts(user_id) WHERE user_id IS NOT NULL');
  db.exec('CREATE UNIQUE INDEX IF NOT EXISTS wishlists_user ON wishlists(user_id) WHERE user_id IS NOT NULL');
}

/**
 * SQLite can't change a CHECK constraint, so a payment_attempts table from before Razorpay
 * (F-014) is rebuilt: its rows are copied into the current definition from schema.sql.
 */
function rebuildPaymentAttempts(db: Db) {
  const table = db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'payment_attempts'").get() as { sql: string } | undefined;
  if (!table || table.sql.includes("'razorpay'")) return;
  const columns = (db.prepare('PRAGMA table_info(payment_attempts)').all() as { name: string }[]).map((c) => c.name).join(', ');
  db.transaction(() => {
    db.exec('DROP INDEX IF EXISTS payment_attempts_order; DROP INDEX IF EXISTS payment_attempts_pending;');
    db.exec('ALTER TABLE payment_attempts RENAME TO payment_attempts_before_f014');
    db.exec(schema);
    db.exec(`INSERT INTO payment_attempts (${columns}) SELECT ${columns} FROM payment_attempts_before_f014`);
    db.exec('DROP TABLE payment_attempts_before_f014');
  })();
}

function ensureColumn(db: Db, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
