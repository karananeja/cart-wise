import { useEffect, useState, type FormEvent } from 'react';
import { CreditCard, Loader2, ShieldCheck } from 'lucide-react';
import {
  cvvLength,
  DEMO_CARDS,
  describeCard,
  formatPrice,
  luhnValid,
  OFFERS,
  recogniseCard,
  type Order,
  type PaymentAttemptView,
} from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { FormField } from '@/features/auth/components';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { usePaymentQuote, useStartPayment } from './api';
import { BankVerification } from './BankVerification';
import { EmiPlans, sameChoice, type EmiChoice } from './EmiPlans';
import type { SummaryExtras } from './summary';
import { failureMessage, offerMismatchMessage, paymentErrorMessage } from './messages';
import { PaymentFailure } from './PaymentFailure';

interface CardPaymentProps {
  order: Order;
  /** Tells the page what the summary should show: the bank offer, or the No Cost EMI discount and plan. */
  onSummaryChange: (extras: SummaryExtras) => void;
  onPaid: (order: Order) => void;
  onHoldEnded: () => void;
}

const NO_OFFER = 'none';

/** "4242 4242 4242 4242" while typing. */
const groupDigits = (digits: string) => digits.replace(/(\d{4})(?=\d)/g, '$1 ');

function expiryError(value: string): string | undefined {
  const match = /^(\d{2})\/(\d{2})$/.exec(value);
  if (!match) return 'Enter the expiry as MM/YY';
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return 'Enter a valid month';
  const now = new Date();
  if (year < now.getFullYear() || (year === now.getFullYear() && month < now.getMonth() + 1)) return 'This card has expired';
  return undefined;
}

/**
 * Card payment with a customer-chosen bank offer (spec FR-2, FR-5, FR-9–FR-12). The full number,
 * expiry and CVV never leave this component: only the first 6 and last 4 digits are sent.
 */
export function CardPayment({ order, onSummaryChange, onPaid, onHoldEnded }: CardPaymentProps) {
  const [offerChoice, setOfferChoice] = useState<string | null>(null);
  const [digits, setDigits] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvv, setCvv] = useState('');
  const [errors, setErrors] = useState<{ number?: string; expiry?: string; cvv?: string }>({});
  const [attempt, setAttempt] = useState<PaymentAttemptView>();
  const [failure, setFailure] = useState<string>();
  const [mode, setMode] = useState<'full' | 'emi'>('full');
  const [emiChoice, setEmiChoice] = useState<EmiChoice | null>(null);
  const [emiError, setEmiError] = useState<string>();
  const [offerNote, setOfferNote] = useState<string>();
  const online = useOnlineStatus();

  const offerId = offerChoice && offerChoice !== NO_OFFER ? offerChoice : null;
  const bin = digits.length >= 6 ? digits.slice(0, 6) : undefined;
  const quote = usePaymentQuote(order.id, offerId, bin);
  const start = useStartPayment(order.id);
  const q = quote.data;
  const card = bin ? recogniseCard(bin) : null;
  const applied = q?.selected?.applies ? q.selected : null;
  const appliedOffer = applied ? OFFERS.find((o) => o.id === applied.offerId) : undefined;
  const emiQuote = bin ? q?.emi : undefined;
  const payInEmi = mode === 'emi' && emiQuote?.eligible === true;
  const plan = payInEmi ? emiQuote.plans.find((p) => sameChoice(emiChoice, p)) : undefined;
  const amountToPay = plan ? plan.chargedPaise : (q?.amountToPayPaise ?? order.totals.totalPaise);
  const suggested = q?.suggestedOfferId ? OFFERS.find((o) => o.id === q.suggestedOfferId) : undefined;
  const suggestedSaving = q?.offers.find((o) => o.offerId === q.suggestedOfferId)?.discountPaise ?? 0;
  const mismatch = bin ? offerMismatchMessage(q?.selected ?? null) : undefined;

  useEffect(() => {
    onSummaryChange({
      bankOffer: appliedOffer && applied && !plan?.noCost ? { bankName: appliedOffer.bankName, discountPaise: applied.discountPaise } : null,
      noCostDiscountPaise: plan?.noCost ? plan.discountPaise : 0,
      emi: plan ?? null,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedOffer?.id, applied?.discountPaise, plan?.tenure, plan?.noCost, plan?.chargedPaise]);

  // A different card can end EMI eligibility: back to paying in full.
  useEffect(() => {
    if (emiQuote && !emiQuote.eligible) {
      setMode('full');
      setEmiChoice(null);
    }
  }, [emiQuote]);

  /** No Cost EMI is the order's one offer (D2): choosing it drops a chosen bank offer, and vice versa. */
  const choosePlan = (chosen: EmiChoice) => {
    setEmiError(undefined);
    setEmiChoice(chosen);
    if (chosen.noCost && offerId) {
      setOfferChoice(NO_OFFER);
      setOfferNote('No Cost EMI is this order’s offer, so the bank offer was removed.');
    } else setOfferNote(undefined);
  };
  const chooseOffer = (id: string) => {
    setOfferChoice(id);
    if (id !== NO_OFFER && emiChoice?.noCost) {
      setEmiChoice(null);
      setOfferNote('A bank offer can’t be combined with No Cost EMI. Choose another EMI plan or pay in full.');
    } else setOfferNote(undefined);
  };

  const validate = () => {
    const next: typeof errors = {};
    if (!luhnValid(digits)) next.number = 'Enter a valid card number';
    next.expiry = expiryError(expiry);
    if (cvv.length !== cvvLength(card?.network ?? null)) next.cvv = `Enter the ${cvvLength(card?.network ?? null)}-digit CVV`;
    setErrors(next);
    return !next.number && !next.expiry && !next.cvv;
  };

  const pay = (event: FormEvent) => {
    event.preventDefault();
    setFailure(undefined);
    if (!validate()) return;
    if (payInEmi && !plan) {
      setEmiError('Choose an EMI plan');
      return;
    }
    start.mutate(
      {
        method: 'card',
        bin: digits.slice(0, 6),
        last4: digits.slice(-4),
        ...(applied && !plan?.noCost ? { offerId: applied.offerId } : {}),
        ...(plan ? { emi: { tenure: plan.tenure, noCost: plan.noCost } } : {}),
      },
      {
        onSuccess: (result) => setAttempt(result.attempt),
        onError: (error) => {
          if (error instanceof ApiError && ['HOLD_EXPIRED', 'ORDER_NOT_PENDING'].includes(error.code)) onHoldEnded();
          if (error instanceof ApiError && ['OFFER_NOT_APPLICABLE', 'EMI_NOT_AVAILABLE'].includes(error.code)) void quote.refetch();
        },
      },
    );
  };

  if (attempt?.status === 'pending') {
    return (
      <BankVerification
        attempt={attempt}
        onSucceeded={onPaid}
        onFailed={(failed) => {
          setAttempt(undefined);
          setCvv('');
          if (failed.failureReason === 'hold_expired') onHoldEnded();
          else if (failed.failureReason !== 'cancelled') setFailure(failureMessage(failed.failureReason));
        }}
      />
    );
  }

  const payButton = (
    <Button type="submit" form="card-payment" size="lg" className="h-12 w-full" disabled={start.isPending || !online}>
      {start.isPending && <Loader2 className="animate-spin" aria-hidden />}
      Pay {formatPrice(amountToPay)}
    </Button>
  );

  return (
    <form id="card-payment" onSubmit={pay} noValidate className="flex flex-col gap-5">
      {failure && <PaymentFailure message={failure} onRetry={() => setFailure(undefined)} />}

      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Bank offers (demo) — choose one</legend>
        {OFFERS.map((offer) => {
          const eligibility = q?.offers.find((o) => o.offerId === offer.id);
          const short = eligibility?.shortfallPaise ?? 0;
          return (
            <label
              key={offer.id}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-foreground has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input type="radio" name="offer" className="mt-1" value={offer.id} checked={offerChoice === offer.id} disabled={short > 0} onChange={() => chooseOffer(offer.id)} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium">
                  {offer.bankName} — {offer.headline}
                </span>
                <span className="text-muted-foreground">
                  {offer.cardsLabel} · min. order {formatPrice(offer.minOrderPaise)} · up to {formatPrice(offer.maxDiscountPaise)}
                </span>
                {short > 0 ? (
                  <span className="text-xs">Add {formatPrice(short)} more to qualify</span>
                ) : (
                  eligibility && <span className="text-xs text-emerald-700 dark:text-emerald-400">Save {formatPrice(eligibility.discountPaise)}</span>
                )}
              </span>
            </label>
          );
        })}
        <label className="flex cursor-pointer items-center gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50">
          <input type="radio" name="offer" value={NO_OFFER} checked={offerChoice === NO_OFFER} onChange={() => chooseOffer(NO_OFFER)} />
          <span className="font-medium">No offer</span>
        </label>
      </fieldset>

      <div className="flex flex-col gap-4">
        <FormField
          label="Card number"
          inputMode="numeric"
          autoComplete="cc-number"
          placeholder="1234 5678 9012 3456"
          value={groupDigits(digits)}
          maxLength={23}
          error={errors.number}
          hint={card ? describeCard(card) : undefined}
          onChange={(e) => setDigits(e.target.value.replace(/\D/g, '').slice(0, 19))}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            label="Expiry (MM/YY)"
            inputMode="numeric"
            autoComplete="cc-exp"
            placeholder="MM/YY"
            value={expiry}
            maxLength={5}
            error={errors.expiry}
            onChange={(e) => {
              const d = e.target.value.replace(/\D/g, '').slice(0, 4);
              setExpiry(d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d);
            }}
          />
          <FormField
            label="CVV"
            type="password"
            inputMode="numeric"
            autoComplete="cc-csc"
            value={cvv}
            maxLength={4}
            error={errors.cvv}
            onChange={(e) => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
          />
        </div>
        <details className="rounded-lg border p-3 text-sm">
          <summary className="cursor-pointer font-medium">Use a demo card</summary>
          <p className="mt-2 text-muted-foreground">
            Any valid card number works. Numbers ending 0002 are declined and 9995 fail for insufficient funds. Use any future expiry and any CVV.
          </p>
          <ul className="mt-2 flex flex-col gap-1">
            {DEMO_CARDS.map((demo) => (
              <li key={demo.number}>
                <Button type="button" variant="link" className="h-auto px-0" onClick={() => setDigits(demo.number)}>
                  <CreditCard aria-hidden /> {demo.label} · {groupDigits(demo.number)}
                </Button>
              </li>
            ))}
          </ul>
        </details>
      </div>

      <EmiPlans
        quote={emiQuote}
        mode={mode}
        onModeChange={(next) => {
          setMode(next);
          setEmiError(undefined);
          if (next === 'full') setEmiChoice(null);
        }}
        choice={emiChoice}
        onChoose={choosePlan}
        error={emiError}
      />

      <div aria-live="polite" className="flex flex-col gap-2 empty:hidden">
        {offerNote && <p className="text-sm text-muted-foreground">{offerNote}</p>}
        {mismatch && (
          <Alert role="status">
            <AlertDescription>{mismatch} You'll pay the full amount with this card.</AlertDescription>
          </Alert>
        )}
        {suggested && !plan?.noCost && (
          <Alert role="status">
            <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
              Your card qualifies for the {suggested.bankName} offer (−{formatPrice(suggestedSaving)})
              <Button type="button" size="sm" variant="outline" onClick={() => chooseOffer(suggested.id)}>
                Apply
              </Button>
            </AlertDescription>
          </Alert>
        )}
        {appliedOffer && applied && !plan?.noCost && (
          <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
            {appliedOffer.bankName} offer: −{formatPrice(applied.discountPaise)}
          </p>
        )}
      </div>

      {start.isError && (
        <Alert variant="destructive">
          <AlertDescription>{paymentErrorMessage(start.error)}</AlertDescription>
        </Alert>
      )}
      {!online && (
        <Alert>
          <AlertDescription>You're offline. Reconnect to pay.</AlertDescription>
        </Alert>
      )}

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <ShieldCheck className="size-4" aria-hidden /> Only the first 6 and last 4 digits are sent. The full number, expiry and CVV stay on this device.
      </p>
      <div className="hidden lg:block">{payButton}</div>
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <p className="flex flex-col text-sm">
          <span className="text-muted-foreground">Amount to pay</span>
          <span className="text-base font-semibold tabular-nums">{formatPrice(amountToPay)}</span>
        </p>
        <div className="flex-1">{payButton}</div>
      </div>
    </form>
  );
}
