import { Loader2, LogOut, MapPin } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useLogout, useMe } from './api';

export function AccountPage() {
  const me = useMe();
  const logout = useLogout();
  if (me.isPending) return <Skeleton className="mx-auto h-48 w-full max-w-md" />;
  const user = me.data?.user;
  if (!user) return <Navigate to="/login?returnTo=%2Faccount" replace />;

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-4 sm:py-10">
      <h1 className="text-2xl font-semibold tracking-tight">My account</h1>
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 rounded-xl border p-5 text-sm">
        <dt className="text-muted-foreground">Name</dt>
        <dd>{user.name}</dd>
        <dt className="text-muted-foreground">Email</dt>
        <dd className="break-all">{user.email}</dd>
        <dt className="text-muted-foreground">Mobile</dt>
        <dd>{user.maskedMobile}</dd>
      </dl>
      <Button asChild variant="outline" className="w-fit">
        <Link to="/account/addresses">
          <MapPin aria-hidden /> Addresses
        </Link>
      </Button>
      <Button variant="outline" className="w-fit" onClick={() => logout.mutate()} disabled={logout.isPending}>
        {logout.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
        Sign out
      </Button>
    </div>
  );
}
