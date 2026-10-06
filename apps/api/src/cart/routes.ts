import type { Request, Response } from 'express';
import { Router } from 'express';
import { addToCartSchema, updateCartLineSchema } from '@store/shared';
import { setGuestCookie } from '../http/cookies.js';
import { HttpError } from '../http/errors.js';
import { currentUser, ownerFor, type Owner } from '../http/owner.js';
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
  const owner = (req: Request, res: Response) => ownerFor(req, res, CART_COOKIE);
  /**
   * Guests keep their cart in a cookie; signed-in users' carts are found by account. Returns
   * the owner to read the updated cart for (a guest's first add creates the cart).
   */
  const remember = (res: Response, cartId: string): Owner => {
    if (currentUser(res)) return { userId: currentUser(res)!.id };
    setCartCookie(res, cartId);
    return { guestId: cartId };
  };

  router.get('/cart', (req, res) => {
    res.json(carts.view(owner(req, res)));
  });

  router.post('/cart/lines', (req, res) => {
    res.json(carts.view(remember(res, carts.add(owner(req, res), parse(addToCartSchema, req.body)))));
  });

  router.patch('/cart/lines/:id', (req, res) => {
    res.json(carts.view(remember(res, carts.update(owner(req, res), lineId(req), parse(updateCartLineSchema, req.body).quantity))));
  });

  router.delete('/cart/lines/:id', (req, res) => {
    res.json(carts.view(remember(res, carts.remove(owner(req, res), lineId(req)))));
  });

  return router;
}
