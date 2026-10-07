import { createHash, randomBytes } from 'node:crypto';
import { maskEmail, type NewsletterUnsubscribeLookup } from '@store/shared';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import type { Mailer } from '../mail/mailer.js';

/** Sign-ups per client IP per hour (F-018 FR-3). In memory, like the sign-in limiter (ADR-003). */
export const NEWSLETTER_MAX_PER_IP_PER_HOUR = 10;
const HOUR_MS = 60 * 60 * 1000;
export const DEFAULT_WEB_BASE_URL = 'http://localhost:5173';

export interface NewsletterOptions {
  clock?: () => number;
  /** Sends the welcome email when MSG91 has a newsletter template (ADR-007); otherwise nothing is sent. */
  mailer?: Mailer;
  /** Where the shop runs, for the unsubscribe link. */
  webBaseUrl?: string;
  log?: (message: string) => void;
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url');

/** A short reason for the log (e.g. "HTTP 401"), never the response (same rule as the code emails). */
function failureCode(error: unknown): string {
  const { code } = (error ?? {}) as { code?: unknown };
  return typeof code === 'string' ? code : 'unknown error';
}

export function createNewsletterService(db: Db, options: NewsletterOptions = {}) {
  const clock = options.clock ?? Date.now;
  const log = options.log ?? console.error;
  const webBaseUrl = (options.webBaseUrl?.trim() || DEFAULT_WEB_BASE_URL).replace(/\/+$/, '');
  const recentByIp = new Map<string, number[]>();

  const find = db.prepare('SELECT unsubscribed_at FROM newsletter_subscribers WHERE email = ?');
  const insert = db.prepare("INSERT INTO newsletter_subscribers (email, token_hash, source, created_at) VALUES (?, ?, 'footer', ?)");
  const resubscribe = db.prepare('UPDATE newsletter_subscribers SET token_hash = ?, unsubscribed_at = NULL WHERE email = ?');
  const byToken = db.prepare('SELECT email FROM newsletter_subscribers WHERE token_hash = ? AND unsubscribed_at IS NULL');
  const unsubscribe = db.prepare('UPDATE newsletter_subscribers SET unsubscribed_at = ? WHERE token_hash = ? AND unsubscribed_at IS NULL');

  function allow(ip: string) {
    const now = clock();
    const recent = (recentByIp.get(ip) ?? []).filter((t) => now - t < HOUR_MS);
    if (recent.length >= NEWSLETTER_MAX_PER_IP_PER_HOUR) {
      recentByIp.set(ip, recent);
      throw new HttpError(429, 'TOO_MANY_REQUESTS', 'Too many sign-ups from here. Please try again later.');
    }
    recentByIp.set(ip, [...recent, now]);
  }

  /** The welcome email goes out after the response; a failure is only logged (FR-3, §14). */
  function welcome(email: string, token: string) {
    const { mailer } = options;
    if (!mailer?.sendsNewsletterWelcome) return;
    const url = `${webBaseUrl}/newsletter/unsubscribe?token=${encodeURIComponent(token)}`;
    Promise.resolve()
      .then(() => mailer.sendNewsletterWelcome(email, url))
      .catch((error: unknown) => log(`Could not email a newsletter welcome (${failureCode(error)}).`));
  }

  return {
    /**
     * Subscribes a normalised email. New and already-subscribed addresses get the same answer
     * (no enumeration); only a new or returning subscriber gets a fresh token and the welcome email.
     */
    subscribe(email: string, ip: string) {
      allow(ip);
      const row = find.get(email) as { unsubscribed_at: string | null } | undefined;
      if (row && !row.unsubscribed_at) return;
      const token = randomBytes(32).toString('base64url');
      if (row) resubscribe.run(hashToken(token), email);
      else insert.run(email, hashToken(token), new Date(clock()).toISOString());
      welcome(email, token);
    },

    /** What the unsubscribe page shows; 404 for an unknown or already-used link. */
    lookup(token: string): NewsletterUnsubscribeLookup {
      const row = byToken.get(hashToken(token)) as { email: string } | undefined;
      if (!row) throw new HttpError(404, 'NOT_FOUND', "This link isn't valid anymore.");
      return { maskedEmail: maskEmail(row.email) };
    },

    unsubscribe(token: string) {
      if (!unsubscribe.run(new Date(clock()).toISOString(), hashToken(token)).changes) throw new HttpError(404, 'NOT_FOUND', "This link isn't valid anymore.");
    },
  };
}

export type NewsletterService = ReturnType<typeof createNewsletterService>;
