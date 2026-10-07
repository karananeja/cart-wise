import type { Request, Response } from 'express';
import { readCookie } from './cookies.js';

/** Who a cart or wishlist belongs to: a signed-in user, or a guest identified by a cookie. */
export type Owner = { userId: number } | { guestId: string | undefined };

export interface SessionUser {
  id: number;
  name: string;
  email: string;
  /** Optional since F-016. */
  mobile: string | null;
}

export function currentUser(res: Response): SessionUser | undefined {
  return res.locals.user as SessionUser | undefined;
}

export function ownerFor(req: Request, res: Response, guestCookie: string): Owner {
  const user = currentUser(res);
  return user ? { userId: user.id } : { guestId: readCookie(req, guestCookie) };
}
