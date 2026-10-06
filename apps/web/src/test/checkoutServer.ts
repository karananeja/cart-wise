import { http, HttpResponse } from 'msw';
import { deliveryOptions, isDeliveryOption, PAYMENT_HOLD_MS, type CheckoutBlocker, type CheckoutQuote, type Order } from '@store/shared';
import { addressList } from './addressServer';
import { view as cartView } from './cartServer';

/** Mock checkout and orders using the shared delivery rules; holds and stock are covered by API tests. */
let orders = new Map<string, Order>();
let nextId = 1;

export function resetCheckout() {
  orders = new Map();
  nextId = 1;
}

export const getOrder = (id: string) => orders.get(id);
export const saveOrder = (order: Order) => orders.set(order.id, order);

/** Lets tests simulate the hold running out. */
export function expireOrder(id: string) {
  const order = orders.get(id)!;
  orders.set(id, { ...order, status: 'payment_expired' });
}

function quote(addressId: number | undefined, delivery: 'standard' | 'express'): CheckoutQuote {
  const cart = cartView();
  const list = addressList();
  const address = list.find((a) => a.id === addressId) ?? list.find((a) => a.isDefault) ?? null;
  const options = deliveryOptions(cart.totals.subtotalPaise, new Date('2026-10-06T10:00:00.000Z'));
  const chosen = options.find((o) => o.option === delivery)!;
  const blockers: CheckoutBlocker[] = [];
  if (!cart.lines.length) blockers.push('EMPTY_CART');
  else if (cart.hasIssues) blockers.push('CART_ISSUES');
  if (!address) blockers.push('NO_ADDRESS');
  return {
    cart,
    address,
    delivery: options,
    selectedDelivery: delivery,
    totals: { ...cart.totals, deliveryPaise: chosen.pricePaise, totalPaise: cart.totals.subtotalPaise + chosen.pricePaise },
    blockers,
  };
}

export const checkoutHandlers = [
  http.get('*/api/checkout', ({ request }) => {
    const params = new URL(request.url).searchParams;
    const delivery = isDeliveryOption(params.get('delivery')) ? (params.get('delivery') as 'standard' | 'express') : 'standard';
    return HttpResponse.json(quote(Number(params.get('addressId')) || undefined, delivery));
  }),
  http.post('*/api/orders', async ({ request }) => {
    const { addressId, delivery } = (await request.json()) as { addressId: number; delivery: 'standard' | 'express' };
    const q = quote(addressId, delivery);
    if (q.blockers.includes('CART_ISSUES')) return HttpResponse.json({ error: { code: 'CART_CHANGED', message: 'x' } }, { status: 409 });
    const { id: _id, isDefault: _d, createdAt: _c, ...address } = q.address!;
    const order: Order = {
      id: `ORD-TEST000${nextId++}`,
      status: 'pending_payment',
      lines: q.cart.lines.map((l) => ({
        productId: l.product.id,
        slug: l.product.slug,
        title: l.product.title,
        size: l.size,
        thumbnailUrl: l.product.thumbnailUrl,
        quantity: l.quantity,
        unitPricePaise: l.product.pricePaise,
        unitMrpPaise: l.product.mrpPaise,
      })),
      address,
      delivery: q.delivery.find((d) => d.option === delivery)!,
      totals: q.totals,
      createdAt: new Date().toISOString(),
      holdExpiresAt: new Date(Date.now() + PAYMENT_HOLD_MS).toISOString(),
      payment: null,
      history: [],
    };
    orders.set(order.id, order);
    return HttpResponse.json({ order }, { status: 201 });
  }),
  http.get('*/api/orders/:id', ({ params }) => {
    const order = orders.get(String(params.id));
    return order ? HttpResponse.json({ order }) : HttpResponse.json({ error: { code: 'ORDER_NOT_FOUND', message: 'x' } }, { status: 404 });
  }),
  http.post('*/api/orders/:id/cancel', ({ params }) => {
    const order = { ...orders.get(String(params.id))!, status: 'cancelled' as const };
    orders.set(order.id, order);
    return HttpResponse.json({ order });
  }),
];
