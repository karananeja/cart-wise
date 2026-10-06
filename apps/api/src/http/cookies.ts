import type { Request, Response } from 'express';

const DAY_MS = 24 * 60 * 60 * 1000;

export function readCookie(req: Request, name: string): string | undefined {
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return undefined;
}

/** Anonymous guest identifiers: HTTP-only, same-site, refreshed on every write. */
export function setGuestCookie(res: Response, name: string, value: string, lifetimeDays: number) {
  res.cookie(name, value, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: lifetimeDays * DAY_MS });
}
