import Database from 'better-sqlite3';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
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

describe('reseeding keeps carts, orders and holds on the right units (F-013)', () => {
  const unitLabel = (db: Database.Database, table: 'cart_lines' | 'order_lines', id: number) =>
    db.prepare(`SELECT v.label, v.kind FROM ${table} l LEFT JOIN product_variants v ON v.id = l.variant_id WHERE l.id = ?`).get(id);

  it('upgrades a version 2 database: sizes keep their label, products that gained options move to the base tier, holds survive', () => {
    dir = mkdtempSync(join(tmpdir(), 'store-db-'));
    const path = join(dir, 'store.db');
    const first = openDatabase(path);
    seedDatabase(first);
    first.close();

    // Turn it into a version 2 database: no options (phones sold as one unit) and variant ids that
    // differ from the ones a fresh seed assigns.
    const old = new Database(path);
    old.pragma('foreign_keys = OFF');
    old.exec(`
      DELETE FROM inventory WHERE variant_id IN (SELECT id FROM product_variants WHERE kind = 'option');
      DELETE FROM product_variants WHERE kind = 'option';
      INSERT INTO inventory (product_id, variant_id, on_hand, reserved, updated_at)
        SELECT id, NULL, 7, 0, 't' FROM products WHERE category_slug IN ('smartphones', 'tablets', 'laptops');
      UPDATE inventory SET variant_id = variant_id + 1000 WHERE variant_id IS NOT NULL;
      UPDATE product_variants SET id = id + 1000;
    `);
    const shirt = old.prepare("SELECT p.id AS productId, v.id AS variantId FROM product_variants v JOIN products p ON p.id = v.product_id WHERE v.label = 'L' ORDER BY p.id LIMIT 1").get() as { productId: number; variantId: number };
    const phone = (old.prepare("SELECT id FROM products WHERE slug = 'realme-xt'").get() as { id: number }).id;
    old.exec(`
      INSERT INTO users (id, name, email, mobile, password_hash, mobile_verified_at, created_at) VALUES (1, 'A', 'a@x.in', '9000000000', 'h', 't', 't');
      INSERT INTO carts (id, user_id, created_at, updated_at) VALUES ('cart', 1, 't', 't');
      INSERT INTO orders (id, user_id, status, address, delivery, item_count, mrp_paise, discount_paise, delivery_paise, total_paise, created_at, hold_expires_at, updated_at)
        VALUES ('ORD-HELD', 1, 'pending_payment', '{}', '{}', 3, 1, 0, 0, 1, 't', '2999-01-01T00:00:00.000Z', 't');
    `);
    old.prepare('INSERT INTO cart_lines (id, cart_id, product_id, variant_id, quantity, added_at) VALUES (1, ?, ?, ?, 2, ?)').run('cart', shirt.productId, shirt.variantId, 't');
    old.prepare('INSERT INTO cart_lines (id, cart_id, product_id, variant_id, quantity, added_at) VALUES (2, ?, ?, NULL, 1, ?)').run('cart', phone, 't');
    const line = old.prepare(`INSERT INTO order_lines (id, order_id, product_id, variant_id, slug, title, size, thumbnail_url, quantity, unit_price_paise, unit_mrp_paise)
      VALUES (?, 'ORD-HELD', ?, ?, 's', 't', ?, 'u', ?, 1, 1)`);
    line.run(1, shirt.productId, shirt.variantId, 'L', 2);
    line.run(2, phone, null, null, 1);
    old.exec('ALTER TABLE order_lines DROP COLUMN option_label');
    old.pragma('user_version = 2');
    old.close();

    const db = openDatabase(path);
    expect(isSeeded(db)).toBe(false);
    seedDatabase(db);
    expect(unitLabel(db, 'cart_lines', 1)).toEqual({ label: 'L', kind: 'size' });
    expect(unitLabel(db, 'cart_lines', 2)).toEqual({ label: '128 GB', kind: 'option' });
    expect(unitLabel(db, 'order_lines', 1)).toEqual({ label: 'L', kind: 'size' });
    expect(unitLabel(db, 'order_lines', 2)).toEqual({ label: '128 GB', kind: 'option' });
    // The unpaid order still holds its stock, on the remapped units.
    const reserved = (id: number) =>
      (db.prepare('SELECT i.reserved FROM order_lines l JOIN inventory i ON i.variant_id = l.variant_id WHERE l.id = ?').get(id) as { reserved: number }).reserved;
    expect([reserved(1), reserved(2)]).toEqual([2, 1]);
    expect(db.prepare("SELECT name FROM sqlite_master WHERE name = 'variant_remap'").get()).toBeUndefined();
    db.close();
  });

  it('re-running the seed keeps sized cart lines instead of cascading them away', () => {
    const db = openDatabase(':memory:');
    seedDatabase(db);
    const unit = db.prepare("SELECT product_id, id FROM product_variants WHERE kind = 'size' AND label = 'M' ORDER BY id LIMIT 1").get() as { product_id: number; id: number };
    db.exec("INSERT INTO carts (id, user_id, created_at, updated_at) VALUES ('g', NULL, 't', 't')");
    db.prepare("INSERT INTO cart_lines (id, cart_id, product_id, variant_id, quantity, added_at) VALUES (1, 'g', ?, ?, 1, 't')").run(unit.product_id, unit.id);
    seedDatabase(db);
    expect(unitLabel(db, 'cart_lines', 1)).toEqual({ label: 'M', kind: 'size' });
  });
});
