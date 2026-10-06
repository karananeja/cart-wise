import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';

/**
 * Cross-site request forgery guard (ADR-003): POSTs must be JSON. Cross-site forms can only
 * send form or text bodies without a CORS preflight, which this API never grants. PUT, PATCH
 * and DELETE always need a preflight. The analytics beacon (text/plain) is exempt.
 */
export const requireJsonPosts: RequestHandler = (req, _res, next) => {
  if (req.method === 'POST' && req.path !== '/events' && !req.is('application/json')) {
    throw new HttpError(415, 'UNSUPPORTED_MEDIA_TYPE', 'Requests must be JSON');
  }
  next();
};
