import { describe, expect, it } from 'vitest';
import { openDatabase } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { LOW_STOCK_THRESHOLD, seedOptionOnHand } from './inventory.js';
import { OPTION_SETS, optionsFor, tierPrices } from './options.js';
import { sizesFor } from './sizes.js';

describe('option sets (F-013 FR-1)', () => {
  it('gives phones and tablets storage tiers and laptops RAM + storage, cheapest first', () => {
    expect(optionsFor('smartphones')).toEqual([
      { label: '128 GB', stepPercent: 0 },
      { label: '256 GB', stepPercent: 10 },
      { label: '512 GB', stepPercent: 25 },
    ]);
    expect(optionsFor('tablets').map((t) => [t.label, t.stepPercent])).toEqual([['64 GB', 0], ['128 GB', 12], ['256 GB', 25]]);
    expect(optionsFor('laptops').map((t) => [t.label, t.stepPercent])).toEqual([['8 GB · 256 GB', 0], ['16 GB · 512 GB', 15], ['32 GB · 1 TB', 35]]);
  });

  it('leaves accessories, watches and sized categories alone', () => {
    for (const category of ['mobile-accessories', 'mens-watches', 'womens-watches', 'mens-shirts']) expect(optionsFor(category)).toEqual([]);
    for (const category of Object.keys(OPTION_SETS)) expect(sizesFor(category)).toEqual([]);
  });
});

describe('tierPrices', () => {
  it('keeps the base tier at the catalog price, to the paisa', () => {
    expect(tierPrices({ mrpPaise: 33_599_04, pricePaise: 29_732_17 }, 0)).toEqual({ mrpPaise: 33_599_04, pricePaise: 29_732_17 });
  });

  it('steps MRP and price by the same percentage, rounded to the rupee', () => {
    expect(tierPrices({ mrpPaise: 33_599_04, pricePaise: 29_732_17 }, 10)).toEqual({ mrpPaise: 36_959_00, pricePaise: 32_705_00 });
    expect(tierPrices({ mrpPaise: 1_000_00, pricePaise: 800_00 }, 25)).toEqual({ mrpPaise: 1_250_00, pricePaise: 1_000_00 });
  });
});

describe('seeded options', () => {
  it('is deterministic per product and tier', () => {
    expect(seedOptionOnHand(121, 1)).toBe(seedOptionOnHand(121, 1));
  });

  it('seeds every phone, tablet and laptop with its tiers, and some tiers start low or sold out', () => {
    const db = openDatabase(':memory:');
    seedDatabase(db);
    const rows = db.prepare(`
      SELECT p.category_slug, p.price_paise AS base, v.label, v.price_paise, i.on_hand
      FROM product_variants v JOIN products p ON p.id = v.product_id JOIN inventory i ON i.variant_id = v.id
      WHERE v.kind = 'option' ORDER BY p.id, v.sort_order`).all() as { category_slug: string; base: number; label: string; price_paise: number; on_hand: number }[];
    expect(rows).toHaveLength((16 + 3 + 5) * 3);
    expect(rows.some((r) => r.on_hand === 0)).toBe(true);
    expect(rows.some((r) => r.on_hand >= 1 && r.on_hand <= LOW_STOCK_THRESHOLD)).toBe(true);
    // The product price is the base tier's, so listings show the starting price.
    for (let i = 0; i < rows.length; i += 3) {
      expect(rows[i]!.price_paise).toBe(rows[i]!.base);
      expect(rows[i + 1]!.price_paise).toBeGreaterThan(rows[i]!.price_paise);
      expect(rows[i + 2]!.price_paise).toBeGreaterThan(rows[i + 1]!.price_paise);
    }
    // No product-level unit is left for products with options.
    expect(db.prepare(`SELECT COUNT(*) AS n FROM inventory i JOIN products p ON p.id = i.product_id
      WHERE p.category_slug IN ('smartphones', 'tablets', 'laptops') AND i.variant_id IS NULL`).get()).toEqual({ n: 0 });
  });
});
