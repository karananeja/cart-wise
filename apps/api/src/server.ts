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
import { createSmtpMailer, loadMailerConfig } from './mail/mailer.js';
import { loadRazorpayConfig } from './payments/razorpay.js';
import { DEFAULT_DB_PATH } from './paths.js';
import { operatorPasswordFrom } from './sim/operator.js';

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

// Email codes (F-016, ADR-006): SMTP settings come from apps/api/.env. The password and codes are never logged.
const mail = loadMailerConfig(process.env);
if (mail.enabled) console.log(`Email codes are sent through ${mail.config.host}:${mail.config.port} as ${mail.config.from}.`);
else {
  if (mail.error) console.error(mail.error);
  console.log('Email codes are shown on screen (demo). Set SMTP_* in apps/api/.env to send real emails.');
}
// Only for automated tests that sign up many shoppers from one address; blank means the default (20).
const maxOtpSendsPerIp = Number(process.env.OTP_MAX_SENDS_PER_IP_PER_HOUR?.trim()) || undefined;

if (operatorPasswordFrom(process.env).isDefault) {
  console.log('Demo operator page uses the default password "demo-operator" (set SIM_OPERATOR_PASSWORD to change it).');
}

// Inventory automation (F-011) runs only here, with the switches saved in the database.
createApp(db, { simScheduler: true, razorpay, mailer: mail.enabled ? createSmtpMailer(mail.config) : undefined, maxOtpSendsPerIp }).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
