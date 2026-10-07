import { http, HttpResponse } from 'msw';
import { checkSignup, maskEmail, maskMobile, normalizeEmail, type ChallengeResponse, type HistoryLists } from '@store/shared';

/**
 * In-memory stand-in for the auth API: one signed-in user at a time (cookies aren't modelled).
 * Codes come back as `demoCode` (demo mode, the default) or are "emailed" (`lastEmailedCode`); the
 * real rules are covered by the API tests.
 */
interface User {
  name: string;
  email: string;
  mobile: string | null;
  password: string;
}

let users: User[] = [];
let signedIn: User | undefined;
let challenges = new Map<string, { purpose: string; email: string; code: string; attempts: number; pending?: User }>();
let nextId = 1;
let delivery: ChallengeResponse['delivery'] = 'demo';
let emailFails = false;
let emailedCode: string | undefined;
export const syncRequests: HistoryLists[] = [];
export const historyRemovals: { list: string; key?: string }[] = [];
/** What the merge step reports on sign-in (set by tests). */
export let mergeResult = { cart: false, wishlist: false };

export function resetAuth() {
  users = [];
  signedIn = undefined;
  challenges = new Map();
  nextId = 1;
  syncRequests.length = 0;
  historyRemovals.length = 0;
  mergeResult = { cart: false, wishlist: false };
  delivery = 'demo';
  emailFails = false;
  emailedCode = undefined;
}

/** Real-email mode (SMTP configured): no `demoCode`; `failing` makes every send fail with EMAIL_FAILED. */
export function setEmailDelivery(options: { failing?: boolean } = {}) {
  delivery = 'email';
  emailFails = options.failing ?? false;
}

export const lastEmailedCode = () => emailedCode;

export function setMergeResult(result: { cart: boolean; wishlist: boolean }) {
  mergeResult = result;
}

export function addUser(user: User, options: { signedIn?: boolean } = {}) {
  users.push(user);
  if (options.signedIn) signedIn = user;
}

const publicUser = (u: User) => ({ name: u.name, email: u.email, mobile: u.mobile, maskedMobile: u.mobile ? maskMobile(u.mobile) : null });
const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, ...(details ? { details } : {}) } }, { status });

function challenge(purpose: string, email: string, pending?: User) {
  if (delivery === 'email' && emailFails) return error(502, 'EMAIL_FAILED');
  const id = `c${nextId++}`;
  const code = String(100000 + nextId);
  challenges.set(id, { purpose, email, code, attempts: 0, pending });
  if (delivery === 'email') emailedCode = code;
  const response: ChallengeResponse = {
    challengeId: id,
    maskedEmail: maskEmail(email),
    delivery,
    ...(delivery === 'demo' ? { demoCode: code } : {}),
    resendAfterSeconds: 30,
    expiresInSeconds: 300,
  };
  return HttpResponse.json(response);
}

const signIn = (user: User) => {
  signedIn = user;
  return HttpResponse.json({ user: publicUser(user), merged: mergeResult });
};

export const authHandlers = [
  http.get('*/api/auth/me', () => HttpResponse.json({ user: signedIn ? publicUser(signedIn) : null })),
  http.post('*/api/auth/signup', async ({ request }) => {
    const { errors, values } = checkSignup((await request.json()) as Record<string, unknown>);
    if (Object.keys(errors).length) return error(400, 'VALIDATION', { fields: errors });
    if (users.some((u) => u.email === values.email)) return error(409, 'EMAIL_TAKEN', { fields: { email: 'An account with this email already exists' } });
    return challenge('signup', values.email, values);
  }),
  http.post('*/api/auth/otp', async ({ request }) => {
    const body = (await request.json()) as { purpose: string; email?: string };
    const email = normalizeEmail(body.email ?? '');
    if (!email) return error(400, 'VALIDATION', { fields: { email: 'Enter a valid email address' } });
    const user = users.find((u) => u.email === email);
    if (!user) return error(404, 'NO_ACCOUNT');
    return challenge(body.purpose, user.email);
  }),
  http.post('*/api/auth/otp/resend', async ({ request }) => {
    const { challengeId } = (await request.json()) as { challengeId: string };
    const existing = challenges.get(challengeId)!;
    const next = challenge(existing.purpose, existing.email, existing.pending);
    if (next.status === 200) challenges.delete(challengeId);
    return next;
  }),
  http.post('*/api/auth/verify', async ({ request }) => {
    const { challengeId, code } = (await request.json()) as { challengeId: string; code: string };
    const found = challenges.get(challengeId);
    if (!found) return error(404, 'CHALLENGE_NOT_FOUND');
    if (found.code !== code) {
      found.attempts += 1;
      return error(401, 'INVALID_CODE', { attemptsLeft: 5 - found.attempts });
    }
    challenges.delete(challengeId);
    if (found.purpose === 'signup') {
      users.push(found.pending!);
      return signIn(found.pending!);
    }
    const user = users.find((u) => u.email === found.email)!;
    if (found.purpose === 'login') return signIn(user);
    return HttpResponse.json({ resetToken: `reset-${user.email}` });
  }),
  http.post('*/api/auth/password', async ({ request }) => {
    const { email, password } = (await request.json()) as { email: string; password: string };
    const user = users.find((u) => u.email === email.trim().toLowerCase() && u.password === password);
    return user ? signIn(user) : error(401, 'INVALID_CREDENTIALS');
  }),
  http.post('*/api/auth/reset', async ({ request }) => {
    const { resetToken, newPassword } = (await request.json()) as { resetToken: string; newPassword: string };
    const user = users.find((u) => `reset-${u.email}` === resetToken)!;
    user.password = newPassword;
    return signIn(user);
  }),
  http.post('*/api/auth/logout', () => {
    signedIn = undefined;
    return HttpResponse.json({ ok: true });
  }),
  http.post('*/api/auth/history/remove', async ({ request }) => {
    historyRemovals.push((await request.json()) as { list: string; key?: string });
    return HttpResponse.json({ ok: true });
  }),
  http.post('*/api/auth/sync', async ({ request }) => {
    const body = (await request.json()) as HistoryLists;
    syncRequests.push(body);
    return HttpResponse.json(body);
  }),
];
