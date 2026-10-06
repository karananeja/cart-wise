import { useState, type FormEvent } from 'react';
import { FlaskConical, Loader2, LogOut } from 'lucide-react';
import { Navigate, NavLink, Outlet, useLocation } from 'react-router';
import { cn } from 'cn';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { PasswordField } from '@/features/auth/components';
import { ApiError } from '@/lib/api';
import { useSimSession, useSimSignIn, useSimSignOut } from './api';

const TABS = [
  { to: '/sim/orders', label: 'Orders', title: 'Order simulation' },
  { to: '/sim/inventory', label: 'Inventory', title: 'Inventory' },
] as const;

/**
 * The Store Simulation Console (brief §16): one operator sign-in, an Orders tab (F-010) and an
 * Inventory tab (F-011). A simulation tool, not an admin dashboard.
 */
export function SimConsole() {
  const session = useSimSession();
  const signOut = useSimSignOut();
  const { pathname } = useLocation();
  const signedIn = session.data?.signedIn === true;
  const tab = TABS.find((t) => pathname.startsWith(t.to)) ?? TABS[0];

  if (pathname.replace(/\/$/, '') === '/sim') return <Navigate to="/sim/orders" replace />;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <div role="note" className="flex items-center gap-2 rounded-xl border border-dashed border-amber-400 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100">
        <FlaskConical className="size-4 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">Demo operator — simulation only.</span> Changes here stand in for the warehouse and courier.
        </span>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{tab.title}</h1>
        {signedIn && (
          <Button variant="outline" size="sm" onClick={() => signOut.mutate()} disabled={signOut.isPending}>
            <LogOut aria-hidden /> Sign out
          </Button>
        )}
      </div>
      <nav aria-label="Simulation console" className="-mt-2 flex gap-1 border-b">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              cn(
                '-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors',
                isActive ? 'border-foreground text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground',
              )
            }
          >
            {t.label}
          </NavLink>
        ))}
      </nav>
      {session.isPending ? (
        <Skeleton className="h-40 rounded-xl" />
      ) : session.isError ? (
        <ErrorState what="the operator session" onRetry={() => void session.refetch()} />
      ) : signedIn ? (
        <Outlet />
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
      <p className="text-sm text-muted-foreground">Enter the demo operator password to move orders along and change stock.</p>
      <PasswordField label="Operator password" autoComplete="current-password" value={password} error={message} onChange={(e) => setPassword(e.target.value)} />
      <Button type="submit" disabled={signIn.isPending || !password} className="w-fit">
        {signIn.isPending && <Loader2 className="animate-spin" aria-hidden />}
        Sign in
      </Button>
    </form>
  );
}
