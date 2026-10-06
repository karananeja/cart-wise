import { randomBytes, randomInt } from 'node:crypto';
import {
  allocatePaise,
  CANCELLABLE_STATUSES,
  DELIVERY_CODE_ATTEMPTS,
  isReturnReason,
  nextStatus,
  RETURN_WINDOW_MS,
  type CancelReason,
  type Order,
  type OrderList,
  type OrderStatus,
  type OrderSummary,
  type ReturnReason,
  type ReturnStatus,
  type SimOrder,
} from '@store/shared';
import type { RecordEvent } from '../analytics/record.js';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import type { OrderService } from './service.js';

interface OrderRow {
  id: string;
  user_id: number;
  status: OrderStatus;
  address: string;
  delivery: string;
  item_count: number;
  delivery_paise: number;
  offer_discount_paise: number;
  paid_paise: number | null;
  payment_label: string | null;
  created_at: string;
  delivered_at: string | null;
  cancelled_at: string | null;
}

interface LineRow {
  id: number;
  product_id: number;
  variant_id: number | null;
  title: string;
  size: string | null;
  thumbnail_url: string;
  quantity: number;
  unit_price_paise: number;
}

interface Deps {
  db: Db;
  orders: OrderService;
  record: RecordEvent;
  clock?: () => number;
}

const PAGE_SIZE = 10;
const SIM_LIST_SIZE = 50;
const newId = (prefix: string) => `${prefix}-${randomBytes(6).toString('base64url').toUpperCase().replace(/[^A-Z0-9]/g, 'X')}`;
const newDeliveryCode = () => String(randomInt(0, 10_000)).padStart(4, '0');

/** Cursor for "newest first" paging: the last card's creation time and id. */
const encodeCursor = (row: { created_at: string; id: string }) => Buffer.from(`${row.created_at}|${row.id}`).toString('base64url');
function decodeCursor(cursor: string | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  const [createdAt, id] = Buffer.from(cursor, 'base64url').toString('utf8').split('|');
  return createdAt && id ? { createdAt, id } : null;
}

/**
 * The paid order lifecycle (F-010): customer cancellation and returns, and the demo operator's
 * steps (advance, OTP-gated delivery, return pickup and refund). Every change is one transaction
 * guarded by the current status, so repeating a request can never apply it twice.
 */
export function createOrderLifecycle({ db, orders, record, clock = Date.now }: Deps) {
  const iso = (ms: number) => new Date(ms).toISOString();

  const order = db.prepare('SELECT * FROM orders WHERE id = ?');
  const ownOrder = db.prepare('SELECT * FROM orders WHERE id = ? AND user_id = ?');
  const lines = db.prepare('SELECT * FROM order_lines WHERE order_id = ? ORDER BY id');
  const paidPage = db.prepare(`
    SELECT * FROM orders WHERE user_id = @userId AND paid_at IS NOT NULL
      AND (@createdAt IS NULL OR created_at < @createdAt OR (created_at = @createdAt AND id < @id))
    ORDER BY created_at DESC, id DESC LIMIT @limit`);
  const recentPaid = db.prepare(`SELECT * FROM orders WHERE paid_at IS NOT NULL ORDER BY created_at DESC, id DESC LIMIT ${SIM_LIST_SIZE}`);
  const moveStatus = db.prepare('UPDATE orders SET status = @to, updated_at = @now WHERE id = @id AND status = @from');
  const markCancelled = db.prepare(`
    UPDATE orders SET status = 'cancelled', cancelled_at = @now, cancel_reason = @reason, updated_at = @now
    WHERE id = @id AND status = @from`);
  const markDelivered = db.prepare(`
    UPDATE orders SET status = 'delivered', delivered_at = @now, updated_at = @now WHERE id = @id AND status = 'out_for_delivery'`);
  const addHistory = db.prepare('INSERT INTO order_status_history (order_id, status, at) VALUES (?, ?, ?)');
  const restock = db.prepare(`
    UPDATE inventory SET on_hand = on_hand + @q, updated_at = @now
    WHERE product_id = @productId AND IFNULL(variant_id, 0) = IFNULL(@variantId, 0)`);
  const insertRefund = db.prepare(`
    INSERT INTO refunds (id, order_id, return_id, amount_paise, label, status, initiated_at, refunded_at)
    VALUES (@id, @orderId, @returnId, @amountPaise, @label, @status, @now, @refundedAt)`);
  const completeRefundRow = db.prepare("UPDATE refunds SET status = 'refunded', refunded_at = ? WHERE return_id = ? AND status = 'initiated'");

  const codeOf = db.prepare('SELECT code, attempts FROM delivery_codes WHERE order_id = ?');
  const putCode = db.prepare(`
    INSERT INTO delivery_codes (order_id, code, attempts, issued_at) VALUES (?, ?, 0, ?)
    ON CONFLICT(order_id) DO UPDATE SET code = excluded.code, attempts = 0, issued_at = excluded.issued_at`);
  const countCodeAttempt = db.prepare('UPDATE delivery_codes SET attempts = attempts + 1 WHERE order_id = ?');
  const dropCode = db.prepare('DELETE FROM delivery_codes WHERE order_id = ?');

  const returnedLineIds = db.prepare(`
    SELECT rl.order_line_id AS id FROM return_lines rl JOIN returns r ON r.id = rl.return_id WHERE r.order_id = ?`);
  const insertReturn = db.prepare("INSERT INTO returns (id, order_id, status, created_at) VALUES (?, ?, 'requested', ?)");
  const insertReturnLine = db.prepare('INSERT INTO return_lines (return_id, order_line_id, reason, refund_paise) VALUES (?, ?, ?, ?)');
  const findReturn = db.prepare('SELECT * FROM returns WHERE id = ?');
  const returnsOf = db.prepare('SELECT * FROM returns WHERE order_id = ? ORDER BY created_at, id');
  const returnLines = db.prepare(`
    SELECT rl.refund_paise, l.product_id, l.variant_id, l.quantity FROM return_lines rl JOIN order_lines l ON l.id = rl.order_line_id
    WHERE rl.return_id = ?`);
  const moveReturn = db.prepare(`UPDATE returns SET status = @to, picked_up_at = COALESCE(@pickedUpAt, picked_up_at),
    refunded_at = COALESCE(@refundedAt, refunded_at) WHERE id = @id AND status = @from`);

  const markDeliveredOnce = db.transaction((orderId: string) => {
    const now = iso(clock());
    if (markDelivered.run({ id: orderId, now }).changes === 0) throw new HttpError(409, 'INVALID_TRANSITION', 'This order is not out for delivery');
    addHistory.run(orderId, 'delivered', now);
    dropCode.run(orderId);
  });

  const ownPaid = (userId: number, orderId: string): OrderRow => {
    const row = ownOrder.get(orderId, userId) as OrderRow | undefined;
    if (!row) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    return row;
  };
  const anyPaid = (orderId: string): OrderRow => {
    const row = order.get(orderId) as OrderRow | undefined;
    if (!row || row.paid_paise === null) throw new HttpError(404, 'ORDER_NOT_FOUND', 'Order not found');
    return row;
  };
  const restockLines = (rows: { product_id: number; variant_id: number | null; quantity: number }[], now: string) => {
    for (const l of rows) restock.run({ q: l.quantity, productId: l.product_id, variantId: l.variant_id, now });
  };
  const view = (userId: number, orderId: string) => orders.view(userId, orderId) as Order;

  /** Each line's refund if returned: its total minus its share of the bank offer (no delivery charge). */
  const refundShares = (row: OrderRow, rows: LineRow[]) => {
    const totals = rows.map((l) => l.unit_price_paise * l.quantity);
    const offer = allocatePaise(totals, row.offer_discount_paise);
    return new Map(rows.map((l, i) => [l.id, totals[i]! - offer[i]!]));
  };

  const summary = (row: OrderRow): OrderSummary => {
    const rows = lines.all(row.id) as LineRow[];
    const returned = new Set((returnedLineIds.all(row.id) as { id: number }[]).map((r) => r.id));
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      deliveredAt: row.delivered_at,
      cancelledAt: row.cancelled_at,
      estimate: (JSON.parse(row.delivery) as { estimate: { from: string; to: string } }).estimate,
      thumbnails: rows.slice(0, 3).map((l) => ({ title: l.title, thumbnailUrl: l.thumbnail_url })),
      itemCount: row.item_count,
      paidPaise: row.paid_paise ?? 0,
      deliveryCode: row.status === 'out_for_delivery' ? ((codeOf.get(row.id) as { code: string } | undefined)?.code ?? null) : null,
      returnState: returned.size === 0 ? 'none' : returned.size === rows.length ? 'all' : 'partial',
    };
  };

  /** The operator's view: city only, never the delivery code. */
  const simOrder = (row: OrderRow): SimOrder => {
    const rows = lines.all(row.id) as LineRow[];
    const code = codeOf.get(row.id) as { attempts: number } | undefined;
    const next = nextStatus(row.status);
    return {
      id: row.id,
      status: row.status,
      createdAt: row.created_at,
      city: (JSON.parse(row.address) as { city: string }).city,
      items: rows.map((l) => ({ title: l.title, size: l.size, quantity: l.quantity })),
      paidPaise: row.paid_paise ?? 0,
      nextStatus: next,
      deliveryAttemptsLeft: row.status === 'out_for_delivery' && code ? Math.max(0, DELIVERY_CODE_ATTEMPTS - code.attempts) : null,
      returns: (returnsOf.all(row.id) as { id: string; status: ReturnStatus }[]).map((r) => {
        const own = returnLines.all(r.id) as { refund_paise: number; quantity: number }[];
        return { id: r.id, status: r.status, itemCount: own.reduce((n, l) => n + l.quantity, 0), refundPaise: own.reduce((n, l) => n + l.refund_paise, 0) };
      }),
    };
  };
  const simView = (orderId: string) => simOrder(order.get(orderId) as OrderRow);

  return {
    list(userId: number, cursor?: string): OrderList {
      const after = decodeCursor(cursor);
      const rows = paidPage.all({ userId, createdAt: after?.createdAt ?? null, id: after?.id ?? null, limit: PAGE_SIZE + 1 }) as OrderRow[];
      const page = rows.slice(0, PAGE_SIZE);
      return { orders: page.map(summary), nextCursor: rows.length > PAGE_SIZE ? encodeCursor(page[page.length - 1]!) : null };
    },

    /** Paid orders before shipping: full refund of what was paid (delivery included) and restock. */
    cancelPaid: db.transaction((userId: number, orderId: string, reason: CancelReason | null, visitorId: string): Order => {
      const row = ownPaid(userId, orderId);
      if (!CANCELLABLE_STATUSES.includes(row.status) || row.paid_paise === null) {
        throw new HttpError(409, 'NOT_CANCELLABLE', 'This order can no longer be cancelled');
      }
      const now = iso(clock());
      if (markCancelled.run({ id: row.id, from: row.status, reason, now }).changes === 0) {
        throw new HttpError(409, 'NOT_CANCELLABLE', 'This order can no longer be cancelled');
      }
      restockLines(lines.all(row.id) as LineRow[], now);
      insertRefund.run({ id: newId('RF'), orderId: row.id, returnId: null, amountPaise: row.paid_paise, label: row.payment_label ?? '', status: 'refunded', now, refundedAt: now });
      addHistory.run(row.id, 'cancelled', now);
      record('order_cancelled', { itemCount: row.item_count, totalPaise: row.paid_paise, reason }, visitorId);
      return view(userId, row.id);
    }),

    requestReturn: db.transaction((userId: number, orderId: string, chosen: { orderLineId: number; reason: ReturnReason }[]): Order => {
      const row = ownPaid(userId, orderId);
      if (row.status !== 'delivered' || !row.delivered_at) throw new HttpError(409, 'NOT_DELIVERED', 'Items can be returned once delivered');
      if (Date.parse(row.delivered_at) + RETURN_WINDOW_MS <= clock()) throw new HttpError(409, 'RETURN_WINDOW_CLOSED', 'The return window has closed');
      const rows = lines.all(row.id) as LineRow[];
      const ids = new Set(rows.map((l) => l.id));
      const returned = new Set((returnedLineIds.all(row.id) as { id: number }[]).map((r) => r.id));
      const unique = new Set(chosen.map((c) => c.orderLineId));
      if (chosen.length === 0 || unique.size !== chosen.length || chosen.some((c) => !ids.has(c.orderLineId) || !isReturnReason(c.reason))) {
        throw new HttpError(400, 'BAD_REQUEST', 'Choose items from this order and a reason for each');
      }
      if (chosen.some((c) => returned.has(c.orderLineId))) throw new HttpError(409, 'ALREADY_RETURNED', 'Some of these items are already being returned');

      const shares = refundShares(row, rows);
      const id = newId('RET');
      const now = iso(clock());
      insertReturn.run(id, row.id, now);
      for (const c of chosen) insertReturnLine.run(id, c.orderLineId, c.reason, shares.get(c.orderLineId)!);
      return view(userId, row.id);
    }),

    // ── Demo operator ─────────────────────────────────────────────────────────────────────

    simList(): SimOrder[] {
      return (recentPaid.all() as OrderRow[]).map(simOrder);
    },

    /** One step forward. Delivered is reached only with the customer's code. */
    advance: db.transaction((orderId: string): SimOrder => {
      const row = anyPaid(orderId);
      const to = nextStatus(row.status);
      if (!to || to === 'delivered') throw new HttpError(409, 'INVALID_TRANSITION', to === 'delivered' ? 'Enter the delivery code to mark delivered' : 'This order cannot move on');
      const now = iso(clock());
      if (moveStatus.run({ id: row.id, from: row.status, to, now }).changes === 0) throw new HttpError(409, 'INVALID_TRANSITION', 'This order has changed');
      addHistory.run(row.id, to, now);
      if (to === 'out_for_delivery') putCode.run(row.id, newDeliveryCode(), now);
      return simView(row.id);
    }),

    /** Not one transaction overall: a wrong code must stay counted when the error is thrown. */
    deliver(orderId: string, code: string): SimOrder {
      const row = anyPaid(orderId);
      if (row.status !== 'out_for_delivery') throw new HttpError(409, 'INVALID_TRANSITION', 'This order is not out for delivery');
      const current = codeOf.get(row.id) as { code: string; attempts: number } | undefined;
      if (!current || current.attempts >= DELIVERY_CODE_ATTEMPTS) throw new HttpError(423, 'DELIVERY_LOCKED', 'Too many wrong codes. Issue a new code.');
      if (current.code !== code) {
        countCodeAttempt.run(row.id);
        const attemptsLeft = DELIVERY_CODE_ATTEMPTS - current.attempts - 1;
        if (attemptsLeft <= 0) throw new HttpError(423, 'DELIVERY_LOCKED', 'Too many wrong codes. Issue a new code.');
        throw new HttpError(401, 'INVALID_CODE', 'That code is not right', { attemptsLeft });
      }
      markDeliveredOnce(row.id);
      return simView(row.id);
    },

    issueCode(orderId: string): SimOrder {
      const row = anyPaid(orderId);
      if (row.status !== 'out_for_delivery') throw new HttpError(409, 'INVALID_TRANSITION', 'This order is not out for delivery');
      putCode.run(row.id, newDeliveryCode(), iso(clock()));
      return simView(row.id);
    },

    /** Picked up: the units go back on sale and the refund starts. */
    pickUp: db.transaction((returnId: string): SimOrder => {
      const ret = findReturn.get(returnId) as { id: string; order_id: string; status: ReturnStatus } | undefined;
      if (!ret) throw new HttpError(404, 'RETURN_NOT_FOUND', 'Return not found');
      const now = iso(clock());
      if (moveReturn.run({ id: ret.id, from: 'requested', to: 'picked_up', pickedUpAt: now, refundedAt: null }).changes === 0) {
        throw new HttpError(409, 'INVALID_TRANSITION', 'This return has already been picked up');
      }
      const own = returnLines.all(ret.id) as { refund_paise: number; product_id: number; variant_id: number | null; quantity: number }[];
      restockLines(own, now);
      const row = order.get(ret.order_id) as OrderRow;
      insertRefund.run({
        id: newId('RF'),
        orderId: ret.order_id,
        returnId: ret.id,
        amountPaise: own.reduce((n, l) => n + l.refund_paise, 0),
        label: row.payment_label ?? '',
        status: 'initiated',
        now,
        refundedAt: null,
      });
      return simView(ret.order_id);
    }),

    completeRefund: db.transaction((returnId: string): SimOrder => {
      const ret = findReturn.get(returnId) as { id: string; order_id: string } | undefined;
      if (!ret) throw new HttpError(404, 'RETURN_NOT_FOUND', 'Return not found');
      const now = iso(clock());
      if (moveReturn.run({ id: ret.id, from: 'picked_up', to: 'refunded', pickedUpAt: null, refundedAt: now }).changes === 0) {
        throw new HttpError(409, 'INVALID_TRANSITION', 'This return is not waiting for a refund');
      }
      completeRefundRow.run(now, ret.id);
      return simView(ret.order_id);
    }),
  };
}

export type OrderLifecycle = ReturnType<typeof createOrderLifecycle>;
