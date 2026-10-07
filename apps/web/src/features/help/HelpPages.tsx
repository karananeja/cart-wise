import { Link } from 'react-router';
import {
  BANKS,
  CANCELLABLE_STATUSES,
  DELIVERY_CODE_ATTEMPTS,
  DELIVERY_OPTIONS,
  DELIVERY_RULES,
  EMI_MIN_PAISE,
  EMI_RATES,
  EMI_TENURES,
  formatPrice,
  FREE_DELIVERY_THRESHOLD_PAISE,
  NO_COST_MIN_PAISE,
  NO_COST_TENURES,
  OFFERS,
  ORDER_STATUS_LABELS,
  PAYMENT_HOLD_MS,
  RETURN_WINDOW_MS,
  UPI_REQUEST_MS,
  ZONE_AREAS,
  ZONE_DAYS,
  type BankId,
} from '@store/shared';
import { HelpLayout } from './HelpLayout';

/*
 * Every number on these pages comes from the shared rules the API enforces (F-018 FR-2), so the
 * help text can't drift from what checkout, payment and orders actually do.
 */

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const days = (range: { minDays: number; maxDays: number } | null) => (range ? `${range.minDays}–${range.maxDays} days` : 'Not available');
/** "3, 6, 9 or 12" */
const orList = (items: readonly (string | number)[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} or ${items.at(-1)}` : String(items[0] ?? ''));
const andList = (items: readonly string[]) => (items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items.at(-1)}` : String(items[0] ?? ''));

export function DeliveryHelpPage() {
  const zones = (['metro', 'regional', 'remote'] as const).map((zone) => ({ zone, area: ZONE_AREAS[zone], ...ZONE_DAYS[zone] }));
  return (
    <HelpLayout title="Delivery" intro="What delivery costs, how long it takes and how the handover works.">
      <section aria-labelledby="help-charges">
        <h2 id="help-charges">Charges</h2>
        <ul>
          <li>
            {DELIVERY_RULES.standard.label}: {formatPrice(DELIVERY_RULES.standard.pricePaise)}, and free on orders of {formatPrice(FREE_DELIVERY_THRESHOLD_PAISE)} or more.
          </li>
          <li>
            {DELIVERY_RULES.express.label}: {formatPrice(DELIVERY_RULES.express.pricePaise)}, where it's available.
          </li>
          <li>Every product follows the same rules.</li>
        </ul>
      </section>

      <section aria-labelledby="help-times">
        <h2 id="help-times">Delivery times</h2>
        <p className="mb-3">Times depend on your pincode. Check yours on any product page to see dates before you buy.</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th scope="col" className="px-3 py-2 font-medium">
                  Where
                </th>
                {DELIVERY_OPTIONS.map((option) => (
                  <th key={option} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                    {DELIVERY_RULES[option].label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {zones.map((row) => (
                <tr key={row.zone} className="border-t">
                  <th scope="row" className="px-3 py-2 font-normal">
                    {row.area}
                  </th>
                  {DELIVERY_OPTIONS.map((option) => (
                    <td key={option} className="px-3 py-2 whitespace-nowrap">
                      {days(row[option])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3">We don't deliver to {ZONE_AREAS.unserviceable} yet.</p>
      </section>

      <section aria-labelledby="help-hold">
        <h2 id="help-hold">Stock hold while you pay</h2>
        <p>
          When you continue to payment, your items are held for {PAYMENT_HOLD_MS / MINUTE_MS} minutes. If the payment isn't completed in that time, the
          items go back on sale and you aren't charged.
        </p>
      </section>

      <section aria-labelledby="help-code">
        <h2 id="help-code">Delivery code</h2>
        <p>
          When your order is out for delivery, its order page shows a delivery code. Give it to the courier at the door: the order is marked delivered only
          with the right code. After {DELIVERY_CODE_ATTEMPTS} wrong codes, a new code is issued.
        </p>
      </section>
    </HelpLayout>
  );
}

export function ReturnsHelpPage() {
  const returnDays = RETURN_WINDOW_MS / DAY_MS;
  const cancellable = CANCELLABLE_STATUSES.map((status) => ORDER_STATUS_LABELS[status]);
  return (
    <HelpLayout title="Returns & refunds" intro="How to cancel an order, return items and get your money back.">
      <section aria-labelledby="help-cancel">
        <h2 id="help-cancel">Cancelling an order</h2>
        <ul>
          <li>
            You can cancel until the order ships, while it is {orList(cancellable.map((label) => `“${label}”`))}.
          </li>
          <li>The refund is instant: the full amount you paid, delivery charge included.</li>
        </ul>
      </section>

      <section aria-labelledby="help-returns">
        <h2 id="help-returns">Returning items</h2>
        <ul>
          <li>Return items within {returnDays} days of delivery from the order page. Choose the items and tell us why.</li>
          <li>Each return goes from Return requested to Picked up to Refunded.</li>
          <li>You get back what you paid for each item. A bank offer on the order is shared across its items.</li>
          <li>The delivery charge isn't refunded on returns.</li>
        </ul>
      </section>

      <section aria-labelledby="help-refunds">
        <h2 id="help-refunds">Where refunds go</h2>
        <ul>
          <li>Refunds go back to the original payment method: the same card or UPI ID.</li>
          <li>Payments made through Razorpay (test mode) are refunded through Razorpay.</li>
          <li>Your order page shows each refund, its amount and where it went.</li>
        </ul>
      </section>
    </HelpLayout>
  );
}

export function PaymentsHelpPage() {
  const banks = Object.keys(EMI_RATES) as BankId[];
  return (
    <HelpLayout title="Payments & EMI" intro="This is a demo store: payments are simulated and no real money is ever charged.">
      <section aria-labelledby="help-methods">
        <h2 id="help-methods">Ways to pay</h2>
        <ul>
          <li>
            <strong className="font-medium">Card:</strong> any number that passes the card-number check works. Only the first 6 and last 4 digits are sent; the
            full number, expiry and CVV stay in your browser and are never stored. A demo bank code is shown on screen to confirm.
          </li>
          <li>
            <strong className="font-medium">UPI:</strong> enter a UPI ID and approve the request in the demo UPI app, or scan a demo QR code. A request stays open
            for {UPI_REQUEST_MS / MINUTE_MS} minutes.
          </li>
          <li>
            <strong className="font-medium">Razorpay:</strong> when it's set up, you can also pay through Razorpay in test mode only, with its own card, UPI,
            netbanking, wallet and EMI options. The demo bank offers and demo EMI below don't apply there.
          </li>
        </ul>
      </section>

      <section aria-labelledby="help-offers">
        <h2 id="help-offers">Bank offers</h2>
        <p className="mb-2">One offer per order. The fictional banks' offers are:</p>
        <ul>
          {OFFERS.map((offer) => (
            <li key={offer.id}>
              {offer.headline} with {offer.cardsLabel}, on orders of {formatPrice(offer.minOrderPaise)} or more
              {offer.kind === 'percent' ? ` (up to ${formatPrice(offer.maxDiscountPaise)})` : ''}.
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="help-emi">
        <h2 id="help-emi">EMI</h2>
        <ul>
          <li>
            EMI is available on {andList(banks.map((bank) => BANKS[bank]))} credit cards, on orders of {formatPrice(EMI_MIN_PAISE)} or more.
          </li>
          <li>
            Choose {orList(EMI_TENURES)} months. Interest is charged by the bank: {andList(banks.map((bank) => `${BANKS[bank]} ${EMI_RATES[bank]}%`))} a year.
            EMI can be combined with your card's bank offer.
          </li>
          <li>
            No-cost EMI is offered on orders of {formatPrice(NO_COST_MIN_PAISE)} or more, over {orList(NO_COST_TENURES)} months. The store pays the interest as an
            upfront discount, so your instalments add up to the price. It counts as the order's offer, so no bank offer can be added.
          </li>
        </ul>
      </section>

      <section aria-labelledby="help-money">
        <h2 id="help-money">No real money</h2>
        <p>
          Nothing on this site charges real money, and no card numbers, CVVs or payment passwords are stored. See{' '}
          <Link to="/help/returns" className="underline underline-offset-4 hover:text-foreground">
            Returns &amp; refunds
          </Link>{' '}
          for how refunds work.
        </p>
      </section>
    </HelpLayout>
  );
}
