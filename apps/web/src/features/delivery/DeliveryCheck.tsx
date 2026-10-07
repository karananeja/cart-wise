import { useId, useState, type FormEvent } from 'react';
import { Truck } from 'lucide-react';
import { deliveryOptions, deliveryZone, FREE_DELIVERY_THRESHOLD_PAISE, formatPrice, normalizePincode, type DeliveryQuote } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAddresses } from '@/features/addresses/api';
import { useMe } from '@/features/auth/api';
import { track } from '@/lib/analytics';
import { saveDeliveryPincode, useSavedDeliveryPincode } from '@/lib/deliveryPincode';

const arrivesFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const arrivesBy = (quote: DeliveryQuote) => `Arrives by ${arrivesFormat.format(new Date(quote.estimate.to))}`;

/**
 * "Can you deliver this to me, and by when?" (F-015). Worked out on the device from the same
 * shared zone rules checkout uses, so the answer is instant and matches checkout.
 */
export function DeliveryCheck({ pricePaise }: { pricePaise: number }) {
  const saved = useSavedDeliveryPincode();
  const signedIn = Boolean(useMe().data?.user);
  // A typed pincode wins; otherwise a signed-in shopper starts from their default address.
  const addresses = useAddresses(signedIn && !saved);
  const fromAddress = addresses.data?.find((a) => a.isDefault)?.pincode;
  const pincode = saved ?? (fromAddress ? normalizePincode(fromAddress) : null);
  const [editing, setEditing] = useState(false);

  return (
    <section aria-labelledby="delivery-check-heading" className="flex flex-col gap-2 rounded-xl border p-4 text-sm">
      <h2 id="delivery-check-heading" className="flex items-center gap-2 font-medium">
        <Truck className="size-4" aria-hidden /> Delivery
      </h2>
      {pincode && !editing ? (
        <DeliveryResult pincode={pincode} pricePaise={pricePaise} onChange={() => setEditing(true)} />
      ) : (
        <PincodeForm
          initial={editing ? (pincode ?? '') : ''}
          onCancel={editing ? () => setEditing(false) : undefined}
          onCheck={(next) => {
            const zone = deliveryZone(next);
            const offered = deliveryOptions(pricePaise, new Date(), zone);
            track('delivery_check_performed', {
              zone,
              serviceable: offered.length > 0,
              expressAvailable: offered.some((o) => o.option === 'express'),
              source: 'typed',
            });
            saveDeliveryPincode(next);
            setEditing(false);
          }}
        />
      )}
    </section>
  );
}

function PincodeForm({ initial, onCheck, onCancel }: { initial: string; onCheck: (pincode: string) => void; onCancel?: () => void }) {
  const [value, setValue] = useState(initial);
  const [error, setError] = useState<string>();
  const inputId = useId();
  const errorId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const pincode = normalizePincode(value);
    if (!pincode) return setError('Enter a 6-digit pincode');
    setError(undefined);
    onCheck(pincode);
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-muted-foreground">
        Check delivery to your pincode
      </label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          inputMode="numeric"
          autoComplete="postal-code"
          maxLength={7}
          placeholder="e.g. 560038"
          className="max-w-40"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          autoFocus={Boolean(onCancel)}
        />
        <Button type="submit" variant="outline">
          Check
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
      {error && (
        <p id={errorId} className="text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}

function DeliveryResult({ pincode, pricePaise, onChange }: { pincode: string; pricePaise: number; onChange: () => void }) {
  const options = deliveryOptions(pricePaise, new Date(), deliveryZone(pincode));
  const standard = options.find((o) => o.option === 'standard');
  const express = options.find((o) => o.option === 'express');

  return (
    <div className="flex flex-col gap-1.5">
      <p className="flex flex-wrap items-baseline gap-x-2">
        <span>
          Delivery to <span className="font-medium">{pincode}</span>
        </span>
        <Button variant="link" className="h-auto p-0" onClick={onChange} aria-label={`Change pincode ${pincode}`}>
          Change
        </Button>
      </p>
      <div aria-live="polite" className="flex flex-col gap-1">
        {!standard ? (
          <p className="font-medium text-amber-700 dark:text-amber-400">We don't deliver to {pincode} yet.</p>
        ) : (
          <>
            <p>
              <span className="font-medium">Standard</span> · {arrivesBy(standard)} ·{' '}
              {standard.pricePaise === 0 ? 'Free' : `${formatPrice(standard.pricePaise)} (free over ${formatPrice(FREE_DELIVERY_THRESHOLD_PAISE)})`}
            </p>
            <p className={express ? undefined : 'text-muted-foreground'}>
              {express ? (
                <>
                  <span className="font-medium">Express</span> · {arrivesBy(express)} · {formatPrice(express.pricePaise)}
                </>
              ) : (
                'Express not available here'
              )}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
