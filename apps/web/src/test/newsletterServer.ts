import { http, HttpResponse } from 'msw';
import { maskEmail, normalizeEmail } from '@store/shared';

/** In-memory stand-in for the newsletter API (F-018; rules covered by the API tests). */
export const subscribers = new Map<string, { token: string; active: boolean }>();

export function resetNewsletter() {
  subscribers.clear();
}

/** Adds an active subscriber with a known unsubscribe token. */
export function addSubscriber(email: string, token: string) {
  subscribers.set(email, { token, active: true });
}

const byToken = (token: string | null) => [...subscribers.entries()].find(([, s]) => s.active && s.token === token);
const notFound = () => HttpResponse.json({ error: { code: 'NOT_FOUND', message: 'x' } }, { status: 404 });

export const newsletterHandlers = [
  http.post('*/api/newsletter', async ({ request }) => {
    const { email } = (await request.json()) as { email?: string };
    const normalized = normalizeEmail(email ?? '');
    if (!normalized) {
      return HttpResponse.json({ error: { code: 'INVALID_EMAIL', message: 'x', details: { fields: { email: 'Enter a valid email address' } } } }, { status: 400 });
    }
    if (!subscribers.get(normalized)?.active) subscribers.set(normalized, { token: `token-${subscribers.size + 1}`, active: true });
    return HttpResponse.json({ ok: true });
  }),
  http.get('*/api/newsletter/unsubscribe', ({ request }) => {
    const found = byToken(new URL(request.url).searchParams.get('token'));
    return found ? HttpResponse.json({ maskedEmail: maskEmail(found[0]) }) : notFound();
  }),
  http.post('*/api/newsletter/unsubscribe', async ({ request }) => {
    const { token } = (await request.json()) as { token?: string };
    const found = byToken(token ?? null);
    if (!found) return notFound();
    found[1].active = false;
    return HttpResponse.json({ ok: true });
  }),
];
