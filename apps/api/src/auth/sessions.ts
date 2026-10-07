import { createHash, randomBytes } from 'node:crypto';
import type { Db } from '../db/database.js';
import type { SessionUser } from '../http/owner.js';

export const SESSION_COOKIE = 'session';
export const SESSION_LIFETIME_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/** Extend the expiry at most once an hour, to avoid a write on every request. */
const TOUCH_INTERVAL_MS = 60 * 60 * 1000;

const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url');

export function createSessionService(db: Db, clock: () => number = Date.now) {
  const iso = (ms: number) => new Date(ms).toISOString();
  const insert = db.prepare('INSERT INTO sessions (token_hash, user_id, created_at, expires_at, last_seen_at) VALUES (?, ?, ?, ?, ?)');
  const find = db.prepare(`
    SELECT s.token_hash, s.expires_at, s.last_seen_at, u.id, u.name, u.email, u.mobile, u.created_at AS createdAt
    FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ?`);
  const touch = db.prepare('UPDATE sessions SET expires_at = ?, last_seen_at = ? WHERE token_hash = ?');
  const remove = db.prepare('DELETE FROM sessions WHERE token_hash = ?');
  const removeForUser = db.prepare('DELETE FROM sessions WHERE user_id = ?');
  const removeExpired = db.prepare('DELETE FROM sessions WHERE expires_at < ?');

  return {
    /** Returns the raw token for the cookie; only its hash is stored. */
    create(userId: number): string {
      const token = randomBytes(32).toString('base64url');
      const now = clock();
      insert.run(hashToken(token), userId, iso(now), iso(now + SESSION_LIFETIME_DAYS * DAY_MS), iso(now));
      return token;
    },

    /** The signed-in user for a token, extending the 30-day window as it is used. */
    resolve(token: string | undefined): SessionUser | undefined {
      if (!token) return undefined;
      const hash = hashToken(token);
      const row = find.get(hash) as (SessionUser & { expires_at: string; last_seen_at: string }) | undefined;
      const now = clock();
      if (!row) return undefined;
      if (Date.parse(row.expires_at) < now) {
        remove.run(hash);
        return undefined;
      }
      if (now - Date.parse(row.last_seen_at) > TOUCH_INTERVAL_MS) touch.run(iso(now + SESSION_LIFETIME_DAYS * DAY_MS), iso(now), hash);
      return { id: row.id, name: row.name, email: row.email, mobile: row.mobile, createdAt: row.createdAt };
    },

    destroy(token: string | undefined) {
      if (token) remove.run(hashToken(token));
    },

    destroyAllForUser(userId: number) {
      removeForUser.run(userId);
    },

    deleteExpired: () => removeExpired.run(iso(clock())).changes,
  };
}

export type SessionService = ReturnType<typeof createSessionService>;
