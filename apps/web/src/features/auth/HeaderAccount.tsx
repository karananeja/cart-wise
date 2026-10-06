import { CircleUser, LogOut, User } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useLogout, useMe } from './api';

const AUTH_PATHS = ['/login', '/signup', '/forgot-password'];

/** Sign in (guests) or an account menu. A neutral placeholder until we know which. */
export function HeaderAccount() {
  const me = useMe();
  const logout = useLogout();
  const location = useLocation();

  if (me.isPending) return <div className="size-8" aria-hidden />;

  const user = me.data?.user;
  if (!user) {
    // Keep an existing returnTo when already on an auth page.
    const here = AUTH_PATHS.includes(location.pathname) ? (new URLSearchParams(location.search).get('returnTo') ?? '/') : location.pathname + location.search;
    const to = `/login${here && here !== '/' ? `?returnTo=${encodeURIComponent(here)}` : ''}`;
    return (
      <Button asChild variant="ghost" size="sm" className="max-sm:size-8 max-sm:px-0">
        <Link to={to} aria-label="Sign in">
          <User aria-hidden className="sm:hidden" />
          <span className="max-sm:sr-only">Sign in</span>
        </Link>
      </Button>
    );
  }

  const first = user.name.split(' ')[0];
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="max-sm:size-8 max-sm:px-0" aria-label={`Account menu for ${first}`}>
          <CircleUser aria-hidden />
          <span className="max-sm:hidden">Hi, {first}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel className="font-normal">
          <span className="block font-medium">{user.name}</span>
          <span className="block text-xs text-muted-foreground">{user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/account">My account</Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => logout.mutate()}>
          <LogOut aria-hidden /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
