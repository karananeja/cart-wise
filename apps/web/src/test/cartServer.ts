import { http, HttpResponse } from 'msw';
import { MAX_PER_LINE, type CartLineView, type CartView, type ProductDetail } from '@store/shared';
import { productDetails } from './fixtures';

/**
 * In-memory stand-in for the cart API, following the same rules as the server (limits,
 * sizes and options, option prices, totals over buyable lines). The real rules are covered by the API tests.
 */
interface Line {
  id: number;
  slug: string;
  size: string | null;
  option: string | null;
  quantity: number;
}

let lines: Line[] = [];
let nextId = 1;
/** Per-test stock overrides: key `${slug}|${size or option ?? ''}`. */
const stockOverrides = new Map<string, number>();

export function resetCart() {
  lines = [];
  nextId = 1;
  stockOverrides.clear();
}

/** Paid orders take their quantities out of the cart (F-009). */
export function removeOrdered(ordered: { slug: string; size: string | null; option?: string | null; quantity: number }[]) {
  for (const o of ordered) {
    const line = lines.find((l) => l.slug === o.slug && l.size === o.size && l.option === (o.option ?? null));
    if (line) line.quantity -= o.quantity;
  }
  lines = lines.filter((l) => l.quantity > 0);
}

export function setStock(slug: string, size: string | null, available: number) {
  stockOverrides.set(`${slug}|${size ?? ''}`, available);
}

function available(product: ProductDetail, unit: string | null): number {
  const override = stockOverrides.get(`${product.slug}|${unit ?? ''}`);
  if (override !== undefined) return override;
  const availability = unit
    ? (product.sizes.find((s) => s.label === unit) ?? product.options.find((o) => o.label === unit))?.availability
    : product.availability;
  if (!availability || availability.status === 'out_of_stock') return 0;
  return availability.status === 'low_stock' ? (availability.available ?? 1) : 20;
}

export function view(): CartView {
  const views: CartLineView[] = lines.map((line) => {
    const product = productDetails.find((p) => p.slug === line.slug)!;
    const stock = available(product, line.size ?? line.option);
    const option = product.options.find((o) => o.label === line.option);
    const unitPricePaise = option?.pricePaise ?? product.pricePaise;
    const unitMrpPaise = option?.mrpPaise ?? product.mrpPaise;
    return {
      id: line.id,
      product,
      size: line.size,
      option: line.option,
      quantity: line.quantity,
      availability: stock === 0 ? { status: 'out_of_stock' } : stock <= 5 ? { status: 'low_stock', available: stock } : { status: 'in_stock' },
      maxQuantity: Math.min(MAX_PER_LINE, stock),
      issue: stock === 0 ? 'out_of_stock' : line.quantity > stock ? 'exceeds_stock' : 'none',
      unitPricePaise,
      unitMrpPaise,
      linePricePaise: unitPricePaise * line.quantity,
      lineMrpPaise: unitMrpPaise * line.quantity,
    };
  });
  const ordered = [...views].reverse().sort((a, b) => Number(b.issue !== 'none') - Number(a.issue !== 'none'));
  const buyable = ordered.filter((l) => l.issue === 'none');
  const mrpPaise = buyable.reduce((s, l) => s + l.lineMrpPaise, 0);
  const subtotalPaise = buyable.reduce((s, l) => s + l.linePricePaise, 0);
  return {
    lines: ordered,
    totalQuantity: ordered.reduce((s, l) => s + l.quantity, 0),
    totals: { itemCount: buyable.reduce((s, l) => s + l.quantity, 0), mrpPaise, discountPaise: mrpPaise - subtotalPaise, subtotalPaise },
    hasIssues: buyable.length !== ordered.length,
  };
}

const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, ...(details ? { details } : {}) } }, { status });

export const cartHandlers = [
  http.get('*/api/cart', () => HttpResponse.json(view())),
  http.post('*/api/cart/lines', async ({ request }) => {
    const body = (await request.json()) as { productSlug: string; size?: string | null; option?: string | null; quantity?: number };
    const product = productDetails.find((p) => p.slug === body.productSlug);
    if (!product) return error(404, 'PRODUCT_NOT_FOUND');
    const size = body.size ?? null;
    const option = body.option ?? null;
    if (product.sizes.length && !size) return error(400, 'SIZE_REQUIRED');
    if (product.options.length && !option) return error(400, 'OPTION_REQUIRED');
    if (option && !product.options.some((o) => o.label === option)) return error(400, 'INVALID_OPTION');
    const stock = available(product, size ?? option);
    if (stock === 0) return error(409, 'OUT_OF_STOCK');
    const existing = lines.find((l) => l.slug === product.slug && l.size === size && l.option === option);
    const quantity = (existing?.quantity ?? 0) + (body.quantity ?? 1);
    const max = Math.min(MAX_PER_LINE, stock);
    if (quantity > max) return error(409, 'QUANTITY_LIMIT', { max });
    if (existing) existing.quantity = quantity;
    else lines.push({ id: nextId++, slug: product.slug, size, option, quantity });
    return HttpResponse.json(view());
  }),
  http.patch('*/api/cart/lines/:id', async ({ params, request }) => {
    const line = lines.find((l) => l.id === Number(params.id));
    if (!line) return error(404, 'LINE_NOT_FOUND');
    const { quantity } = (await request.json()) as { quantity: number };
    const product = productDetails.find((p) => p.slug === line.slug)!;
    const max = Math.min(MAX_PER_LINE, available(product, line.size ?? line.option));
    if (quantity > line.quantity && quantity > max) return error(409, 'QUANTITY_LIMIT', { max });
    line.quantity = quantity;
    return HttpResponse.json(view());
  }),
  http.delete('*/api/cart/lines/:id', ({ params }) => {
    const before = lines.length;
    lines = lines.filter((l) => l.id !== Number(params.id));
    if (lines.length === before) return error(404, 'LINE_NOT_FOUND');
    return HttpResponse.json(view());
  }),
];
