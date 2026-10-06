import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { isCancelReason, isDeliveryOption, RETURN_REASONS, type ReturnReason } from '@store/shared';
import { HttpError } from '../http/errors.js';
import { currentUser } from '../http/owner.js';
import type { OrderLifecycle } from './lifecycle.js';
import type { OrderService } from './service.js';

function requireUserId(res: Response): number {
  const user = currentUser(res);
  if (!user) throw new HttpError(401, 'SIGNED_OUT', 'Please sign in');
  return user.id;
}

function addressIdFrom(value: unknown): number | undefined {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : undefined;
}

const orderId = (req: Request) => String(req.params.id);

const returnBody = z.object({
  lines: z
    .array(z.object({ orderLineId: z.number().int().positive(), reason: z.enum(RETURN_REASONS.map((r) => r.id) as [ReturnReason, ...ReturnReason[]]) }))
    .min(1)
    .max(100),
});

export function orderRouter(orders: OrderService, lifecycle: OrderLifecycle): Router {
  const router = Router();

  router.get('/checkout', (req, res) => {
    const delivery = isDeliveryOption(req.query.delivery) ? req.query.delivery : 'standard';
    res.json(orders.quote(requireUserId(res), addressIdFrom(req.query.addressId), delivery));
  });

  router.post('/orders', (req, res) => {
    const userId = requireUserId(res);
    const body = (req.body ?? {}) as { addressId?: unknown; delivery?: unknown };
    if (!isDeliveryOption(body.delivery)) throw new HttpError(400, 'BAD_REQUEST', 'Choose a delivery option');
    res.status(201).json({ order: orders.create(userId, addressIdFrom(body.addressId), body.delivery) });
  });

  router.get('/orders', (req, res) => {
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    res.json(lifecycle.list(requireUserId(res), cursor));
  });

  router.get('/orders/:id', (req, res) => {
    res.json({ order: orders.get(requireUserId(res), orderId(req)) });
  });

  /** Unpaid holds (F-008) and paid orders before shipping (F-010) share the cancel route. */
  router.post('/orders/:id/cancel', (req, res) => {
    const userId = requireUserId(res);
    const current = orders.get(userId, orderId(req));
    if (current.status === 'pending_payment') {
      res.json({ order: orders.cancel(userId, current.id) });
      return;
    }
    const body = (req.body ?? {}) as { reason?: unknown; visitorId?: unknown };
    const reason = isCancelReason(body.reason) ? body.reason : null;
    const visitorId = typeof body.visitorId === 'string' && body.visitorId.length <= 64 ? body.visitorId : `user-${userId}`;
    res.json({ order: lifecycle.cancelPaid(userId, current.id, reason, visitorId) });
  });

  router.post('/orders/:id/returns', (req, res) => {
    const userId = requireUserId(res);
    const parsed = returnBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'BAD_REQUEST', 'Choose items from this order and a reason for each');
    res.status(201).json({ order: lifecycle.requestReturn(userId, orderId(req), parsed.data.lines) });
  });

  return router;
}
