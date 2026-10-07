import {
  amountInWords,
  CANCEL_REASONS,
  DELIVERY_GST_RATE,
  findOffer,
  formatPrice,
  gstRate,
  invoiceNumber,
  isIntraState,
  NO_COST_EMI_OFFER_ID,
  RETURN_REASONS,
  SELLER,
  splitInclusive,
  type GstSplit,
  type Order,
  type OrderPayment,
} from '@store/shared';

/** Everything the invoice PDF draws (F-019). Tests assert on this; the renderer only lays it out. */
export interface InvoiceData {
  title: string;
  demoNote: string;
  number: string;
  /** ISO: when the order was paid. */
  invoiceDate: string;
  orderId: string;
  orderDate: string;
  seller: typeof SELLER;
  billTo: { name: string; lines: string[]; state: string; pincode: string };
  /** CGST + SGST within the seller's state, IGST otherwise. */
  supply: 'intra' | 'inter';
  lines: InvoiceLine[];
  totals: {
    itemsPaise: number;
    deliveryPaise: number;
    taxablePaise: number;
    taxPaise: number;
    cgstPaise: number;
    sgstPaise: number;
    igstPaise: number;
    totalPaise: number;
  };
  amountInWords: string;
  payment: {
    label: string;
    emi: string | null;
    discounts: { label: string; amountPaise: number }[];
    paidPaise: number;
    note: string;
  };
  /** "Cancelled — refunded" (or "— refund in progress") when the paid order was cancelled. */
  banner: string | null;
  refunds: { date: string; what: string; to: string; amountPaise: number; status: string }[];
}

export interface InvoiceLine extends GstSplit {
  kind: 'item' | 'delivery';
  description: string;
  quantity: number;
  unitPricePaise: number;
}

export const INVOICE_TITLE = 'Tax Invoice (demo)';
export const INVOICE_DEMO_NOTE = 'Not a valid tax document. Demo store.';
export const PAYMENT_DISCOUNT_NOTE = "Payment discounts are applied at payment and don't change the tax on items (demo simplification).";

function discountLabel(payment: OrderPayment): string {
  if (payment.offerId === NO_COST_EMI_OFFER_ID) return 'No Cost EMI discount';
  if (payment.provider === 'razorpay') return 'Razorpay offer';
  const offer = findOffer(payment.offerId);
  return offer ? `Bank offer · ${offer.bankName} ${offer.headline}` : 'Bank offer';
}

function emiText(emi: NonNullable<OrderPayment['emi']>): string {
  const last = Math.abs(emi.lastMonthlyPaise - emi.monthlyPaise) >= 100 ? ` (last ${formatPrice(emi.lastMonthlyPaise)})` : '';
  const cost = emi.noCost ? 'No Cost EMI, no interest' : `${formatPrice(emi.interestPaise)} interest to the bank`;
  return `EMI ${emi.tenure} × ${formatPrice(emi.monthlyPaise)}/month${last} · ${cost}`;
}

const reasonLabel = (list: readonly { id: string; label: string }[], id: string | null) => list.find((r) => r.id === id)?.label;

/**
 * The invoice for a paid order. `categories` maps product ids to category slugs (for the rate);
 * a missing category gets the default rate. Lines and totals are the original sale, whatever was
 * refunded later (spec FR-8).
 */
export function buildInvoice(order: Order, categories: ReadonlyMap<number, string | null>): InvoiceData {
  const payment = order.payment;
  if (!payment) throw new Error(`Order ${order.id} has not been paid`);
  const intra = isIntraState(order.address.state);

  const lines: InvoiceLine[] = order.lines.map((line) => {
    const detail = [line.size && `Size ${line.size}`, line.option].filter(Boolean).join(', ');
    const rate = gstRate(categories.get(line.productId), line.unitPricePaise);
    return {
      kind: 'item',
      description: detail ? `${line.title} (${detail})` : line.title,
      quantity: line.quantity,
      unitPricePaise: line.unitPricePaise,
      ...splitInclusive(line.unitPricePaise * line.quantity, rate, intra),
    };
  });
  if (order.totals.deliveryPaise > 0) {
    lines.push({
      kind: 'delivery',
      description: `Delivery charge (${order.delivery.label})`,
      quantity: 1,
      unitPricePaise: order.totals.deliveryPaise,
      ...splitInclusive(order.totals.deliveryPaise, DELIVERY_GST_RATE, intra),
    });
  }

  const sum = (key: keyof GstSplit) => lines.reduce((total, l) => total + l[key], 0);
  const itemsPaise = lines.filter((l) => l.kind === 'item').reduce((total, l) => total + l.amountPaise, 0);
  const totalPaise = sum('amountPaise');

  const titleOf = new Map(order.lines.map((l) => [l.id, l.title]));
  const refunds = order.refunds.map((refund) => {
    const ret = refund.returnId ? order.returns.find((r) => r.id === refund.returnId) : undefined;
    const what = ret
      ? `Return: ${ret.lines.map((l) => `${titleOf.get(l.orderLineId) ?? 'Item'} (${reasonLabel(RETURN_REASONS, l.reason) ?? 'returned'})`).join('; ')}`
      : `Order cancelled${reasonLabel(CANCEL_REASONS, order.cancelReason) ? ` (${reasonLabel(CANCEL_REASONS, order.cancelReason)})` : ''}`;
    return {
      date: refund.refundedAt ?? refund.initiatedAt,
      what,
      to: refund.label,
      amountPaise: refund.amountPaise,
      status: refund.status === 'refunded' ? 'Refunded' : 'Initiated',
    };
  });

  const { fullName, line1, line2, landmark, city, state, pincode } = order.address;
  return {
    title: INVOICE_TITLE,
    demoNote: INVOICE_DEMO_NOTE,
    number: invoiceNumber(order.id),
    invoiceDate: payment.paidAt,
    orderId: order.id,
    orderDate: order.createdAt,
    seller: SELLER,
    billTo: { name: fullName, lines: [line1, line2, landmark && `Landmark: ${landmark}`, `${city}, ${state} ${pincode}`].filter(Boolean), state, pincode },
    supply: intra ? 'intra' : 'inter',
    lines,
    totals: {
      itemsPaise,
      deliveryPaise: order.totals.deliveryPaise,
      taxablePaise: sum('taxablePaise'),
      taxPaise: sum('taxPaise'),
      cgstPaise: sum('cgstPaise'),
      sgstPaise: sum('sgstPaise'),
      igstPaise: sum('igstPaise'),
      totalPaise,
    },
    amountInWords: amountInWords(totalPaise),
    payment: {
      label: payment.label,
      emi: payment.emi ? emiText(payment.emi) : null,
      discounts: payment.offerDiscountPaise > 0 ? [{ label: discountLabel(payment), amountPaise: payment.offerDiscountPaise }] : [],
      paidPaise: payment.paidPaise,
      note: PAYMENT_DISCOUNT_NOTE,
    },
    // A Razorpay refund can still be on its way (or waiting for Retry); only say "refunded" once it is.
    banner: order.status !== 'cancelled' ? null : order.refunds.every((r) => r.status === 'refunded') ? 'Cancelled — refunded' : 'Cancelled — refund in progress',
    refunds,
  };
}
