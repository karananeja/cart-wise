/**
 * Store Simulation Console — inventory simulation (F-011). User decisions 2026-10-06.
 */
import type { Availability } from './types.js';

/** Tick intervals the operator can choose, in seconds (60 by default). */
export const SIM_INTERVALS = [10, 30, 60, 300] as const;
export type SimIntervalSeconds = (typeof SIM_INTERVALS)[number];
export const DEFAULT_SIM_INTERVAL: SimIntervalSeconds = 60;
export const isSimInterval = (v: unknown): v is SimIntervalSeconds => SIM_INTERVALS.includes(v as SimIntervalSeconds);

/** Highest on-hand value the operator can set. */
export const MAX_ON_HAND = 999;

/** Automatic decrease: 1–3 random available units lose 1 each per tick. */
export const AUTO_DECREASE_MAX_UNITS = 3;
/** Automatic restock: up to 3 units at or below the low-stock level are refilled per tick. */
export const AUTO_RESTOCK_MAX_UNITS = 3;
/** Restocked units get at least this many available. */
export const RESTOCK_MIN_AVAILABLE = 10;

export const INVENTORY_FILTERS = ['all', 'low', 'sold_out'] as const;
export type InventoryFilter = (typeof INVENTORY_FILTERS)[number];

/** One sellable unit: a product without sizes or options, one size, or one option (F-013). */
export interface SimInventoryUnit {
  productId: number;
  variantId: number | null;
  /** The size or option label; null for products without either. */
  size: string | null;
  kind: 'size' | 'option' | null;
  onHand: number;
  /** Reserved by checkouts in progress (F-008). */
  held: number;
  available: number;
  status: Availability['status'];
}

export interface SimInventoryProduct {
  productId: number;
  slug: string;
  title: string;
  categoryName: string;
  thumbnailUrl: string;
  /** Totals across sizes. */
  onHand: number;
  held: number;
  available: number;
  status: Availability['status'];
  /** One entry for products without sizes or options (size null), one per size or option otherwise. */
  units: SimInventoryUnit[];
}

export interface SimInventoryPage {
  products: SimInventoryProduct[];
  nextCursor: string | null;
}

export type InventoryChangeSource = 'manual' | 'auto_decrease' | 'auto_restock';

export interface InventoryChange {
  id: number;
  at: string;
  productId: number;
  variantId: number | null;
  title: string;
  size: string | null;
  fromOnHand: number;
  toOnHand: number;
  source: InventoryChangeSource;
}

export interface SimAutomation {
  autoDecrease: boolean;
  autoRestock: boolean;
  intervalSeconds: SimIntervalSeconds;
  /** When the next automatic tick runs; null when both switches are off. */
  nextTickAt: string | null;
  /** The last 20 stock changes, newest first. */
  log: InventoryChange[];
}
