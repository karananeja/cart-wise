import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  CARD_OTP_ATTEMPTS,
  cardLabel,
  cardOutcome,
  demoPaymentUri,
  findOffer,
  isUpiId,
  OFFERS,
  offerEligibility,
  recogniseCard,
  UPI_REQUEST_MS,
  type CardNetwork,
  type CardType,
  type BankId,
  type Order,
  type PaymentAttemptView,
  type PaymentFailureReason,
  type PaymentInput,
  type PaymentMethod,
  type PaymentQuote,
} from '@store/shared';
import type { RecordEvent } from '../analytics/record.js';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import type { OrderService } from '../orders/service.js';

interface AttemptRow {
  id: string;
  order_id: string;
  method: PaymentMethod;
  status: PaymentAttemptView['status'];
  failure_reason: PaymentFailureReason | null;
  amount_paise: number;
  discount_paise: number;
  offer_id: string | null;
  card_network: CardNetwork | null;
  card_bank: BankId | null;
  card_type: CardType | null;
  card_last4: string | null;
  upi_id: string | null;
  otp_hash: string | null;
  otp_attempts: number;
  visitor_id: string;
  expires_at: string;
  created_at: string;
  completed_at: string | null;
}

interface Deps {
  db: Db;
  orders: OrderService;
  record: RecordEvent;
  clock?: () => number;
}

const newAttemptId = () => `PAY-${randomBytes(9).toString('base64url')}`;
const hashOtp = (attemptId: string, code: string) => createHash('sha256').update(`${attemptId}:${code}`).digest('base64url');

function labelOf(row: AttemptRow): string {
  if (row.method === 'card') return cardLabel({ network: row.card_network, bank: row.card_bank, cardType: row.card_type }, row.card_last4 ?? '');
  if (row.method === 'upi_id') return `UPI · ${row.upi_id}`;
  return 'UPI (QR)';
}

/**
 * Simulated payment (F-009). A Pending Payment order takes one attempt at a time; a successful
 * attempt confirms the order, turns its held stock into a sale and takes the items out of the
 * cart, all in one transaction. No real money and no card details beyond the last 4 digits.
 */
export function createPaymentService({ db, orders, record, clock = Date.now }: Deps) {
  const iso = (ms: number) => new Date(ms).toISOString();

  const findAttempt = db.prepare(`
    SELECT a.* FROM payment_attempts a JOIN orders o ON o.id = a.order_id WHERE a.id = ? AND o.user_id = ?`);
  const attemptById = db.prepare('SELECT * FROM payment_attempts WHERE id = ?');
  const pendingForOrder = db.prepare("SELECT * FROM payment_attempts WHERE order_id = ? AND status = 'pending'");
  const insertAttempt = db.prepare(`
    INSERT INTO payment_attempts (id, order_id, method, status, amount_paise, discount_paise, offer_id, card_network, card_bank,
      card_type, card_last4, upi_id, otp_hash, visitor_id, expires_at, created_at)
    VALUES (@id, @orderId, @method, 'pending', @amountPaise, @discountPaise, @offerId, @cardNetwork, @cardBank,
      @cardType, @cardLast4, @upiId, @otpHash, @visitorId, @expiresAt, @now)`);
  const failRow = db.prepare("UPDATE payment_attempts SET status = 'failed', failure_reason = ?, completed_at = ? WHERE id = ? AND status = 'pending'");
  const succeedRow = db.prepare("UPDATE payment_attempts SET status = 'succeeded', completed_at = ? WHERE id = ? AND status = 'pending'");
  const countOtp = db.prepare('UPDATE payment_attempts SET otp_attempts = otp_attempts + 1 WHERE id = ?');
  const orderRow = db.prepare('SELECT id, user_id, status, hold_expires_at, item_count, total_paise FROM orders WHERE id = ?');
  const confirmOrder = db.prepare(`
    UPDATE orders SET status = 'confirmed', payment_method = @method, payment_label = @label, offer_id = @offerId,
      offer_discount_paise = @discountPaise, paid_paise = @paidPaise, paid_at = @now, hold_released_at = @now, updated_at = @now
    WHERE id = @orderId AND status = 'pending_payment'`);
  const orderLines = db.prepare('SELECT product_id, variant_id, quantity FROM order_lines WHERE order_id = ?');
  const sell = db.prepare(`
    UPDATE inventory SET on_hand = on_hand - @q, reserved = MAX(reserved - @q, 0), updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0)`);
  const addHistory = db.prepare('INSERT INTO order_status_history (order_id, status, at) VALUES (?, ?, ?)');
  const userCart = db.prepare('SELECT id FROM carts WHERE user_id = ?');
  const reduceCartLine = db.prepare(`
    UPDATE cart_lines SET quantity = quantity - @q
    WHERE cart_id = @cartId AND product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0) AND quantity > @q`);
  const dropCartLine = db.prepare(`
    DELETE FROM cart_lines
    WHERE cart_id = @cartId AND product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0) AND quantity <= @q`);
  const touchCart = db.prepare('UPDATE carts SET updated_at = ? WHERE id = ?');

  const view = (row: AttemptRow, extra: Partial<PaymentAttemptView> = {}): PaymentAttemptView => ({
    id: row.id,
    orderId: row.order_id,
    method: row.method,
    status: row.status,
    failureReason: row.failure_reason,
    amountPaise: row.amount_paise - row.discount_paise,
    discountPaise: row.discount_paise,
    offerId: row.offer_id,
    label: labelOf(row),
    expiresAt: row.expires_at,
    ...(row.method === 'card' && row.status === 'pending' ? { otpAttemptsLeft: CARD_OTP_ATTEMPTS - row.otp_attempts } : {}),
    ...(row.method === 'upi_qr' ? { qrUri: demoPaymentUri(row.order_id, row.amount_paise - row.discount_paise) } : {}),
    ...extra,
  });

  const reload = (id: string) => attemptById.get(id) as AttemptRow;

  const fail = (row: AttemptRow, reason: PaymentFailureReason): AttemptRow => {
    if (failRow.run(reason, iso(clock()), row.id).changes) record('payment_failed', { method: row.method, reason }, row.visitor_id);
    return reload(row.id);
  };

  /** Settles time-based outcomes before anything reads or acts on an attempt. */
  const refresh = (row: AttemptRow): AttemptRow => {
    // Expired holds end their orders, failing any attempt with them (orders.end).
    orders.sweepExpired();
    const current = reload(row.id);
    if (current.status === 'pending' && Date.parse(current.expires_at) <= clock()) return fail(current, current.method === 'card' ? 'hold_expired' : 'upi_expired');
    return current;
  };

  const ownAttempt = (userId: number, attemptId: string): AttemptRow => {
    const row = findAttempt.get(attemptId, userId) as AttemptRow | undefined;
    if (!row) throw new HttpError(404, 'PAYMENT_NOT_FOUND', 'Payment not found');
    return refresh(row);
  };

  const pendingOrder = (userId: number, orderId: string): Order => {
    orders.sweepExpired();
    const order = orders.view(userId, orderId);
    if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    if (order.status === 'payment_expired') throw new HttpError(409, 'HOLD_EXPIRED', 'Your hold expired');
    if (order.status !== 'pending_payment') throw new HttpError(409, 'ORDER_NOT_PENDING', 'This order is no longer awaiting payment');
    return order;
  };

  const result = (userId: number, row: AttemptRow) => ({ attempt: view(row), order: orders.view(userId, row.order_id)! });

  /** Acting on a finished attempt: success is returned as it is (idempotent); failure is refused. */
  const settled = (userId: number, row: AttemptRow) => {
    if (row.status === 'succeeded') return result(userId, row);
    throw new HttpError(409, 'ATTEMPT_NOT_PENDING', 'This payment has already ended', { attempt: view(row) });
  };

  /**
   * Confirms the order, exactly once. The status and hold are re-checked inside the
   * transaction, so a double approval or a late one can't complete twice or after expiry.
   */
  const complete = db.transaction((attemptId: string): AttemptRow => {
    const row = reload(attemptId);
    if (row.status !== 'pending') return row;
    const order = orderRow.get(row.order_id) as { id: string; user_id: number; status: string; hold_expires_at: string; item_count: number };
    if (order.status !== 'pending_payment' || Date.parse(order.hold_expires_at) <= clock()) {
      orders.sweepExpired();
      return fail(reload(attemptId), 'hold_expired');
    }
    const now = iso(clock());
    const paidPaise = row.amount_paise - row.discount_paise;
    succeedRow.run(now, row.id);
    confirmOrder.run({ orderId: order.id, method: row.method, label: labelOf(row), offerId: row.offer_id, discountPaise: row.discount_paise, paidPaise, now });

    const lines = orderLines.all(order.id) as { product_id: number; variant_id: number | null; quantity: number }[];
    const cart = userCart.get(order.user_id) as { id: string } | undefined;
    for (const line of lines) {
      const unit = { q: line.quantity, productId: line.product_id, variantId: line.variant_id };
      sell.run({ ...unit, now });
      if (cart) {
        // Drop first: a line reduced from 3 to 1 must not then be dropped as "≤ 2".
        dropCartLine.run({ ...unit, cartId: cart.id });
        reduceCartLine.run({ ...unit, cartId: cart.id });
      }
    }
    if (cart) touchCart.run(now, cart.id);
    addHistory.run(order.id, 'payment_successful', now);
    addHistory.run(order.id, 'confirmed', now);

    record('payment_completed', { method: row.method, amountPaise: paidPaise, discountPaise: row.discount_paise, offerId: row.offer_id }, row.visitor_id);
    record('order_created', { itemCount: order.item_count, totalPaise: paidPaise }, row.visitor_id);
    return reload(row.id);
  });

  return {
    quote(userId: number, orderId: string, input: { offerId?: string; bin?: string }): PaymentQuote {
      orders.sweepExpired();
      const order = orders.view(userId, orderId);
      if (!order) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
      const amount = order.totals.totalPaise;
      const card = input.bin && /^\d{6}$/.test(input.bin) ? recogniseCard(input.bin) : null;
      const offers = OFFERS.map((o) => offerEligibility(o, amount, card));
      const selected = offers.find((o) => o.offerId === input.offerId) ?? null;
      return {
        orderTotalPaise: amount,
        card,
        offers,
        selected,
        suggestedOfferId: offers.find((o) => o.applies && o.offerId !== input.offerId)?.offerId ?? null,
        amountToPayPaise: amount - (selected?.applies ? selected.discountPaise : 0),
      };
    },

    start: db.transaction((userId: number, orderId: string, input: PaymentInput): PaymentAttemptView => {
      const order = pendingOrder(userId, orderId);
      // One attempt at a time: a new one withdraws any still open.
      for (const open of pendingForOrder.all(orderId) as AttemptRow[]) fail(open, 'cancelled');

      const now = clock();
      const id = newAttemptId();
      const amountPaise = order.totals.totalPaise;
      const visitorId = input.visitorId ?? `user-${userId}`;
      const base = {
        id,
        orderId,
        method: input.method,
        amountPaise,
        discountPaise: 0,
        offerId: null as string | null,
        cardNetwork: null as string | null,
        cardBank: null as string | null,
        cardType: null as string | null,
        cardLast4: null as string | null,
        upiId: null as string | null,
        otpHash: null as string | null,
        visitorId,
        now: iso(now),
        expiresAt: iso(Math.min(now + UPI_REQUEST_MS, Date.parse(order.holdExpiresAt))),
      };
      let demoCode: string | undefined;

      if (input.method === 'card') {
        const card = recogniseCard(input.bin);
        if (input.offerId) {
          const offer = findOffer(input.offerId);
          if (!offer) throw new HttpError(400, 'BAD_REQUEST', 'Unknown offer');
          const eligibility = offerEligibility(offer, amountPaise, card);
          if (!eligibility.applies) throw new HttpError(409, 'OFFER_NOT_APPLICABLE', 'This offer does not apply to this card', { reason: eligibility.reason });
          base.offerId = offer.id;
          base.discountPaise = eligibility.discountPaise;
        }
        demoCode = String(randomInt(0, 1_000_000)).padStart(6, '0');
        Object.assign(base, {
          cardNetwork: card.network,
          cardBank: card.bank,
          cardType: card.cardType,
          cardLast4: input.last4,
          otpHash: hashOtp(id, demoCode),
          // The bank OTP stays valid for as long as the items are held.
          expiresAt: order.holdExpiresAt,
        });
      } else if (input.method === 'upi_id') {
        if (!isUpiId(input.upiId)) throw new HttpError(400, 'INVALID_UPI_ID', 'Enter a UPI ID like name@bank');
        base.upiId = input.upiId;
      }

      insertAttempt.run(base);
      record('payment_started', { method: input.method, amountPaise: amountPaise - base.discountPaise, offerId: base.offerId }, visitorId);
      return view(reload(id), demoCode ? { demoCode } : {});
    }),

    get(userId: number, attemptId: string) {
      return result(userId, ownAttempt(userId, attemptId));
    },

    verifyOtp(userId: number, attemptId: string, code: string) {
      const row = ownAttempt(userId, attemptId);
      if (row.method !== 'card') throw new HttpError(400, 'BAD_REQUEST', 'This payment has no bank verification');
      if (row.status !== 'pending') return settled(userId, row);

      const expected = Buffer.from(row.otp_hash ?? '');
      const actual = Buffer.from(hashOtp(row.id, code));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        countOtp.run(row.id);
        const attemptsLeft = CARD_OTP_ATTEMPTS - row.otp_attempts - 1;
        if (attemptsLeft <= 0) return result(userId, fail(row, 'verification_failed'));
        throw new HttpError(401, 'INVALID_CODE', 'That code is not right', { attemptsLeft });
      }
      const outcome = cardOutcome(row.card_last4 ?? '');
      return result(userId, outcome === 'success' ? complete(row.id) : fail(row, outcome));
    },

    respondUpi(userId: number, attemptId: string, approve: boolean) {
      const row = ownAttempt(userId, attemptId);
      if (row.method === 'card') throw new HttpError(400, 'BAD_REQUEST', 'This is not a UPI payment');
      if (row.status !== 'pending') return settled(userId, row);
      return result(userId, approve ? complete(row.id) : fail(row, 'upi_declined'));
    },

    cancel(userId: number, attemptId: string): PaymentAttemptView {
      const row = ownAttempt(userId, attemptId);
      if (row.status === 'succeeded') throw new HttpError(409, 'ATTEMPT_NOT_PENDING', 'This payment has already completed', { attempt: view(row) });
      return view(row.status === 'pending' ? fail(row, 'cancelled') : row);
    },
  };
}

export type PaymentService = ReturnType<typeof createPaymentService>;
