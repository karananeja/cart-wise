import type { ReactNode } from 'react';
import { Heart, Loader2, LogOut, MapPin, Package } from 'lucide-react';
import { Link, Navigate } from 'react-router';
import type { PublicUser } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { QueryFallback } from '@/components/ErrorState';
import { useAddresses } from '@/features/addresses/api';
import { useLogout, useMe } from '@/features/auth/api';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { RecentlyViewedRail } from '@/features/catalog/components/RecentlyViewedRail';
import { useOrders } from '@/features/orders/api';
import { OrderCard } from '@/features/orders/OrdersPage';
import { useWishlist } from '@/features/wishlist/api';

const memberSinceFormat = new Intl.DateTimeFormat('en-IN', { month: 'short', year: 'numeric' });

/**
 * Account overview (F-017): who you are, then your latest order, default address, wishlist and
 * recently viewed. Each tile loads and fails on its own, so one slow request never blanks the page.
 */
export function AccountPage() {
  const me = useMe();
  // Only a confirmed "signed out" sends to sign-in; a failed or offline check says so instead.
  if (!me.data) return <QueryFallback query={me} what="your account" loading={<Skeleton className="h-40 w-full rounded-xl" />} />;
  const user = me.data.user;
  if (!user) return <Navigate to="/login?returnTo=%2Faccount" replace />;

  return (
    <div className="flex flex-col gap-8">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">My account</h1>
      <ProfileCard user={user} />
      <div className="grid gap-4 md:grid-cols-2">
        <LatestOrderTile />
        <AddressTile />
        <WishlistTile />
      </div>
      <RecentlyViewedRail />
    </div>
  );
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');

function ProfileCard({ user }: { user: PublicUser }) {
  const logout = useLogout();
  return (
    <section aria-label="Profile" className="flex flex-col gap-4 rounded-xl border p-5 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-foreground text-lg font-semibold text-background" aria-hidden>
          {initials(user.name)}
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
          <p className="text-lg font-semibold break-words">{user.name}</p>
          <p className="break-all text-muted-foreground">{user.email}</p>
          {user.maskedMobile && <p className="text-muted-foreground">Mobile {user.maskedMobile}</p>}
          <p className="text-xs text-muted-foreground">Member since {memberSinceFormat.format(new Date(user.memberSince))}</p>
        </div>
      </div>
      <Button variant="outline" className="w-full sm:w-auto" onClick={() => logout.mutate()} disabled={logout.isPending}>
        {logout.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <LogOut aria-hidden />}
        Sign out
      </Button>
    </section>
  );
}

function Tile({ id, title, action, className, children }: { id: string; title: string; action?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className={`flex flex-col gap-3 rounded-xl border p-5 ${className ?? ''}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="font-semibold">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function TileLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-sm font-medium hover:underline">
      {children}
    </Link>
  );
}

function TileEmpty({ icon, text, action }: { icon: ReactNode; text: string; action: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span className="flex size-9 items-center justify-center rounded-full bg-muted [&_svg]:size-4" aria-hidden>
        {icon}
      </span>
      <span className="flex-1">{text}</span>
      {action}
    </div>
  );
}

function TileError({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
      <span className="flex-1">Couldn't load {what}.</span>
      <Button variant="outline" size="sm" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function LatestOrderTile() {
  const orders = useOrders();
  const latest = orders.data?.pages[0]?.orders[0];
  return (
    <Tile id="account-latest-order" title="Latest order" className="md:col-span-2" action={latest && <TileLink to="/account/orders">View all orders</TileLink>}>
      {orders.isPending ? (
        <Skeleton className="h-28 rounded-xl" role="status" aria-label="Loading your latest order" />
      ) : orders.isError && !latest ? (
        <TileError what="your orders" onRetry={() => void orders.refetch()} />
      ) : latest ? (
        <OrderCard order={latest} headingLevel={3} />
      ) : (
        <TileEmpty
          icon={<Package />}
          text="No orders yet"
          action={
            <Button asChild size="sm">
              <Link to="/products">Start shopping</Link>
            </Button>
          }
        />
      )}
    </Tile>
  );
}

function AddressTile() {
  const addresses = useAddresses();
  const list = addresses.data;
  const address = list?.find((a) => a.isDefault) ?? list?.[0];
  return (
    <Tile id="account-address" title="Default address" action={address && <TileLink to="/account/addresses">Manage</TileLink>}>
      {addresses.isPending ? (
        <Skeleton className="h-16 rounded-lg" role="status" aria-label="Loading your addresses" />
      ) : addresses.isError ? (
        <TileError what="your addresses" onRetry={() => void addresses.refetch()} />
      ) : address ? (
        <p className="flex flex-col gap-0.5 text-sm">
          <span className="font-medium">{address.fullName}</span>
          <span className="text-muted-foreground">
            {address.line1}, {address.line2}
          </span>
          <span className="text-muted-foreground">
            {address.city} {address.pincode}
          </span>
        </p>
      ) : (
        <TileEmpty
          icon={<MapPin />}
          text="No saved address"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/account/addresses/new?returnTo=%2Faccount">Add address</Link>
            </Button>
          }
        />
      )}
    </Tile>
  );
}

function WishlistTile() {
  const wishlist = useWishlist();
  const items = wishlist.data?.items ?? [];
  const shown = items.slice(0, 4);
  return (
    <Tile id="account-wishlist" title="Wishlist" action={items.length > 0 && <TileLink to="/wishlist">View wishlist</TileLink>}>
      {wishlist.isPending ? (
        <Skeleton className="h-16 rounded-lg" role="status" aria-label="Loading your wishlist" />
      ) : wishlist.isError ? (
        <TileError what="your wishlist" onRetry={() => void wishlist.refetch()} />
      ) : items.length > 0 ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-muted-foreground">
            {wishlist.data!.count} saved {wishlist.data!.count === 1 ? 'item' : 'items'}
          </p>
          <ul className="flex gap-2">
            {shown.map(({ product }) => (
              <li key={product.id}>
                <Link to={`/p/${product.slug}`} className="block rounded-lg focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none">
                  <ProductImage src={product.thumbnailUrl} alt={product.title} className="size-14" />
                </Link>
              </li>
            ))}
            {items.length > shown.length && <li className="flex items-center text-sm text-muted-foreground">+{items.length - shown.length}</li>}
          </ul>
        </div>
      ) : (
        <TileEmpty icon={<Heart />} text="Save items you like with ♡" action={<TileLink to="/products">Browse products</TileLink>} />
      )}
    </Tile>
  );
}
