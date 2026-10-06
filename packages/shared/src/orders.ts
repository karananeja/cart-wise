/**
 * Order lifecycle after payment (F-010): rules shared by the API (authority) and the web.
 * User decisions Q9 and Q16 (2026-10-06).
 */
import type { OrderStatus } from './checkout.js';

/** The paid lifecycle, in order. Delivered needs the delivery code. */
export const ORDER_FLOW = ['confirmed', 'processing', 'shipped', 'out_for_delivery', 'delivered'] as const satisfies readonly OrderStatus[];
export type PaidOrderStatus = (typeof ORDER_FLOW)[number];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending_payment: 'Pending payment',
  payment_expired: 'Payment expired',
  cancelled: 'Cancelled',
  confirmed: 'Order confirmed',
  processing: 'Processing',
  shipped: 'Shipped',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

export function nextStatus(status: OrderStatus): PaidOrderStatus | null {
  const i = ORDER_FLOW.indexOf(status as PaidOrderStatus);
  return i >= 0 && i < ORDER_FLOW.length - 1 ? ORDER_FLOW[i + 1]! : null;
}

/** Customers may cancel before the order ships (Q9). */
export const CANCELLABLE_STATUSES: readonly OrderStatus[] = ['confirmed', 'processing'];
/** Returns are accepted for 7 days after delivery (Q9). */
export const RETURN_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
/** Wrong delivery codes allowed before delivery is blocked until a new code is issued (Q16). */
export const DELIVERY_CODE_ATTEMPTS = 3;

export const CANCEL_REASONS = [
  { id: 'changed_mind', label: 'Changed my mind' },
  { id: 'found_cheaper', label: 'Found a better price' },
  { id: 'ordered_by_mistake', label: 'Ordered by mistake' },
  { id: 'delivery_too_slow', label: 'Delivery takes too long' },
  { id: 'other', label: 'Other' },
] as const;
export type CancelReason = (typeof CANCEL_REASONS)[number]['id'];

export const RETURN_REASONS = [
  { id: 'damaged', label: 'Damaged or defective' },
  { id: 'wrong_item', label: 'Wrong item received' },
  { id: 'size_fit', label: 'Size or fit issue' },
  { id: 'not_as_described', label: 'Not as described' },
  { id: 'not_needed', label: 'No longer needed' },
] as const;
export type ReturnReason = (typeof RETURN_REASONS)[number]['id'];

export const isCancelReason = (v: unknown): v is CancelReason => CANCEL_REASONS.some((r) => r.id === v);
export const isReturnReason = (v: unknown): v is ReturnReason => RETURN_REASONS.some((r) => r.id === v);

/**
 * Shares `amount` across lines in proportion to their totals, exact to the paisa (largest
 * remainder; ties go to the earlier line). The shares always add up to `amount`.
 */
export function allocatePaise(totals: number[], amount: number): number[] {
  const sum = totals.reduce((a, b) => a + b, 0);
  if (amount <= 0 || sum <= 0) return totals.map(() => 0);
  const shares = totals.map((t) => Math.floor((amount * t) / sum));
  const remainders = totals.map((t, i) => ({ i, r: (amount * t) % sum }));
  let left = amount - shares.reduce((a, b) => a + b, 0);
  for (const { i } of remainders.sort((a, b) => b.r - a.r || a.i - b.i)) {
    if (left <= 0) break;
    shares[i]! += 1;
    left -= 1;
  }
  return shares;
}

// ── API shapes ────────────────────────────────────────────────────────────────────────────

export type ReturnStatus = 'requested' | 'picked_up' | 'refunded';

export interface OrderReturn {
  id: string;
  status: ReturnStatus;
  lines: { orderLineId: number; reason: ReturnReason; refundPaise: number }[];
  refundPaise: number;
  createdAt: string;
  pickedUpAt: string | null;
  refundedAt: string | null;
}

export interface OrderRefund {
  id: string;
  /** null for a cancellation refund. */
  returnId: string | null;
  amountPaise: number;
  /** Where it goes, e.g. "Aurora Bank Visa •••• 4242". */
  label: string;
  status: 'initiated' | 'refunded';
  initiatedAt: string;
  refundedAt: string | null;
}

export interface OrderActions {
  canCancel: boolean;
  canReturn: boolean;
  /** Set once delivered. */
  returnWindowEndsAt: string | null;
}

export type ReturnState = 'none' | 'partial' | 'all';

/** A card in Your orders. */
export interface OrderSummary {
  id: string;
  status: OrderStatus;
  createdAt: string;
  deliveredAt: string | null;
  cancelledAt: string | null;
  estimate: { from: string; to: string };
  thumbnails: { title: string; thumbnailUrl: string }[];
  itemCount: number;
  paidPaise: number;
  /** Only while out for delivery. */
  deliveryCode: string | null;
  returnState: ReturnState;
}

export interface OrderList {
  orders: OrderSummary[];
  nextCursor: string | null;
}

/** What the demo operator sees: no address beyond the city, never the delivery code. */
export interface SimOrder {
  id: string;
  status: OrderStatus;
  createdAt: string;
  city: string;
  items: { title: string; size: string | null; option: string | null; quantity: number }[];
  paidPaise: number;
  nextStatus: PaidOrderStatus | null;
  deliveryAttemptsLeft: number | null;
  returns: { id: string; status: ReturnStatus; itemCount: number; refundPaise: number }[];
}
