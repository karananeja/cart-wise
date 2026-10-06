import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { OFFERS, type PaymentConfig, type PaymentInput } from '@store/shared';
import { HttpError } from '../http/errors.js';
import { currentUser } from '../http/owner.js';
import type { PaymentService } from './service.js';

function requireUserId(res: Response): number {
  const user = currentUser(res);
  if (!user) throw new HttpError(401, 'SIGNED_OUT', 'Please sign in');
  return user.id;
}

const visitorId = z.string().min(8).max(64).optional();

/**
 * Strict: unknown keys are refused, so a body carrying a full card number, expiry or CVV is
 * rejected rather than read (spec FR-12).
 */
const paymentInput = z.discriminatedUnion('method', [
  z.strictObject({
    method: z.literal('card'),
    bin: z.string().regex(/^\d{6}$/),
    last4: z.string().regex(/^\d{4}$/),
    offerId: z.string().max(64).optional(),
    emi: z.strictObject({ tenure: z.number().int().min(1).max(24), noCost: z.boolean() }).optional(),
    visitorId,
  }),
  z.strictObject({ method: z.literal('upi_id'), upiId: z.string().max(330), visitorId }),
  z.strictObject({ method: z.literal('upi_qr'), visitorId }),
  z.strictObject({ method: z.literal('razorpay'), visitorId }),
]);

const razorpayResponse = z.object({
  razorpayPaymentId: z.string().regex(/^pay_\w{1,40}$/),
  razorpayOrderId: z.string().regex(/^order_\w{1,40}$/),
  razorpaySignature: z.string().regex(/^[a-f0-9]{64}$/),
});

function parse<T>(schema: z.ZodType<T>, body: unknown, code: string, message: string): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new HttpError(400, code, message);
  return parsed.data;
}

const param = (req: Request) => String(req.params.id);

export function paymentRouter(payments: PaymentService, razorpayKeyId: string | null): Router {
  const router = Router();

  router.get('/payments/config', (_req, res) => {
    const config: PaymentConfig = { razorpay: { enabled: payments.razorpayEnabled, keyId: razorpayKeyId, testMode: true } };
    res.json(config);
  });

  // Razorpay webhooks (F-014): signed by Razorpay, no session. Registered before `/payments/:id`.
  router.post('/payments/razorpay/webhook', async (req, res) => {
    await payments.webhook((req as Request & { rawBody?: Buffer }).rawBody, req.get('x-razorpay-signature'));
    res.json({ ok: true });
  });

  router.get('/offers', (_req, res) => {
    res.json({ offers: OFFERS });
  });

  router.get('/orders/:id/payment-quote', (req, res) => {
    const offerId = typeof req.query.offerId === 'string' && req.query.offerId ? req.query.offerId : undefined;
    const bin = typeof req.query.bin === 'string' ? req.query.bin : undefined;
    res.json(payments.quote(requireUserId(res), param(req), { offerId, bin }));
  });

  router.post('/orders/:id/payments', async (req, res) => {
    const userId = requireUserId(res);
    const body = (req.body ?? {}) as { method?: unknown };
    const code = body.method === 'card' ? 'INVALID_CARD' : 'BAD_REQUEST';
    const input = parse(paymentInput, req.body, code, 'Check your payment details') as PaymentInput;
    const attempt = input.method === 'razorpay' ? await payments.startRazorpay(userId, param(req), input.visitorId) : payments.start(userId, param(req), input);
    res.status(201).json({ attempt });
  });

  router.get('/payments/:id', async (req, res) => {
    res.json(await payments.getLive(requireUserId(res), param(req)));
  });

  router.post('/payments/:id/razorpay/verify', async (req, res) => {
    const userId = requireUserId(res);
    const body = parse(razorpayResponse, req.body, 'GATEWAY_SIGNATURE_INVALID', "We couldn't confirm this payment");
    res.json(await payments.verifyRazorpay(userId, param(req), { paymentId: body.razorpayPaymentId, orderId: body.razorpayOrderId, signature: body.razorpaySignature }));
  });

  router.post('/payments/:id/verify', (req, res) => {
    const userId = requireUserId(res);
    const { otp } = parse(z.object({ otp: z.string().regex(/^\d{6}$/) }), req.body, 'INVALID_CODE', 'Enter the 6-digit code');
    res.json(payments.verifyOtp(userId, param(req), otp));
  });

  router.post('/payments/:id/upi-response', (req, res) => {
    const userId = requireUserId(res);
    const { approve } = parse(z.object({ approve: z.boolean() }), req.body, 'BAD_REQUEST', 'Approve or decline');
    res.json(payments.respondUpi(userId, param(req), approve));
  });

  router.post('/payments/:id/cancel', async (req, res) => {
    res.json({ attempt: await payments.cancelLive(requireUserId(res), param(req)) });
  });

  return router;
}
