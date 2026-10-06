import { useState } from 'react';
import { MapPin, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import { maskMobile, MAX_ADDRESSES, type Address } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { StatusMessage } from '@/components/StatusMessage';
import { UndoToast, useTimedNotice, type UndoNotice } from '@/components/UndoToast';
import { useMe } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/messages';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useAddresses, useCreateAddress, useDeleteAddress, useSetDefaultAddress } from './api';

const TYPE_LABELS = { home: 'Home', work: 'Work', other: 'Other' } as const;

interface DeletedAddress extends UndoNotice {
  address: Address;
}

export function AddressesPage() {
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const addresses = useAddresses(signedIn);
  const remove = useDeleteAddress();
  const restore = useCreateAddress();
  const setDefault = useSetDefaultAddress();
  const online = useOnlineStatus();
  const [deleted, setDeleted] = useTimedNotice<DeletedAddress>();
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  if (me.isPending) return <Skeleton className="mx-auto h-64 w-full max-w-3xl" />;
  if (!signedIn) return <Navigate to="/login?returnTo=%2Faccount%2Faddresses" replace />;

  const list = addresses.data;
  const atLimit = (list?.length ?? 0) >= MAX_ADDRESSES;

  const onDelete = (address: Address) => {
    setError(undefined);
    setNotice(undefined);
    remove.mutate(address.id, {
      onSuccess: ({ addresses: next, promotedId }) => {
        setDeleted({ key: Date.now(), message: 'Address deleted', address });
        const promoted = next.find((a) => a.id === promotedId);
        if (promoted) setNotice(`${promoted.line1}, ${promoted.city} is now your default address.`);
      },
      onError: (e) => setError(authErrorMessage(e)),
    });
  };

  const undo = () => {
    if (!deleted) return;
    const { address } = deleted;
    setDeleted(undefined);
    setNotice(undefined);
    const { id: _id, isDefault, createdAt: _createdAt, ...values } = address;
    restore.mutate({ values, makeDefault: isDefault }, { onError: (e) => setError(authErrorMessage(e)) });
  };

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link to="/account" className="text-sm text-muted-foreground hover:underline">
            ← My account
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Addresses</h1>
        </div>
        {list && list.length > 0 && !atLimit && (
          <Button asChild disabled={!online}>
            <Link to="/account/addresses/new">
              <Plus aria-hidden /> Add address
            </Link>
          </Button>
        )}
      </div>

      <div aria-live="polite">
        {notice && (
          <Alert>
            <Star aria-hidden />
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </div>
      {atLimit && <p className="text-sm text-muted-foreground">You can save up to {MAX_ADDRESSES} addresses — delete one to add another.</p>}

      {!list ? (
        addresses.isError ? (
          <ErrorState what="your addresses" onRetry={() => void addresses.refetch()} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2" role="status" aria-label="Loading addresses">
            <Skeleton className="h-40 rounded-xl" />
            <Skeleton className="h-40 rounded-xl" />
          </div>
        )
      ) : list.length === 0 ? (
        <StatusMessage
          icon={<MapPin />}
          title="No saved addresses yet"
          description="Add one now and checkout will be quicker."
          actions={
            <Button asChild>
              <Link to="/account/addresses/new">
                <Plus aria-hidden /> Add address
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {list.map((address) => (
            <li key={address.id}>
              <AddressCard
                address={address}
                disabled={!online}
                onDelete={() => onDelete(address)}
                onSetDefault={() => setDefault.mutate(address.id, { onError: (e) => setError(authErrorMessage(e)) })}
              />
            </li>
          ))}
        </ul>
      )}
      <UndoToast notice={deleted} onUndo={undo} onDismiss={() => setDeleted(undefined)} />
    </div>
  );
}

function AddressCard({ address, disabled, onDelete, onSetDefault }: { address: Address; disabled: boolean; onDelete: () => void; onSetDefault: () => void }) {
  const label = `${TYPE_LABELS[address.type]} address, ${address.line1}`;
  return (
    <article aria-label={label} className="flex h-full flex-col gap-3 rounded-xl border p-4">
      <div className="flex items-center gap-2">
        <h2 className="font-medium">{address.fullName}</h2>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{TYPE_LABELS[address.type]}</span>
        {address.isDefault && <span className="rounded-full bg-foreground px-2 py-0.5 text-xs text-background">Default</span>}
      </div>
      <p className="text-sm leading-relaxed text-muted-foreground">
        {address.line1}, {address.line2}
        {address.landmark && <>, {address.landmark}</>}
        <br />
        {address.city}, {address.state} {address.pincode}
        <br />
        Mobile {maskMobile(address.mobile)}
      </p>
      <div className="mt-auto flex flex-wrap gap-1">
        <Button asChild variant="ghost" size="sm" disabled={disabled}>
          <Link to={`/account/addresses/${address.id}/edit`} aria-label={`Edit ${label}`}>
            <Pencil aria-hidden /> Edit
          </Link>
        </Button>
        <Button variant="ghost" size="sm" onClick={onDelete} disabled={disabled} aria-label={`Delete ${label}`}>
          <Trash2 aria-hidden /> Delete
        </Button>
        {!address.isDefault && (
          <Button variant="ghost" size="sm" onClick={onSetDefault} disabled={disabled} aria-label={`Set ${label} as default`}>
            <Star aria-hidden /> Set as default
          </Button>
        )}
      </div>
    </article>
  );
}
