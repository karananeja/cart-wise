import { CANCELLABLE_STATUSES, RETURN_WINDOW_MS, type Order } from '@store/shared';

/** F-010 fields every mock order starts with. */
export const orderDefaults = {
  deliveredAt: null,
  cancelledAt: null,
  cancelReason: null,
  returns: [],
  refunds: [],
  deliveryCode: null,
  actions: { canCancel: false, canReturn: false, returnWindowEndsAt: null },
  returnState: 'none',
} satisfies Partial<Order>;

/** Recomputes what the API derives (actions, return state), as the server does on every read. */
export function derive(order: Order, now = Date.now()): Order {
  const returned = new Set(order.returns.flatMap((r) => r.lines.map((l) => l.orderLineId)));
  const windowEnds = order.deliveredAt ? Date.parse(order.deliveredAt) + RETURN_WINDOW_MS : null;
  return {
    ...order,
    actions: {
      canCancel: order.payment !== null && CANCELLABLE_STATUSES.includes(order.status),
      canReturn: order.status === 'delivered' && windowEnds !== null && now < windowEnds && order.lines.some((l) => !returned.has(l.id)),
      returnWindowEndsAt: windowEnds === null ? null : new Date(windowEnds).toISOString(),
    },
    returnState: returned.size === 0 ? 'none' : returned.size >= order.lines.length ? 'all' : 'partial',
    deliveryCode: order.status === 'out_for_delivery' ? order.deliveryCode : null,
  };
}
