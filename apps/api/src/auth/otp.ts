import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { maskEmail, type ChallengeResponse } from '@store/shared';
import type { Db } from '../db/database.js';
import { HttpError } from '../http/errors.js';
import type { Mailer } from '../mail/mailer.js';

export type OtpPurpose = 'signup' | 'login' | 'reset';

export const OTP_RULES = {
  digits: 6,
  validForMs: 5 * 60 * 1000,
  maxAttempts: 5,
  resendAfterMs: 60 * 1000,
  maxSendsPerHour: 5,
  /** Per client IP, so sign-up can't be used to flood a stranger's inbox (F-016 FR-7). */
  maxSendsPerIpPerHour: 20,
};

export interface Challenge {
  id: string;
  purpose: OtpPurpose;
  email: string;
  userId: number | null;
  payload: string | null;
}

export interface OtpOptions {
  clock?: () => number;
  /**
   * Sends the codes through MSG91 (F-016, ADR-007). Without one, delivery is a demo: the code comes back as
   * `demoCode` for the on-screen banner. This is the only place a code leaves the server.
   */
  mailer?: Mailer;
  /** Overrides the per-IP hourly limit (E2E signs up many shoppers from one address). */
  maxSendsPerIpPerHour?: number;
  /** Send failures for the operator (defaults to console.error). Never given the code or credentials. */
  log?: (message: string) => void;
}

function hashCode(challengeId: string, code: string): string {
  return createHash('sha256').update(`${challengeId}:${code}`).digest('base64url');
}

/** A short reason for the log (e.g. "HTTP 401", "TIMEOUT"), never the response or the code. */
function failureCode(error: unknown): string {
  const { code } = (error ?? {}) as { code?: unknown };
  return typeof code === 'string' ? code : 'unknown error';
}

export function createOtpService(db: Db, options: OtpOptions = {}) {
  const clock = options.clock ?? Date.now;
  const { mailer } = options;
  const ipLimit = options.maxSendsPerIpPerHour ?? OTP_RULES.maxSendsPerIpPerHour;
  const log = options.log ?? console.error;
  const iso = (ms: number) => new Date(ms).toISOString();

  const sendsInLastHour = db.prepare('SELECT COUNT(*) AS n FROM otp_sends WHERE email = ? AND sent_at >= ?');
  const ipSendsInLastHour = db.prepare('SELECT COUNT(*) AS n FROM otp_ip_sends WHERE ip = ? AND sent_at >= ?');
  const recordSend = db.prepare('INSERT INTO otp_sends (email, sent_at) VALUES (?, ?)');
  const recordIpSend = db.prepare('INSERT INTO otp_ip_sends (ip, sent_at) VALUES (?, ?)');
  const pruneSends = db.prepare('DELETE FROM otp_sends WHERE sent_at < ?');
  const pruneIpSends = db.prepare('DELETE FROM otp_ip_sends WHERE sent_at < ?');
  const insert = db.prepare(`
    INSERT INTO otp_challenges (id, purpose, email, user_id, code_hash, payload, created_at, expires_at, last_sent_at)
    VALUES (@id, @purpose, @email, @userId, @codeHash, @payload, @now, @expiresAt, @now)`);
  const find = db.prepare('SELECT * FROM otp_challenges WHERE id = ?');
  const reissue = db.prepare('UPDATE otp_challenges SET code_hash = ?, attempts = 0, expires_at = ? WHERE id = ?');
  const markSent = db.prepare('UPDATE otp_challenges SET last_sent_at = ? WHERE id = ?');
  const countAttempt = db.prepare('UPDATE otp_challenges SET attempts = attempts + 1 WHERE id = ?');
  const remove = db.prepare('DELETE FROM otp_challenges WHERE id = ?');

  /** Checks both limits and counts the send (even if the email then fails), returning a fresh code. */
  function allowSend(email: string, ip: string): string {
    const now = clock();
    const hourAgo = iso(now - 60 * 60 * 1000);
    pruneSends.run(hourAgo);
    pruneIpSends.run(hourAgo);
    if (
      (sendsInLastHour.get(email, hourAgo) as { n: number }).n >= OTP_RULES.maxSendsPerHour ||
      (ipSendsInLastHour.get(ip, hourAgo) as { n: number }).n >= ipLimit
    ) {
      throw new HttpError(429, 'TOO_MANY_CODES', 'Too many codes requested. Please try again later.');
    }
    recordSend.run(email, iso(now));
    recordIpSend.run(ip, iso(now));
    return String(randomInt(0, 10 ** OTP_RULES.digits)).padStart(OTP_RULES.digits, '0');
  }

  /** Emails the code when a mailer is set up; otherwise there is nothing to send (demo). */
  async function deliver(email: string, code: string, purpose: OtpPurpose) {
    if (!mailer) return;
    try {
      await mailer.sendOtp(email, code, purpose, OTP_RULES.validForMs / 60_000);
    } catch (error) {
      log(`Could not email a ${purpose} code (${failureCode(error)}).`);
      throw new HttpError(502, 'EMAIL_FAILED', "We couldn't send the code. Please try again.");
    }
  }

  function response(id: string, email: string, code: string): ChallengeResponse {
    return {
      challengeId: id,
      maskedEmail: maskEmail(email),
      ...(mailer ? { delivery: 'email' as const } : { delivery: 'demo' as const, demoCode: code }),
      resendAfterSeconds: OTP_RULES.resendAfterMs / 1000,
      expiresInSeconds: OTP_RULES.validForMs / 1000,
    };
  }

  type Row = { id: string; purpose: OtpPurpose; email: string; user_id: number | null; code_hash: string; payload: string | null; attempts: number; expires_at: string; last_sent_at: string; consumed_at: string | null };

  return {
    /** Mode for the start-up log line. */
    delivery: mailer ? ('email' as const) : ('demo' as const),

    async start(purpose: OtpPurpose, email: string, options: { ip: string; userId?: number; payload?: string }): Promise<ChallengeResponse> {
      const code = allowSend(email, options.ip);
      await deliver(email, code, purpose);
      // Stored only once the code is out, so a failed email leaves nothing behind.
      const id = randomBytes(16).toString('base64url');
      const now = clock();
      insert.run({
        id,
        purpose,
        email,
        userId: options.userId ?? null,
        codeHash: hashCode(id, code),
        payload: options.payload ?? null,
        now: iso(now),
        expiresAt: iso(now + OTP_RULES.validForMs),
      });
      return response(id, email, code);
    },

    async resend(challengeId: string, ip: string): Promise<ChallengeResponse> {
      const row = find.get(challengeId) as Row | undefined;
      if (!row || row.consumed_at) throw new HttpError(404, 'CHALLENGE_NOT_FOUND', 'Please start again');
      const wait = Date.parse(row.last_sent_at) + OTP_RULES.resendAfterMs - clock();
      if (wait > 0) {
        throw new HttpError(429, 'RESEND_TOO_SOON', 'Please wait before requesting another code', { retryAfterSeconds: Math.ceil(wait / 1000) });
      }
      const code = allowSend(row.email, ip);
      // The previous code stops working now, even if this email then fails. The wait restarts only
      // once the new code is out, so a failed send can be retried straight away.
      reissue.run(hashCode(row.id, code), iso(clock() + OTP_RULES.validForMs), row.id);
      await deliver(row.email, code, row.purpose);
      markSent.run(iso(clock()), row.id);
      return response(row.id, row.email, code);
    },

    /** Checks a code. Each wrong attempt counts; after 5 a new code is needed. Deleted once used. */
    verify(challengeId: string, code: string, purposes: OtpPurpose[]): Challenge {
      const row = find.get(challengeId) as Row | undefined;
      if (!row || row.consumed_at || !purposes.includes(row.purpose)) {
        throw new HttpError(404, 'CHALLENGE_NOT_FOUND', 'Please start again');
      }
      if (Date.parse(row.expires_at) < clock()) throw new HttpError(410, 'CODE_EXPIRED', 'That code has expired. Request a new one.');
      if (row.attempts >= OTP_RULES.maxAttempts) {
        throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code.');
      }
      const expected = Buffer.from(row.code_hash);
      const actual = Buffer.from(hashCode(row.id, String(code)));
      if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
        countAttempt.run(row.id);
        const attemptsLeft = OTP_RULES.maxAttempts - row.attempts - 1;
        if (attemptsLeft <= 0) throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many wrong attempts. Request a new code.');
        throw new HttpError(401, 'INVALID_CODE', 'That code is not right', { attemptsLeft });
      }
      remove.run(row.id);
      return { id: row.id, purpose: row.purpose, email: row.email, userId: row.user_id, payload: row.payload };
    },
  };
}

export type OtpService = ReturnType<typeof createOtpService>;
