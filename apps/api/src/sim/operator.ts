import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Db } from '../db/database.js';

export const OPERATOR_COOKIE = 'sim_operator';
export const DEFAULT_OPERATOR_PASSWORD = 'demo-operator';
export const OPERATOR_SESSION_MS = 8 * 60 * 60 * 1000;

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Demo operator access (F-010, Q14): one shared password from the environment and a session
 * separate from customer accounts. Only a hash of the session token is stored.
 */
export function createOperatorAccess(db: Db, password: string, clock: () => number = Date.now) {
  const iso = (ms: number) => new Date(ms).toISOString();
  const expected = digest(password);
  const insert = db.prepare('INSERT INTO operator_sessions (token_hash, created_at, expires_at) VALUES (?, ?, ?)');
  const find = db.prepare('SELECT expires_at FROM operator_sessions WHERE token_hash = ?');
  const remove = db.prepare('DELETE FROM operator_sessions WHERE token_hash = ?');
  const removeExpired = db.prepare('DELETE FROM operator_sessions WHERE expires_at < ?');
  const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url');

  return {
    /** Constant-time comparison (both sides hashed to the same length). */
    passwordMatches: (candidate: string) => timingSafeEqual(digest(candidate), expected),

    signIn(): string {
      removeExpired.run(iso(clock()));
      const token = randomBytes(32).toString('base64url');
      insert.run(hashToken(token), iso(clock()), iso(clock() + OPERATOR_SESSION_MS));
      return token;
    },

    isSignedIn(token: string | undefined): boolean {
      if (!token) return false;
      const row = find.get(hashToken(token)) as { expires_at: string } | undefined;
      return !!row && Date.parse(row.expires_at) > clock();
    },

    signOut(token: string | undefined) {
      if (token) remove.run(hashToken(token));
    },
  };
}

export type OperatorAccess = ReturnType<typeof createOperatorAccess>;
