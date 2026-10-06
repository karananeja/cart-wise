import { EMI_INELIGIBILITY_MESSAGES, formatPrice, type EmiPlan, type EmiQuote } from '@store/shared';
import { emiCostText, instalments } from './emiText';

export type EmiChoice = { tenure: number; noCost: boolean };
export const sameChoice = (a: EmiChoice | null, b: EmiPlan) => a !== null && a.tenure === b.tenure && a.noCost === b.noCost;

interface EmiPlansProps {
  quote: EmiQuote | undefined;
  mode: 'full' | 'emi';
  onModeChange: (mode: 'full' | 'emi') => void;
  choice: EmiChoice | null;
  onChoose: (plan: EmiPlan) => void;
  error?: string;
}

/**
 * Pay in full or in EMI, shown once an eligible credit card is entered (F-014 FR-5). Each plan
 * shows the monthly amount, what it costs and what is charged today; no plan is preselected.
 */
export function EmiPlans({ quote, mode, onModeChange, choice, onChoose, error }: EmiPlansProps) {
  if (!quote) return null;
  if (!quote.eligible) {
    return quote.reason && quote.reason !== 'NO_CARD' ? <p className="text-sm text-muted-foreground">{EMI_INELIGIBILITY_MESSAGES[quote.reason]}</p> : null;
  }
  return (
    <div className="flex flex-col gap-3">
      <fieldset className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
        <legend className="mb-2 text-sm font-medium">How do you want to pay?</legend>
        <label className="flex items-center gap-2">
          <input type="radio" name="pay-mode" checked={mode === 'full'} onChange={() => onModeChange('full')} /> Pay in full
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" name="pay-mode" checked={mode === 'emi'} onChange={() => onModeChange('emi')} /> Pay in EMI
        </label>
      </fieldset>
      {mode === 'emi' && (
        <fieldset className="flex flex-col gap-2" aria-describedby={error ? 'emi-error' : undefined}>
          <legend className="mb-2 text-sm font-medium">EMI plans from {quote.bankName} (demo)</legend>
          {quote.plans.map((plan) => (
            <label
              key={`${plan.tenure}-${plan.noCost}`}
              className="flex cursor-pointer items-start gap-3 rounded-lg border p-3 text-sm has-[:checked]:border-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input type="radio" name="emi-plan" className="mt-1" checked={sameChoice(choice, plan)} onChange={() => onChoose(plan)} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {instalments(plan)}{' '}
                  {plan.noCost && (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">No Cost</span>
                  )}
                </span>{' '}
                <span className="text-muted-foreground">
                  {plan.tenure} months at {plan.ratePercent}% p.a. · {emiCostText(plan)} · total {formatPrice(plan.totalPaise)}.
                </span>{' '}
                {plan.noCost && (
                  <span className="text-xs text-emerald-700 dark:text-emerald-400">
                    {formatPrice(plan.discountPaise)} off today; charged {formatPrice(plan.chargedPaise)}. Can't be combined with a bank offer.
                  </span>
                )}
              </span>
            </label>
          ))}
          {error && (
            <p id="emi-error" role="alert" className="text-sm font-medium text-destructive">
              {error}
            </p>
          )}
        </fieldset>
      )}
    </div>
  );
}
