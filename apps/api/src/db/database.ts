import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { saveVariantLabels } from './seed.js';

export type Db = Database.Database;

/**
 * Bumped when a table changes in a way `upgradeInPlace` can't express (4: accounts by email, F-016).
 * Databases older than SEEDED_TABLES_VERSION have their catalog and inventory tables dropped and are
 * re-seeded from the snapshot; analytics events and user tables are always kept.
 */
export const SCHEMA_VERSION = 4;
/** The last version that changed seeded tables (F-013). */
const SEEDED_TABLES_VERSION = 3;
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
  const version = db.pragma('user_version', { simple: true }) as number;
  if (version < SEEDED_TABLES_VERSION) {
    // Carts and orders point at variant ids; the reseed remaps them by label (seed.ts).
    saveVariantLabels(db);
    db.pragma('foreign_keys = OFF');
    for (const table of SEEDED_TABLES) db.exec(`DROP TABLE IF EXISTS ${table}`);
    db.pragma('foreign_keys = ON');
  }
  dropMobileOtpTables(db);
  db.exec(schema);
  rebuildUsersForEmailOtp(db);
  upgradeInPlace(db);
  if (version < SCHEMA_VERSION) db.pragma(`user_version = ${SCHEMA_VERSION}`);
  return db;
}

const columnsOf = (db: Db, table: string) => (db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]).map((c) => c.name);

/**
 * Codes were keyed by mobile before F-016. They only live for minutes, so the old tables are dropped
 * (pending codes at upgrade time are lost) and schema.sql recreates them keyed by email.
 */
function dropMobileOtpTables(db: Db) {
  for (const table of ['otp_challenges', 'otp_sends']) {
    if (columnsOf(db, table).includes('mobile')) db.exec(`DROP TABLE ${table}`);
  }
}

/**
 * F-016: mobile becomes optional and non-unique, and email_verified_at is added. SQLite can't drop a
 * NOT NULL or UNIQUE constraint, so `users` is rebuilt the way SQLite documents: create the new table,
 * copy every row with its id, drop the old one and rename the new one into place. Foreign keys are off
 * meanwhile, so nothing cascades, and the tables pointing at `users` (sessions, carts, orders…) resolve
 * to the new table by name. Renaming the old table instead would rewrite those references.
 */
function rebuildUsersForEmailOtp(db: Db) {
  const columns = columnsOf(db, 'users');
  if (columns.includes('email_verified_at')) return;
  const definition = schema.match(/CREATE TABLE IF NOT EXISTS users \([\s\S]*?\n\);/)![0].replace('IF NOT EXISTS users', 'users_f016');
  // Stray rows that were already dangling must not block the upgrade; only new breakage does.
  const dangling = () => (db.pragma('foreign_key_check') as unknown[]).length;
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      const before = dangling();
      db.exec(definition);
      db.exec(`INSERT INTO users_f016 (${columns.join(', ')}) SELECT ${columns.join(', ')} FROM users`);
      db.exec('DROP TABLE users');
      db.exec('ALTER TABLE users_f016 RENAME TO users');
      if (dangling() > before) throw new Error('Upgrading accounts would break rows linked to them; the database was left unchanged.');
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
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
  // Rows are copied as they are: a stray row must not stop the upgrade.
  db.pragma('foreign_keys = OFF');
  try {
    db.transaction(() => {
      db.exec('DROP INDEX IF EXISTS payment_attempts_order; DROP INDEX IF EXISTS payment_attempts_pending;');
      db.exec('ALTER TABLE payment_attempts RENAME TO payment_attempts_before_f014');
      db.exec(schema);
      db.exec(`INSERT INTO payment_attempts (${columns}) SELECT ${columns} FROM payment_attempts_before_f014`);
      db.exec('DROP TABLE payment_attempts_before_f014');
    })();
  } finally {
    db.pragma('foreign_keys = ON');
  }
}

function ensureColumn(db: Db, table: string, column: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!columns.some((c) => c.name === column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
