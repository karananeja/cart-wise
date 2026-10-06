import type { AnalyticsEvent, AnalyticsEventName } from '@store/shared';
import { apiUrl } from './api';

const VISITOR_KEY = 'store.visitorId';
const FLUSH_DELAY_MS = 2000;
const MAX_BATCH = 50;

let queue: AnalyticsEvent[] = [];
let timer: ReturnType<typeof setTimeout> | undefined;
let memoryVisitorId: string | undefined;

/** Anonymous random id; not linked to any personal data. Falls back to memory if storage is blocked. */
function visitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_KEY);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(VISITOR_KEY, id);
    return id;
  } catch {
    memoryVisitorId ??= crypto.randomUUID();
    return memoryVisitorId;
  }
}

export function track(name: AnalyticsEventName, properties: AnalyticsEvent['properties']): void {
  queue.push({ name, properties, visitorId: visitorId(), occurredAt: new Date().toISOString() });
  if (queue.length >= MAX_BATCH) flush();
  else timer ??= setTimeout(flush, FLUSH_DELAY_MS);
}

/** Sends queued events. Analytics must never break the shopping flow, so failures are dropped. */
export function flush(useBeacon = false): void {
  clearTimeout(timer);
  timer = undefined;
  if (!queue.length) return;
  const body = JSON.stringify({ events: queue.splice(0, MAX_BATCH) });
  if (useBeacon && typeof navigator.sendBeacon === 'function') {
    navigator.sendBeacon(apiUrl('/events'), body);
    return;
  }
  fetch(apiUrl('/events'), { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true }).catch(
    () => undefined,
  );
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => flush(true));
}
