import { ApiError } from '@/lib/api';

/** Plain-language messages for order actions; never raw codes (CLAUDE.md §16). */
export function orderActionError(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'NETWORK':
      return "We couldn't reach the store. Check your connection and try again.";
    case 'NOT_CANCELLABLE':
      return 'This order has just shipped, so it can no longer be cancelled.';
    case 'RETURN_WINDOW_CLOSED':
      return 'The return window for this order has closed.';
    case 'ALREADY_RETURNED':
      return 'Some of these items have already been returned.';
    case 'NOT_DELIVERED':
      return 'You can return items once the order is delivered.';
    default:
      return 'Something went wrong. Please try again.';
  }
}
