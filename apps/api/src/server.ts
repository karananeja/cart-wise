import { createApp } from './app.js';
import { createCatalogRepository } from './catalog/repository.js';
import { createCartService } from './cart/service.js';
import { openDatabase } from './db/database.js';
import { isSeeded, seedDatabase } from './db/seed.js';
import { DEFAULT_DB_PATH } from './paths.js';

const port = Number(process.env.PORT ?? 3001);
const db = openDatabase(process.env.DB_PATH ?? DEFAULT_DB_PATH);

if (!isSeeded(db)) {
  const result = seedDatabase(db);
  console.log(`Seeded ${result.products} products from the catalog snapshot.`);
}

// Guest carts untouched for 30 days are deleted at start and then hourly.
const carts = createCartService(db, createCatalogRepository(db));
carts.deleteExpired();
setInterval(() => carts.deleteExpired(), 60 * 60 * 1000).unref();

createApp(db).listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
