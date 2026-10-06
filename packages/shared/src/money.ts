const whole = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const fractional = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** ₹1,29,999 for whole rupees, ₹9.99 otherwise. */
export function formatPrice(paise: number): string {
  return paise % 100 === 0 ? whole.format(paise / 100) : fractional.format(paise / 100);
}

/** Whole-rupee formatting for filter bounds. */
export function formatRupees(rupees: number): string {
  return whole.format(rupees);
}
