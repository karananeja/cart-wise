import { http, HttpResponse } from 'msw';
import {
  allocatePaise,
  CANCELLABLE_STATUSES,
  isReturnReason,
  type Order,
  type OrderHistoryStatus,
  type OrderSummary,
  type ReturnReason,
} from '@store/shared';
import { allOrders, getOrder, saveOrder } from './checkoutServer';
import { derive, orderDefaults } from './orderState';

/**
 * Mock order history, cancellation and returns on the shared rules. Restocking, exactly-once
 * effects and ownership are covered by the API tests.
 */
let nextReturn = 1;
export function resetOrders() {
  nextReturn = 1;
}

const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, details } }, { status });

const NOW = '2026-10-06T10:00:00.000Z';

/** A paid order for tests, in any state. Two lines by default: ₹3,000 × 2 and ₹1,000 × 1, ₹600 Aurora offer. */
export function seedOrder(overrides: Partial<Order> & { id: string }): Order {
  const lines = overrides.lines ?? [
    { id: 11, productId: 1, slug: 'product-1', title: 'Galaxy Phone', size: null, option: '256 GB', thumbnailUrl: '/p1.jpg', quantity: 2, unitPricePaise: 3_000_00, unitMrpPaise: 3_500_00 },
    { id: 12, productId: 3, slug: 'product-3', title: 'Running Shoe', size: 'UK 9', option: null, thumbnailUrl: '/p3.jpg', quantity: 1, unitPricePaise: 1_000_00, unitMrpPaise: 1_200_00 },
  ];
  const subtotal = lines.reduce((sum, l) => sum + l.unitPricePaise * l.quantity, 0);
  const mrp = lines.reduce((sum, l) => sum + l.unitMrpPaise * l.quantity, 0);
  const deliveryPaise = overrides.totals?.deliveryPaise ?? 0;
  const offer = overrides.payment === null ? 0 : (overrides.payment?.offerDiscountPaise ?? 600_00);
  const order: Order = {
    status: 'confirmed',
    lines,
    address: { fullName: 'Karan Aneja', mobile: '9876543210', pincode: '560038', line1: 'Flat 4B', line2: 'Indiranagar', landmark: '', city: 'Bengaluru', state: 'Karnataka', type: 'home', latitude: null, longitude: null },
    delivery: { option: 'standard', label: 'Standard', pricePaise: deliveryPaise, estimate: { from: '2026-10-09', to: '2026-10-11' } },
    totals: { itemCount: lines.reduce((n, l) => n + l.quantity, 0), mrpPaise: mrp, discountPaise: mrp - subtotal, deliveryPaise, totalPaise: subtotal + deliveryPaise },
    createdAt: NOW,
    holdExpiresAt: NOW,
    payment: { method: 'card', label: 'Aurora Bank Visa •••• 4242', offerId: offer ? 'aurora-credit-10' : null, offerDiscountPaise: offer, paidPaise: subtotal + deliveryPaise - offer, paidAt: NOW, provider: 'demo', emi: null },
    history: [
      { status: 'payment_successful', at: NOW },
      { status: 'confirmed', at: NOW },
    ],
    ...orderDefaults,
    ...overrides,
  };
  saveOrder(order);
  return order;
}

function summary(order: Order): OrderSummary {
  const o = derive(order);
  return {
    id: o.id,
    status: o.status,
    createdAt: o.createdAt,
    deliveredAt: o.deliveredAt,
    cancelledAt: o.cancelledAt,
    estimate: o.delivery.estimate,
    thumbnails: o.lines.map((l) => ({ title: l.title, thumbnailUrl: l.thumbnailUrl })),
    itemCount: o.totals.itemCount,
    paidPaise: o.payment?.paidPaise ?? 0,
    deliveryCode: o.deliveryCode,
    returnState: o.returnState,
  };
}

const step = (order: Order, status: OrderHistoryStatus) => [...order.history, { status, at: new Date().toISOString() }];

export const ordersHandlers = [
  http.get('*/api/orders', ({ request }) => {
    const cursor = Number(new URL(request.url).searchParams.get('cursor') ?? 0);
    const paid = allOrders()
      .filter((o) => o.payment)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id));
    const page = paid.slice(cursor, cursor + 10);
    return HttpResponse.json({ orders: page.map(summary), nextCursor: cursor + 10 < paid.length ? String(cursor + 10) : null });
  }),

  http.post('*/api/orders/:id/cancel', async ({ params, request }) => {
    const order = getOrder(String(params.id));
    if (!order) return error(404, 'ORDER_NOT_FOUND');
    const body = (await request.json().catch(() => ({}))) as { reason?: string };
    const now = new Date().toISOString();
    if (order.status === 'pending_payment') {
      const cancelled = { ...order, status: 'cancelled' as const };
      saveOrder(cancelled);
      return HttpResponse.json({ order: derive(cancelled) });
    }
    if (!order.payment || !CANCELLABLE_STATUSES.includes(order.status)) return error(409, 'NOT_CANCELLABLE');
    const cancelled: Order = {
      ...order,
      status: 'cancelled',
      cancelledAt: now,
      cancelReason: body.reason ?? null,
      history: step(order, 'cancelled'),
      refunds: [
        ...order.refunds,
        { id: 'RF-C1', returnId: null, amountPaise: order.payment.paidPaise, label: order.payment.label, status: 'refunded', initiatedAt: now, refundedAt: now },
      ],
    };
    saveOrder(cancelled);
    return HttpResponse.json({ order: derive(cancelled) });
  }),

  http.post('*/api/orders/:id/returns', async ({ params, request }) => {
    const order = getOrder(String(params.id));
    if (!order) return error(404, 'ORDER_NOT_FOUND');
    if (order.status !== 'delivered') return error(409, 'NOT_DELIVERED');
    if (!derive(order).actions.canReturn) return error(409, 'RETURN_WINDOW_CLOSED');
    const { lines } = (await request.json()) as { lines: { orderLineId: number; reason: ReturnReason }[] };
    if (!lines?.length || lines.some((l) => !isReturnReason(l.reason))) return error(400, 'BAD_REQUEST');
    const returned = new Set(order.returns.flatMap((r) => r.lines.map((l) => l.orderLineId)));
    if (lines.some((l) => returned.has(l.orderLineId))) return error(409, 'ALREADY_RETURNED');
    const totals = order.lines.map((l) => l.unitPricePaise * l.quantity);
    const shares = allocatePaise(totals, order.payment?.offerDiscountPaise ?? 0);
    const refundOf = (id: number) => {
      const i = order.lines.findIndex((l) => l.id === id);
      return totals[i]! - shares[i]!;
    };
    const returnLines = lines.map((l) => ({ ...l, refundPaise: refundOf(l.orderLineId) }));
    const updated: Order = {
      ...order,
      returns: [
        ...order.returns,
        {
          id: `RET-${nextReturn++}`,
          status: 'requested',
          lines: returnLines,
          refundPaise: returnLines.reduce((sum, l) => sum + l.refundPaise, 0),
          createdAt: new Date().toISOString(),
          pickedUpAt: null,
          refundedAt: null,
        },
      ],
    };
    saveOrder(updated);
    return HttpResponse.json({ order: derive(updated) }, { status: 201 });
  }),
];
