import { http, HttpResponse } from 'msw';
import {
  cardLabel,
  cardOutcome,
  CARD_OTP_ATTEMPTS,
  demoPaymentUri,
  findOffer,
  isUpiId,
  offerDiscountPaise,
  offerEligibility,
  OFFERS,
  recogniseCard,
  UPI_REQUEST_MS,
  type Order,
  type PaymentAttemptView,
  type PaymentInput,
  type PaymentQuote,
} from '@store/shared';
import { removeOrdered } from './cartServer';
import { getOrder, saveOrder } from './checkoutServer';

/**
 * Mock payments built on the shared rules. Completion, idempotency, expiry and stock are covered
 * by the API tests; this follows the same contract so the UI can be exercised.
 */
const DEMO_OTP = '246810';

interface Stored {
  view: PaymentAttemptView;
  last4?: string;
  otpTries: number;
}

let attempts = new Map<string, Stored>();
let nextId = 1;
/** Bodies posted to start a payment, so tests can check what left the browser. */
export const paymentRequests: unknown[] = [];

export function resetPayments() {
  attempts = new Map();
  nextId = 1;
  paymentRequests.length = 0;
}

const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, details } }, { status });

function quote(order: Order, offerId: string | null, bin: string | null): PaymentQuote {
  const total = order.totals.totalPaise;
  const card = bin ? recogniseCard(bin) : null;
  const offers = OFFERS.map((o) => offerEligibility(o, total, card));
  const chosen = findOffer(offerId);
  const selected = chosen ? offerEligibility(chosen, total, card) : null;
  const suggested = card ? offers.find((o) => o.applies && o.offerId !== offerId) : undefined;
  return {
    orderTotalPaise: total,
    card,
    offers,
    selected,
    suggestedOfferId: suggested?.offerId ?? null,
    amountToPayPaise: total - (selected?.applies ? selected.discountPaise : 0),
  };
}

function complete(stored: Stored): Order {
  const order = getOrder(stored.view.orderId)!;
  stored.view = { ...stored.view, status: 'succeeded', demoCode: undefined };
  const now = new Date().toISOString();
  const paid: Order = {
    ...order,
    status: 'confirmed',
    payment: {
      method: stored.view.method,
      label: stored.view.label,
      offerId: stored.view.offerId,
      offerDiscountPaise: stored.view.discountPaise,
      paidPaise: stored.view.amountPaise,
      paidAt: now,
    },
    history: [
      { status: 'payment_successful', at: now },
      { status: 'confirmed', at: now },
    ],
  };
  saveOrder(paid);
  removeOrdered(order.lines.map((l) => ({ slug: l.slug, size: l.size, quantity: l.quantity })));
  return paid;
}

function fail(stored: Stored, reason: PaymentAttemptView['failureReason']) {
  stored.view = { ...stored.view, status: 'failed', failureReason: reason, demoCode: undefined };
}

export const paymentHandlers = [
  http.get('*/api/offers', () => HttpResponse.json({ offers: OFFERS })),
  http.get('*/api/orders/:id/payment-quote', ({ params, request }) => {
    const order = getOrder(String(params.id));
    if (!order) return error(404, 'ORDER_NOT_FOUND');
    const search = new URL(request.url).searchParams;
    return HttpResponse.json(quote(order, search.get('offerId'), search.get('bin')));
  }),
  http.post('*/api/orders/:id/payments', async ({ params, request }) => {
    const order = getOrder(String(params.id));
    if (!order) return error(404, 'ORDER_NOT_FOUND');
    if (order.status !== 'pending_payment') return error(409, 'ORDER_NOT_PENDING');
    const body = (await request.json()) as PaymentInput;
    paymentRequests.push(body);
    for (const stored of attempts.values()) if (stored.view.orderId === order.id && stored.view.status === 'pending') fail(stored, 'cancelled');

    const base = {
      id: `PAY-${nextId++}`,
      orderId: order.id,
      method: body.method,
      status: 'pending' as const,
      failureReason: null,
      offerId: null as string | null,
      discountPaise: 0,
      amountPaise: order.totals.totalPaise,
      expiresAt: new Date(Math.min(Date.now() + UPI_REQUEST_MS, Date.parse(order.holdExpiresAt))).toISOString(),
    };
    let stored: Stored;
    if (body.method === 'card') {
      if (!/^\d{6}$/.test(body.bin) || !/^\d{4}$/.test(body.last4)) return error(400, 'INVALID_CARD');
      const card = recogniseCard(body.bin);
      const offer = findOffer(body.offerId);
      if (body.offerId && (!offer || !offerEligibility(offer, order.totals.totalPaise, card).applies)) return error(409, 'OFFER_NOT_APPLICABLE');
      const discountPaise = offer ? offerDiscountPaise(offer, order.totals.totalPaise) : 0;
      stored = {
        view: {
          ...base,
          offerId: offer?.id ?? null,
          discountPaise,
          amountPaise: order.totals.totalPaise - discountPaise,
          label: cardLabel(card, body.last4),
          demoCode: DEMO_OTP,
          otpAttemptsLeft: CARD_OTP_ATTEMPTS,
        },
        last4: body.last4,
        otpTries: 0,
      };
    } else if (body.method === 'upi_id') {
      if (!isUpiId(body.upiId)) return error(400, 'INVALID_UPI_ID');
      stored = { view: { ...base, label: `UPI · ${body.upiId}` }, otpTries: 0 };
    } else {
      stored = { view: { ...base, label: 'UPI QR', qrUri: demoPaymentUri(order.id, order.totals.totalPaise) }, otpTries: 0 };
    }
    attempts.set(stored.view.id, stored);
    return HttpResponse.json({ attempt: stored.view }, { status: 201 });
  }),
  http.get('*/api/payments/:id', ({ params }) => {
    const stored = attempts.get(String(params.id));
    if (!stored) return error(404, 'PAYMENT_NOT_FOUND');
    return HttpResponse.json({ attempt: stored.view, order: getOrder(stored.view.orderId) });
  }),
  http.post('*/api/payments/:id/verify', async ({ params, request }) => {
    const stored = attempts.get(String(params.id));
    if (!stored) return error(404, 'PAYMENT_NOT_FOUND');
    if (stored.view.status === 'failed') return error(409, 'ATTEMPT_NOT_PENDING', { attempt: stored.view });
    if (stored.view.status === 'pending') {
      const { otp } = (await request.json()) as { otp: string };
      if (otp !== DEMO_OTP) {
        stored.otpTries += 1;
        if (stored.otpTries < CARD_OTP_ATTEMPTS) return error(401, 'INVALID_CODE', { attemptsLeft: CARD_OTP_ATTEMPTS - stored.otpTries });
        fail(stored, 'verification_failed');
      } else {
        const outcome = cardOutcome(stored.last4!);
        if (outcome === 'success') complete(stored);
        else fail(stored, outcome);
      }
    }
    return HttpResponse.json({ attempt: stored.view, order: getOrder(stored.view.orderId) });
  }),
  http.post('*/api/payments/:id/upi-response', async ({ params, request }) => {
    const stored = attempts.get(String(params.id));
    if (!stored) return error(404, 'PAYMENT_NOT_FOUND');
    if (stored.view.status === 'failed') return error(409, 'ATTEMPT_NOT_PENDING', { attempt: stored.view });
    const { approve } = (await request.json()) as { approve: boolean };
    if (stored.view.status === 'pending') {
      if (approve) complete(stored);
      else fail(stored, 'upi_declined');
    }
    return HttpResponse.json({ attempt: stored.view, order: getOrder(stored.view.orderId) });
  }),
  http.post('*/api/payments/:id/cancel', ({ params }) => {
    const stored = attempts.get(String(params.id));
    if (!stored) return error(404, 'PAYMENT_NOT_FOUND');
    if (stored.view.status === 'pending') fail(stored, 'cancelled');
    return HttpResponse.json({ attempt: stored.view });
  }),
];

/** Lets tests simulate a UPI request running out. */
export function expireAttempt(id: string) {
  const stored = attempts.get(id)!;
  fail(stored, 'upi_expired');
}
