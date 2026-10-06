import { Router, type Request, type Response } from 'express';
import { isDeliveryOption } from '@store/shared';
import { HttpError } from '../http/errors.js';
import { currentUser } from '../http/owner.js';
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

export function orderRouter(orders: OrderService): Router {
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

  router.get('/orders/:id', (req, res) => {
    res.json({ order: orders.get(requireUserId(res), orderId(req)) });
  });

  router.post('/orders/:id/cancel', (req, res) => {
    res.json({ order: orders.cancel(requireUserId(res), orderId(req)) });
  });

  return router;
}
