import { http, HttpResponse } from 'msw';
import { DELIVERY_CODE_ATTEMPTS, nextStatus, type Order, type SimOrder } from '@store/shared';
import { allOrders, getOrder, saveOrder } from './checkoutServer';

/** Mock demo-operator API. The password and limits are covered by the API tests. */
export const OPERATOR_PASSWORD = 'demo-operator';

let signedIn = false;
let wrongPasswords = 0;
const attempts = new Map<string, number>();
let nextCode = 4831;

export function resetSim() {
  signedIn = false;
  wrongPasswords = 0;
  attempts.clear();
  nextCode = 4831;
}

export const signInOperator = () => {
  signedIn = true;
};

const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, details } }, { status });

function sim(order: Order): SimOrder {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    city: order.address.city,
    items: order.lines.map((l) => ({ title: l.title, size: l.size, quantity: l.quantity })),
    paidPaise: order.payment?.paidPaise ?? 0,
    nextStatus: nextStatus(order.status),
    deliveryAttemptsLeft: order.status === 'out_for_delivery' ? DELIVERY_CODE_ATTEMPTS - (attempts.get(order.id) ?? 0) : null,
    returns: order.returns.map((r) => ({ id: r.id, status: r.status, itemCount: r.lines.length, refundPaise: r.refundPaise })),
  };
}

const at = () => new Date().toISOString();
const guard = () => (signedIn ? null : error(401, 'OPERATOR_REQUIRED'));
const orderOf = (id: string) => getOrder(id);
const orderWithReturn = (returnId: string) => allOrders().find((o) => o.returns.some((r) => r.id === returnId));

export const simHandlers = [
  http.get('*/api/sim/session', () => HttpResponse.json({ signedIn })),
  http.post('*/api/sim/session', async ({ request }) => {
    const { password } = (await request.json()) as { password: string };
    if (wrongPasswords >= 5) return error(429, 'TOO_MANY_ATTEMPTS', { retryAfterSeconds: 900 });
    if (password !== OPERATOR_PASSWORD) {
      wrongPasswords += 1;
      return error(401, 'WRONG_PASSWORD');
    }
    signedIn = true;
    return HttpResponse.json({ signedIn: true });
  }),
  http.delete('*/api/sim/session', () => {
    signedIn = false;
    return HttpResponse.json({ signedIn: false });
  }),
  http.get('*/api/sim/orders', () => {
    const denied = guard();
    if (denied) return denied;
    const orders = allOrders()
      .filter((o) => o.payment)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return HttpResponse.json({ orders: orders.map(sim) });
  }),
  http.post('*/api/sim/orders/:id/advance', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderOf(String(params.id));
    if (!order) return error(404, 'ORDER_NOT_FOUND');
    const next = nextStatus(order.status);
    if (!next || next === 'delivered') return error(409, 'INVALID_TRANSITION');
    const updated: Order = {
      ...order,
      status: next,
      history: [...order.history, { status: next, at: at() }],
      ...(next === 'out_for_delivery' ? { deliveryCode: String(nextCode++) } : {}),
    };
    saveOrder(updated);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/orders/:id/deliver', async ({ params, request }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderOf(String(params.id));
    if (!order || order.status !== 'out_for_delivery') return error(409, 'INVALID_TRANSITION');
    const used = attempts.get(order.id) ?? 0;
    if (used >= DELIVERY_CODE_ATTEMPTS) return error(423, 'DELIVERY_LOCKED');
    const { code } = (await request.json()) as { code: string };
    if (code !== order.deliveryCode) {
      attempts.set(order.id, used + 1);
      const left = DELIVERY_CODE_ATTEMPTS - used - 1;
      return left <= 0 ? error(423, 'DELIVERY_LOCKED') : error(401, 'INVALID_CODE', { attemptsLeft: left });
    }
    const now = at();
    const updated: Order = { ...order, status: 'delivered', deliveredAt: now, deliveryCode: null, history: [...order.history, { status: 'delivered', at: now }] };
    saveOrder(updated);
    attempts.delete(order.id);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/orders/:id/delivery-code', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderOf(String(params.id));
    if (!order || order.status !== 'out_for_delivery') return error(409, 'INVALID_TRANSITION');
    const updated = { ...order, deliveryCode: String(nextCode++) };
    saveOrder(updated);
    attempts.delete(order.id);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/returns/:id/pickup', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderWithReturn(String(params.id));
    const ret = order?.returns.find((r) => r.id === params.id);
    if (!order || !ret || ret.status !== 'requested') return error(409, 'INVALID_TRANSITION');
    const now = at();
    const updated: Order = {
      ...order,
      returns: order.returns.map((r) => (r.id === ret.id ? { ...r, status: 'picked_up', pickedUpAt: now } : r)),
      refunds: [...order.refunds, { id: `RF-${ret.id}`, returnId: ret.id, amountPaise: ret.refundPaise, label: order.payment!.label, status: 'initiated', initiatedAt: now, refundedAt: null }],
    };
    saveOrder(updated);
    return HttpResponse.json({ order: sim(updated) });
  }),
  http.post('*/api/sim/returns/:id/refund', ({ params }) => {
    const denied = guard();
    if (denied) return denied;
    const order = orderWithReturn(String(params.id));
    const ret = order?.returns.find((r) => r.id === params.id);
    if (!order || !ret || ret.status !== 'picked_up') return error(409, 'INVALID_TRANSITION');
    const now = at();
    const updated: Order = {
      ...order,
      returns: order.returns.map((r) => (r.id === ret.id ? { ...r, status: 'refunded', refundedAt: now } : r)),
      refunds: order.refunds.map((f) => (f.returnId === ret.id ? { ...f, status: 'refunded', refundedAt: now } : f)),
    };
    saveOrder(updated);
    return HttpResponse.json({ order: sim(updated) });
  }),
];
