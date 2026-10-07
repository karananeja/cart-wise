import { useState, type FormEvent } from 'react';
import { Loader2, MapPin } from 'lucide-react';
import { ADDRESS_TYPES, checkAddress, deliveryZone, INDIAN_STATES, normalizePincode, type AddressErrors, type AddressInput } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { FormField } from '@/features/auth/components';
import { cn } from '@/lib/utils';
import { LazyMap } from './LazyMap';

const TYPE_LABELS = { home: 'Home', work: 'Work', other: 'Other' } as const;

/** F-015: saving is allowed, but say up front that orders can't be delivered there yet. */
function pincodeHint(value: string): string | undefined {
  const pincode = normalizePincode(value);
  return pincode && deliveryZone(pincode) === 'unserviceable' ? "We don't deliver here yet. You can still save it." : undefined;
}

interface AddressFormProps {
  initial: AddressInput;
  onSubmit: (values: AddressInput) => void;
  /** Re-open the map to move the pin (keeps flat/landmark). */
  onChangeLocation: () => void;
  saving: boolean;
  serverErrors?: AddressErrors;
  failure?: string;
  submitLabel: string;
}

/** Step 2: everything pre-filled from the map stays editable (spec FR-7). */
export function AddressForm({ initial, onSubmit, onChangeLocation, saving, serverErrors, failure, submitLabel }: AddressFormProps) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<AddressErrors>({});
  const shown = { ...serverErrors, ...errors };
  const set = (key: keyof AddressInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { errors: found, values: clean } = checkAddress(values);
    setErrors(found);
    if (Object.keys(found).length) {
      // Focus the first invalid field in on-screen order, not validation order.
      const fields = Array.from(event.currentTarget.elements) as HTMLInputElement[];
      fields.find((field) => field.name in found && found[field.name as keyof AddressErrors])?.focus();
      return;
    }
    onSubmit(clean);
  };

  const hasPin = values.latitude !== null && values.longitude !== null;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2 rounded-xl border p-3">
        {hasPin && <LazyMap position={{ latitude: values.latitude!, longitude: values.longitude! }} height={120} />}
        <div className="flex items-center justify-between gap-2 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <MapPin className="size-4" aria-hidden />
            {hasPin ? 'Location set on the map' : 'No map location'}
          </span>
          <Button type="button" variant="link" size="sm" className="h-auto px-0" onClick={onChangeLocation}>
            {hasPin ? 'Change' : 'Pick on map'}
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField label="Full name" name="fullName" autoComplete="name" value={values.fullName} onChange={set('fullName')} error={shown.fullName} />
        <FormField label="Mobile number" name="mobile" type="tel" autoComplete="tel-national" value={values.mobile} onChange={set('mobile')} error={shown.mobile} />
      </div>
      <FormField label="Flat, house no., building" name="line1" autoComplete="address-line1" value={values.line1} onChange={set('line1')} error={shown.line1} />
      <FormField label="Area, street, locality" name="line2" autoComplete="address-line2" value={values.line2} onChange={set('line2')} error={shown.line2} />
      <FormField label="Landmark (optional)" name="landmark" value={values.landmark} onChange={set('landmark')} error={shown.landmark} />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField label="Pincode" name="pincode" inputMode="numeric" autoComplete="postal-code" maxLength={7} value={values.pincode} onChange={set('pincode')} error={shown.pincode} hint={pincodeHint(values.pincode)} />
        <FormField label="City" name="city" autoComplete="address-level2" value={values.city} onChange={set('city')} error={shown.city} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="address-state">State</Label>
          <select
            id="address-state"
            name="state"
            autoComplete="address-level1"
            value={values.state}
            onChange={set('state')}
            aria-invalid={shown.state ? true : undefined}
            aria-describedby={shown.state ? 'address-state-error' : undefined}
            className="h-10 rounded-lg border border-input bg-background px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
          >
            <option value="">Choose…</option>
            {INDIAN_STATES.map((state) => (
              <option key={state} value={state}>
                {state}
              </option>
            ))}
          </select>
          {shown.state && (
            <p id="address-state-error" className="text-sm text-destructive">
              {shown.state}
            </p>
          )}
        </div>
      </div>
      <fieldset className="flex flex-col gap-2">
        <legend className="mb-2 text-sm font-medium">Address type</legend>
        <div className="flex gap-2">
          {ADDRESS_TYPES.map((type) => (
            <label
              key={type}
              className={cn(
                'flex h-9 cursor-pointer items-center rounded-full border px-4 text-sm has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50',
                values.type === type ? 'border-foreground bg-foreground text-background' : 'border-input hover:border-foreground',
              )}
            >
              <input type="radio" name="type" value={type} checked={values.type === type} onChange={set('type')} className="sr-only" />
              {TYPE_LABELS[type]}
            </label>
          ))}
        </div>
      </fieldset>
      {failure && (
        <Alert variant="destructive">
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}
      <Button type="submit" size="lg" className="h-11 sm:w-60" disabled={saving}>
        {saving && <Loader2 className="animate-spin" aria-hidden />}
        {submitLabel}
      </Button>
    </form>
  );
}
