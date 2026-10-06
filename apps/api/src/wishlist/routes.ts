import { Router, type Request, type Response } from 'express';
import { setGuestCookie } from '../http/cookies.js';
import { currentUser, ownerFor, type Owner } from '../http/owner.js';
import { WISHLIST_LIFETIME_DAYS, type WishlistService } from './service.js';

export const WISHLIST_COOKIE = 'wishlist_id';

export function wishlistRouter(wishlists: WishlistService): Router {
  const router = Router();
  const owner = (req: Request, res: Response) => ownerFor(req, res, WISHLIST_COOKIE);
  /**
   * Guests keep their wishlist in a cookie; signed-in users' wishlists are found by account.
   * Returns the owner to read the updated wishlist for (a guest's first save creates it).
   */
  const remember = (res: Response, id: string | undefined): Owner => {
    const user = currentUser(res);
    if (user) return { userId: user.id };
    if (id) setGuestCookie(res, WISHLIST_COOKIE, id, WISHLIST_LIFETIME_DAYS);
    return { guestId: id };
  };

  router.get('/wishlist', (req, res) => {
    res.json(wishlists.view(owner(req, res)));
  });

  router.put('/wishlist/items/:slug', (req, res) => {
    res.json(wishlists.view(remember(res, wishlists.save(owner(req, res), req.params.slug))));
  });

  router.delete('/wishlist/items/:slug', (req, res) => {
    res.json(wishlists.view(remember(res, wishlists.remove(owner(req, res), req.params.slug))));
  });

  return router;
}
