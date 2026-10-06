import express from 'express';
import { analyticsRouter } from './analytics/routes.js';
import { createCatalogRepository } from './catalog/repository.js';
import { catalogRouter } from './catalog/routes.js';
import type { Db } from './db/database.js';
import { errorHandler, notFoundHandler } from './http/errors.js';

export function createApp(db: Db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(express.json({ limit: '64kb' }));
  app.use(express.text({ limit: '64kb' }));

  const api = express.Router();
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  api.use(catalogRouter(createCatalogRepository(db)));
  api.use(analyticsRouter(db));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
