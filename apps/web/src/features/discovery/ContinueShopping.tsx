import { useId } from 'react';
import { Link } from 'react-router';
import { ArrowRight } from 'lucide-react';
import { formatPrice } from '@store/shared';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { useMe } from '@/features/auth/api';
import { useCart } from '@/features/cart/api';
import { useRecentlyViewed } from '@/lib/recentlyViewed';
import { useHomeRecommendations } from './api';
import { RecommendationRail } from './RecommendationRail';

/**
 * Homepage "Because you viewed / bought" rails for returning visitors (spec FR-9). They sit below
 * the category grid and recently viewed (user feedback at Gate 2, 2026-10-06); first-time
 * visitors (no history, signed out) get nothing, so the homepage is unchanged for them.
 */
export function PersonalisedRails() {
  const viewed = useRecentlyViewed().map((p) => p.slug);
  const me = useMe();
  const account = me.data?.user?.email ?? null;
  const home = useHomeRecommendations(viewed, account);
  const showRails = !home.isError && !(!home.data && home.fetchStatus === 'paused') && (viewed.length > 0 || account !== null);

  return (
    <>
      {showRails && (
        <>
          {(home.data?.becauseViewed || (!home.data && viewed.length > 0)) && (
            <RecommendationRail
              title={home.data?.becauseViewed ? `Because you viewed ${home.data.becauseViewed.anchor.title}` : 'Because you viewed…'}
              items={home.data?.becauseViewed?.items}
              surface="home"
              kind="because_viewed"
            />
          )}
          {home.data?.becauseBought && (
            <RecommendationRail
              title={`Because you bought ${home.data.becauseBought.anchor.title}`}
              items={home.data.becauseBought.items}
              surface="home"
              kind="because_bought"
            />
          )}
        </>
      )}
    </>
  );
}

/** The short cart reminder at the top of the homepage (spec FR-9). */
export function StillInYourCart() {
  const cart = useCart();
  const headingId = useId();
  const lines = cart.data?.lines ?? [];
  if (!lines.length || !cart.data) return null;

  const count = cart.data.totalQuantity;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
      <div className="flex min-w-0 items-center gap-4">
        <ul className="flex shrink-0 -space-x-3" aria-hidden>
          {lines.slice(0, 4).map((line) => (
            <li key={line.id} className="rounded-lg ring-2 ring-background">
              <ProductImage src={line.product.thumbnailUrl} alt="" className="size-12" />
            </li>
          ))}
        </ul>
        <div className="min-w-0">
          <h2 id={headingId} className="text-lg font-semibold tracking-tight">
            Still in your cart
          </h2>
          <p className="text-sm text-muted-foreground">
            {count} {count === 1 ? 'item' : 'items'} · {formatPrice(cart.data.totals.subtotalPaise)}
          </p>
        </div>
      </div>
      <Link to="/cart" className="inline-flex items-center gap-1 text-sm font-medium hover:underline">
        Go to cart <ArrowRight className="size-4" aria-hidden />
      </Link>
    </section>
  );
}
