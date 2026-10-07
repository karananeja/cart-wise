/**
 * GST on the demo invoice (F-019, user decision D1, 2026-10-07). Simplified category rates following
 * the GST 2.0 slabs (effective 22 Sep 2025); real rates depend on HSN codes the catalog doesn't have.
 * Prices include GST. The seller is fictional and not registered.
 */

/** The fictional seller. The GSTIN is deliberately not in a real format, so it can't match a business. */
export const SELLER = {
  name: 'Cartwise Demo Retail',
  addressLines: ['No. 42, 2nd Floor, Demo Tech Park', '100 Feet Road, Indiranagar', 'Bengaluru, Karnataka 560038'],
  state: 'Karnataka',
  gstin: 'DEMO — not registered',
} as const;

/** Apparel and footwear: 5% up to this unit price, 18% above it. */
export const APPAREL_FOOTWEAR_THRESHOLD_PAISE = 2_500_00;
export const APPAREL_FOOTWEAR_CATEGORIES = ['mens-shirts', 'tops', 'womens-dresses', 'mens-shoes', 'womens-shoes'] as const;
export const APPAREL_FOOTWEAR_HIGH_RATE = 18;
export const DELIVERY_GST_RATE = 18;
/** For a category missing from the table. */
export const DEFAULT_GST_RATE = 18;

/** Rate (percent) by category slug. Apparel and footwear show their rate at or below the threshold. */
export const GST_RATES: Readonly<Record<string, number>> = {
  groceries: 5,
  'mens-shirts': 5,
  tops: 5,
  'womens-dresses': 5,
  'mens-shoes': 5,
  'womens-shoes': 5,
  beauty: 18,
  fragrances: 18,
  'skin-care': 18,
  furniture: 18,
  'home-decoration': 18,
  'kitchen-accessories': 18,
  laptops: 18,
  smartphones: 18,
  tablets: 18,
  'mobile-accessories': 18,
  'sports-accessories': 18,
  sunglasses: 18,
  'mens-watches': 18,
  'womens-watches': 18,
  'womens-bags': 18,
  'womens-jewellery': 3,
  motorcycle: 40,
  vehicle: 40,
};

/** The GST rate for one unit of a product in this category at this price. */
export function gstRate(categorySlug: string | null | undefined, unitPricePaise: number): number {
  if (!categorySlug) return DEFAULT_GST_RATE;
  if ((APPAREL_FOOTWEAR_CATEGORIES as readonly string[]).includes(categorySlug) && unitPricePaise > APPAREL_FOOTWEAR_THRESHOLD_PAISE) {
    return APPAREL_FOOTWEAR_HIGH_RATE;
  }
  return GST_RATES[categorySlug] ?? DEFAULT_GST_RATE;
}

/** CGST + SGST when the buyer is in the seller's state; IGST otherwise. */
export const isIntraState = (buyerState: string) => buyerState.trim().toLowerCase() === SELLER.state.toLowerCase();

export interface GstSplit {
  amountPaise: number;
  ratePercent: number;
  taxablePaise: number;
  taxPaise: number;
  cgstPaise: number;
  sgstPaise: number;
  igstPaise: number;
}

/**
 * Splits a GST-inclusive amount (spec FR-6): taxable = round(amount × 100 / (100 + rate)), tax is
 * the rest. Within the state, CGST is half (floored) and SGST takes the odd paisa.
 */
export function splitInclusive(amountPaise: number, ratePercent: number, intraState: boolean): GstSplit {
  const taxablePaise = Math.round((amountPaise * 100) / (100 + ratePercent));
  const taxPaise = amountPaise - taxablePaise;
  const cgstPaise = intraState ? Math.floor(taxPaise / 2) : 0;
  return {
    amountPaise,
    ratePercent,
    taxablePaise,
    taxPaise,
    cgstPaise,
    sgstPaise: intraState ? taxPaise - cgstPaise : 0,
    igstPaise: intraState ? 0 : taxPaise,
  };
}

/** `ORD-7KQ2M9XA` → `INV-7KQ2M9XA`. */
export const invoiceNumber = (orderId: string) => `INV-${orderId.replace(/^ORD-/, '')}`;

const ONES = [
  '', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
  'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen',
];
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n]!;
  const unit = n % 10;
  return unit ? `${TENS[Math.floor(n / 10)]}-${ONES[unit]}` : TENS[Math.floor(n / 10)]!;
}

/** A whole number in Indian words (lakh, crore): 12,34,567 → "twelve lakh thirty-four thousand five hundred sixty-seven". */
export function numberInWords(n: number): string {
  if (n === 0) return 'zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 1_00_00_000);
  if (crore) parts.push(`${numberInWords(crore)} crore`);
  let rest = n % 1_00_00_000;
  const groups: [number, string][] = [
    [1_00_000, 'lakh'],
    [1_000, 'thousand'],
    [100, 'hundred'],
  ];
  for (const [size, name] of groups) {
    const count = Math.floor(rest / size);
    if (count) parts.push(`${belowHundred(count)} ${name}`);
    rest %= size;
  }
  if (rest) parts.push(belowHundred(rest));
  return parts.join(' ');
}

/** ₹1,23,456.78 → "Rupees one lakh twenty-three thousand four hundred fifty-six and seventy-eight paise only". */
export function amountInWords(paise: number): string {
  const rupees = Math.floor(paise / 100);
  const rest = paise % 100;
  return `Rupees ${numberInWords(rupees)}${rest ? ` and ${belowHundred(rest)} paise` : ''} only`;
}
