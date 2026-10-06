import { describe, expect, it } from 'vitest';
import type { CartLineView } from '@store/shared';
import { buildCartView, lineIssue, maxQuantity } from './rules.js';

describe('maxQuantity', () => {
  it('is the lower of 10 and available stock', () => {
    expect([maxQuantity(0), maxQuantity(3), maxQuantity(10), maxQuantity(50)]).toEqual([0, 3, 10, 10]);
  });
});

describe('lineIssue', () => {
  it('flags out of stock and quantities above stock', () => {
    expect(lineIssue(1, 0)).toBe('out_of_stock');
    expect(lineIssue(4, 3)).toBe('exceeds_stock');
    expect(lineIssue(3, 3)).toBe('none');
  });
});

const line = (id: number, quantity: number, issue: CartLineView['issue'], price = 100, mrp = 120): CartLineView => ({
  id,
  product: {} as CartLineView['product'],
  size: null,
  option: null,
  quantity,
  availability: { status: 'in_stock' },
  maxQuantity: 10,
  issue,
  unitPricePaise: price,
  unitMrpPaise: mrp,
  linePricePaise: price * quantity,
  lineMrpPaise: mrp * quantity,
});

describe('buildCartView', () => {
  it('totals only buyable lines and counts every unit for the badge', () => {
    const view = buildCartView([line(1, 2, 'none'), line(2, 1, 'out_of_stock'), line(3, 3, 'none', 50, 50)]);
    expect(view.totals).toEqual({ itemCount: 5, mrpPaise: 390, discountPaise: 40, subtotalPaise: 350 });
    expect(view.totalQuantity).toBe(6);
    expect(view.hasIssues).toBe(true);
  });

  it('lists problem lines first and otherwise keeps order', () => {
    const view = buildCartView([line(1, 1, 'none'), line(2, 5, 'exceeds_stock'), line(3, 1, 'none')]);
    expect(view.lines.map((l) => l.id)).toEqual([2, 1, 3]);
  });

  it('handles an empty cart', () => {
    expect(buildCartView([])).toMatchObject({ lines: [], totalQuantity: 0, hasIssues: false });
  });
});
