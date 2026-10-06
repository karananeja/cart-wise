import { http, HttpResponse } from 'msw';
import { checkSignup, maskMobile, normalizeMobile, type ChallengeResponse, type HistoryLists } from '@store/shared';

/**
 * In-memory stand-in for the auth API: one signed-in user at a time (cookies aren't modelled).
 * Codes are always the `demoCode` returned; the real rules are covered by the API tests.
 */
interface User {
  name: string;
  email: string;
  mobile: string;
  password: string;
}

let users: User[] = [];
let signedIn: User | undefined;
let challenges = new Map<string, { purpose: string; mobile: string; code: string; attempts: number; pending?: User }>();
let nextId = 1;
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
}

export function setMergeResult(result: { cart: boolean; wishlist: boolean }) {
  mergeResult = result;
}

export function addUser(user: User, options: { signedIn?: boolean } = {}) {
  users.push(user);
  if (options.signedIn) signedIn = user;
}

const publicUser = (u: User) => ({ name: u.name, email: u.email, mobile: u.mobile, maskedMobile: maskMobile(u.mobile) });
const error = (status: number, code: string, details?: Record<string, unknown>) =>
  HttpResponse.json({ error: { code, message: code, ...(details ? { details } : {}) } }, { status });

function challenge(purpose: string, mobile: string, pending?: User): ChallengeResponse {
  const id = `c${nextId++}`;
  const code = String(100000 + nextId);
  challenges.set(id, { purpose, mobile, code, attempts: 0, pending });
  return { challengeId: id, maskedMobile: maskMobile(mobile), demoCode: code, resendAfterSeconds: 30, expiresInSeconds: 300 };
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
    if (users.some((u) => u.mobile === values.mobile)) return error(409, 'MOBILE_TAKEN', { fields: { mobile: 'An account with this mobile already exists' } });
    return HttpResponse.json(challenge('signup', values.mobile, values));
  }),
  http.post('*/api/auth/otp', async ({ request }) => {
    const body = (await request.json()) as { purpose: string; mobile?: string; identifier?: string };
    const key = body.purpose === 'login' ? normalizeMobile(body.mobile ?? '') : body.identifier;
    const user = users.find((u) => u.mobile === normalizeMobile(key ?? '') || u.email === key);
    if (!user) return error(404, 'NO_ACCOUNT');
    return HttpResponse.json(challenge(body.purpose, user.mobile));
  }),
  http.post('*/api/auth/otp/resend', async ({ request }) => {
    const { challengeId } = (await request.json()) as { challengeId: string };
    const existing = challenges.get(challengeId)!;
    challenges.delete(challengeId);
    return HttpResponse.json(challenge(existing.purpose, existing.mobile, existing.pending));
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
    const user = users.find((u) => u.mobile === found.mobile)!;
    if (found.purpose === 'login') return signIn(user);
    return HttpResponse.json({ resetToken: `reset-${user.mobile}` });
  }),
  http.post('*/api/auth/password', async ({ request }) => {
    const { identifier, password } = (await request.json()) as { identifier: string; password: string };
    const user = users.find((u) => (u.email === identifier.toLowerCase() || u.mobile === normalizeMobile(identifier)) && u.password === password);
    return user ? signIn(user) : error(401, 'INVALID_CREDENTIALS');
  }),
  http.post('*/api/auth/reset', async ({ request }) => {
    const { resetToken, newPassword } = (await request.json()) as { resetToken: string; newPassword: string };
    const user = users.find((u) => `reset-${u.mobile}` === resetToken)!;
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
