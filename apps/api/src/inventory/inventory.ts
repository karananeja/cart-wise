import type { Availability } from '@store/shared';

export const LOW_STOCK_THRESHOLD = 5;

/** mulberry32: tiny deterministic PRNG so seeded stock is identical on every run. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Initial on-hand stock for a product. Roughly 6% start out of stock and 10% low so those
 * states are demonstrable; these are real application inventory values, not display tricks.
 */
export function seedOnHand(productId: number): number {
  const random = mulberry32(productId * 2654435761);
  const roll = random();
  if (roll < 0.06) return 0;
  if (roll < 0.16) return 1 + Math.floor(random() * LOW_STOCK_THRESHOLD);
  return 8 + Math.floor(random() * 53);
}

/**
 * Initial stock for one size. Sizes sell through unevenly, so out-of-stock and low sizes are
 * more common than for whole products. Seeded by product and size position.
 */
export function seedSizeOnHand(productId: number, sizeIndex: number): number {
  const random = mulberry32((productId * 31 + sizeIndex + 1) * 2246822519);
  const roll = random();
  if (roll < 0.15) return 0;
  if (roll < 0.3) return 1 + Math.floor(random() * 3);
  return 4 + Math.floor(random() * 12);
}

/** Availability from the units available (on hand minus reserved, summed across sizes). */
export function deriveAvailability(available: number): Availability {
  if (available <= 0) return { status: 'out_of_stock' };
  if (available <= LOW_STOCK_THRESHOLD) return { status: 'low_stock', available };
  return { status: 'in_stock' };
}
