import { Router } from 'express';
import { analyticsBatchSchema } from '@store/shared';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';

export function analyticsRouter(db: Db): Router {
  const router = Router();
  const insert = db.prepare(
    'INSERT INTO analytics_events (name, properties, visitor_id, occurred_at, received_at) VALUES (?, ?, ?, ?, ?)',
  );
  const insertBatch = db.transaction((events: ReturnType<typeof analyticsBatchSchema.parse>['events']) => {
    const receivedAt = new Date().toISOString();
    for (const e of events) insert.run(e.name, JSON.stringify(e.properties), e.visitorId, e.occurredAt, receivedAt);
  });

  router.post('/events', (req, res) => {
    // sendBeacon posts text/plain, so accept a raw string body too.
    const body = typeof req.body === 'string' ? safeJson(req.body) : req.body;
    const parsed = analyticsBatchSchema.safeParse(body);
    if (!parsed.success) throw new HttpError(400, 'INVALID_EVENTS', 'Invalid analytics events');
    insertBatch(parsed.data.events);
    res.status(202).end();
  });

  return router;
}

function safeJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
