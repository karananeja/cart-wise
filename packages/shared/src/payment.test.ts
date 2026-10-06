import { describe, expect, it } from 'vitest';
import {
  bestOfferFor,
  cardLabel,
  cardNetwork,
  cardOutcome,
  DEMO_CARDS,
  demoPaymentUri,
  describeCard,
  findOffer,
  isUpiId,
  luhnValid,
  offerDiscountPaise,
  offerEligibility,
  recogniseCard,
} from './payment.js';

const aurora = findOffer('aurora-credit-10')!;
const meridian = findOffer('meridian-flat-250')!;
const kestrel = findOffer('kestrel-credit-5')!;

describe('offer discounts', () => {
  it('gives nothing below the minimum', () => {
    expect(offerDiscountPaise(aurora, 4_999_99)).toBe(0);
    expect(offerDiscountPaise(meridian, 2_499_00)).toBe(0);
  });

  it('floors percent discounts to the whole rupee and caps them', () => {
    expect(offerDiscountPaise(aurora, 6_000_00)).toBe(600_00);
    expect(offerDiscountPaise(aurora, 5_555_55)).toBe(555_00); // ₹555.555 → ₹555
    expect(offerDiscountPaise(aurora, 50_000_00)).toBe(1_500_00);
    expect(offerDiscountPaise(kestrel, 1_019_90)).toBe(50_00); // ₹50.995 → ₹50
  });

  it('gives flat offers their value', () => {
    expect(offerDiscountPaise(meridian, 2_500_00)).toBe(250_00);
    expect(offerDiscountPaise(meridian, 90_000_00)).toBe(250_00);
  });

  it('picks the best offer for a price, or none', () => {
    expect(bestOfferFor(6_000_00)).toEqual({ offer: aurora, discountPaise: 600_00 });
    expect(bestOfferFor(3_000_00)).toEqual({ offer: meridian, discountPaise: 250_00 });
    expect(bestOfferFor(1_200_00)).toEqual({ offer: kestrel, discountPaise: 60_00 });
    expect(bestOfferFor(800_00)).toBeNull();
  });
});

describe('offer eligibility', () => {
  const auroraCredit = recogniseCard('424242');
  const auroraDebit = recogniseCard('400050');

  it('applies when bank, card type and minimum match', () => {
    expect(offerEligibility(aurora, 6_000_00, auroraCredit)).toEqual({ offerId: aurora.id, applies: true, discountPaise: 600_00, shortfallPaise: 0 });
  });

  it('explains why not', () => {
    expect(offerEligibility(aurora, 4_800_00, auroraCredit)).toMatchObject({ applies: false, reason: 'BELOW_MINIMUM', shortfallPaise: 200_00 });
    expect(offerEligibility(aurora, 6_000_00, null)).toMatchObject({ applies: false, reason: 'NO_CARD', discountPaise: 600_00 });
    expect(offerEligibility(aurora, 6_000_00, recogniseCard('510510'))).toMatchObject({ applies: false, reason: 'WRONG_BANK' });
    expect(offerEligibility(aurora, 6_000_00, auroraDebit)).toMatchObject({ applies: false, reason: 'WRONG_CARD_TYPE' });
    expect(offerEligibility(meridian, 6_000_00, recogniseCard('555544'))).toMatchObject({ applies: true });
  });
});

describe('cards', () => {
  it('checks numbers with Luhn', () => {
    expect(luhnValid('4242424242424242')).toBe(true);
    expect(luhnValid('4242424242424241')).toBe(false);
    expect(luhnValid('378282246310005')).toBe(true);
    expect(luhnValid('42424242')).toBe(false);
    expect(luhnValid('4242 4242 4242 4242')).toBe(false);
  });

  it('recognises networks from the leading digits', () => {
    expect(cardNetwork('411111')).toBe('visa');
    expect(cardNetwork('555555')).toBe('mastercard');
    expect(cardNetwork('222100')).toBe('mastercard');
    expect(cardNetwork('652150')).toBe('rupay');
    expect(cardNetwork('608001')).toBe('rupay');
    expect(cardNetwork('371449')).toBe('amex');
    expect(cardNetwork('900000')).toBeNull();
  });

  it('recognises fictional bank ranges only', () => {
    expect(recogniseCard('424242')).toEqual({ network: 'visa', bank: 'aurora', cardType: 'credit' });
    expect(recogniseCard('411111')).toEqual({ network: 'visa', bank: null, cardType: null });
    expect(describeCard(recogniseCard('424242'))).toBe('Aurora Bank · Visa credit');
    expect(describeCard(recogniseCard('411111'))).toBe('Visa');
    expect(cardLabel(recogniseCard('424242'), '4242')).toBe('Aurora Bank Visa •••• 4242');
    expect(cardLabel(recogniseCard('900000'), '1234')).toBe('Card •••• 1234');
  });

  it('decides outcomes by the last 4 digits', () => {
    expect(cardOutcome('0002')).toBe('declined');
    expect(cardOutcome('9995')).toBe('insufficient_funds');
    expect(cardOutcome('4242')).toBe('success');
  });

  it('lists only valid demo cards, one per fictional range plus the two failures', () => {
    for (const card of DEMO_CARDS) expect(luhnValid(card.number), card.label).toBe(true);
    expect(DEMO_CARDS.map((c) => cardOutcome(c.number.slice(-4)))).toEqual(['success', 'success', 'success', 'success', 'success', 'declined', 'insufficient_funds']);
  });
});

describe('UPI', () => {
  it('accepts name@handle', () => {
    expect(isUpiId('asha.rao@okdemo')).toBe(true);
    expect(isUpiId('98450-12345@upi')).toBe(true);
    expect(isUpiId('asha@')).toBe(false);
    expect(isUpiId('asha@ok1')).toBe(false);
    expect(isUpiId('a b@upi')).toBe(false);
  });

  it('builds the demo payment URI in rupees', () => {
    expect(demoPaymentUri('ORD-ABCD2345', 1_299_00)).toBe('demo-payment://pay?orderId=ORD-ABCD2345&amount=1299.00');
  });
});
