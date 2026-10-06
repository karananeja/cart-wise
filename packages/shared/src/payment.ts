/**
 * Simulated payment rules (F-009). Every bank, card range and offer here is fictional. The API
 * is the authority; the web uses the same rules to preview amounts. Razorpay (F-014, ADR-005)
 * runs in test mode only.
 */
import type { EmiPlan, EmiQuote } from './emi.js';

export const PAYMENT_METHODS = ['card', 'upi_id', 'upi_qr', 'razorpay'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

/** A UPI collect request or QR stays open this long (never past the stock hold). */
export const UPI_REQUEST_MS = 5 * 60 * 1000;
/** Wrong bank OTPs allowed before the card attempt fails. */
export const CARD_OTP_ATTEMPTS = 3;

// ── Offers ────────────────────────────────────────────────────────────────────────────────

export type CardType = 'credit' | 'debit';
export type BankId = 'aurora' | 'meridian' | 'kestrel';

export const BANKS: Record<BankId, string> = {
  aurora: 'Aurora Bank',
  meridian: 'Meridian Bank',
  kestrel: 'Kestrel Bank',
};

export interface Offer {
  id: string;
  bank: BankId;
  bankName: string;
  cardTypes: CardType[];
  kind: 'percent' | 'flat';
  /** Percent (e.g. 10) or flat amount in paise. */
  value: number;
  minOrderPaise: number;
  maxDiscountPaise: number;
  /** "10% instant discount", "Flat ₹250 off". */
  headline: string;
  /** "Aurora Bank credit cards". */
  cardsLabel: string;
}

export const OFFERS: Offer[] = [
  {
    id: 'aurora-credit-10',
    bank: 'aurora',
    bankName: BANKS.aurora,
    cardTypes: ['credit'],
    kind: 'percent',
    value: 10,
    minOrderPaise: 5_000_00,
    maxDiscountPaise: 1_500_00,
    headline: '10% instant discount',
    cardsLabel: 'Aurora Bank credit cards',
  },
  {
    id: 'meridian-flat-250',
    bank: 'meridian',
    bankName: BANKS.meridian,
    cardTypes: ['credit', 'debit'],
    kind: 'flat',
    value: 250_00,
    minOrderPaise: 2_500_00,
    maxDiscountPaise: 250_00,
    headline: 'Flat ₹250 off',
    cardsLabel: 'Meridian Bank credit and debit cards',
  },
  {
    id: 'kestrel-credit-5',
    bank: 'kestrel',
    bankName: BANKS.kestrel,
    cardTypes: ['credit'],
    kind: 'percent',
    value: 5,
    minOrderPaise: 1_000_00,
    maxDiscountPaise: 750_00,
    headline: '5% instant discount',
    cardsLabel: 'Kestrel Bank credit cards',
  },
];

export const findOffer = (id: string | null | undefined): Offer | undefined => OFFERS.find((o) => o.id === id);

/** Discount an offer gives on an amount: 0 below the minimum; percent floored to the rupee, then capped. */
export function offerDiscountPaise(offer: Offer, amountPaise: number): number {
  if (amountPaise < offer.minOrderPaise) return 0;
  const raw = offer.kind === 'percent' ? Math.floor((amountPaise * offer.value) / 100 / 100) * 100 : offer.value;
  return Math.min(raw, offer.maxDiscountPaise, amountPaise);
}

/** The offer saving the most on this price, for the product-page banner; null when none applies. */
export function bestOfferFor(pricePaise: number): { offer: Offer; discountPaise: number } | null {
  let best: { offer: Offer; discountPaise: number } | null = null;
  for (const offer of OFFERS) {
    const discountPaise = offerDiscountPaise(offer, pricePaise);
    if (discountPaise > 0 && (!best || discountPaise > best.discountPaise)) best = { offer, discountPaise };
  }
  return best;
}

export type OfferIneligibility = 'BELOW_MINIMUM' | 'NO_CARD' | 'WRONG_BANK' | 'WRONG_CARD_TYPE';

export interface OfferEligibility {
  offerId: string;
  applies: boolean;
  /** Saving on this amount if the card matches (0 below the minimum). */
  discountPaise: number;
  /** How much more the order needs to reach the minimum (0 when it does). */
  shortfallPaise: number;
  reason?: OfferIneligibility;
}

/** Whether an offer applies to this amount and card. `card` is null until a card is recognised. */
export function offerEligibility(offer: Offer, amountPaise: number, card: RecognisedCard | null): OfferEligibility {
  const shortfallPaise = Math.max(0, offer.minOrderPaise - amountPaise);
  const discountPaise = offerDiscountPaise(offer, amountPaise);
  const base = { offerId: offer.id, discountPaise, shortfallPaise };
  if (shortfallPaise > 0) return { ...base, applies: false, reason: 'BELOW_MINIMUM' };
  if (!card) return { ...base, applies: false, reason: 'NO_CARD' };
  if (card.bank !== offer.bank) return { ...base, applies: false, reason: 'WRONG_BANK' };
  if (!card.cardType || !offer.cardTypes.includes(card.cardType)) return { ...base, applies: false, reason: 'WRONG_CARD_TYPE' };
  return { ...base, applies: true };
}

// ── Cards ─────────────────────────────────────────────────────────────────────────────────

export type CardNetwork = 'visa' | 'mastercard' | 'rupay' | 'amex';

export const NETWORK_NAMES: Record<CardNetwork, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  rupay: 'RuPay',
  amex: 'American Express',
};

export function luhnValid(number: string): boolean {
  if (!/^\d{12,19}$/.test(number)) return false;
  let sum = 0;
  let double = false;
  for (let i = number.length - 1; i >= 0; i -= 1) {
    let digit = Number(number[i]);
    if (double) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Network from the leading digits; null when unknown. RuPay is checked before the others it overlaps. */
export function cardNetwork(prefix: string): CardNetwork | null {
  if (/^(60|65|81|82|508)/.test(prefix)) return 'rupay';
  if (/^3[47]/.test(prefix)) return 'amex';
  if (/^4/.test(prefix)) return 'visa';
  if (/^(5[1-5]|222[1-9]|22[3-9]|2[3-6]|27[01]|2720)/.test(prefix)) return 'mastercard';
  return null;
}

/** Fictional bank card ranges (first 6 digits). Only these can receive an offer. */
export const CARD_RANGES: { bin: string; bank: BankId; network: CardNetwork; cardType: CardType }[] = [
  { bin: '424242', bank: 'aurora', network: 'visa', cardType: 'credit' },
  { bin: '400050', bank: 'aurora', network: 'visa', cardType: 'debit' },
  { bin: '510510', bank: 'meridian', network: 'mastercard', cardType: 'credit' },
  { bin: '555544', bank: 'meridian', network: 'mastercard', cardType: 'debit' },
  { bin: '652150', bank: 'kestrel', network: 'rupay', cardType: 'credit' },
];

export interface RecognisedCard {
  network: CardNetwork | null;
  /** Set only for the fictional bank ranges. */
  bank: BankId | null;
  cardType: CardType | null;
}

/** What the first 6 digits say about a card. */
export function recogniseCard(bin: string): RecognisedCard {
  const range = CARD_RANGES.find((r) => r.bin === bin.slice(0, 6));
  if (range) return { network: range.network, bank: range.bank, cardType: range.cardType };
  return { network: cardNetwork(bin), bank: null, cardType: null };
}

/** "Aurora Bank · Visa credit", "Visa", or "Card". */
export function describeCard(card: RecognisedCard): string {
  const network = card.network ? NETWORK_NAMES[card.network] : 'Card';
  if (!card.bank) return network;
  return `${BANKS[card.bank]} · ${network} ${card.cardType ?? ''}`.trim();
}

export type CardOutcome = 'success' | 'declined' | 'insufficient_funds';

/** Simulated outcome, keyed on the last 4 digits (user decision 2026-10-06). */
export function cardOutcome(last4: string): CardOutcome {
  if (last4 === '0002') return 'declined';
  if (last4 === '9995') return 'insufficient_funds';
  return 'success';
}

/** Convenience list on the payment page. Any Luhn-valid number works. */
export const DEMO_CARDS: { number: string; label: string }[] = [
  { number: '4242424242424242', label: 'Aurora Bank Visa credit' },
  { number: '4000500000001009', label: 'Aurora Bank Visa debit' },
  { number: '5105105105105100', label: 'Meridian Bank Mastercard credit' },
  { number: '5555444400001002', label: 'Meridian Bank Mastercard debit' },
  { number: '6521500000001004', label: 'Kestrel Bank RuPay credit' },
  { number: '4000000000000002', label: 'Visa — is declined' },
  { number: '4000000000009995', label: 'Visa — insufficient funds' },
];

/** CVV length for a network (American Express uses 4). */
export const cvvLength = (network: CardNetwork | null) => (network === 'amex' ? 4 : 3);

/** "Aurora Bank Visa •••• 4242", "Visa •••• 0002". */
export function cardLabel(card: RecognisedCard, last4: string): string {
  const network = card.network ? NETWORK_NAMES[card.network] : 'Card';
  return `${card.bank ? `${BANKS[card.bank]} ` : ''}${network} •••• ${last4}`;
}

// ── UPI ───────────────────────────────────────────────────────────────────────────────────

export function isUpiId(value: string): boolean {
  return /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/.test(value);
}

/** Simulated UPI QR payload (brief §13). Amount in rupees. */
export function demoPaymentUri(orderId: string, amountPaise: number): string {
  return `demo-payment://pay?orderId=${encodeURIComponent(orderId)}&amount=${(amountPaise / 100).toFixed(2)}`;
}

// ── API shapes ────────────────────────────────────────────────────────────────────────────

export type PaymentAttemptStatus = 'pending' | 'succeeded' | 'failed';

export type PaymentFailureReason =
  | 'declined'
  | 'insufficient_funds'
  | 'verification_failed'
  | 'upi_declined'
  | 'upi_expired'
  | 'cancelled'
  | 'hold_expired'
  /** Razorpay could not complete the payment (F-014). */
  | 'gateway_failed'
  /** The Razorpay response could not be verified. */
  | 'gateway_unverified';

export interface PaymentAttemptView {
  id: string;
  orderId: string;
  method: PaymentMethod;
  status: PaymentAttemptStatus;
  failureReason: PaymentFailureReason | null;
  amountPaise: number;
  discountPaise: number;
  offerId: string | null;
  /** Masked method, e.g. "Aurora Bank Visa •••• 4242" or "UPI · asha@okdemo". */
  label: string;
  expiresAt: string;
  /** Card attempts while pending: the simulated bank OTP, shown on screen (ADR-003 pattern). */
  demoCode?: string;
  otpAttemptsLeft?: number;
  /** UPI QR attempts. */
  qrUri?: string;
  /** Card attempts paid in EMI (F-014). */
  emi?: EmiPlan;
  /** Razorpay attempts while pending: what Razorpay Checkout needs (no secrets). */
  gateway?: RazorpayCheckout;
}

/** Options for Razorpay Checkout in the browser. */
export interface RazorpayCheckout {
  keyId: string;
  orderId: string;
  amountPaise: number;
  prefill: { name: string; email: string; contact: string };
}

export interface PaymentConfig {
  razorpay: { enabled: boolean; keyId: string | null; testMode: true };
}

export interface PaymentQuote {
  orderTotalPaise: number;
  card: RecognisedCard | null;
  offers: OfferEligibility[];
  /** The chosen offer's result, when one was chosen. */
  selected: OfferEligibility | null;
  /** An offer this card qualifies for that isn't the chosen one (the Apply hint). */
  suggestedOfferId: string | null;
  amountToPayPaise: number;
  /** EMI plans for the recognised card (F-014). */
  emi: EmiQuote;
}

/** Card payments send only these digits; the full number, expiry and CVV stay in the browser. */
export interface CardPaymentInput {
  method: 'card';
  bin: string;
  last4: string;
  offerId?: string;
  /** Pay in EMI (F-014). No-cost EMI cannot be combined with an offer. */
  emi?: { tenure: number; noCost: boolean };
  visitorId?: string;
}

export type PaymentInput =
  | CardPaymentInput
  | { method: 'upi_id'; upiId: string; visitorId?: string }
  | { method: 'upi_qr'; visitorId?: string }
  | { method: 'razorpay'; visitorId?: string };

export type PaymentProvider = 'demo' | 'razorpay';

export interface OrderPayment {
  method: PaymentMethod;
  label: string;
  offerId: string | null;
  offerDiscountPaise: number;
  paidPaise: number;
  paidAt: string;
  provider: PaymentProvider;
  /** The EMI plan, when paid in EMI with the demo payment. */
  emi: { tenure: number; monthlyPaise: number; interestPaise: number; noCost: boolean } | null;
}

export const PAYMENT_FAILURE_MESSAGES: Record<PaymentFailureReason, string> = {
  declined: 'Your bank declined this payment.',
  insufficient_funds: 'The payment failed because of insufficient funds.',
  verification_failed: 'Verification failed — too many wrong codes.',
  upi_declined: 'You declined the request.',
  upi_expired: 'The request expired.',
  cancelled: 'The payment was cancelled.',
  hold_expired: 'Your hold expired before the payment completed.',
  gateway_failed: "Razorpay couldn't complete the payment.",
  gateway_unverified: "We couldn't confirm this payment with Razorpay.",
};
