import { Router } from 'express';
import { VIEWED_MAX } from '@store/shared';
import type { CartService } from '../cart/service.js';
import { CART_COOKIE } from '../cart/routes.js';
import { currentUser, ownerFor } from '../http/owner.js';
import type { RecommendationService } from './service.js';

const SLUG = /^[a-z0-9-]{1,200}$/;

/** Product discovery (F-012). Read-only; suggestions never include another customer's data. */
export function recommendationRouter(recommendations: RecommendationService, carts: CartService): Router {
  const router = Router();
  const cartProductIds = (req: Parameters<typeof ownerFor>[0], res: Parameters<typeof ownerFor>[1]) =>
    carts.view(ownerFor(req, res, CART_COOKIE)).lines.map((l) => l.product.id);

  router.get('/products/:slug/recommendations', (req, res) => {
    res.json(recommendations.forProduct(String(req.params.slug)));
  });

  router.get('/recommendations/home', (req, res) => {
    const viewed = (typeof req.query.viewed === 'string' ? req.query.viewed.split(',') : [])
      .filter((slug) => SLUG.test(slug))
      .slice(0, VIEWED_MAX);
    res.json(recommendations.forHome(viewed, currentUser(res)?.id ?? null, cartProductIds(req, res)));
  });

  router.get('/cart/recommendations', (req, res) => {
    res.json(recommendations.forCart(cartProductIds(req, res)));
  });

  return router;
}
