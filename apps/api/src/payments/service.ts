import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import {
  CARD_OTP_ATTEMPTS,
  cardLabel,
  emiPlan,
  emiQuote,
  isEmiTenure,
  isNoCostTenure,
  NO_COST_EMI_OFFER_ID,
  NO_COST_MIN_PAISE,
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
  type PaymentProvider,
  type EmiPlan,
  type RecognisedCard,
} from '@store/shared';
import type { RecordEvent } from '../analytics/record.js';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import type { OrderService } from '../orders/service.js';
import { GatewayError, razorpayLabel, type RazorpayClient, type RazorpayPayment } from './razorpay.js';

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
  emi_tenure: number | null;
  emi_rate_percent: number | null;
  emi_monthly_paise: number | null;
  emi_interest_paise: number | null;
  emi_no_cost: number;
  gateway_order_id: string | null;
  gateway_payment_id: string | null;
}

interface Deps {
  db: Db;
  orders: OrderService;
  record: RecordEvent;
  clock?: () => number;
  /** Set when Razorpay test keys are configured (F-014, ADR-005). */
  razorpay?: RazorpayClient;
  /** Logs gateway problems for the operator; never shown to customers. */
  log?: (message: string) => void;
}

/** What Razorpay actually took, applied when the order is confirmed. */
interface Settlement {
  paidPaise: number;
  discountPaise: number;
  offerId: string | null;
  label: string;
  gatewayPaymentId: string;
}

/** A pending Razorpay attempt asks Razorpay about its payments at most this often. */
const RECONCILE_EVERY_MS = 15_000;

const newAttemptId = () => `PAY-${randomBytes(9).toString('base64url')}`;
const hashOtp = (attemptId: string, code: string) => createHash('sha256').update(`${attemptId}:${code}`).digest('base64url');

function labelOf(row: AttemptRow): string {
  if (row.method === 'razorpay') return 'Razorpay';
  if (row.method === 'card') return cardLabel({ network: row.card_network, bank: row.card_bank, cardType: row.card_type }, row.card_last4 ?? '');
  if (row.method === 'upi_id') return `UPI · ${row.upi_id}`;
  return 'UPI (QR)';
}

/**
 * Simulated payment (F-009). A Pending Payment order takes one attempt at a time; a successful
 * attempt confirms the order, turns its held stock into a sale and takes the items out of the
 * cart, all in one transaction. No real money and no card details beyond the last 4 digits.
 */
/** EMI on analytics events: `emiTenure` and `emiNoCost`, or null without EMI. */
const emiEventProps = (tenure: number | null, noCost: number) => ({ emiTenure: tenure, emiNoCost: tenure === null ? null : noCost === 1 });

/**
 * The EMI plan for a card payment (F-014 FR-1–FR-4). No-cost EMI is the order's one offer, so it
 * can't join a bank offer (D2); normal EMI finances the amount after the bank offer.
 */
function emiFields(card: RecognisedCard, amountPaise: number, offerDiscountPaise: number, offerId: string | null, emi: { tenure: number; noCost: boolean }) {
  const quote = emiQuote(card, amountPaise, offerDiscountPaise);
  if (!quote.eligible || !card.bank) throw new HttpError(409, 'EMI_NOT_AVAILABLE', 'EMI is not available for this card', { reason: quote.reason });
  if (!isEmiTenure(emi.tenure)) throw new HttpError(400, 'EMI_NOT_AVAILABLE', 'Choose one of the EMI plans');
  if (emi.noCost) {
    if (offerId) throw new HttpError(409, 'OFFER_NOT_APPLICABLE', 'No Cost EMI cannot be combined with a bank offer', { reason: 'NO_COST_EMI' });
    if (!isNoCostTenure(emi.tenure) || amountPaise < NO_COST_MIN_PAISE) throw new HttpError(409, 'EMI_NOT_AVAILABLE', 'No Cost EMI is not available on this plan');
  }
  const plan = emiPlan(card.bank, emi.noCost ? amountPaise : amountPaise - offerDiscountPaise, emi.tenure, emi.noCost);
  return {
    emiTenure: plan.tenure,
    emiRatePercent: plan.ratePercent,
    emiMonthlyPaise: plan.monthlyPaise,
    emiInterestPaise: plan.interestPaise,
    emiNoCost: plan.noCost ? 1 : 0,
    ...(plan.noCost ? { offerId: NO_COST_EMI_OFFER_ID, discountPaise: plan.discountPaise } : {}),
  };
}

const providerOf = (method: PaymentMethod): PaymentProvider => (method === 'razorpay' ? 'razorpay' : 'demo');

function emiOf(row: AttemptRow): EmiPlan | undefined {
  if (row.emi_tenure === null) return undefined;
  const noCost = row.emi_no_cost === 1;
  return {
    tenure: row.emi_tenure,
    ratePercent: row.emi_rate_percent ?? 0,
    noCost,
    chargedPaise: row.amount_paise - row.discount_paise,
    discountPaise: noCost ? row.discount_paise : 0,
    monthlyPaise: row.emi_monthly_paise ?? 0,
    interestPaise: row.emi_interest_paise ?? 0,
    totalPaise: (row.emi_monthly_paise ?? 0) * row.emi_tenure,
  };
}

export function createPaymentService({ db, orders, record, clock = Date.now, razorpay, log = console.error }: Deps) {
  const iso = (ms: number) => new Date(ms).toISOString();

  const findAttempt = db.prepare(`
    SELECT a.* FROM payment_attempts a JOIN orders o ON o.id = a.order_id WHERE a.id = ? AND o.user_id = ?`);
  const attemptById = db.prepare('SELECT * FROM payment_attempts WHERE id = ?');
  const pendingForOrder = db.prepare("SELECT * FROM payment_attempts WHERE order_id = ? AND status = 'pending'");
  const insertAttempt = db.prepare(`
    INSERT INTO payment_attempts (id, order_id, method, status, amount_paise, discount_paise, offer_id, card_network, card_bank,
      card_type, card_last4, upi_id, otp_hash, visitor_id, expires_at, created_at,
      emi_tenure, emi_rate_percent, emi_monthly_paise, emi_interest_paise, emi_no_cost, gateway_order_id)
    VALUES (@id, @orderId, @method, 'pending', @amountPaise, @discountPaise, @offerId, @cardNetwork, @cardBank,
      @cardType, @cardLast4, @upiId, @otpHash, @visitorId, @expiresAt, @now,
      @emiTenure, @emiRatePercent, @emiMonthlyPaise, @emiInterestPaise, @emiNoCost, @gatewayOrderId)`);
  const attemptByGatewayOrder = db.prepare('SELECT * FROM payment_attempts WHERE gateway_order_id = ?');
  const setGatewayPayment = db.prepare('UPDATE payment_attempts SET gateway_payment_id = ? WHERE id = ?');
  const customer = db.prepare('SELECT name, email, mobile FROM users WHERE id = ?');
  const failRow = db.prepare("UPDATE payment_attempts SET status = 'failed', failure_reason = ?, completed_at = ? WHERE id = ? AND status = 'pending'");
  const succeedRow = db.prepare(`
    UPDATE payment_attempts SET status = 'succeeded', completed_at = @now, amount_paise = @amountPaise, discount_paise = @discountPaise,
      offer_id = @offerId, gateway_payment_id = COALESCE(@gatewayPaymentId, gateway_payment_id)
    WHERE id = @id AND status = 'pending'`);
  const countOtp = db.prepare('UPDATE payment_attempts SET otp_attempts = otp_attempts + 1 WHERE id = ?');
  const orderRow = db.prepare('SELECT id, user_id, status, hold_expires_at, item_count, total_paise FROM orders WHERE id = ?');
  const confirmOrder = db.prepare(`
    UPDATE orders SET status = 'confirmed', payment_method = @method, payment_label = @label, offer_id = @offerId,
      offer_discount_paise = @discountPaise, paid_paise = @paidPaise, paid_at = @now, hold_released_at = @now, updated_at = @now,
      payment_provider = @provider, emi_tenure = @emiTenure, emi_monthly_paise = @emiMonthlyPaise,
      emi_interest_paise = @emiInterestPaise, emi_no_cost = @emiNoCost, gateway_payment_id = @gatewayPaymentId
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
    ...(emiOf(row) ? { emi: emiOf(row) } : {}),
    ...(row.method === 'razorpay' && row.status === 'pending' && row.gateway_order_id && razorpay
      ? { gateway: { keyId: razorpay.keyId, orderId: row.gateway_order_id, amountPaise: row.amount_paise, prefill: prefillFor(row.order_id) } }
      : {}),
    ...extra,
  });

  const prefillFor = (orderId: string) => {
    const user = customer.get((orderRow.get(orderId) as { user_id: number }).user_id) as { name: string; email: string; mobile: string };
    return { name: user.name, email: user.email, contact: `+91${user.mobile}` };
  };

  const reload = (id: string) => attemptById.get(id) as AttemptRow;

  const actorFor = (row: AttemptRow) => ({ visitorId: row.visitor_id, userId: (orderRow.get(row.order_id) as { user_id: number }).user_id });

  const fail = (row: AttemptRow, reason: PaymentFailureReason): AttemptRow => {
    if (failRow.run(reason, iso(clock()), row.id).changes) {
      record('payment_failed', { orderId: row.order_id, method: row.method, provider: providerOf(row.method), reason }, actorFor(row));
    }
    return reload(row.id);
  };

  /** Settles time-based outcomes before anything reads or acts on an attempt. */
  const refresh = (row: AttemptRow): AttemptRow => {
    // Expired holds end their orders, failing any attempt with them (orders.end).
    orders.sweepExpired();
    const current = reload(row.id);
    if (current.status === 'pending' && Date.parse(current.expires_at) <= clock()) {
      return fail(current, current.method === 'upi_id' || current.method === 'upi_qr' ? 'upi_expired' : 'hold_expired');
    }
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
  const complete = db.transaction((attemptId: string, settlement?: Settlement): AttemptRow => {
    const row = reload(attemptId);
    if (row.status !== 'pending') return row;
    const order = orderRow.get(row.order_id) as { id: string; user_id: number; status: string; hold_expires_at: string; item_count: number };
    if (order.status !== 'pending_payment' || Date.parse(order.hold_expires_at) <= clock()) {
      orders.sweepExpired();
      return fail(reload(attemptId), 'hold_expired');
    }
    const now = iso(clock());
    const discountPaise = settlement?.discountPaise ?? row.discount_paise;
    const offerId = settlement ? settlement.offerId : row.offer_id;
    const paidPaise = settlement?.paidPaise ?? row.amount_paise - row.discount_paise;
    succeedRow.run({ id: row.id, now, amountPaise: row.amount_paise, discountPaise, offerId, gatewayPaymentId: settlement?.gatewayPaymentId ?? null });
    confirmOrder.run({
      orderId: order.id,
      method: row.method,
      label: settlement?.label ?? labelOf(row),
      offerId,
      discountPaise,
      paidPaise,
      now,
      provider: providerOf(row.method),
      emiTenure: row.emi_tenure,
      emiMonthlyPaise: row.emi_monthly_paise,
      emiInterestPaise: row.emi_interest_paise,
      emiNoCost: row.emi_no_cost,
      gatewayPaymentId: settlement?.gatewayPaymentId ?? null,
    });

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

    const actor = { visitorId: row.visitor_id, userId: order.user_id };
    record(
      'payment_completed',
      { orderId: order.id, method: row.method, provider: providerOf(row.method), amountPaise: paidPaise, discountPaise, offerId, ...emiEventProps(row.emi_tenure, row.emi_no_cost) },
      actor,
    );
    record('order_created', { orderId: order.id, itemCount: order.item_count, totalPaise: paidPaise, productIds: [...new Set(lines.map((l) => l.product_id))].join(',') }, actor);
    return reload(row.id);
  });

  // ── Razorpay (F-014, ADR-005) ───────────────────────────────────────────────────────────

  const lastReconciled = new Map<string, number>();

  const gateway = (): RazorpayClient => {
    if (!razorpay) throw new HttpError(404, 'RAZORPAY_DISABLED', 'Razorpay is not available');
    return razorpay;
  };

  /** Gives back a payment Razorpay captured for an order we could no longer confirm (FR-12). */
  const refundLate = async (payment: RazorpayPayment, row: AttemptRow) => {
    if (payment.status !== 'captured') return; // Uncaptured payments are released by Razorpay itself.
    const receipt = `late-${row.id}`;
    const client = gateway();
    if ((await client.refundsOf(payment.id)).some((r) => r.receipt === receipt)) return;
    await client.refund(payment.id, payment.amount, receipt);
    log(`Razorpay payment ${payment.id} arrived after the hold on ${row.order_id} ended; refunded.`);
  };

  /**
   * Applies a Razorpay payment to its attempt: checks it belongs to this order and amount,
   * captures it if only authorised, and confirms the order once. Safe to call from the browser
   * callback, a reconcile and a webhook in any order.
   */
  const finalize = async (row: AttemptRow, payment: RazorpayPayment): Promise<AttemptRow> => {
    if (payment.order_id !== row.gateway_order_id) throw new HttpError(400, 'GATEWAY_SIGNATURE_INVALID', "We couldn't confirm this payment");
    if (payment.status !== 'authorized' && payment.status !== 'captured') return reload(row.id);
    // Less than the total only when Razorpay applied one of its offers (e.g. No Cost EMI).
    if (payment.currency !== 'INR' || payment.amount > row.amount_paise || (payment.amount < row.amount_paise && !payment.offer_id)) {
      log(`Razorpay payment ${payment.id} for ${row.order_id} has an unexpected amount (${payment.amount} of ${row.amount_paise}); not accepted.`);
      throw new HttpError(400, 'GATEWAY_SIGNATURE_INVALID', "We couldn't confirm this payment");
    }
    const current = refresh(row);
    if (current.status === 'succeeded') return current;
    if (current.status === 'failed') {
      await refundLate(payment, current);
      return current;
    }
    setGatewayPayment.run(payment.id, row.id);
    let captured = payment;
    if (payment.status === 'authorized') {
      try {
        captured = await gateway().capture(payment.id, payment.amount);
      } catch (error) {
        // Captured meanwhile by a parallel call or by auto-capture: read it again.
        captured = await gateway().fetchPayment(payment.id);
        if (captured.status !== 'captured') throw error;
      }
    }
    const done = complete(row.id, {
      paidPaise: captured.amount,
      discountPaise: row.amount_paise - captured.amount,
      offerId: captured.offer_id ?? null,
      label: razorpayLabel(captured),
      gatewayPaymentId: captured.id,
    });
    if (done.status === 'failed') await refundLate(captured, done);
    return done;
  };

  /** Asks Razorpay whether a pending attempt was paid (browser closed, callback lost). */
  const reconcile = async (row: AttemptRow, force = false): Promise<AttemptRow> => {
    if (row.method !== 'razorpay' || !row.gateway_order_id || !razorpay) return row;
    if (row.status !== 'pending' && !(row.status === 'failed' && row.failure_reason === 'hold_expired')) return row;
    const last = lastReconciled.get(row.id) ?? 0;
    if (!force && clock() - last < RECONCILE_EVERY_MS) return row;
    lastReconciled.set(row.id, clock());
    try {
      const paid = (await razorpay.orderPayments(row.gateway_order_id)).find((p) => p.status === 'captured' || p.status === 'authorized');
      return paid ? await finalize(row, paid) : reload(row.id);
    } catch (error) {
      log(`Razorpay reconcile for ${row.id} failed: ${error instanceof Error ? error.message : String(error)}`);
      return reload(row.id);
    }
  };

  const gatewayCall = async <T>(fn: () => Promise<T>): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof GatewayError) {
        log(`Razorpay: ${error.message}`);
        throw new HttpError(502, 'GATEWAY_UNAVAILABLE', 'Razorpay is unavailable right now');
      }
      throw error;
    }
  };

  return {
    razorpayEnabled: razorpay !== undefined,

    /** Creates the Razorpay order for the total first, then the attempt that tracks it. */
    async startRazorpay(userId: number, orderId: string, visitorId?: string): Promise<PaymentAttemptView> {
      const client = gateway();
      const order = pendingOrder(userId, orderId);
      const created = await gatewayCall(() =>
        client.createOrder({ amountPaise: order.totals.totalPaise, receipt: order.id, notes: { order_id: order.id } }),
      );
      return this.start(userId, orderId, { method: 'razorpay', visitorId }, created.id);
    },

    /** Checkout's success callback. Trusted only after the signature and Razorpay's own record agree. */
    async verifyRazorpay(userId: number, attemptId: string, input: { paymentId: string; orderId: string; signature: string }) {
      const row = ownAttempt(userId, attemptId);
      if (row.method !== 'razorpay') throw new HttpError(400, 'BAD_REQUEST', 'This is not a Razorpay payment');
      if (row.status === 'succeeded') return result(userId, row);
      if (input.orderId !== row.gateway_order_id || !gateway().verifyPaymentSignature(input.orderId, input.paymentId, input.signature)) {
        log(`Razorpay signature check failed for ${row.id}.`);
        throw new HttpError(400, 'GATEWAY_SIGNATURE_INVALID', "We couldn't confirm this payment");
      }
      const payment = await gatewayCall(() => gateway().fetchPayment(input.paymentId));
      return result(userId, await gatewayCall(() => finalize(row, payment)));
    },

    /** Razorpay webhooks (optional; need a public URL). Unknown or unsigned calls change nothing. */
    async webhook(rawBody: Buffer | undefined, signature: string | undefined): Promise<void> {
      const client = gateway();
      if (!client.webhooksEnabled) throw new HttpError(404, 'NOT_FOUND', 'Not found');
      if (!rawBody || !signature || !client.verifyWebhookSignature(rawBody, signature)) throw new HttpError(400, 'BAD_SIGNATURE', 'Bad signature');
      const event = JSON.parse(rawBody.toString('utf8')) as { event?: string; payload?: { payment?: { entity?: RazorpayPayment } } };
      const payment = event.payload?.payment?.entity;
      if (!payment?.order_id || (event.event !== 'payment.authorized' && event.event !== 'payment.captured')) return;
      const row = attemptByGatewayOrder.get(payment.order_id) as AttemptRow | undefined;
      if (row) await finalize(row, payment);
    },

    /** Like `get`, but a pending Razorpay attempt first checks with Razorpay (throttled). */
    async getLive(userId: number, attemptId: string) {
      const row = ownAttempt(userId, attemptId);
      return result(userId, row.method === 'razorpay' ? await reconcile(row) : row);
    },

    /** Checkout closed: unless Razorpay says it was paid, the attempt is cancelled. */
    async cancelLive(userId: number, attemptId: string): Promise<PaymentAttemptView> {
      const row = ownAttempt(userId, attemptId);
      if (row.method === 'razorpay') await reconcile(row, true);
      return this.cancel(userId, attemptId);
    },

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
        emi: emiQuote(card, amount, selected?.applies ? selected.discountPaise : 0),
      };
    },

    start: db.transaction((userId: number, orderId: string, input: PaymentInput, gatewayOrderId?: string): PaymentAttemptView => {
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
        emiTenure: null as number | null,
        emiRatePercent: null as number | null,
        emiMonthlyPaise: null as number | null,
        emiInterestPaise: null as number | null,
        emiNoCost: 0,
        gatewayOrderId: null as string | null,
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
        if (input.emi) Object.assign(base, emiFields(card, amountPaise, base.discountPaise, base.offerId, input.emi));
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
      } else if (input.method === 'razorpay') {
        if (!gatewayOrderId) throw new HttpError(400, 'BAD_REQUEST', 'Razorpay is not available');
        Object.assign(base, { gatewayOrderId, expiresAt: order.holdExpiresAt });
      }

      insertAttempt.run(base);
      record(
        'payment_started',
        { orderId, method: input.method, provider: providerOf(input.method), amountPaise: amountPaise - base.discountPaise, offerId: base.offerId, ...emiEventProps(base.emiTenure, base.emiNoCost) },
        { visitorId, userId },
      );
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
