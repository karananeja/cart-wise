import { useEffect, useState, type FormEvent } from 'react';
import { FlaskConical, Loader2, LogOut } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { formatPrice, ORDER_STATUS_LABELS, type SimOrder } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { FormField, PasswordField } from '@/features/auth/components';
import { formatDateTime } from '@/features/orders/format';
import { ApiError } from '@/lib/api';
import { simSessionKey, useSimAction, useSimOrders, useSimSession, useSimSignIn, useSimSignOut } from './api';

/**
 * Demo operator: moves paid orders along, completes delivery with the customer's code and
 * advances returns (spec §5.7). A simulation tool, not an admin dashboard (brief §16).
 */
export function SimOrdersPage() {
  const session = useSimSession();
  const signOut = useSimSignOut();
  const signedIn = session.data?.signedIn === true;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div role="note" className="flex items-center gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">Demo operator — simulation only.</span> Changes here stand in for the warehouse and courier.
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Order simulation</h1>
        {signedIn && (
          <Button variant="outline" size="sm" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
            <LogOut aria-hidden /> Sign out
          </Button>
        )}
      </div>
      {session.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : session.isError ? (
        <ErrorState what="the operator session" onRetry={() => void session.refetch()} />
      ) : signedIn ? (
        <SimOrderList />
      ) : (
        <OperatorSignIn />
      )}
    </div>
  );
}

function OperatorSignIn() {
  const [password, setPassword] = useState('');
  const signIn = useSimSignIn();
  const error = signIn.error instanceof ApiError ? signIn.error : undefined;
  const message =
    error?.code === 'WRONG_PASSWORD'
      ? 'That password is not right.'
      : error?.code === 'TOO_MANY_ATTEMPTS'
        ? `Too many wrong attempts. Try again in ${Math.ceil(Number(error.details?.retryAfterSeconds ?? 900) / 60)} minutes.`
        : signIn.isError
          ? "We couldn't sign you in. Please try again."
          : undefined;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (password) signIn.mutate(password);
  };

  return (
    <form onSubmit={submit} className="flex max-w-sm flex-col gap-4 rounded-xl border p-5" noValidate>
      <p className="text-sm text-muted-foreground">Enter the demo operator password to move orders along.</p>
      <PasswordField label="Operator password" autoComplete="current-password" value={password} error={message} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" disabled={signIn.isPending || !password} className="w-fit">
        {signIn.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Sign in
      </Button>
    </form>
  );
}

function SimOrderList() {
  const orders = useSimOrders(true);
  const queryClient = useQueryClient();
  const expired = orders.error instanceof ApiError && orders.error.code === 'OPERATOR_REQUIRED';

  useEffect(() => {
    // The operator session ended (expired or signed out elsewhere): back to sign-in.
    if (expired) queryClient.setQueryData(simSessionKey, { signedIn: false });
  }, [expired, queryClient]);

  if (orders.isPending) return <Skeleton className="h-40 rounded-xl" />;
  if (orders.isError) return <ErrorState what="orders" onRetry={() => void orders.refetch()} />;
  if (!orders.data.length) return <p className="text-sm text-muted-foreground">No paid orders yet.</p>;
  return (
    <ul className="flex flex-col gap-4">
      {orders.data.map((order) => (
        <li key={order.id}>
          <SimOrderRow order={order} />
        </li>
      ))}
    </ul>
  );
}

function SimOrderRow({ order }: { order: SimOrder }) {
  const action = useSimAction();
  const [code, setCode] = useState('');
  const [notice, setNotice] = useState<string>();
  const locked = order.deliveryAttemptsLeft === 0;

  const run = (path: string, body?: unknown, after?: () => void) => {
    setNotice(undefined);
    action.mutate(
      { path, body },
      {
        onSuccess: after,
        onError: (e) => {
          if (!(e instanceof ApiError)) return setNotice('Something went wrong. Please try again.');
          if (e.code === 'INVALID_CODE') {
            const left = Number(e.details?.attemptsLeft ?? 0);
            setNotice(`Wrong code. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
          } else if (e.code === 'DELIVERY_LOCKED') setNotice('Delivery is blocked after 3 wrong codes. Issue a new code.');
          else if (e.code === 'INVALID_TRANSITION') setNotice('This order has already moved on. The list is refreshed.');
          else setNotice('Something went wrong. Please try again.');
        },
      },
    );
  };

  const deliver = (event: FormEvent) => {
    event.preventDefault();
    if (/^\d{4}$/.test(code)) run(`/orders/${order.id}/deliver`, { code }, () => setCode(''));
    else setNotice('Enter the 4-digit code.');
  };

  return (
    <article aria-labelledby={`sim-${order.id}`} className="flex flex-col gap-3 rounded-xl border p-4 text-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 id={`sim-${order.id}`} className="font-mono font-semibold">
            {order.id}
          </h2>
          <p className="text-xs text-muted-foreground">
            {formatDateTime(order.createdAt)} · {order.city}
          </p>
        </div>
        <p className="text-right">
          <span className="block font-medium">{ORDER_STATUS_LABELS[order.status]}</span>
          <span className="text-muted-foreground tabular-nums">{formatPrice(order.paidPaise)}</span>
        </p>
      </div>
      <ul className="text-muted-foreground">
        {order.items.map((item, i) => (
          <li key={i}>
            {item.title}
            {item.size && ` (${item.size})`} × {item.quantity}
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-end gap-3">
        {order.nextStatus && order.nextStatus !== 'delivered' && (
          <Button size="sm" disabled={action.isPending} onClick={() => run(`/orders/${order.id}/advance`)}>
            Advance to {ORDER_STATUS_LABELS[order.nextStatus].toLowerCase()}
          </Button>
        )}
        {order.status === 'out_for_delivery' && (
          <>
            <form onSubmit={deliver} className="flex items-end gap-2">
              <FormField
                label="Delivery code"
                inputMode="numeric"
                autoComplete="off"
                maxLength={4}
                className="w-28"
                value={code}
                disabled={locked}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <Button type="submit" size="sm" disabled={action.isPending || locked}>
                Mark delivered
              </Button>
            </form>
            <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => run(`/orders/${order.id}/delivery-code`)}>
              Issue new code
            </Button>
          </>
        )}
      </div>
      {order.status === 'out_for_delivery' && (
        <p className="text-xs text-muted-foreground">
          {locked ? 'Delivery is blocked after 3 wrong codes. Issue a new code.' : `${order.deliveryAttemptsLeft} code ${order.deliveryAttemptsLeft === 1 ? 'attempt' : 'attempts'} left. Ask the customer for the code shown on their order.`}
        </p>
      )}

      {order.returns.length > 0 && (
        <div className="flex flex-col gap-2 border-t pt-3">
          {order.returns.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-3">
              <span>
                Return {r.id} · {r.itemCount} {r.itemCount === 1 ? 'item' : 'items'} · {formatPrice(r.refundPaise)} ·{' '}
                {r.status === 'requested' ? 'Requested' : r.status === 'picked_up' ? 'Picked up' : 'Refunded'}
              </span>
              {r.status === 'requested' && (
                <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => run(`/returns/${r.id}/pickup`)}>
                  Mark picked up
                </Button>
              )}
              {r.status === 'picked_up' && (
                <Button size="sm" variant="outline" disabled={action.isPending} onClick={() => run(`/returns/${r.id}/refund`)}>
                  Complete refund
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {notice && (
        <Alert role="alert">
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
    </article>
  );
}
