/**
 * Application-owned electronics options (F-013 spec FR-1, approved 2026-10-06). Each tier is its
 * own sellable unit with its own price: the base tier keeps the catalog price, and higher tiers
 * step both MRP and price up by the same percentage, so the discount is unchanged.
 */
export interface OptionTier {
  label: string;
  /** Percent above the base tier's price. */
  stepPercent: number;
}

export const OPTION_SETS: Record<string, OptionTier[]> = {
  smartphones: [
    { label: '128 GB', stepPercent: 0 },
    { label: '256 GB', stepPercent: 10 },
    { label: '512 GB', stepPercent: 25 },
  ],
  tablets: [
    { label: '64 GB', stepPercent: 0 },
    { label: '128 GB', stepPercent: 12 },
    { label: '256 GB', stepPercent: 25 },
  ],
  laptops: [
    { label: '8 GB · 256 GB', stepPercent: 0 },
    { label: '16 GB · 512 GB', stepPercent: 15 },
    { label: '32 GB · 1 TB', stepPercent: 35 },
  ],
};

/** What the option selector is called for a category. */
export const OPTION_NAMES: Record<string, string> = {
  smartphones: 'Storage',
  tablets: 'Storage',
  laptops: 'Configuration',
};

export function optionsFor(categorySlug: string): OptionTier[] {
  return OPTION_SETS[categorySlug] ?? [];
}

const toRupee = (paise: number) => Math.round(paise / 100) * 100;

/** A tier's prices from the base tier's; the base tier (step 0) returns them unchanged. */
export function tierPrices(base: { mrpPaise: number; pricePaise: number }, stepPercent: number): { mrpPaise: number; pricePaise: number } {
  if (stepPercent === 0) return { mrpPaise: base.mrpPaise, pricePaise: base.pricePaise };
  const factor = 1 + stepPercent / 100;
  return { mrpPaise: toRupee(base.mrpPaise * factor), pricePaise: toRupee(base.pricePaise * factor) };
}
