import type { DeliveryOption } from './checkout.js';

/**
 * Simulated delivery zones by pincode prefix (F-015, approved 2026-10-07). The prefixes
 * approximate real postal regions; every product follows the same rules.
 */
export type DeliveryZone = 'metro' | 'regional' | 'remote' | 'unserviceable';

const METRO = ['110', '120', '121', '122', '201', '400', '411', '380', '500', '560', '600', '700'];
const REMOTE = ['18', '19', '737', '78', '79'];

/** Days to arrive per zone and option; null when the option isn't offered there. */
export const ZONE_DAYS: Record<Exclude<DeliveryZone, 'unserviceable'>, Record<DeliveryOption, { minDays: number; maxDays: number } | null>> = {
  metro: { standard: { minDays: 2, maxDays: 3 }, express: { minDays: 1, maxDays: 2 } },
  regional: { standard: { minDays: 3, maxDays: 5 }, express: { minDays: 2, maxDays: 3 } },
  remote: { standard: { minDays: 6, maxDays: 9 }, express: null },
};

/** "560 038" → "560038"; null unless it is a 6-digit Indian pincode. Same rule as addresses. */
export function normalizePincode(input: string): string | null {
  const pincode = input.replace(/\s/g, '');
  return /^[1-9]\d{5}$/.test(pincode) ? pincode : null;
}

/** The zone of a valid pincode (see `normalizePincode`). */
export function deliveryZone(pincode: string): DeliveryZone {
  const lakshadweep = /^68255[1-9]$/.test(pincode);
  if (pincode.startsWith('744') || lakshadweep || pincode.startsWith('9')) return 'unserviceable';
  if (METRO.some((p) => pincode.startsWith(p))) return 'metro';
  if (REMOTE.some((p) => pincode.startsWith(p))) return 'remote';
  return 'regional';
}
