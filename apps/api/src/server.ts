import { createApp } from './app.js';
import { createCatalogRepository } from './catalog/repository.js';
import { createSessionService } from './auth/sessions.js';
import { createCartService } from './cart/service.js';
import { createWishlistService } from './wishlist/service.js';
import { createAddressService } from './addresses/service.js';
import { createOrderService } from './orders/service.js';
import { openDatabase } from './db/database.js';
import { isSeeded, repriceIfRateChanged, seedDatabase } from './db/seed.js';
import { DEFAULT_DB_PATH } from './paths.js';

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
const orders = createOrderService({ db, carts, addresses: createAddressService(db) });
orders.sweepExpired();
setInterval(() => orders.sweepExpired(), 30 * 1000).unref();

createApp(db).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
