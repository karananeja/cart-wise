import MiniSearch, { type Query, type SearchOptions } from 'minisearch';
import type { SearchMatchMode } from '@store/shared';
import { fragments, maxEdits, processTerm, transpositions } from './terms.js';

export interface SearchDocument {
  id: number;
  title: string;
  brand: string | null;
  categoryName: string;
  categorySlug: string;
  tags: string[];
  description: string;
}

export interface SearchResult {
  matchMode: SearchMatchMode;
  /** Product id → relevance score. Empty when nothing matched. */
  scores: Map<number, number>;
}

const BOOST = { title: 5, brand: 4, category: 4, tags: 3, description: 1, fragments: 1 };

function tokenize(text: string): string[] {
  return text.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
}

/** Processed query words, in order. */
function queryWords(query: string): string[] {
  return tokenize(query)
    .map(processTerm)
    .filter((w): w is string => w !== null);
}

/**
 * One OR-group per word: the word with typo tolerance (prefix on the last word, for
 * type-as-you-go), plus its letter swaps matched exactly.
 */
function wordQueries(words: string[]): Query[] {
  return words.map((word, i) => ({
    combineWith: 'OR',
    queries: [
      { queries: [word], fuzzy: maxEdits(word), prefix: i === words.length - 1 },
      ...transpositions(word).map((variant) => ({ queries: [variant] })),
    ],
  }));
}

const indexOptions = {
  tokenize,
  // Index time: the fragments field stores word suffixes; every other field stores processed words.
  processTerm: (term: string, field?: string) => {
    const word = processTerm(term);
    if (!word) return null;
    if (field !== 'fragments') return word;
    const parts = fragments(word);
    return parts.length ? parts : null;
  },
  // Query terms are already processed by `queryWords`; keep them as they are.
  searchOptions: { processTerm: (term: string) => term },
};

export function createSearchIndex(documents: SearchDocument[]) {
  const products = new MiniSearch<SearchDocument>({
    ...indexOptions,
    fields: ['title', 'brand', 'category', 'tags', 'description', 'fragments'],
    extractField: (doc, field) => {
      switch (field) {
        case 'category':
          return `${doc.categoryName} ${doc.categorySlug.replace(/-/g, ' ')}`;
        case 'tags':
          return doc.tags.join(' ');
        case 'fragments':
          return [doc.title, doc.brand ?? '', doc.categoryName, doc.categorySlug.replace(/-/g, ' '), ...doc.tags].join(' ');
        default:
          return String((doc as unknown as Record<string, unknown>)[field] ?? '');
      }
    },
  });
  products.addAll(documents);

  const categoryDocs = [...new Map(documents.map((d) => [d.categorySlug, { id: d.categorySlug, name: d.categoryName }])).values()];
  const categories = new MiniSearch<{ id: string; name: string }>({
    ...indexOptions,
    fields: ['name', 'fragments'],
    storeFields: ['name'],
    extractField: (doc, field) => (field === 'fragments' ? doc.name : String(doc[field as 'name'] ?? '')),
  });
  categories.addAll(categoryDocs);

  const run = (index: MiniSearch, words: string[], combineWith: 'AND' | 'OR') =>
    index.search({ combineWith, queries: wordQueries(words) } as Query, { boost: BOOST } as SearchOptions);

  return {
    /** All words must match; if none do, falls back to any word (spec FR-11, FR-12). */
    search(query: string): SearchResult {
      const words = queryWords(query);
      if (!words.length) return { matchMode: 'all', scores: new Map() };
      let matchMode: SearchMatchMode = 'all';
      let hits = run(products, words, 'AND');
      if (!hits.length && words.length > 1) {
        hits = run(products, words, 'OR');
        matchMode = 'partial';
      }
      // MiniSearch can hand ids back as strings; products are keyed by number.
      return { matchMode, scores: new Map(hits.map((h) => [Number(h.id), h.score])) };
    },

    /** Matching categories, best first. */
    suggestCategories(query: string, limit: number): { slug: string; name: string }[] {
      const words = queryWords(query);
      if (!words.length) return [];
      return run(categories, words, 'AND')
        .slice(0, limit)
        .map((hit) => ({ slug: hit.id as string, name: hit.name as string }));
    },
  };
}

export type SearchIndex = ReturnType<typeof createSearchIndex>;
