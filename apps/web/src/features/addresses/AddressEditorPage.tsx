import { QueryFallback } from '@/components/ErrorState';
import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams, useSearchParams } from 'react-router';
import { safeReturnTo, type AddressErrors, type AddressInput } from '@store/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { NotFound } from '@/components/NotFound';
import { useMe } from '@/features/auth/api';
import { authErrorMessage, fieldErrors } from '@/features/auth/messages';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/api';
import { useAddresses, useCreateAddress, useUpdateAddress } from './api';
import { AddressForm } from './AddressForm';
import { LocationPicker, type PickedLocation } from './LocationPicker';

/** Fill the form from a map location, keeping what only the customer knows (flat, landmark). */
function applyLocation(values: AddressInput, location: PickedLocation): AddressInput {
  const { place } = location;
  return {
    ...values,
    latitude: location.latitude,
    longitude: location.longitude,
    line2: place?.area ?? values.line2,
    pincode: place?.pincode ?? values.pincode,
    city: place?.city ?? values.city,
    state: place?.state ?? values.state,
  };
}

export function AddressEditorPage() {
  const { id } = useParams();
  const editing = id !== undefined;
  const me = useMe();
  const user = me.data?.user;
  const addresses = useAddresses(Boolean(user));
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'), '/account/addresses');
  const create = useCreateAddress();
  const update = useUpdateAddress();
  const [step, setStep] = useState<'locate' | 'details'>(editing ? 'details' : 'locate');
  const [method, setMethod] = useState<'map' | 'manual'>('map');
  const [draft, setDraft] = useState<AddressInput>();

  const placeholder = <Skeleton className="mx-auto h-96 w-full max-w-2xl" />;
  // Only a confirmed "signed out" sends to sign-in; a failed or offline check says so instead.
  if (!me.data) return <QueryFallback query={me} what="your account" loading={placeholder} />;
  if (!user) return <Navigate to={`/login?returnTo=${encodeURIComponent(location.pathname)}`} replace />;
  if (editing && !addresses.data) return <QueryFallback query={addresses} what="this address" loading={placeholder} />;

  const existing = editing ? addresses.data?.find((a) => a.id === Number(id)) : undefined;
  if (editing && !existing) return <NotFound title="We couldn't find that address" />;

  const base: AddressInput = draft ??
    existing ?? {
      fullName: user.name,
      mobile: user.mobile,
      pincode: '',
      line1: '',
      line2: '',
      landmark: '',
      city: '',
      state: '',
      type: 'home',
      latitude: null,
      longitude: null,
    };

  const mutation = editing ? update : create;
  const save = (values: AddressInput) => {
    const done = () => navigate(returnTo, { state: { authNotice: editing ? 'Address updated.' : 'Address saved.' } });
    if (existing) {
      update.mutate({ id: existing.id, values }, { onSuccess: done });
      return;
    }
    const isFirst = (addresses.data?.length ?? 0) === 0;
    const before = new Set(addresses.data?.map((a) => a.id));
    create.mutate(
      { values },
      {
        onSuccess: ({ addresses: after }) => {
          track('address_added', { addressType: values.type, method: values.latitude !== null ? method : 'manual', isDefault: isFirst });
          // Returning to checkout selects the address just added (F-008 FR-5).
          const added = after.find((a) => !before.has(a.id));
          if (added && returnTo.startsWith('/checkout')) {
            const url = new URL(returnTo, window.location.origin);
            url.searchParams.set('addressId', String(added.id));
            navigate(url.pathname + url.search);
            return;
          }
          done();
        },
      },
    );
  };

  const limitReached = mutation.error instanceof ApiError && mutation.error.code === 'ADDRESS_LIMIT';
  const serverErrors: AddressErrors = fieldErrors(mutation.error) as AddressErrors;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link to="/account/addresses" className="w-fit text-sm text-muted-foreground hover:underline">
          ← Addresses
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {editing ? 'Edit address' : step === 'locate' ? 'Where should we deliver?' : 'Add address details'}
        </h1>
      </div>
      {step === 'locate' ? (
        <LocationPicker
          initial={base.latitude !== null && base.longitude !== null ? { latitude: base.latitude, longitude: base.longitude } : null}
          onConfirm={(location) => {
            setMethod('map');
            setDraft(applyLocation(base, location));
            setStep('details');
          }}
          onManual={() => {
            setMethod('manual');
            setDraft(base);
            setStep('details');
          }}
        />
      ) : (
        <AddressForm
          key={JSON.stringify([base.latitude, base.longitude])}
          initial={base}
          onSubmit={save}
          onChangeLocation={() => setStep('locate')}
          saving={mutation.isPending}
          serverErrors={serverErrors}
          failure={
            limitReached
              ? 'You can save up to 10 addresses — delete one to add another.'
              : mutation.isError && Object.keys(serverErrors).length === 0
                ? authErrorMessage(mutation.error)
                : undefined
          }
          submitLabel={editing ? 'Save changes' : 'Save address'}
        />
      )}
    </div>
  );
}
