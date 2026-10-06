import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import { GatewayError, type RazorpayClient } from './razorpay.js';

interface RefundRow {
  id: string;
  order_id: string;
  amount_paise: number;
  status: 'initiated' | 'refunded';
  gateway_refund_id: string | null;
  payment_provider: string | null;
  gateway_payment_id: string | null;
}

/**
 * Refunds of Razorpay orders go back through Razorpay in test mode (F-014 D3). A refund is marked
 * refunded only once Razorpay has accepted it; until then it stays initiated with the reason, for
 * the operator to retry. Our refund id is Razorpay's receipt, so a retry never refunds twice.
 */
export function createGatewayRefunds({ db, razorpay, clock = Date.now, log = console.error }: { db: Db; razorpay?: RazorpayClient; clock?: () => number; log?: (m: string) => void }) {
  const find = db.prepare(`
    SELECT r.id, r.order_id, r.amount_paise, r.status, r.gateway_refund_id, o.payment_provider, o.gateway_payment_id
    FROM refunds r JOIN orders o ON o.id = r.order_id WHERE r.id = ?`);
  const forReturn = db.prepare('SELECT id FROM refunds WHERE return_id = ?');
  const cancellationRefund = db.prepare('SELECT id FROM refunds WHERE order_id = ? AND return_id IS NULL ORDER BY initiated_at DESC LIMIT 1');
  const markRefunded = db.prepare(`
    UPDATE refunds SET status = 'refunded', refunded_at = ?, gateway_refund_id = ?, failure = NULL WHERE id = ? AND status = 'initiated'`);
  const markFailed = db.prepare('UPDATE refunds SET failure = ? WHERE id = ?');
  const isRazorpayOrder = db.prepare("SELECT 1 FROM orders WHERE id = ? AND payment_provider = 'razorpay'");

  async function process(refundId: string): Promise<void> {
    const row = find.get(refundId) as RefundRow | undefined;
    if (!row) throw new HttpError(404, 'REFUND_NOT_FOUND', 'Refund not found');
    if (row.payment_provider !== 'razorpay' || row.status === 'refunded') return;
    try {
      if (!razorpay || !row.gateway_payment_id) throw new GatewayError('Razorpay is not configured');
      const existing = (await razorpay.refundsOf(row.gateway_payment_id)).find((r) => r.receipt === row.id);
      const refund = existing ?? (await razorpay.refund(row.gateway_payment_id, row.amount_paise, row.id));
      markRefunded.run(new Date(clock()).toISOString(), refund.id, row.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      markFailed.run(message.slice(0, 200), row.id);
      log(`Razorpay refund ${row.id} for ${row.order_id} failed: ${message}`);
      throw new HttpError(502, 'GATEWAY_UNAVAILABLE', 'Razorpay could not take the refund right now. Try again.');
    }
  }

  const orderOfRefund = db.prepare('SELECT order_id FROM refunds WHERE id = ?');

  return {
    process,
    orderOf: (refundId: string) => (orderOfRefund.get(refundId) as { order_id: string }).order_id,
    isRazorpayOrder: (orderId: string) => isRazorpayOrder.get(orderId) !== undefined,
    /** The return's refund, before the operator marks the return refunded. */
    async forReturn(returnId: string) {
      const row = forReturn.get(returnId) as { id: string } | undefined;
      if (row) await process(row.id);
    },
    /** A cancellation's refund. Failures are kept on the refund (shown to the operator), not thrown. */
    async afterCancel(orderId: string) {
      const row = cancellationRefund.get(orderId) as { id: string } | undefined;
      if (row) await process(row.id).catch(() => undefined);
    },
  };
}

export type GatewayRefunds = ReturnType<typeof createGatewayRefunds>;
