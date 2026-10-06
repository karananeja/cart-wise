import express from 'express';
import { addressRouter, geoRouter } from './addresses/routes.js';
import { createAddressService } from './addresses/service.js';
import { createGeoService } from './geo/service.js';
import { orderRouter } from './orders/routes.js';
import { createOrderLifecycle } from './orders/lifecycle.js';
import { createOrderService } from './orders/service.js';
import { createOperatorAccess, DEFAULT_OPERATOR_PASSWORD } from './sim/operator.js';
import { simRouter } from './sim/routes.js';
import { paymentRouter } from './payments/routes.js';
import { createPaymentService } from './payments/service.js';
import { createMergeService } from './auth/merge.js';
import { createOtpService } from './auth/otp.js';
import { createLoginLimiter } from './auth/rateLimit.js';
import { authRouter } from './auth/routes.js';
import { createSessionService, SESSION_COOKIE } from './auth/sessions.js';
import { createEventRecorder } from './analytics/record.js';
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

export interface AppOptions {
  /** Outbound HTTP for the geocoding proxy (injected in tests). */
  fetch?: typeof fetch;
  /** Time source for order holds (injected in tests). */
  clock?: () => number;
  /** Demo operator password (F-010); defaults to SIM_OPERATOR_PASSWORD, then the demo default. */
  operatorPassword?: string;
}

export function createApp(db: Db, options: AppOptions = {}) {
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
  const carts = createCartService(db, catalog);
  const addresses = createAddressService(db);
  api.use(cartRouter(carts));
  api.use(wishlistRouter(createWishlistService(db, catalog)));
  api.use(authRouter({ db, otp: createOtpService(db), sessions, merge: createMergeService(db), limiter: createLoginLimiter() }));
  api.use(addressRouter(addresses));
  const record = createEventRecorder(db, options.clock);
  const orders = createOrderService({ db, carts, addresses, record, clock: options.clock });
  const lifecycle = createOrderLifecycle({ db, orders, record, clock: options.clock });
  api.use(orderRouter(orders, lifecycle));
  const operatorPassword = options.operatorPassword ?? process.env.SIM_OPERATOR_PASSWORD ?? DEFAULT_OPERATOR_PASSWORD;
  api.use(simRouter(createOperatorAccess(db, operatorPassword, options.clock), lifecycle, createLoginLimiter(undefined, options.clock)));
  api.use(paymentRouter(createPaymentService({ db, orders, record, clock: options.clock })));
  api.use(geoRouter(createGeoService({ fetch: options.fetch ?? fetch })));
  api.use(analyticsRouter(db));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
