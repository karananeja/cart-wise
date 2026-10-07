import type { FieldErrors } from '@store/shared';
import { ApiError } from '@/lib/api';

/** Field-level errors from the API, if any. */
export function fieldErrors(error: unknown): FieldErrors {
  if (error instanceof ApiError && error.details?.fields) return error.details.fields as FieldErrors;
  return {};
}

/** User-facing text for auth failures; never technical detail. */
export function authErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  const details = error.details ?? {};
  switch (error.code) {
    case 'VALIDATION':
      return 'Please check the highlighted fields.';
    case 'EMAIL_TAKEN':
      return 'An account with this email already exists.';
    case 'NO_ACCOUNT':
      return 'No account found.';
    case 'INVALID_CODE': {
      const left = Number(details.attemptsLeft ?? 0);
      return `That code isn't right. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`;
    }
    case 'CODE_EXPIRED':
      return 'That code has expired. Request a new one.';
    case 'TOO_MANY_ATTEMPTS': {
      const wait = Number(details.retryAfterSeconds ?? 0);
      return wait > 0
        ? `Too many attempts. Try again in ${Math.ceil(wait / 60)} ${Math.ceil(wait / 60) === 1 ? 'minute' : 'minutes'}.`
        : 'Too many wrong attempts. Request a new code.';
    }
    case 'EMAIL_FAILED':
      return "We couldn't send the code. Please try again.";
    case 'TOO_MANY_CODES':
      return 'Too many codes requested. Please try again later.';
    case 'RESEND_TOO_SOON':
      return 'Please wait a few seconds before requesting another code.';
    case 'INVALID_CREDENTIALS':
      return 'Incorrect email or password.';
    case 'RESET_EXPIRED':
    case 'CHALLENGE_NOT_FOUND':
      return 'This step has expired. Please start again.';
    case 'NETWORK':
      return "We couldn't reach the store. Check your connection and try again.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
