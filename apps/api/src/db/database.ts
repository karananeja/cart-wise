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
  return db;
}
