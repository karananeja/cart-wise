import { CalendarClock } from 'lucide-react';
import { BANKS, EMI_RATES, EMI_TENURES, emiPlan, formatPrice, lowestEmi, NO_COST_MIN_PAISE, NO_COST_TENURES, type BankId } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

/**
 * "EMI from ₹X/month · No Cost EMI available" for the price shown (F-014 FR-6), with the plans
 * per bank. Hidden below the EMI minimum and when the product can't be bought.
 */
export function EmiBanner({ pricePaise, outOfStock }: { pricePaise: number; outOfStock: boolean }) {
  const lowest = lowestEmi(pricePaise);
  if (!lowest || outOfStock) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
      <CalendarClock className="size-4 text-muted-foreground" aria-hidden />
      <span>
        EMI from <span className="font-semibold">{formatPrice(lowest.monthlyPaise)}/month</span>
        {lowest.noCostAvailable && <span className="font-medium text-emerald-700 dark:text-emerald-400"> · No Cost EMI available</span>}
      </span>
      <EmiPlansDialog pricePaise={pricePaise} />
    </div>
  );
}

function EmiPlansDialog({ pricePaise }: { pricePaise: number }) {
  const banks = Object.keys(BANKS) as BankId[];
  const noCost = pricePaise >= NO_COST_MIN_PAISE;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="link" className="h-auto px-0 text-sm">
          View plans
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>EMI plans</DialogTitle>
          <DialogDescription>
            Demo plans on Aurora, Meridian and Kestrel Bank credit cards for {formatPrice(pricePaise)}. Choose a plan at payment.
            {noCost && ' No Cost EMI: a discount today makes the instalments add up to exactly the price.'}
          </DialogDescription>
        </DialogHeader>
        {banks.map((bank) => (
          <section key={bank} aria-labelledby={`emi-${bank}`} className="flex flex-col gap-2">
            <h3 id={`emi-${bank}`} className="text-sm font-medium">
              {BANKS[bank]} · {EMI_RATES[bank]}% p.a.
            </h3>
            <table className="w-full text-sm">
              <thead className="text-left text-muted-foreground">
                <tr>
                  <th scope="col" className="font-normal">Months</th>
                  <th scope="col" className="text-right font-normal">Monthly</th>
                  <th scope="col" className="text-right font-normal">Interest</th>
                </tr>
              </thead>
              <tbody className="tabular-nums">
                {noCost &&
                  NO_COST_TENURES.map((n) => {
                    const plan = emiPlan(bank, pricePaise, n, true);
                    return (
                      <tr key={`nc-${n}`}>
                        <td>
                          {n} <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400">No Cost</span>
                        </td>
                        <td className="text-right">{formatPrice(plan.monthlyPaise)}</td>
                        <td className="text-right">₹0</td>
                      </tr>
                    );
                  })}
                {EMI_TENURES.map((n) => {
                  const plan = emiPlan(bank, pricePaise, n, false);
                  return (
                    <tr key={n}>
                      <td>{n}</td>
                      <td className="text-right">{formatPrice(plan.monthlyPaise)}</td>
                      <td className="text-right">{formatPrice(plan.interestPaise)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        ))}
      </DialogContent>
    </Dialog>
  );
}
