import type { AnalyticsEventName } from '@store/shared';
import type { Db } from '../db/database.js';

/** Who the event belongs to: the browser's anonymous id and, for account actions, the account id. */
export interface EventActor {
  visitorId: string;
  userId: number | null;
}

export type RecordEvent = (name: AnalyticsEventName, properties: Record<string, string | number | boolean | null>, actor: EventActor) => void;

/**
 * Server-side events, for facts only the server knows for certain (payment outcomes, orders).
 * Recorded at the state change, so each is counted once. Server events carry the account id
 * (user decision 2026-10-06) so repeat purchase and per-person funnels can be computed; client
 * events stay anonymous and join to accounts through the visitor id.
 */
export function createEventRecorder(db: Db, clock: () => number = Date.now): RecordEvent {
  const insert = db.prepare(
    'INSERT INTO analytics_events (name, properties, visitor_id, user_id, occurred_at, received_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  return (name, properties, { visitorId, userId }) => {
    const at = new Date(clock()).toISOString();
    insert.run(name, JSON.stringify(properties), visitorId, userId, at, at);
  };
}
