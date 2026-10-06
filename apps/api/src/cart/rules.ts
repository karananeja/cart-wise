import { MAX_PER_LINE, type CartLineIssue, type CartLineView, type CartView } from '@store/shared';

export function maxQuantity(available: number): number {
  return Math.min(MAX_PER_LINE, Math.max(0, available));
}

export function lineIssue(quantity: number, available: number): CartLineIssue {
  if (available <= 0) return 'out_of_stock';
  if (quantity > available) return 'exceeds_stock';
  return 'none';
}

/**
 * Totals cover only lines that can be bought now; problem lines come first, then the most
 * recently added (lines arrive newest first).
 */
export function buildCartView(lines: CartLineView[]): CartView {
  const sorted = [...lines].sort((a, b) => Number(b.issue !== 'none') - Number(a.issue !== 'none'));
  const buyable = sorted.filter((l) => l.issue === 'none');
  const mrpPaise = buyable.reduce((sum, l) => sum + l.lineMrpPaise, 0);
  const subtotalPaise = buyable.reduce((sum, l) => sum + l.linePricePaise, 0);
  return {
    lines: sorted,
    totalQuantity: sorted.reduce((sum, l) => sum + l.quantity, 0),
    totals: {
      itemCount: buyable.reduce((sum, l) => sum + l.quantity, 0),
      mrpPaise,
      discountPaise: mrpPaise - subtotalPaise,
      subtotalPaise,
    },
    hasIssues: buyable.length !== sorted.length,
  };
}
