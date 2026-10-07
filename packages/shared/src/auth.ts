/** Validation and types shared by the sign-up/sign-in forms and the API (F-006). */

export type SignupField = 'name' | 'email' | 'mobile' | 'password';
export type FieldErrors = Partial<Record<SignupField, string>>;

/** A short blocklist of the most common passwords (NIST 800-63B: block known-bad, no composition rules). */
const COMMON_PASSWORDS = new Set([
  '12345678', '123456789', '1234567890', 'password', 'password1', 'password123', 'qwerty123', 'qwertyuiop',
  'iloveyou', 'abcd1234', '11111111', '00000000', 'admin123', 'welcome1', 'letmein1', 'sunshine',
  'princess', 'football', 'baseball', 'india123', 'abc12345', 'passw0rd', '87654321', 'asdfghjk',
]);

/** Indian mobile: 10 digits starting 6–9; accepts +91 / 91 / 0 prefixes and spaces or dashes. */
export function normalizeMobile(input: string): string | undefined {
  let digits = input.replace(/[\s-]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : undefined;
}

export function normalizeEmail(input: string): string | undefined {
  const email = input.trim().toLowerCase();
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) ? email : undefined;
}

export function passwordProblem(password: string): string | undefined {
  if (password.length < 8) return 'Use at least 8 characters';
  if (password.length > 128) return 'Use at most 128 characters';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'That password is too common';
  return undefined;
}

export function maskMobile(mobile: string): string {
  return `••••••${mobile.slice(-4)}`;
}

/** "karan@example.com" → "k••••@example.com": enough to recognise, not to read (F-016). */
export function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at < 1) return '••••';
  return `${email[0]}••••${email.slice(at)}`;
}

export interface SignupInput {
  name: string;
  email: string;
  /** Optional since F-016: for delivery updates only, not unique and not verified. */
  mobile: string | null;
  password: string;
}

/** Field errors for a sign-up form (empty object when valid) and the normalised values. */
export function checkSignup(input: Partial<Record<SignupField, unknown>>): { errors: FieldErrors; values: SignupInput } {
  const text = (v: unknown) => (typeof v === 'string' ? v : '');
  const errors: FieldErrors = {};
  const name = text(input.name).replace(/\s+/g, ' ').trim();
  if (name.length < 2 || name.length > 60) errors.name = 'Enter your name (2–60 characters)';
  const email = normalizeEmail(text(input.email));
  if (!email) errors.email = 'Enter a valid email address';
  // Mobile is optional (F-016); when given it must be a valid number.
  const mobileText = text(input.mobile).trim();
  const mobile = mobileText ? normalizeMobile(mobileText) : null;
  if (mobile === undefined) errors.mobile = 'Enter a 10-digit Indian mobile number';
  const password = text(input.password);
  const problem = passwordProblem(password);
  if (problem) errors.password = problem;
  return { errors, values: { name, email: email ?? '', mobile: mobile ?? null, password } };
}

export interface PublicUser {
  name: string;
  email: string;
  /** The account owner's own number, when given (pre-fills forms); shown masked in the UI. Optional since F-016. */
  mobile: string | null;
  maskedMobile: string | null;
  /** When the account was created, ISO time (F-017). */
  memberSince: string;
}

export interface MeResponse {
  user: PublicUser | null;
}

/**
 * Sent when a code goes out to the account's email (F-016, ADR-006). With SMTP configured it is
 * really emailed (`delivery: 'email'`, no code here); otherwise it comes back as `demoCode` for the
 * labelled demo banner (`delivery: 'demo'`).
 */
export interface ChallengeResponse {
  challengeId: string;
  maskedEmail: string;
  delivery: 'email' | 'demo';
  demoCode?: string;
  resendAfterSeconds: number;
  expiresInSeconds: number;
}

export interface SignedInResponse {
  user: PublicUser;
  /** Whether guest items were carried into the account. */
  merged: { cart: boolean; wishlist: boolean };
}

export interface ResetTokenResponse {
  resetToken: string;
}

export interface HistoryLists {
  recentlyViewed: { slug: string; viewedAt: string }[];
  recentSearches: { query: string; searchedAt: string }[];
}

/** Only same-site paths are accepted as a place to return to after signing in. */
export function safeReturnTo(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.startsWith('/\\')) return fallback;
  return value;
}
