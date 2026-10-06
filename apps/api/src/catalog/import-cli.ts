/**
 * Refreshes the committed DummyJSON snapshot. Run only when the upstream catalog should be
 * re-imported; normal setup seeds from the committed file and needs no network.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { SNAPSHOT_PATH } from '../paths.js';
import type { CatalogSnapshot, DummyJsonProduct } from './dummyjson.js';

const SOURCE = 'https://dummyjson.com/products?limit=0';

const response = await fetch(SOURCE);
if (!response.ok) throw new Error(`DummyJSON responded ${response.status}`);
const body = (await response.json()) as { products: DummyJsonProduct[]; total: number };
if (body.products.length !== body.total) throw new Error(`Expected ${body.total} products, got ${body.products.length}`);

const snapshot: CatalogSnapshot = { source: SOURCE, fetchedAt: new Date().toISOString(), products: body.products };
mkdirSync(dirname(SNAPSHOT_PATH), { recursive: true });
writeFileSync(SNAPSHOT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`);
console.log(`Saved ${body.products.length} products to ${SNAPSHOT_PATH}. Run \`pnpm db:seed\` to load them.`);
