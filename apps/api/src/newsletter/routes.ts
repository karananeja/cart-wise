import { Router, type Request } from 'express';
import { normalizeEmail } from '@store/shared';
import { HttpError } from '../http/errors.js';
import type { NewsletterService } from './service.js';

const field = (req: Request, name: string): string => {
  const source = req.method === 'GET' ? req.query : typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
  const value = source[name];
  return typeof value === 'string' ? value : '';
};

/** An unsubscribe token as the link carries it; anything else can't match a stored hash. */
const token = (req: Request): string => {
  const value = field(req, 'token');
  if (!value || value.length > 200) throw new HttpError(404, 'NOT_FOUND', "This link isn't valid anymore.");
  return value;
};

/** Footer newsletter (F-018). */
export function newsletterRouter(newsletter: NewsletterService): Router {
  const router = Router();

  router.post('/newsletter', (req, res) => {
    const email = normalizeEmail(field(req, 'email'));
    if (!email) throw new HttpError(400, 'INVALID_EMAIL', 'Enter a valid email address', { fields: { email: 'Enter a valid email address' } });
    newsletter.subscribe(email, req.ip ?? req.socket.remoteAddress ?? 'unknown');
    res.json({ ok: true });
  });

  router.get('/newsletter/unsubscribe', (req, res) => {
    res.json(newsletter.lookup(token(req)));
  });

  router.post('/newsletter/unsubscribe', (req, res) => {
    newsletter.unsubscribe(token(req));
    res.json({ ok: true });
  });

  return router;
}
