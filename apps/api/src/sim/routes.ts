import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { INVENTORY_FILTERS, MAX_ON_HAND, SIM_INTERVALS, type InventoryFilter, type SimAutomation } from '@store/shared';
import type { LoginLimiter } from '../auth/rateLimit.js';
import { readCookie } from '../http/cookies.js';
import { HttpError } from '../http/errors.js';
import type { OrderLifecycle } from '../orders/lifecycle.js';
import type { InventorySimulation } from './inventory.js';
import { OPERATOR_COOKIE, OPERATOR_SESSION_MS, type OperatorAccess } from './operator.js';
import type { SimScheduler } from './scheduler.js';

const unitBody = z.strictObject({
  productId: z.number().int().positive(),
  variantId: z.number().int().positive().nullable(),
  onHand: z.number().int().min(0).max(MAX_ON_HAND),
});
const automationBody = z.strictObject({
  autoDecrease: z.boolean(),
  autoRestock: z.boolean(),
  intervalSeconds: z.union(SIM_INTERVALS.map((s) => z.literal(s)) as [z.ZodLiteral<10>, z.ZodLiteral<30>, z.ZodLiteral<60>, z.ZodLiteral<300>]),
});

interface SimDeps {
  access: OperatorAccess;
  lifecycle: OrderLifecycle;
  limiter: LoginLimiter;
  simulation: InventorySimulation;
  /** Present when the API runs automation (server); absent in tests. */
  scheduler?: SimScheduler;
}

/**
 * Demo operator API (F-010 orders, F-011 inventory). Separate from customer sessions: a signed-in
 * customer gets nothing here without the operator cookie.
 */
export function simRouter({ access, lifecycle, limiter, simulation, scheduler }: SimDeps): Router {
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

  // ── Inventory simulation (F-011) ──────────────────────────────────────────────────────

  const automation = (): SimAutomation => ({ ...simulation.getSettings(), nextTickAt: scheduler?.nextTickAt() ?? null, log: simulation.recentChanges() });

  router.get('/sim/inventory', (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q.slice(0, 100) : undefined;
    const filter = INVENTORY_FILTERS.includes(req.query.filter as InventoryFilter) ? (req.query.filter as InventoryFilter) : 'all';
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    res.json(simulation.list(q, filter, cursor));
  });

  router.put('/sim/inventory/units', (req, res) => {
    const parsed = unitBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'BAD_REQUEST', `Enter a whole number from 0 to ${MAX_ON_HAND}`);
    res.json(simulation.setOnHand(parsed.data.productId, parsed.data.variantId, parsed.data.onHand));
  });

  router.get('/sim/automation', (_req, res) => {
    res.json(automation());
  });

  router.put('/sim/automation', (req, res) => {
    const parsed = automationBody.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'BAD_REQUEST', 'Check the automation settings');
    simulation.saveSettings(parsed.data);
    scheduler?.reschedule();
    res.json(automation());
  });

  /** Run once now: one tick of whatever is switched on (spec FR-6). */
  router.post('/sim/automation/run', (_req, res) => {
    const { autoDecrease, autoRestock } = simulation.getSettings();
    if (!autoDecrease && !autoRestock) throw new HttpError(409, 'AUTOMATION_OFF', 'Turn on decrease or restock first');
    const changes = simulation.tick({ decrease: autoDecrease, restock: autoRestock });
    res.json({ changes, automation: automation() });
  });

  return router;
}
