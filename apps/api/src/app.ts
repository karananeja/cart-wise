import express from 'express';
import { addressRouter, geoRouter } from './addresses/routes.js';
import { createAddressService } from './addresses/service.js';
import { createGeoService } from './geo/service.js';
import { orderRouter } from './orders/routes.js';
import { createOrderLifecycle } from './orders/lifecycle.js';
import { recommendationRouter } from './recommendations/routes.js';
import { createRecommendationService } from './recommendations/service.js';
import { createOrderService } from './orders/service.js';
import { createInventorySimulation } from './sim/inventory.js';
import { createOperatorAccess, operatorPasswordFrom } from './sim/operator.js';
import { createSimScheduler } from './sim/scheduler.js';
import { simRouter } from './sim/routes.js';
import { paymentRouter } from './payments/routes.js';
import { createPaymentService } from './payments/service.js';
import { createGatewayRefunds } from './payments/gatewayRefunds.js';
import { createRazorpayClient, loadRazorpayConfig, type RazorpaySetup } from './payments/razorpay.js';
import { createMergeService } from './auth/merge.js';
import { createOtpService } from './auth/otp.js';
import { createLoginLimiter } from './auth/rateLimit.js';
import type { Mailer } from './mail/mailer.js';
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
import { newsletterRouter } from './newsletter/routes.js';
import { createNewsletterService } from './newsletter/service.js';
import { wishlistRouter } from './wishlist/routes.js';
import { createWishlistService } from './wishlist/service.js';

export interface AppOptions {
  /** Outbound HTTP for the geocoding proxy (injected in tests). */
  fetch?: typeof fetch;
  /** Time source for order holds (injected in tests). */
  clock?: () => number;
  /** Demo operator password (F-010); defaults to SIM_OPERATOR_PASSWORD, then the demo default. */
  operatorPassword?: string;
  /** Random source for inventory automation (seeded in tests). */
  random?: () => number;
  /** Run inventory automation on a timer (the server sets this; tests drive ticks directly). */
  simScheduler?: boolean;
  /** Razorpay test-mode setup (F-014); defaults to the environment. Its HTTP uses `fetch`. */
  razorpay?: RazorpaySetup;
  /** Gateway and email problems for the operator (defaults to console.error). */
  log?: (message: string) => void;
  /** Sends one-time codes (and the newsletter welcome) through MSG91 (F-016, ADR-007). Without one, codes are shown on screen (demo). */
  mailer?: Mailer;
  /** Where the shop runs, for links in emails (F-018); defaults to WEB_BASE_URL, then http://localhost:5173. */
  webBaseUrl?: string;
  /** Overrides the per-IP hourly code limit (20); E2E signs up many shoppers from one address. */
  maxOtpSendsPerIp?: number;
}

export function createApp(db: Db, options: AppOptions = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  // The raw bytes are kept for Razorpay webhook signatures (F-014).
  app.use(express.json({ limit: '64kb', verify: (req, _res, buf) => ((req as express.Request & { rawBody?: Buffer }).rawBody = buf) }));
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
  api.use(recommendationRouter(createRecommendationService(db), carts));
  api.use(wishlistRouter(createWishlistService(db, catalog)));
  const otp = createOtpService(db, { clock: options.clock, mailer: options.mailer, maxSendsPerIpPerHour: options.maxOtpSendsPerIp, log: options.log });
  api.use(authRouter({ db, otp, sessions, merge: createMergeService(db), limiter: createLoginLimiter() }));
  api.use(addressRouter(addresses));
  const record = createEventRecorder(db, options.clock);
  const orders = createOrderService({ db, carts, addresses, record, clock: options.clock });
  const setup = options.razorpay ?? loadRazorpayConfig(process.env);
  const razorpay = setup.enabled ? createRazorpayClient(setup.config, options.fetch ?? fetch) : undefined;
  const payments = createPaymentService({ db, orders, record, clock: options.clock, razorpay, log: options.log });
  const lifecycle = createOrderLifecycle({ db, orders, record, clock: options.clock });
  const gatewayRefunds = createGatewayRefunds({ db, razorpay, clock: options.clock, log: options.log });
  api.use(orderRouter(orders, lifecycle, gatewayRefunds));
  const operatorPassword = options.operatorPassword ?? operatorPasswordFrom(process.env).password;
  const simulation = createInventorySimulation(db, { clock: options.clock, random: options.random });
  const scheduler = options.simScheduler ? createSimScheduler(simulation) : undefined;
  scheduler?.start();
  api.use(
    simRouter({
      access: createOperatorAccess(db, operatorPassword, options.clock),
      lifecycle,
      limiter: createLoginLimiter(undefined, options.clock),
      simulation,
      scheduler,
      gatewayRefunds,
    }),
  );
  api.use(paymentRouter(payments, razorpay?.keyId ?? null));
  api.use(geoRouter(createGeoService({ fetch: options.fetch ?? fetch })));
  api.use(analyticsRouter(db));
  api.use(newsletterRouter(createNewsletterService(db, { clock: options.clock, mailer: options.mailer, webBaseUrl: options.webBaseUrl ?? process.env.WEB_BASE_URL, log: options.log })));
  app.use('/api', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
