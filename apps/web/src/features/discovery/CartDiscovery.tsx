import type { CartView } from '@store/shared';
import { useCartRecommendations } from './api';
import { RecommendationRail } from './RecommendationRail';

/** "Pairs well with your cart", placed after the cart and its checkout action (spec FR-10). */
export function CartDiscovery({ cart }: { cart: CartView }) {
  // Changes whenever the cart's contents change, so suggestions follow the cart.
  const signature = cart.lines.map((l) => `${l.product.slug}:${l.size ?? ''}`).sort().join(',');
  const recommendations = useCartRecommendations(signature);
  if (!cart.lines.length || recommendations.isError || (!recommendations.data && recommendations.fetchStatus === 'paused')) return null;
  return (
    <RecommendationRail title="Pairs well with your cart" items={recommendations.data?.items} surface="cart" kind="pairs_well" />
  );
}
