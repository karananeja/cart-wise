import type { Request, Response } from 'express';
import { Router } from 'express';
import { addToCartSchema, updateCartLineSchema } from '@store/shared';
import { readCookie, setGuestCookie } from '../http/cookies.js';
import { HttpError } from '../http/errors.js';
import { CART_LIFETIME_DAYS, type CartService } from './service.js';

export const CART_COOKIE = 'cart_id';

function setCartCookie(res: Response, cartId: string) {
  setGuestCookie(res, CART_COOKIE, cartId, CART_LIFETIME_DAYS);
}

function parse<T>(schema: { safeParse: (v: unknown) => { success: true; data: T } | { success: false } }, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) throw new HttpError(400, 'BAD_REQUEST', 'Invalid request');
  return result.data;
}

function lineId(req: Request): number {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id < 1) throw new HttpError(404, 'LINE_NOT_FOUND', 'That item is no longer in your cart');
  return id;
}

export function cartRouter(carts: CartService): Router {
  const router = Router();

  router.get('/cart', (req, res) => {
    res.json(carts.view(readCookie(req, CART_COOKIE)));
  });

  router.post('/cart/lines', (req, res) => {
    const cartId = carts.add(readCookie(req, CART_COOKIE), parse(addToCartSchema, req.body));
    setCartCookie(res, cartId);
    res.json(carts.view(cartId));
  });

  router.patch('/cart/lines/:id', (req, res) => {
    const cartId = readCookie(req, CART_COOKIE);
    carts.update(cartId, lineId(req), parse(updateCartLineSchema, req.body).quantity);
    setCartCookie(res, cartId!);
    res.json(carts.view(cartId));
  });

  router.delete('/cart/lines/:id', (req, res) => {
    const cartId = readCookie(req, CART_COOKIE);
    carts.remove(cartId, lineId(req));
    setCartCookie(res, cartId!);
    res.json(carts.view(cartId));
  });

  return router;
}
