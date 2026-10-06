import { beforeAll, describe, expect, it } from 'vitest';
import { createCatalogRepository } from '../catalog/repository.js';
import { openDatabase } from '../db/database.js';
import { seedDatabase } from '../db/seed.js';
import { createSearchIndex, type SearchIndex } from './searchIndex.js';

let index: SearchIndex;
let byId: Map<number, { title: string; categorySlug: string; brand: string | null }>;

beforeAll(() => {
  const db = openDatabase(':memory:');
  seedDatabase(db);
  const catalog = createCatalogRepository(db);
  index = createSearchIndex(catalog.listSearchDocuments());
  byId = new Map(catalog.listItems().map((i) => [i.summary.id, i.summary]));
});

const results = (q: string) =>
  [...index.search(q).scores]
    .sort((a, b) => b[1] - a[1])
    .map(([id]) => byId.get(id)!);

describe('search against the catalog', () => {
  it('finds laptops by keyword', () => {
    const found = results('laptop');
    expect(found).toHaveLength(5);
    expect(found.every((p) => p.categorySlug === 'laptops')).toBe(true);
  });

  it('tolerates swapped letters (spec AC4)', () => {
    expect(results('lapotp').map((p) => p.categorySlug)).toEqual(results('laptop').map((p) => p.categorySlug));
    expect(results('iphnoe')[0]!.title).toMatch(/iPhone/);
  });

  it('tolerates a single wrong letter', () => {
    // Same products; fuzzy matches may score slightly differently.
    expect(results('perfune').map((p) => p.title).sort()).toEqual(results('perfume').map((p) => p.title).sort());
  });

  it('treats singular and plural alike (spec AC5)', () => {
    expect(results('shoe')).toEqual(results('shoes'));
    expect(results('shoes').length).toBeGreaterThan(5);
  });

  it('matches words inside compound names (spec AC5)', () => {
    const found = results('phone');
    expect(found.some((p) => p.title.startsWith('iPhone'))).toBe(true);
    expect(found.filter((p) => p.categorySlug === 'smartphones')).toHaveLength(16);
  });

  it('prefix-matches the last word', () => {
    expect(results('sungl')[0]!.title).toMatch(/sun ?glasses/i);
  });

  it('requires every word (spec AC6)', () => {
    const found = results('nike shoes');
    expect(found.length).toBeGreaterThan(0);
    expect(found.every((p) => p.brand === 'Nike')).toBe(true);
    expect(index.search('nike shoes').matchMode).toBe('all');
  });

  it('falls back to partial matches when no product has every word (spec AC6)', () => {
    const result = index.search('red leather office chair');
    expect(result.matchMode).toBe('partial');
    expect(result.scores.size).toBeGreaterThan(0);
    expect(results('red leather office chair')[0]!.title).toMatch(/chair/i);
  });

  it('returns nothing for nonsense and for filler-only queries', () => {
    expect(index.search('qwxzv').scores.size).toBe(0);
    expect(index.search('for the').scores.size).toBe(0);
  });

  it('ranks title and brand matches above description-only matches', () => {
    expect(results('apple')[0]!.brand).toBe('Apple');
  });
});

describe('category suggestions', () => {
  it('matches by prefix and inside compound names', () => {
    expect(index.suggestCategories('lap', 3)).toEqual([{ slug: 'laptops', name: 'Laptops' }]);
    expect(index.suggestCategories('phone', 3)[0]).toEqual({ slug: 'smartphones', name: 'Smartphones' });
    expect(index.suggestCategories('sho', 3).map((c) => c.slug).sort()).toEqual(['mens-shoes', 'womens-shoes']);
  });
});
