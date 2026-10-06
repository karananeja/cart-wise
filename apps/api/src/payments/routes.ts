import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { OFFERS, type PaymentInput } from '@store/shared';
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
  z.strictObject({ method: z.literal('card'), bin: z.string().regex(/^\d{6}$/), last4: z.string().regex(/^\d{4}$/), offerId: z.string().max(64).optional(), visitorId }),
  z.strictObject({ method: z.literal('upi_id'), upiId: z.string().max(330), visitorId }),
  z.strictObject({ method: z.literal('upi_qr'), visitorId }),
]);

function parse<T>(schema: z.ZodType<T>, body: unknown, code: string, message: string): T {
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) throw new HttpError(400, code, message);
  return parsed.data;
}

const param = (req: Request) => String(req.params.id);

export function paymentRouter(payments: PaymentService): Router {
  const router = Router();

  router.get('/offers', (_req, res) => {
    res.json({ offers: OFFERS });
  });

  router.get('/orders/:id/payment-quote', (req, res) => {
    const offerId = typeof req.query.offerId === 'string' && req.query.offerId ? req.query.offerId : undefined;
    const bin = typeof req.query.bin === 'string' ? req.query.bin : undefined;
    res.json(payments.quote(requireUserId(res), param(req), { offerId, bin }));
  });

  router.post('/orders/:id/payments', (req, res) => {
    const userId = requireUserId(res);
    const body = (req.body ?? {}) as { method?: unknown };
    const code = body.method === 'card' ? 'INVALID_CARD' : 'BAD_REQUEST';
    const input = parse(paymentInput, req.body, code, 'Check your payment details') as PaymentInput;
    res.status(201).json({ attempt: payments.start(userId, param(req), input) });
  });

  router.get('/payments/:id', (req, res) => {
    res.json(payments.get(requireUserId(res), param(req)));
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

  router.post('/payments/:id/cancel', (req, res) => {
    res.json({ attempt: payments.cancel(requireUserId(res), param(req)) });
  });

  return router;
}
