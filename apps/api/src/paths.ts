import { fileURLToPath } from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('../data/', import.meta.url));
export const SNAPSHOT_PATH = fileURLToPath(new URL('../data/catalog/dummyjson-products.json', import.meta.url));
export const DEFAULT_DB_PATH = fileURLToPath(new URL('../data/store.db', import.meta.url));
