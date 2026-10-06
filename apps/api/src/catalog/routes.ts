import { Router } from 'express';
import { parseListingParams } from '@store/shared';
import { HttpError } from '../http/errors.js';
import { queryCatalog } from './query.js';
import type { CatalogRepository } from './repository.js';

export function catalogRouter(catalog: CatalogRepository): Router {
  const router = Router();

  router.get('/categories', (_req, res) => {
    res.json({ categories: catalog.listCategories() });
  });

  router.get('/products', (req, res) => {
    const params = parseListingParams(req.query);
    if (params.category && !catalog.categoryExists(params.category)) {
      throw new HttpError(404, 'CATEGORY_NOT_FOUND', 'Category not found');
    }
    res.json(queryCatalog(catalog.listItems(), params, catalog.listCategories()));
  });

  router.get('/products/:slug', (req, res) => {
    const product = catalog.findProduct(req.params.slug);
    if (!product) throw new HttpError(404, 'PRODUCT_NOT_FOUND', 'Product not found');
    res.json({ product });
  });

  return router;
}
