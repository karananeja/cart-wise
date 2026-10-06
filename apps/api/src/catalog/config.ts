/**
 * Conversion applied to upstream USD prices. User decision Q2: 1:1 at first, corrected to
 * ₹96 = $1 on 2026-10-06. Changing it re-prices the catalog on the next API start
 * (see `repriceIfRateChanged`), keeping stock, carts, wishlists and accounts.
 */
export const USD_TO_INR_RATE = 96;
