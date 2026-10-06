import type { Address } from './address.js';
import type { CartView } from './cart.js';
import type { OrderActions, OrderRefund, OrderReturn, ReturnState } from './orders.js';
import type { OrderPayment } from './payment.js';

/** Delivery rules (user decision Q8, 2026-10-06). */
export const FREE_DELIVERY_THRESHOLD_PAISE = 999_00;
export const DELIVERY_OPTIONS = ['standard', 'express'] as const;
export type DeliveryOption = (typeof DELIVERY_OPTIONS)[number];

const RULES: Record<DeliveryOption, { label: string; minDays: number; maxDays: number; pricePaise: number }> = {
  standard: { label: 'Standard', minDays: 3, maxDays: 5, pricePaise: 49_00 },
  express: { label: 'Express', minDays: 1, maxDays: 2, pricePaise: 149_00 },
};

/** Stock is held for 10 minutes once payment starts (user decision Q10). */
export const PAYMENT_HOLD_MS = 10 * 60 * 1000;

export interface DeliveryQuote {
  option: DeliveryOption;
  label: string;
  pricePaise: number;
  /** ISO dates (yyyy-mm-dd) of the estimated arrival window. */
  estimate: { from: string; to: string };
  /** Standard only: how much more to spend for free delivery (0 when already free). */
  freeDeliveryShortfallPaise?: number;
}

const isoDate = (base: Date, days: number) => {
  const d = new Date(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export function deliveryOptions(subtotalPaise: number, now: Date): DeliveryQuote[] {
  return DELIVERY_OPTIONS.map((option) => {
    const rule = RULES[option];
    const free = option === 'standard' && subtotalPaise >= FREE_DELIVERY_THRESHOLD_PAISE;
    return {
      option,
      label: rule.label,
      pricePaise: free ? 0 : rule.pricePaise,
      estimate: { from: isoDate(now, rule.minDays), to: isoDate(now, rule.maxDays) },
      ...(option === 'standard' ? { freeDeliveryShortfallPaise: Math.max(0, FREE_DELIVERY_THRESHOLD_PAISE - subtotalPaise) } : {}),
    };
  });
}

export function isDeliveryOption(value: unknown): value is DeliveryOption {
  return DELIVERY_OPTIONS.includes(value as DeliveryOption);
}

export interface CheckoutTotals {
  itemCount: number;
  mrpPaise: number;
  discountPaise: number;
  deliveryPaise: number;
  totalPaise: number;
}

export type CheckoutBlocker = 'EMPTY_CART' | 'CART_ISSUES' | 'NO_ADDRESS';

export interface CheckoutQuote {
  cart: CartView;
  /** The chosen address (or the default), or null when the customer has none. */
  address: Address | null;
  delivery: DeliveryQuote[];
  selectedDelivery: DeliveryOption;
  totals: CheckoutTotals;
  blockers: CheckoutBlocker[];
}

export type OrderStatus =
  | 'pending_payment'
  | 'payment_expired'
  | 'cancelled'
  | 'confirmed'
  | 'processing'
  | 'shipped'
  | 'out_for_delivery'
  | 'delivered';

/** Lifecycle steps recorded with their time (F-009: payment and confirmation; F-010: the rest). */
export type OrderHistoryStatus = 'payment_successful' | 'confirmed' | 'processing' | 'shipped' | 'out_for_delivery' | 'delivered' | 'cancelled';

export interface OrderLine {
  /** Order line id, used to choose items to return (F-010). */
  id: number;
  productId: number;
  slug: string;
  title: string;
  size: string | null;
  thumbnailUrl: string;
  quantity: number;
  unitPricePaise: number;
  unitMrpPaise: number;
}

export interface Order {
  id: string;
  status: OrderStatus;
  lines: OrderLine[];
  address: Omit<Address, 'id' | 'isDefault' | 'createdAt'>;
  delivery: DeliveryQuote;
  totals: CheckoutTotals;
  createdAt: string;
  /** When the payment hold ends (pending orders). */
  holdExpiresAt: string;
  /** Set once paid (F-009). */
  payment: OrderPayment | null;
  history: { status: OrderHistoryStatus; at: string }[];
  /** F-010 */
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  returns: OrderReturn[];
  refunds: OrderRefund[];
  /** The owner's delivery code, only while out for delivery. */
  deliveryCode: string | null;
  actions: OrderActions;
  returnState: ReturnState;
}
