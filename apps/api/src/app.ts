import express from 'express';
import { createMergeService } from './auth/merge.js';
import { createOtpService } from './auth/otp.js';
import { createLoginLimiter } from './auth/rateLimit.js';
import { authRouter } from './auth/routes.js';
import { createSessionService, SESSION_COOKIE } from './auth/sessions.js';
import { analyticsRouter } from './analytics/routes.js';
import { cartRouter } from './cart/routes.js';
import { createCartService } from './cart/service.js';
import { createCatalogRepository } from './catalog/repository.js';
import { catalogRouter } from './catalog/routes.js';
import type { Db } from './db/database.js';
import { readCookie } from './http/cookies.js';
import { errorHandler, notFoundHandler } from './http/errors.js';
import { requireJsonPosts } from './http/guards.js';
import { createSearchIndex } from './search/searchIndex.js';
import { wishlistRouter } from './wishlist/routes.js';
import { createWishlistService } from './wishlist/service.js';

export function createApp(db: Db) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(express.json({ limit: '64kb' }));
  app.use(express.text({ limit: '64kb' }));

  const api = express.Router();
  const sessions = createSessionService(db);
  api.use(requireJsonPosts);
  // Signed-in user (if any) for every API request.
  api.use((req, res, next) => {
    res.locals.user = sessions.resolve(readCookie(req, SESSION_COOKIE));
    next();
  });
  api.get('/health', (_req, res) => {
    res.json({ ok: true });
  });
  const catalog = createCatalogRepository(db);
  // Built once from the seeded catalog; holds only ids, so prices and stock stay live.
  api.use(catalogRouter(catalog, createSearchIndex(catalog.listSearchDocuments())));
  api.use(cartRouter(createCartService(db, catalog)));
  api.use(wishlistRouter(createWishlistService(db, catalog)));
  api.use(authRouter({ db, otp: createOtpService(db), sessions, merge: createMergeService(db), limiter: createLoginLimiter() }));
  api.use(analyticsRouter(db));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
