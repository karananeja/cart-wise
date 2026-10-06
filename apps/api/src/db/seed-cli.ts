import { DEFAULT_DB_PATH } from '../paths.js';
import { openDatabase } from './database.js';
import { seedDatabase } from './seed.js';

const db = openDatabase(process.env.DB_PATH ?? DEFAULT_DB_PATH);
const result = seedDatabase(db);
db.close();
console.log(`Seeded ${result.products} products in ${result.categories} categories.`);
