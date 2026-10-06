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
