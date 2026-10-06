import {
  AUTO_DECREASE_MAX_UNITS,
  AUTO_RESTOCK_MAX_UNITS,
  DEFAULT_SIM_INTERVAL,
  isSimInterval,
  RESTOCK_MIN_AVAILABLE,
  type InventoryChange,
  type InventoryChangeSource,
  type InventoryFilter,
  type SimInventoryPage,
  type SimInventoryProduct,
  type SimInventoryUnit,
  type SimIntervalSeconds,
} from '@store/shared';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import { deriveAvailability, LOW_STOCK_THRESHOLD, seedUnitOnHand } from '../inventory/inventory.js';

const PAGE_SIZE = 20;
const LOG_SHOWN = 20;
const LOG_KEPT = 500;

export interface SimSettings {
  autoDecrease: boolean;
  autoRestock: boolean;
  intervalSeconds: SimIntervalSeconds;
}

interface UnitRow {
  product_id: number;
  variant_id: number | null;
  size: string | null;
  kind: 'size' | 'option' | null;
  sort_order: number | null;
  title: string;
  on_hand: number;
  reserved: number;
}

const KEYS = { autoDecrease: 'sim.autoDecrease', autoRestock: 'sim.autoRestock', intervalSeconds: 'sim.intervalSeconds' } as const;

/**
 * Inventory simulation (F-011): the operator's manual stock changes and the automatic
 * decrease/restock ticks. It only ever changes real inventory, never below what checkouts hold.
 */
export function createInventorySimulation(db: Db, options: { clock?: () => number; random?: () => number } = {}) {
  const clock = options.clock ?? Date.now;
  const random = options.random ?? Math.random;
  const iso = () => new Date(clock()).toISOString();

  const unitColumns = `i.product_id, i.variant_id, v.label AS size, v.kind, v.sort_order, p.title, i.on_hand, i.reserved
    FROM inventory i JOIN products p ON p.id = i.product_id LEFT JOIN product_variants v ON v.id = i.variant_id`;
  const productPage = db.prepare(`
    SELECT p.id, p.slug, p.title, p.thumbnail_url, c.name AS category_name,
      SUM(i.on_hand) AS on_hand, SUM(i.reserved) AS held, SUM(MAX(i.on_hand - i.reserved, 0)) AS available
    FROM products p JOIN categories c ON c.slug = p.category_slug JOIN inventory i ON i.product_id = p.id
    WHERE (@q IS NULL OR p.title LIKE @q ESCAPE '\\')
    GROUP BY p.id
    HAVING @filter = 'all' OR (@filter = 'low' AND available BETWEEN 1 AND ${LOW_STOCK_THRESHOLD}) OR (@filter = 'sold_out' AND available <= 0)
    ORDER BY p.title COLLATE NOCASE, p.id LIMIT @limit OFFSET @offset`);
  const unitsOf = db.prepare(`SELECT ${unitColumns} WHERE i.product_id = ? ORDER BY v.sort_order`);
  const findUnit = db.prepare(`SELECT ${unitColumns} WHERE i.product_id = ? AND IFNULL(i.variant_id, 0) = IFNULL(?, 0)`);
  const setUnit = db.prepare(`
    UPDATE inventory SET on_hand = @onHand, updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0) AND reserved <= @onHand`);
  const sellable = db.prepare(`SELECT ${unitColumns} WHERE i.on_hand - i.reserved >= 1`);
  const lowUnits = db.prepare(`SELECT ${unitColumns} WHERE i.on_hand - i.reserved <= ${LOW_STOCK_THRESHOLD}`);
  const decrementOne = db.prepare(`
    UPDATE inventory SET on_hand = on_hand - 1, updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0) AND on_hand - reserved >= 1`);
  const insertLog = db.prepare(`
    INSERT INTO inventory_log (at, product_id, variant_id, title, size, from_on_hand, to_on_hand, source)
    VALUES (@at, @productId, @variantId, @title, @size, @from, @to, @source)`);
  const pruneLog = db.prepare(`DELETE FROM inventory_log WHERE id <= (SELECT MAX(id) FROM inventory_log) - ${LOG_KEPT}`);
  const recentLog = db.prepare(`SELECT * FROM inventory_log ORDER BY id DESC LIMIT ${LOG_SHOWN}`);
  const readSetting = db.prepare('SELECT value FROM app_settings WHERE key = ?');
  const writeSetting = db.prepare('INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value');

  const toUnit = (row: UnitRow): SimInventoryUnit => {
    const available = Math.max(row.on_hand - row.reserved, 0);
    return {
      productId: row.product_id,
      variantId: row.variant_id,
      size: row.size,
      kind: row.kind,
      onHand: row.on_hand,
      held: row.reserved,
      available,
      status: deriveAvailability(available).status,
    };
  };

  type ProductRow = { id: number; slug: string; title: string; thumbnail_url: string; category_name: string; on_hand: number; held: number; available: number };
  const toProduct = (row: ProductRow): SimInventoryProduct => ({
    productId: row.id,
    slug: row.slug,
    title: row.title,
    categoryName: row.category_name,
    thumbnailUrl: row.thumbnail_url,
    onHand: row.on_hand,
    held: row.held,
    available: row.available,
    status: deriveAvailability(row.available).status,
    units: (unitsOf.all(row.id) as UnitRow[]).map(toUnit),
  });
  const productView = (productId: number): SimInventoryProduct => {
    const units = (unitsOf.all(productId) as UnitRow[]).map(toUnit);
    const first = db.prepare('SELECT p.id, p.slug, p.title, p.thumbnail_url, c.name AS category_name FROM products p JOIN categories c ON c.slug = p.category_slug WHERE p.id = ?').get(productId) as Omit<ProductRow, 'on_hand' | 'held' | 'available'>;
    const sum = (key: 'onHand' | 'held' | 'available') => units.reduce((n, u) => n + u[key], 0);
    return toProduct({ ...first, on_hand: sum('onHand'), held: sum('held'), available: sum('available') });
  };

  const log = (row: UnitRow, to: number, source: InventoryChangeSource) => {
    insertLog.run({ at: iso(), productId: row.product_id, variantId: row.variant_id, title: row.title, size: row.size, from: row.on_hand, to, source });
    pruneLog.run();
  };

  /** k distinct random picks (partial Fisher–Yates). */
  const pick = <T>(items: T[], k: number): T[] => {
    const pool = [...items];
    const out: T[] = [];
    for (let i = 0; i < k && pool.length; i += 1) {
      const j = Math.floor(random() * pool.length);
      out.push(pool.splice(j, 1)[0]!);
    }
    return out;
  };

  /** The item's original seeded level, as at seeding time. */
  const seededLevel = (row: UnitRow) =>
    seedUnitOnHand(row.product_id, row.kind === null ? null : { kind: row.kind, index: row.sort_order ?? 0 });

  const toChange = (r: { id: number; at: string; product_id: number; variant_id: number | null; title: string; size: string | null; from_on_hand: number; to_on_hand: number; source: InventoryChangeSource }): InventoryChange => ({
    id: r.id,
    at: r.at,
    productId: r.product_id,
    variantId: r.variant_id,
    title: r.title,
    size: r.size,
    fromOnHand: r.from_on_hand,
    toOnHand: r.to_on_hand,
    source: r.source,
  });

  return {
    list(q: string | undefined, filter: InventoryFilter, cursor: string | undefined): SimInventoryPage {
      const offset = Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0);
      const like = q?.trim() ? `%${q.trim().replace(/[\\%_]/g, (c) => `\\${c}`)}%` : null;
      const rows = productPage.all({ q: like, filter, limit: PAGE_SIZE + 1, offset }) as ProductRow[];
      return {
        products: rows.slice(0, PAGE_SIZE).map(toProduct),
        nextCursor: rows.length > PAGE_SIZE ? String(offset + PAGE_SIZE) : null,
      };
    },

    setOnHand: db.transaction((productId: number, variantId: number | null, onHand: number) => {
      const row = findUnit.get(productId, variantId) as UnitRow | undefined;
      if (!row) throw new HttpError(404, 'UNIT_NOT_FOUND', 'That product or size does not exist');
      if (setUnit.run({ productId, variantId, onHand, now: iso() }).changes === 0) {
        throw new HttpError(409, 'BELOW_HELD', 'Units held in checkout cannot be removed', { held: row.reserved });
      }
      if (row.on_hand !== onHand) log(row, onHand, 'manual');
      return { unit: toUnit(findUnit.get(productId, variantId) as UnitRow), product: productView(productId) };
    }),

    /** One automatic tick (spec FR-7, FR-8). Returns what changed. */
    tick: db.transaction((kinds: { decrease: boolean; restock: boolean }): InventoryChange[] => {
      const before = (db.prepare('SELECT IFNULL(MAX(id), 0) AS id FROM inventory_log').get() as { id: number }).id;
      if (kinds.decrease) {
        const count = 1 + Math.floor(random() * AUTO_DECREASE_MAX_UNITS);
        for (const row of pick(sellable.all() as UnitRow[], count)) {
          if (decrementOne.run({ productId: row.product_id, variantId: row.variant_id, now: iso() }).changes) log(row, row.on_hand - 1, 'auto_decrease');
        }
      }
      if (kinds.restock) {
        for (const row of pick(lowUnits.all() as UnitRow[], AUTO_RESTOCK_MAX_UNITS)) {
          const target = row.reserved + Math.max(seededLevel(row), RESTOCK_MIN_AVAILABLE);
          if (target > row.on_hand && setUnit.run({ productId: row.product_id, variantId: row.variant_id, onHand: target, now: iso() }).changes) {
            log(row, target, 'auto_restock');
          }
        }
      }
      return (db.prepare('SELECT * FROM inventory_log WHERE id > ? ORDER BY id').all(before) as Parameters<typeof toChange>[0][]).map(toChange);
    }),

    recentChanges: (): InventoryChange[] => (recentLog.all() as Parameters<typeof toChange>[0][]).map(toChange),

    getSettings(): SimSettings {
      const read = (key: string) => (readSetting.get(key) as { value: string } | undefined)?.value;
      const interval = Number(read(KEYS.intervalSeconds));
      return {
        autoDecrease: read(KEYS.autoDecrease) === '1',
        autoRestock: read(KEYS.autoRestock) === '1',
        intervalSeconds: isSimInterval(interval) ? interval : DEFAULT_SIM_INTERVAL,
      };
    },

    saveSettings: db.transaction((settings: SimSettings) => {
      writeSetting.run(KEYS.autoDecrease, settings.autoDecrease ? '1' : '0');
      writeSetting.run(KEYS.autoRestock, settings.autoRestock ? '1' : '0');
      writeSetting.run(KEYS.intervalSeconds, String(settings.intervalSeconds));
    }),
  };
}

export type InventorySimulation = ReturnType<typeof createInventorySimulation>;
