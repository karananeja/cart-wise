import { Router } from 'express';
import { readCookie, setGuestCookie } from '../http/cookies.js';
import { WISHLIST_LIFETIME_DAYS, type WishlistService } from './service.js';

export const WISHLIST_COOKIE = 'wishlist_id';

export function wishlistRouter(wishlists: WishlistService): Router {
  const router = Router();

  router.get('/wishlist', (req, res) => {
    res.json(wishlists.view(readCookie(req, WISHLIST_COOKIE)));
  });

  router.put('/wishlist/items/:slug', (req, res) => {
    const id = wishlists.save(readCookie(req, WISHLIST_COOKIE), req.params.slug);
    setGuestCookie(res, WISHLIST_COOKIE, id, WISHLIST_LIFETIME_DAYS);
    res.json(wishlists.view(id));
  });

  router.delete('/wishlist/items/:slug', (req, res) => {
    const id = readCookie(req, WISHLIST_COOKIE);
    wishlists.remove(id, req.params.slug);
    if (id) setGuestCookie(res, WISHLIST_COOKIE, id, WISHLIST_LIFETIME_DAYS);
    res.json(wishlists.view(id));
  });

  return router;
}
