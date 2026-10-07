import { Heart, LayoutDashboard, Loader2, LogOut, MapPin, Package } from 'lucide-react';
import { NavLink, Outlet } from 'react-router';
import { useLogout, useMe } from '@/features/auth/api';
import { cn } from '@/lib/utils';

const LINKS = [
  { to: '/account', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/account/orders', label: 'Orders', icon: Package, end: false },
  { to: '/account/addresses', label: 'Addresses', icon: MapPin, end: false },
  { to: '/wishlist', label: 'Wishlist', icon: Heart, end: false },
];

/**
 * Account pages (F-017): a sidebar on wide screens next to the overview, orders and addresses.
 * On phones the overview's tiles are the navigation, so there is no sidebar. Each page still
 * handles its own sign-in redirect.
 */
export function AccountLayout() {
  const signedIn = Boolean(useMe().data?.user);
  return (
    <div className="flex gap-10">
      {signedIn && <AccountNav />}
      <div className="min-w-0 flex-1">
        <Outlet />
      </div>
    </div>
  );
}

function AccountNav() {
  const logout = useLogout();
  return (
    <nav aria-label="Account" className="sticky top-24 hidden h-fit w-52 shrink-0 flex-col gap-1 lg:flex">
      {LINKS.map(({ to, label, icon: Icon, end }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) =>
            cn('flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:bg-muted', isActive ? 'bg-muted text-foreground' : 'text-muted-foreground')
          }
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </NavLink>
      ))}
      <div className="mt-2 border-t pt-2">
        <button
          type="button"
          onClick={() => logout.mutate()}
          disabled={logout.isPending}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
        >
          {logout.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <LogOut className="size-4" aria-hidden />}
          Sign out
        </button>
      </div>
    </nav>
  );
}
