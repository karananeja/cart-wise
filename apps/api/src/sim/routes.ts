import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import type { LoginLimiter } from '../auth/rateLimit.js';
import { readCookie } from '../http/cookies.js';
import { HttpError } from '../http/errors.js';
import type { OrderLifecycle } from '../orders/lifecycle.js';
import { OPERATOR_COOKIE, OPERATOR_SESSION_MS, type OperatorAccess } from './operator.js';

/**
 * Demo operator API (F-010, SIM-3, SIM-4). Separate from customer sessions: a signed-in
 * customer gets nothing here without the operator cookie.
 */
export function simRouter(access: OperatorAccess, lifecycle: OrderLifecycle, limiter: LoginLimiter): Router {
  const router = Router();

  router.get('/sim/session', (req, res) => {
    res.json({ signedIn: access.isSignedIn(readCookie(req, OPERATOR_COOKIE)) });
  });

  router.post('/sim/session', (req, res) => {
    const key = `operator:${req.ip ?? 'unknown'}`;
    const retryAfterSeconds = limiter.retryAfterSeconds(key);
    if (retryAfterSeconds > 0) throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Try again later.', { retryAfterSeconds });
    const password = (req.body as { password?: unknown } | undefined)?.password;
    if (typeof password !== 'string' || password.length > 200 || !access.passwordMatches(password)) {
      limiter.fail(key);
      throw new HttpError(401, 'WRONG_PASSWORD', 'That password is not right');
    }
    limiter.reset(key);
    res.cookie(OPERATOR_COOKIE, access.signIn(), { httpOnly: true, sameSite: 'lax', path: '/', maxAge: OPERATOR_SESSION_MS });
    res.json({ signedIn: true });
  });

  router.delete('/sim/session', (req, res) => {
    access.signOut(readCookie(req, OPERATOR_COOKIE));
    res.clearCookie(OPERATOR_COOKIE, { path: '/' });
    res.json({ signedIn: false });
  });

  const requireOperator: RequestHandler = (req, _res, next) => {
    if (!access.isSignedIn(readCookie(req, OPERATOR_COOKIE))) throw new HttpError(401, 'OPERATOR_REQUIRED', 'Operator sign-in required');
    next();
  };
  router.use('/sim', requireOperator);

  const id = (value: unknown) => String(value);

  router.get('/sim/orders', (_req, res) => {
    res.json({ orders: lifecycle.simList() });
  });
  router.post('/sim/orders/:id/advance', (req, res) => {
    res.json({ order: lifecycle.advance(id(req.params.id)) });
  });
  router.post('/sim/orders/:id/deliver', (req, res) => {
    const parsed = z.object({ code: z.string().regex(/^\d{4}$/) }).safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'BAD_REQUEST', 'Enter the 4-digit delivery code');
    res.json({ order: lifecycle.deliver(id(req.params.id), parsed.data.code) });
  });
  router.post('/sim/orders/:id/delivery-code', (req, res) => {
    res.json({ order: lifecycle.issueCode(id(req.params.id)) });
  });
  router.post('/sim/returns/:id/pickup', (req, res) => {
    res.json({ order: lifecycle.pickUp(id(req.params.id)) });
  });
  router.post('/sim/returns/:id/refund', (req, res) => {
    res.json({ order: lifecycle.completeRefund(id(req.params.id)) });
  });

  return router;
}
