import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Razorpay Standard Checkout, test mode only (F-014, ADR-005). Every call goes through this small
 * client with an injected fetch, so tests never reach Razorpay. The key secret stays here: it is
 * never sent to the browser, logged, or put in an error.
 */
export interface RazorpayConfig {
  keyId: string;
  keySecret: string;
  webhookSecret: string | null;
  /** A No Cost EMI offer created in the Razorpay Dashboard, attached to every order. */
  noCostEmiOfferId: string | null;
  baseUrl: string;
}

export type RazorpaySetup = { enabled: true; config: RazorpayConfig } | { enabled: false; error?: string };

const DEFAULT_BASE_URL = 'https://api.razorpay.com';

/** Reads the environment. Live keys are refused: no real money, ever (ADR-005). */
export function loadRazorpayConfig(env: Record<string, string | undefined>): RazorpaySetup {
  const keyId = env.RAZORPAY_KEY_ID?.trim();
  const keySecret = env.RAZORPAY_KEY_SECRET?.trim();
  if (!keyId && !keySecret) return { enabled: false };
  if (!keyId || !keySecret) return { enabled: false, error: 'Razorpay is off: set both RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.' };
  if (keyId.startsWith('rzp_live_')) {
    return { enabled: false, error: 'Razorpay is off: live keys (rzp_live_…) are refused. This store only takes test-mode payments (ADR-005).' };
  }
  if (!keyId.startsWith('rzp_test_')) return { enabled: false, error: 'Razorpay is off: RAZORPAY_KEY_ID should start with rzp_test_.' };
  // Only the local fake used by E2E may replace Razorpay's address.
  const override = env.RAZORPAY_API_BASE_URL?.trim();
  if (override && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(override)) {
    return { enabled: false, error: 'Razorpay is off: RAZORPAY_API_BASE_URL may only point at localhost.' };
  }
  return {
    enabled: true,
    config: {
      keyId,
      keySecret,
      webhookSecret: env.RAZORPAY_WEBHOOK_SECRET?.trim() || null,
      noCostEmiOfferId: env.RAZORPAY_NO_COST_EMI_OFFER_ID?.trim() || null,
      baseUrl: override || DEFAULT_BASE_URL,
    },
  };
}

/** The parts of Razorpay's payment entity we read. */
export interface RazorpayPayment {
  id: string;
  order_id: string | null;
  amount: number;
  currency: string;
  status: 'created' | 'authorized' | 'captured' | 'refunded' | 'failed';
  method: string;
  offer_id?: string | null;
  vpa?: string | null;
  bank?: string | null;
  wallet?: string | null;
  card?: { last4?: string; network?: string } | null;
}

export interface RazorpayRefund {
  id: string;
  amount: number;
  receipt?: string | null;
  status: string;
}

export class GatewayError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'GatewayError';
  }
}

const TIMEOUT_MS = 10_000;

export function createRazorpayClient(config: RazorpayConfig, fetchImpl: typeof fetch = fetch) {
  const auth = `Basic ${Buffer.from(`${config.keyId}:${config.keySecret}`).toString('base64')}`;

  async function call<T>(method: 'GET' | 'POST', path: string, body?: object): Promise<T> {
    let res: Response;
    try {
      res = await fetchImpl(`${config.baseUrl}/v1${path}`, {
        method,
        headers: { Authorization: auth, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new GatewayError('Razorpay could not be reached');
    }
    const json = (await res.json().catch(() => ({}))) as T & { error?: { description?: string } };
    // Razorpay's own description, kept for logs and the operator; customers see fixed messages.
    if (!res.ok) throw new GatewayError(json.error?.description ?? `Razorpay answered ${res.status}`, res.status);
    return json;
  }

  return {
    keyId: config.keyId,
    createOrder: (input: { amountPaise: number; receipt: string; notes: Record<string, string> }) =>
      call<{ id: string; amount: number; status: string }>('POST', '/orders', {
        amount: input.amountPaise,
        currency: 'INR',
        receipt: input.receipt,
        notes: input.notes,
        ...(config.noCostEmiOfferId ? { offers: [config.noCostEmiOfferId] } : {}),
      }),
    fetchPayment: (paymentId: string) => call<RazorpayPayment>('GET', `/payments/${encodeURIComponent(paymentId)}`),
    orderPayments: (orderId: string) => call<{ items: RazorpayPayment[] }>('GET', `/orders/${encodeURIComponent(orderId)}/payments`).then((r) => r.items ?? []),
    capture: (paymentId: string, amountPaise: number) =>
      call<RazorpayPayment>('POST', `/payments/${encodeURIComponent(paymentId)}/capture`, { amount: amountPaise, currency: 'INR' }),
    refund: (paymentId: string, amountPaise: number, receipt: string) =>
      call<RazorpayRefund>('POST', `/payments/${encodeURIComponent(paymentId)}/refund`, { amount: amountPaise, receipt, speed: 'normal' }),
    refundsOf: (paymentId: string) => call<{ items: RazorpayRefund[] }>('GET', `/payments/${encodeURIComponent(paymentId)}/refunds`).then((r) => r.items ?? []),

    /** Checkout's success response: HMAC-SHA256 of `order_id|payment_id` with the key secret. */
    verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
      return safeEqualHex(createHmac('sha256', config.keySecret).update(`${orderId}|${paymentId}`).digest('hex'), signature);
    },
    /** Webhooks: HMAC-SHA256 of the raw body with the webhook secret. */
    verifyWebhookSignature(rawBody: Buffer, signature: string): boolean {
      if (!config.webhookSecret) return false;
      return safeEqualHex(createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex'), signature);
    },
    webhooksEnabled: config.webhookSecret !== null,
  };
}

function safeEqualHex(expected: string, actual: string): boolean {
  const a = Buffer.from(expected);
  const b = Buffer.from(actual);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type RazorpayClient = ReturnType<typeof createRazorpayClient>;

const NETWORKS: Record<string, string> = { Visa: 'Visa', MasterCard: 'Mastercard', RuPay: 'RuPay', 'American Express': 'American Express', Amex: 'American Express' };

/** "Razorpay · Visa •••• 1111", "Razorpay · UPI success@razorpay", "Razorpay · EMI · Visa •••• 1007". */
export function razorpayLabel(payment: RazorpayPayment): string {
  const card = payment.card?.last4 ? `${NETWORKS[payment.card.network ?? ''] ?? payment.card.network ?? 'Card'} •••• ${payment.card.last4}` : 'Card';
  switch (payment.method) {
    case 'card':
      return `Razorpay · ${card}`;
    case 'emi':
      return `Razorpay · EMI · ${card}`;
    case 'upi':
      return `Razorpay · UPI${payment.vpa ? ` ${payment.vpa}` : ''}`;
    case 'netbanking':
      return `Razorpay · Netbanking${payment.bank ? ` ${payment.bank}` : ''}`;
    case 'wallet':
      return `Razorpay · Wallet${payment.wallet ? ` ${payment.wallet}` : ''}`;
    default:
      return 'Razorpay';
  }
}
