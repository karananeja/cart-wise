import { createHmac, randomBytes } from 'node:crypto';
import type { RazorpayPayment, RazorpayRefund } from './razorpay.js';

/**
 * An in-memory stand-in for the parts of Razorpay's API the store uses (F-014). Used by API
 * tests through `fetch`, and by the E2E fake server over HTTP. It never talks to Razorpay.
 */
export function createFakeRazorpay(keySecret: string) {
  const orders = new Map<string, { id: string; amount: number; receipt: string; notes: Record<string, string>; offers?: string[] }>();
  const payments = new Map<string, RazorpayPayment>();
  const refunds = new Map<string, RazorpayRefund[]>();
  const id = (prefix: string) => `${prefix}_${randomBytes(7).toString('hex')}`;
  let down = false;
  let refundsDown = false;
  const calls: string[] = [];

  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
  const error = (status: number, description: string) => json({ error: { code: 'BAD_REQUEST_ERROR', description } }, status);

  async function handle(method: string, path: string, body: Record<string, unknown>): Promise<Response> {
    calls.push(`${method} ${path}`);
    if (down) throw new TypeError('fetch failed');
    let m: RegExpMatchArray | null;
    if (method === 'POST' && path === '/v1/orders') {
      const order = { id: id('order'), amount: Number(body.amount), receipt: String(body.receipt), notes: body.notes as Record<string, string>, offers: body.offers as string[] | undefined };
      orders.set(order.id, order);
      return json({ ...order, status: 'created', currency: 'INR' });
    }
    if (method === 'GET' && (m = path.match(/^\/v1\/orders\/([^/]+)\/payments$/))) {
      return json({ items: [...payments.values()].filter((p) => p.order_id === m![1]) });
    }
    if (method === 'GET' && (m = path.match(/^\/v1\/payments\/([^/]+)$/))) {
      const payment = payments.get(m[1]!);
      return payment ? json(payment) : error(400, 'The id provided does not exist');
    }
    if (method === 'POST' && (m = path.match(/^\/v1\/payments\/([^/]+)\/capture$/))) {
      const payment = payments.get(m[1]!);
      if (!payment) return error(400, 'The id provided does not exist');
      if (payment.status !== 'authorized') return error(400, 'This payment has already been captured');
      payment.status = 'captured';
      return json(payment);
    }
    if (method === 'POST' && (m = path.match(/^\/v1\/payments\/([^/]+)\/refund$/))) {
      if (refundsDown) return error(502, 'Refunds are temporarily unavailable');
      const payment = payments.get(m[1]!);
      if (!payment || payment.status !== 'captured') return error(400, 'The payment has not been captured');
      const list = refunds.get(payment.id) ?? [];
      const refund = { id: id('rfnd'), amount: Number(body.amount), receipt: (body.receipt as string) ?? null, status: 'processed' };
      list.push(refund);
      refunds.set(payment.id, list);
      return json(refund);
    }
    if (method === 'GET' && (m = path.match(/^\/v1\/payments\/([^/]+)\/refunds$/))) {
      return json({ items: refunds.get(m[1]!) ?? [] });
    }
    return error(404, 'Not found');
  }

  return {
    fetch: (async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      const body = init?.body ? (JSON.parse(String(init.body)) as Record<string, unknown>) : {};
      return handle(init?.method ?? 'GET', url.pathname, body);
    }) as typeof fetch,
    handle,
    orders,
    payments,
    refunds,
    calls,
    setDown: (value: boolean) => (down = value),
    setRefundsDown: (value: boolean) => (refundsDown = value),
    /**
     * What Checkout does when the customer pays: a payment on the order and the signed response
     * the browser receives. `status` is 'authorized' unless auto-capture is simulated.
     */
    pay(orderId: string, options: { method?: string; status?: 'authorized' | 'captured' | 'failed'; amount?: number; offerId?: string } = {}) {
      const order = orders.get(orderId);
      if (!order) throw new Error(`No order ${orderId}`);
      const payment: RazorpayPayment = {
        id: id('pay'),
        order_id: orderId,
        amount: options.amount ?? order.amount,
        currency: 'INR',
        status: options.status ?? 'authorized',
        method: options.method ?? 'card',
        offer_id: options.offerId ?? null,
        vpa: options.method === 'upi' ? 'success@razorpay' : null,
        card: options.method === 'upi' ? null : { last4: '1111', network: 'Visa' },
      };
      payments.set(payment.id, payment);
      return {
        razorpayPaymentId: payment.id,
        razorpayOrderId: orderId,
        razorpaySignature: createHmac('sha256', keySecret).update(`${orderId}|${payment.id}`).digest('hex'),
      };
    },
  };
}

export type FakeRazorpay = ReturnType<typeof createFakeRazorpay>;
