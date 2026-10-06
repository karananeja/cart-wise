import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { openDatabase, SCHEMA_VERSION } from './database.js';
import { isSeeded, seedDatabase } from './seed.js';

let dir: string | undefined;
afterEach(() => dir && rmSync(dir, { recursive: true, force: true }));

it('upgrades a version 1 database: rebuilds seeded tables and keeps analytics', () => {
  dir = mkdtempSync(join(tmpdir(), 'store-db-'));
  const path = join(dir, 'store.db');

  // A database as F-001 created it: inventory keyed by product, no variants or reviews.
  const old = new Database(path);
  old.exec(`
    CREATE TABLE products (id INTEGER PRIMARY KEY, title TEXT);
    CREATE TABLE inventory (product_id INTEGER PRIMARY KEY, on_hand INTEGER, reserved INTEGER, updated_at TEXT);
    CREATE TABLE analytics_events (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, properties TEXT NOT NULL,
      visitor_id TEXT NOT NULL, occurred_at TEXT NOT NULL, received_at TEXT NOT NULL);
    INSERT INTO products VALUES (1, 'old');
    INSERT INTO analytics_events (name, properties, visitor_id, occurred_at, received_at) VALUES ('filter_applied', '{}', 'v', 't', 't');
  `);
  old.close();

  const db = openDatabase(path);
  expect(db.pragma('user_version', { simple: true })).toBe(SCHEMA_VERSION);
  expect(isSeeded(db)).toBe(false);
  expect((db.prepare('SELECT COUNT(*) AS n FROM analytics_events').get() as { n: number }).n).toBe(1);

  seedDatabase(db);
  expect(isSeeded(db)).toBe(true);
  db.close();
});

it('adds the F-009 payment columns to an F-008 orders table, keeping its orders', () => {
  dir = mkdtempSync(join(tmpdir(), 'store-db-'));
  const path = join(dir, 'store.db');
  const first = openDatabase(path);
  seedDatabase(first);
  first.close();

  // Strip the payment columns, as an F-008 database had them.
  const old = new Database(path);
  for (const c of ['payment_method', 'payment_label', 'offer_id', 'offer_discount_paise', 'paid_paise', 'paid_at']) old.exec(`ALTER TABLE orders DROP COLUMN ${c}`);
  old.exec(`INSERT INTO users (id, name, email, mobile, password_hash, mobile_verified_at, created_at) VALUES (1, 'A', 'a@x.in', '9000000000', 'h', 't', 't');
    INSERT INTO orders (id, user_id, status, address, delivery, item_count, mrp_paise, discount_paise, delivery_paise, total_paise, created_at, hold_expires_at, updated_at)
    VALUES ('ORD-OLD', 1, 'cancelled', '{}', '{}', 1, 1, 0, 0, 1, 't', 't', 't')`);
  old.close();

  const db = openDatabase(path);
  const columns = (db.prepare('PRAGMA table_info(orders)').all() as { name: string }[]).map((c) => c.name);
  expect(columns).toEqual(expect.arrayContaining(['payment_method', 'payment_label', 'offer_id', 'offer_discount_paise', 'paid_paise', 'paid_at']));
  expect(db.prepare("SELECT offer_discount_paise FROM orders WHERE id = 'ORD-OLD'").get()).toEqual({ offer_discount_paise: 0 });
  db.close();
});

it('takes the write lock at the start of a transaction, so another connection cannot make it fail half-way', () => {
  dir = mkdtempSync(join(tmpdir(), 'store-db-'));
  const path = join(dir, 'store.db');
  const db = openDatabase(path);
  db.exec('CREATE TABLE counters (id INTEGER PRIMARY KEY, n INTEGER NOT NULL); INSERT INTO counters VALUES (1, 0)');
  const other = new Database(path, { timeout: 0 });

  // As the old deferred default did: read, another connection commits, then write → "database is locked".
  const deferred = db.transaction(() => {
    db.prepare('SELECT n FROM counters').get();
    other.prepare('UPDATE counters SET n = n + 100').run();
    db.prepare('UPDATE counters SET n = n + 1').run();
  }).deferred;
  expect(() => deferred()).toThrow(/locked|busy/i);

  // The default is now immediate: the other connection waits (here, with no timeout, it is refused)
  // and the transaction itself completes.
  let otherError: unknown;
  db.transaction(() => {
    db.prepare('SELECT n FROM counters').get();
    try {
      other.prepare('UPDATE counters SET n = n + 100').run();
    } catch (error) {
      otherError = error;
    }
    db.prepare('UPDATE counters SET n = n + 1').run();
  })();
  expect(String(otherError)).toMatch(/locked|busy/i);
  expect(db.prepare('SELECT n FROM counters').get()).toEqual({ n: 101 });
  other.close();
  db.close();
});
