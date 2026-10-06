import { ApiError } from '@/lib/api';

/** User-facing text for cart failures; never shows technical detail (NFR-7). */
export function cartErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. Please try again.';
  switch (error.code) {
    case 'SIZE_REQUIRED':
      return 'Please select a size';
    case 'INVALID_SIZE':
      return 'That size is no longer available';
    case 'OUT_OF_STOCK':
      return 'Sorry, this just sold out';
    case 'QUANTITY_LIMIT': {
      const max = Number(error.details?.max ?? 0);
      return max > 0 ? `You can have up to ${max} of this item` : 'No more of this item is available';
    }
    case 'LINE_NOT_FOUND':
      return 'That item is no longer in your cart';
    case 'PRODUCT_NOT_FOUND':
      return 'This product is no longer available';
    case 'NETWORK':
      return "We couldn't reach the store. Check your connection and try again.";
    default:
      return 'Something went wrong. Please try again.';
  }
}
