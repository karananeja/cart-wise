import { createApp } from './app.js';
import { createCatalogRepository } from './catalog/repository.js';
import { createSessionService } from './auth/sessions.js';
import { createCartService } from './cart/service.js';
import { createWishlistService } from './wishlist/service.js';
import { createAddressService } from './addresses/service.js';
import { createOrderService } from './orders/service.js';
import { openDatabase } from './db/database.js';
import { createEventRecorder } from './analytics/record.js';
import { isSeeded, repriceIfRateChanged, seedDatabase } from './db/seed.js';
import { loadRazorpayConfig } from './payments/razorpay.js';
import { DEFAULT_DB_PATH } from './paths.js';

// apps/api/.env (git-ignored), when present: Razorpay test keys and other settings (F-014).
try {
  process.loadEnvFile(new URL('../.env', import.meta.url));
} catch {
  // No .env: defaults apply.
}

const port = Number(process.env.PORT ?? 3001);
const db = openDatabase(process.env.DB_PATH ?? DEFAULT_DB_PATH);

if (!isSeeded(db)) {
  const result = seedDatabase(db);
  console.log(`Seeded ${result.products} products from the catalog snapshot.`);
} else if (repriceIfRateChanged(db)) {
  console.log('Re-priced the catalog for the new USD → INR rate.');
}

// Guest carts (30 days) and wishlists (90 days) left untouched are deleted at start and then hourly.
const catalog = createCatalogRepository(db);
const carts = createCartService(db, catalog);
const wishlists = createWishlistService(db, catalog);
const sessions = createSessionService(db);
const deleteExpiredGuestData = () => {
  carts.deleteExpired();
  wishlists.deleteExpired();
  sessions.deleteExpired();
};
deleteExpiredGuestData();
setInterval(deleteExpiredGuestData, 60 * 60 * 1000).unref();

// Unpaid holds past 10 minutes give their stock back (F-008).
const orders = createOrderService({ db, carts, addresses: createAddressService(db), record: createEventRecorder(db) });
orders.sweepExpired();
setInterval(() => orders.sweepExpired(), 30 * 1000).unref();

// Razorpay test mode (F-014, ADR-005): keys come from apps/api/.env. The secret is never logged.
const razorpay = loadRazorpayConfig(process.env);
if (razorpay.enabled) console.log(`Razorpay test mode is on (key ${razorpay.config.keyId}).`);
else if (razorpay.error) console.error(razorpay.error);

if (!process.env.SIM_OPERATOR_PASSWORD) {
  console.log('Demo operator page uses the default password "demo-operator" (set SIM_OPERATOR_PASSWORD to change it).');
}

// Inventory automation (F-011) runs only here, with the switches saved in the database.
createApp(db, { simScheduler: true, razorpay }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
