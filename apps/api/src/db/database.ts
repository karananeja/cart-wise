import Database from 'better-sqlite3';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type Db = Database.Database;

const schema = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

/** Opens (or creates) the database and applies the schema. Pass ':memory:' in tests. */
export function openDatabase(path: string): Db {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new Database(path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(schema);
  return db;
}
