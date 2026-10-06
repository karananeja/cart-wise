import { Router } from 'express';
import { normalizeQuery, parseListingParams, type SearchSuggestions } from '@store/shared';
import { HttpError } from '../http/errors.js';
import type { SearchIndex } from '../search/searchIndex.js';
import { queryCatalog } from './query.js';
import type { CatalogRepository } from './repository.js';

const SUGGESTED_PRODUCTS = 5;
const SUGGESTED_CATEGORIES = 3;
const MIN_SUGGESTION_LENGTH = 2;
const MAX_BATCH = 24;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function catalogRouter(catalog: CatalogRepository, search: SearchIndex): Router {
  const router = Router();

  router.get('/categories', (_req, res) => {
    res.json({ categories: catalog.listCategories() });
  });

  router.get('/products', (req, res) => {
    const params = parseListingParams(req.query);
    if (params.category && !catalog.categoryExists(params.category)) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    if (!params.q) {
      res.json(queryCatalog(catalog.listItems(), params, catalog.listCategories()));
      return;
    }
    const { matchMode, scores } = search.search(params.q);
    res.json({
      ...queryCatalog(catalog.listItems(), params, catalog.listCategories(), scores),
      search: { query: params.q, matchMode },
    });
  });

  // Registered before /products/:slug so "batch" is not taken as a slug.
  router.get('/products/batch', (req, res) => {
    const raw = typeof req.query.slugs === 'string' ? req.query.slugs : '';
    const slugs = [...new Set(raw.split(',').filter((s) => SLUG.test(s)))].slice(0, MAX_BATCH);
    res.json({ items: catalog.findSummaries(slugs) });
  });

  router.get('/products/:slug', (req, res) => {
    const product = catalog.findProduct(req.params.slug);
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    res.json({ product });
  });

  router.get('/search/suggestions', (req, res) => {
    const q = normalizeQuery(typeof req.query.q === 'string' ? req.query.q : undefined);
    const empty: SearchSuggestions = { categories: [], products: [] };
    if (!q || q.length < MIN_SUGGESTION_LENGTH) {
      res.json(empty);
      return;
    }
    const { matchMode, scores } = search.search(q);
    // Suggestions only show products matching every word; partial matches belong on the results page.
    const products =
      matchMode === 'all'
        ? queryCatalog(catalog.listItems(), parseListingParams({ q, pageSize: String(SUGGESTED_PRODUCTS) }), [], scores).items
        : [];
    res.json({ categories: search.suggestCategories(q, SUGGESTED_CATEGORIES), products } satisfies SearchSuggestions);
  });

  return router;
}
