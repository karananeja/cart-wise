import type { AnalyticsEventName } from '@store/shared';
import type { Db } from '../db/database.js';

export type RecordEvent = (name: AnalyticsEventName, properties: Record<string, string | number | boolean | null>, visitorId: string) => void;

/**
 * Server-side events, for facts only the server knows for certain (payment outcomes, orders).
 * Recorded at the state change, so each is counted once.
 */
export function createEventRecorder(db: Db, clock: () => number = Date.now): RecordEvent {
  const insert = db.prepare(
    'INSERT INTO analytics_events (name, properties, visitor_id, occurred_at, received_at) VALUES (?, ?, ?, ?, ?)',
  );
  return (name, properties, visitorId) => {
    const at = new Date(clock()).toISOString();
    insert.run(name, JSON.stringify(properties), visitorId, at, at);
  };
}
