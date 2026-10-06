import { findOffer, PAYMENT_FAILURE_MESSAGES, type OfferEligibility, type PaymentFailureReason } from '@store/shared';
import { ApiError } from '@/lib/api';

export const NETWORK_MESSAGE = "We couldn't reach the payment service — you have not been charged.";

export function failureMessage(reason: PaymentFailureReason | null): string {
  return reason ? PAYMENT_FAILURE_MESSAGES[reason] : 'The payment did not go through.';
}

/** Plain words for errors from starting or acting on a payment. */
export function paymentErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return 'Something went wrong. You have not been charged.';
  switch (error.code) {
    case 'NETWORK':
      return NETWORK_MESSAGE;
    case 'OFFER_NOT_APPLICABLE':
      return "That offer doesn't apply to this card. Choose another offer or pay the full amount.";
    case 'INVALID_CARD':
      return 'Check the card number and try again.';
    case 'INVALID_UPI_ID':
      return 'Enter a UPI ID like name@bank.';
    case 'HOLD_EXPIRED':
      return 'Your hold expired before the payment completed. You have not been charged.';
    case 'ORDER_NOT_PENDING':
      return 'This order can no longer be paid.';
    default:
      return 'Something went wrong. You have not been charged.';
  }
}

/** "an Aurora Bank credit card", "a Meridian Bank credit or debit card". */
function oneCard(cardsLabel: string): string {
  const singular = cardsLabel.replace(' and ', ' or ').replace(/cards$/, 'card');
  return `${/^[AEIOU]/i.test(singular) ? 'an' : 'a'} ${singular}`;
}

/** Why a chosen offer doesn't apply to the card entered; undefined while there's nothing to explain. */
export function offerMismatchMessage(eligibility: OfferEligibility | null): string | undefined {
  if (!eligibility || eligibility.applies) return undefined;
  const offer = findOffer(eligibility.offerId);
  if (!offer) return undefined;
  if (eligibility.reason === 'WRONG_BANK' || eligibility.reason === 'WRONG_CARD_TYPE') return `This offer needs ${oneCard(offer.cardsLabel)}.`;
  return undefined;
}
