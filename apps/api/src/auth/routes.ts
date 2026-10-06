import { createHash, randomBytes } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import {
  maskMobile,
  normalizeEmail,
  normalizeMobile,
  passwordProblem,
  type MeResponse,
  type PublicUser,
  type SignedInResponse,
} from '@store/shared';
import { CART_COOKIE } from '../cart/routes.js';
import type { Db } from '../db/database.js';
import { readCookie } from '../http/cookies.js';
import { HttpError } from '../http/errors.js';
import { currentUser, type SessionUser } from '../http/owner.js';
import { WISHLIST_COOKIE } from '../wishlist/routes.js';
import { historySchema, type MergeService } from './merge.js';
import type { OtpService } from './otp.js';
import { hashPassword, verifyPassword } from './passwords.js';
import type { LoginLimiter } from './rateLimit.js';
import { SESSION_COOKIE, SESSION_LIFETIME_DAYS, type SessionService } from './sessions.js';
import { validateSignup } from './validation.js';

const RESET_TOKEN_MS = 10 * 60 * 1000;
const hashToken = (token: string) => createHash('sha256').update(token).digest('base64url');

interface UserRow extends SessionUser {
  password_hash: string;
}

interface Deps {
  db: Db;
  otp: OtpService;
  sessions: SessionService;
  merge: MergeService;
  limiter: LoginLimiter;
}

function body(req: Request): Record<string, unknown> {
  return typeof req.body === 'object' && req.body !== null ? (req.body as Record<string, unknown>) : {};
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

export const publicUser = (user: SessionUser): PublicUser => ({ name: user.name, email: user.email, maskedMobile: maskMobile(user.mobile) });

export function authRouter({ db, otp, sessions, merge, limiter }: Deps): Router {
  const router = Router();

  const byId = db.prepare('SELECT id, name, email, mobile, password_hash FROM users WHERE id = ?');
  const byMobile = db.prepare('SELECT id, name, email, mobile, password_hash FROM users WHERE mobile = ?');
  const byEmail = db.prepare('SELECT id, name, email, mobile, password_hash FROM users WHERE email = ?');
  const insertUser = db.prepare(
    'INSERT INTO users (name, email, mobile, password_hash, mobile_verified_at, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  );
  const setPassword = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?');
  const insertReset = db.prepare('INSERT INTO password_resets (token_hash, user_id, expires_at) VALUES (?, ?, ?)');
  const findReset = db.prepare('SELECT user_id, expires_at, used_at FROM password_resets WHERE token_hash = ?');
  const useReset = db.prepare('UPDATE password_resets SET used_at = ? WHERE token_hash = ?');

  /** Email or mobile, whichever the identifier is. */
  const findByIdentifier = (identifier: string): UserRow | undefined => {
    const mobile = normalizeMobile(identifier);
    if (mobile) return byMobile.get(mobile) as UserRow | undefined;
    const email = normalizeEmail(identifier);
    return email ? (byEmail.get(email) as UserRow | undefined) : undefined;
  };

  /** Starts a session and carries the guest's cart and wishlist into the account. */
  function signIn(req: Request, res: Response, user: SessionUser): SignedInResponse {
    sessions.destroy(readCookie(req, SESSION_COOKIE));
    res.cookie(SESSION_COOKIE, sessions.create(user.id), {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_LIFETIME_DAYS * 24 * 60 * 60 * 1000,
    });
    const merged = {
      cart: merge.mergeCart(user.id, readCookie(req, CART_COOKIE)),
      wishlist: merge.mergeWishlist(user.id, readCookie(req, WISHLIST_COOKIE)),
    };
    res.clearCookie(CART_COOKIE, { path: '/' });
    res.clearCookie(WISHLIST_COOKIE, { path: '/' });
    return { user: publicUser(user), merged };
  }

  function requireUser(res: Response): SessionUser {
    const user = currentUser(res);
    if (!user) throw new HttpError(401, 'SIGNED_OUT', 'Please sign in');
    return user;
  }

  router.get('/auth/me', (_req, res) => {
    const user = currentUser(res);
    res.json({ user: user ? publicUser(user) : null } satisfies MeResponse);
  });

  router.post('/auth/signup', async (req, res) => {
    const details = validateSignup(req.body);
    if (byEmail.get(details.email)) {
      throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists', { fields: { email: 'An account with this email already exists' } });
    }
    if (byMobile.get(details.mobile)) {
      throw new HttpError(409, 'MOBILE_TAKEN', 'An account with this mobile already exists', { fields: { mobile: 'An account with this mobile already exists' } });
    }
    // The pending account (with its already-hashed password) waits in the challenge until verified.
    const payload = JSON.stringify({ name: details.name, email: details.email, mobile: details.mobile, passwordHash: await hashPassword(details.password) });
    res.json(otp.start('signup', details.mobile, { payload }));
  });

  router.post('/auth/otp', (req, res) => {
    const { purpose, mobile, identifier } = body(req);
    if (purpose === 'login') {
      const normalized = normalizeMobile(text(mobile));
      if (!normalized) throw new HttpError(400, 'VALIDATION', 'Enter a 10-digit Indian mobile number', { fields: { mobile: 'Enter a 10-digit Indian mobile number' } });
      const user = byMobile.get(normalized) as UserRow | undefined;
      if (!user) throw new HttpError(404, 'NO_ACCOUNT', 'No account for this number');
      res.json(otp.start('login', normalized, { userId: user.id }));
      return;
    }
    if (purpose === 'reset') {
      const user = findByIdentifier(text(identifier));
      if (!user) throw new HttpError(404, 'NO_ACCOUNT', 'No account found');
      res.json(otp.start('reset', user.mobile, { userId: user.id }));
      return;
    }
    throw new HttpError(400, 'BAD_REQUEST', 'Invalid request');
  });

  router.post('/auth/otp/resend', (req, res) => {
    res.json(otp.resend(text(body(req).challengeId)));
  });

  router.post('/auth/verify', (req, res) => {
    const { challengeId, code } = body(req);
    const challenge = otp.verify(text(challengeId), text(code), ['signup', 'login', 'reset']);

    if (challenge.purpose === 'signup') {
      const pending = JSON.parse(challenge.payload ?? '{}') as { name: string; email: string; mobile: string; passwordHash: string };
      // Someone may have registered the same email or mobile since this sign-up started.
      if (byEmail.get(pending.email)) throw new HttpError(409, 'EMAIL_TAKEN', 'An account with this email already exists');
      if (byMobile.get(pending.mobile)) throw new HttpError(409, 'MOBILE_TAKEN', 'An account with this mobile already exists');
      const now = new Date().toISOString();
      const id = Number(insertUser.run(pending.name, pending.email, pending.mobile, pending.passwordHash, now, now).lastInsertRowid);
      res.json(signIn(req, res, byId.get(id) as UserRow));
      return;
    }

    const user = challenge.userId ? (byId.get(challenge.userId) as UserRow | undefined) : undefined;
    if (!user) throw new HttpError(404, 'NO_ACCOUNT', 'No account found');
    if (challenge.purpose === 'login') {
      res.json(signIn(req, res, user));
      return;
    }
    const token = randomBytes(32).toString('base64url');
    insertReset.run(hashToken(token), user.id, new Date(Date.now() + RESET_TOKEN_MS).toISOString());
    res.json({ resetToken: token });
  });

  router.post('/auth/password', async (req, res) => {
    const identifier = text(body(req).identifier).trim().toLowerCase();
    const password = text(body(req).password);
    const key = normalizeMobile(identifier) ?? identifier;
    const wait = limiter.retryAfterSeconds(key);
    if (wait > 0) throw new HttpError(429, 'TOO_MANY_ATTEMPTS', 'Too many attempts. Please try again later.', { retryAfterSeconds: wait });
    const user = findByIdentifier(identifier);
    if (!user || !(await verifyPassword(password, user.password_hash))) {
      limiter.fail(key);
      throw new HttpError(401, 'INVALID_CREDENTIALS', 'Incorrect email/mobile or password');
    }
    limiter.reset(key);
    res.json(signIn(req, res, user));
  });

  router.post('/auth/reset', async (req, res) => {
    const { resetToken, newPassword } = body(req);
    const problem = passwordProblem(text(newPassword));
    if (problem) throw new HttpError(400, 'VALIDATION', problem, { fields: { password: problem } });
    const hash = hashToken(text(resetToken));
    const reset = findReset.get(hash) as { user_id: number; expires_at: string; used_at: string | null } | undefined;
    if (!reset || reset.used_at || Date.parse(reset.expires_at) < Date.now()) {
      throw new HttpError(410, 'RESET_EXPIRED', 'This reset link has expired. Please start again.');
    }
    useReset.run(new Date().toISOString(), hash);
    setPassword.run(await hashPassword(text(newPassword)), reset.user_id);
    // A new password signs the account out everywhere else.
    sessions.destroyAllForUser(reset.user_id);
    res.json(signIn(req, res, byId.get(reset.user_id) as UserRow));
  });

  router.post('/auth/logout', (req, res) => {
    sessions.destroy(readCookie(req, SESSION_COOKIE));
    // This device becomes a fresh guest; the account keeps its cart and wishlist.
    for (const name of [SESSION_COOKIE, CART_COOKIE, WISHLIST_COOKIE]) res.clearCookie(name, { path: '/' });
    res.json({ ok: true });
  });

  router.post('/auth/sync', (req, res) => {
    const user = requireUser(res);
    const parsed = historySchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(400, 'BAD_REQUEST', 'Invalid request');
    res.json(merge.syncHistory(user.id, parsed.data));
  });

  return router;
}
