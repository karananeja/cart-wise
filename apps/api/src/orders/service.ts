import { randomBytes } from 'node:crypto';
import {
  CANCELLABLE_STATUSES,
  deliveryOptions,
  RETURN_WINDOW_MS,
  type OrderRefund,
  type OrderReturn,
  type ReturnReason,
  type ReturnState,
  PAYMENT_HOLD_MS,
  type Address,
  type CheckoutBlocker,
  type CheckoutQuote,
  type DeliveryOption,
  type Order,
  type OrderHistoryStatus,
  type OrderStatus,
  type PaymentFailureReason,
  type PaymentMethod,
  type PaymentProvider,
} from '@store/shared';
import type { RecordEvent } from '../analytics/record.js';
import type { AddressService } from '../addresses/service.js';
import type { CartService } from '../cart/service.js';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';

interface OrderRow {
  id: string;
  user_id: number;
  status: OrderStatus;
  address: string;
  delivery: string;
  item_count: number;
  mrp_paise: number;
  discount_paise: number;
  delivery_paise: number;
  total_paise: number;
  created_at: string;
  hold_expires_at: string;
  hold_released_at: string | null;
  payment_method: PaymentMethod | null;
  payment_label: string | null;
  offer_id: string | null;
  offer_discount_paise: number;
  paid_paise: number | null;
  paid_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancel_reason: string | null;
  payment_provider: PaymentProvider | null;
  emi_tenure: number | null;
  emi_monthly_paise: number | null;
  emi_interest_paise: number | null;
  emi_no_cost: number;
}

interface LineRow {
  id: number;
  product_id: number;
  variant_id: number | null;
  slug: string;
  title: string;
  size: string | null;
  option_label: string | null;
  thumbnail_url: string;
  quantity: number;
  unit_price_paise: number;
  unit_mrp_paise: number;
}

/** `ORD-` + 8 characters from an unambiguous alphabet. */
function newOrderId(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return `ORD-${Array.from(randomBytes(8), (b) => alphabet[b % alphabet.length]).join('')}`;
}

interface Deps {
  db: Db;
  carts: CartService;
  addresses: AddressService;
  record: RecordEvent;
  clock?: () => number;
}

export function createOrderService({ db, carts, addresses, record, clock = Date.now }: Deps) {
  const iso = (ms: number) => new Date(ms).toISOString();

  const cartLines = db.prepare(`
    SELECT l.id, l.product_id, l.variant_id, l.quantity FROM cart_lines l JOIN carts c ON c.id = l.cart_id
    WHERE c.user_id = ? ORDER BY l.added_at DESC, l.id DESC`);
  const reserve = db.prepare(`
    UPDATE inventory SET reserved = reserved + @q, updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0) AND on_hand - reserved >= @q`);
  const unreserve = db.prepare(`
    UPDATE inventory SET reserved = MAX(reserved - @q, 0), updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0)`);
  const insertOrder = db.prepare(`
    INSERT INTO orders (id, user_id, status, address, delivery, item_count, mrp_paise, discount_paise, delivery_paise, total_paise,
      created_at, hold_expires_at, updated_at)
    VALUES (@id, @userId, 'pending_payment', @address, @delivery, @itemCount, @mrpPaise, @discountPaise, @deliveryPaise, @totalPaise,
      @now, @holdExpiresAt, @now)`);
  const insertLine = db.prepare(`
    INSERT INTO order_lines (order_id, product_id, variant_id, slug, title, size, option_label, thumbnail_url, quantity, unit_price_paise, unit_mrp_paise)
    VALUES (@orderId, @productId, @variantId, @slug, @title, @size, @option, @thumbnailUrl, @quantity, @unitPricePaise, @unitMrpPaise)`);
  const findOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
  const orderLines = db.prepare('SELECT * FROM order_lines WHERE order_id = ? ORDER BY id');
  const pendingForUser = db.prepare("SELECT id FROM orders WHERE user_id = ? AND status = 'pending_payment'");
  const expiredPending = db.prepare("SELECT id FROM orders WHERE status = 'pending_payment' AND hold_expires_at < ?");
  const setStatus = db.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?');
  const markReleased = db.prepare('UPDATE orders SET hold_released_at = ? WHERE id = ? AND hold_released_at IS NULL');
  const history = db.prepare('SELECT status, at FROM order_status_history WHERE order_id = ? ORDER BY id');
  const returnsOf = db.prepare('SELECT * FROM returns WHERE order_id = ? ORDER BY created_at, id');
  const returnLinesOf = db.prepare(`
    SELECT rl.return_id, rl.order_line_id, rl.reason, rl.refund_paise FROM return_lines rl JOIN returns r ON r.id = rl.return_id
    WHERE r.order_id = ? ORDER BY rl.order_line_id`);
  const refundsOf = db.prepare('SELECT * FROM refunds WHERE order_id = ? ORDER BY initiated_at, id');
  const deliveryCode = db.prepare('SELECT code FROM delivery_codes WHERE order_id = ?');
  const pendingAttempts = db.prepare("SELECT id, method, visitor_id FROM payment_attempts WHERE order_id = ? AND status = 'pending'");
  const failAttempt = db.prepare("UPDATE payment_attempts SET status = 'failed', failure_reason = ?, completed_at = ? WHERE id = ? AND status = 'pending'");

  const pickAddress = (userId: number, addressId: number | undefined): Address | null => {
    const list = addresses.list(userId);
    return list.find((a) => a.id === addressId) ?? list.find((a) => a.isDefault) ?? list[0] ?? null;
  };

  /** Returns held stock to sale. Guarded so it happens at most once per order. */
  const release = (orderId: string) => {
    if (markReleased.run(iso(clock()), orderId).changes === 0) return;
    for (const line of orderLines.all(orderId) as LineRow[]) {
      unreserve.run({ q: line.quantity, productId: line.product_id, variantId: line.variant_id, now: iso(clock()) });
    }
  };

  /** Ends an unpaid order: any payment in progress fails with it, and the stock goes back on sale. */
  const end = db.transaction((orderId: string, status: OrderStatus) => {
    setStatus.run(status, iso(clock()), orderId);
    const reason: PaymentFailureReason = status === 'payment_expired' ? 'hold_expired' : 'cancelled';
    const userId = (db.prepare('SELECT user_id FROM orders WHERE id = ?').get(orderId) as { user_id: number }).user_id;
    for (const a of pendingAttempts.all(orderId) as { id: string; method: PaymentMethod; visitor_id: string }[]) {
      if (failAttempt.run(reason, iso(clock()), a.id).changes) record('payment_failed', { orderId, method: a.method, reason }, { visitorId: a.visitor_id, userId });
    }
    release(orderId);
  });

  /** Unpaid holds past their time become Payment expired, and their stock is released. */
  const sweepExpired = () => {
    for (const { id } of expiredPending.all(iso(clock())) as { id: string }[]) end(id, 'payment_expired');
  };

  const toOrder = (row: OrderRow, options: { withDeliveryCode?: boolean } = {}): Order => {
    const lines = orderLines.all(row.id) as LineRow[];
    const returnLines = returnLinesOf.all(row.id) as { return_id: string; order_line_id: number; reason: ReturnReason; refund_paise: number }[];
    const returns: OrderReturn[] = (returnsOf.all(row.id) as { id: string; status: OrderReturn['status']; created_at: string; picked_up_at: string | null; refunded_at: string | null }[]).map(
      (r) => {
        const own = returnLines.filter((l) => l.return_id === r.id);
        return {
          id: r.id,
          status: r.status,
          lines: own.map((l) => ({ orderLineId: l.order_line_id, reason: l.reason, refundPaise: l.refund_paise })),
          refundPaise: own.reduce((sum, l) => sum + l.refund_paise, 0),
          createdAt: r.created_at,
          pickedUpAt: r.picked_up_at,
          refundedAt: r.refunded_at,
        };
      },
    );
    const refunds: OrderRefund[] = (refundsOf.all(row.id) as { id: string; return_id: string | null; amount_paise: number; label: string; status: OrderRefund['status']; initiated_at: string; refunded_at: string | null }[]).map(
      (r) => ({ id: r.id, returnId: r.return_id, amountPaise: r.amount_paise, label: r.label, status: r.status, initiatedAt: r.initiated_at, refundedAt: r.refunded_at }),
    );
    const returned = new Set(returnLines.map((l) => l.order_line_id));
    const returnState: ReturnState = returned.size === 0 ? 'none' : returned.size === lines.length ? 'all' : 'partial';
    const returnWindowEndsAt = row.delivered_at ? iso(Date.parse(row.delivered_at) + RETURN_WINDOW_MS) : null;
    const code = options.withDeliveryCode && row.status === 'out_for_delivery' ? ((deliveryCode.get(row.id) as { code: string } | undefined)?.code ?? null) : null;
    return {
    id: row.id,
    status: row.status,
    lines: lines.map((l) => ({
      id: l.id,
      productId: l.product_id,
      slug: l.slug,
      title: l.title,
      size: l.size,
      option: l.option_label,
      thumbnailUrl: l.thumbnail_url,
      quantity: l.quantity,
      unitPricePaise: l.unit_price_paise,
      unitMrpPaise: l.unit_mrp_paise,
    })),
    address: JSON.parse(row.address) as Order['address'],
    delivery: JSON.parse(row.delivery) as Order['delivery'],
    totals: {
      itemCount: row.item_count,
      mrpPaise: row.mrp_paise,
      discountPaise: row.discount_paise,
      deliveryPaise: row.delivery_paise,
      totalPaise: row.total_paise,
    },
    createdAt: row.created_at,
    holdExpiresAt: row.hold_expires_at,
    payment:
      row.paid_at && row.payment_method
        ? {
            method: row.payment_method,
            label: row.payment_label ?? '',
            offerId: row.offer_id,
            offerDiscountPaise: row.offer_discount_paise,
            paidPaise: row.paid_paise ?? 0,
            paidAt: row.paid_at,
            provider: row.payment_provider ?? 'demo',
            emi:
              row.emi_tenure !== null
                ? {
                    tenure: row.emi_tenure,
                    monthlyPaise: row.emi_monthly_paise ?? 0,
                    // No-cost instalments add up to the order total exactly; the last takes the rounding.
                    lastMonthlyPaise: row.emi_no_cost === 1 ? row.total_paise - (row.emi_monthly_paise ?? 0) * (row.emi_tenure - 1) : (row.emi_monthly_paise ?? 0),
                    interestPaise: row.emi_interest_paise ?? 0,
                    noCost: row.emi_no_cost === 1,
                  }
                : null,
          }
        : null,
    history: history.all(row.id) as { status: OrderHistoryStatus; at: string }[],
    deliveredAt: row.delivered_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    returns,
    refunds,
    deliveryCode: code,
    actions: {
      canCancel: CANCELLABLE_STATUSES.includes(row.status),
      canReturn: row.status === 'delivered' && returnWindowEndsAt !== null && Date.parse(returnWindowEndsAt) > clock() && returned.size < lines.length,
      returnWindowEndsAt,
    },
    returnState,
    };
  };

  function quote(userId: number, addressId: number | undefined, delivery: DeliveryOption): CheckoutQuote {
    const cart = carts.view({ userId });
    const address = pickAddress(userId, addressId);
    const options = deliveryOptions(cart.totals.subtotalPaise, new Date(clock()));
    const chosen = options.find((o) => o.option === delivery)!;
    const blockers: CheckoutBlocker[] = [];
    if (cart.lines.length === 0) blockers.push('EMPTY_CART');
    else if (cart.hasIssues) blockers.push('CART_ISSUES');
    if (!address) blockers.push('NO_ADDRESS');
    return {
      cart,
      address,
      delivery: options,
      selectedDelivery: delivery,
      totals: {
        itemCount: cart.totals.itemCount,
        mrpPaise: cart.totals.mrpPaise,
        discountPaise: cart.totals.discountPaise,
        deliveryPaise: chosen.pricePaise,
        totalPaise: cart.totals.subtotalPaise + chosen.pricePaise,
      },
      blockers,
    };
  }

  return {
    quote,
    sweepExpired,
    /** The order as the API shows it; null when it isn't this user's. No sweep. */
    view(userId: number, orderId: string): Order | null {
      const row = findOrder.get(orderId, userId) as OrderRow | undefined;
      return row ? toOrder(row, { withDeliveryCode: true }) : null;
    },

    /**
     * Creates a Pending Payment order and holds its stock, all in one transaction: if any line
     * can't be reserved, nothing is (spec FR-12–FR-14). The user's previous unpaid hold is
     * cancelled first.
     */
    create: db.transaction((userId: number, addressId: number | undefined, delivery: DeliveryOption): Order => {
      for (const { id } of pendingForUser.all(userId) as { id: string }[]) end(id, 'cancelled');

      const q = quote(userId, addressId, delivery);
      if (q.blockers.includes('EMPTY_CART')) throw new HttpError(400, 'EMPTY_CART', 'Your cart is empty');
      if (q.blockers.includes('CART_ISSUES')) throw new HttpError(409, 'CART_CHANGED', 'Some items in your cart changed');
      if (!q.address || (addressId !== undefined && q.address.id !== addressId)) throw new HttpError(400, 'NO_ADDRESS', 'Choose a delivery address');

      const now = clock();
      const raw = cartLines.all(userId) as { id: number; product_id: number; variant_id: number | null; quantity: number }[];
      const variantOf = new Map(raw.map((r) => [r.id, r.variant_id]));
      for (const line of raw) {
        const reserved = reserve.run({ q: line.quantity, productId: line.product_id, variantId: line.variant_id, now: iso(now) }).changes;
        if (reserved === 0) throw new HttpError(409, 'CART_CHANGED', 'Some items in your cart changed');
      }

      const id = newOrderId();
      const { id: _id, isDefault: _isDefault, createdAt: _createdAt, ...address } = q.address;
      const delivered = q.delivery.find((d) => d.option === delivery)!;
      insertOrder.run({
        id,
        userId,
        address: JSON.stringify(address),
        delivery: JSON.stringify(delivered),
        ...q.totals,
        now: iso(now),
        holdExpiresAt: iso(now + PAYMENT_HOLD_MS),
      });
      q.cart.lines.forEach((line) => {
        insertLine.run({
          orderId: id,
          productId: line.product.id,
          variantId: variantOf.get(line.id) ?? null,
          slug: line.product.slug,
          title: line.product.title,
          size: line.size,
          option: line.option,
          thumbnailUrl: line.product.thumbnailUrl,
          quantity: line.quantity,
          unitPricePaise: line.unitPricePaise,
          unitMrpPaise: line.unitMrpPaise,
        });
      });
      return toOrder(findOrder.get(id, userId) as OrderRow);
    }),

    get(userId: number, orderId: string): Order {
      sweepExpired();
      const row = findOrder.get(orderId, userId) as OrderRow | undefined;
      if (!row) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
      return toOrder(row, { withDeliveryCode: true });
    },

    cancel(userId: number, orderId: string): Order {
      sweepExpired();
      const row = findOrder.get(orderId, userId) as OrderRow | undefined;
      if (!row) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
      if (row.status !== 'pending_payment') throw new HttpError(409, 'ORDER_NOT_PENDING', 'This order can no longer be cancelled here');
      end(orderId, 'cancelled');
      return toOrder(findOrder.get(orderId, userId) as OrderRow);
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
