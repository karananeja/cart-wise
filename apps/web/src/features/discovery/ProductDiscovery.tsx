import type { ProductDetail } from '@store/shared';
import { Skeleton } from '@/components/ui/skeleton';
import { useProductRecommendations } from './api';
import { PairingSection } from './PairingSection';
import { RecommendationRail } from './RecommendationRail';

/**
 * Below the product details: the pairing group, then "You may also like" (spec FR-7).
 * Placeholders while loading; nothing at all on error, offline or empty.
 */
export function ProductDiscovery({ product, selectedSize, selectedOption }: { product: ProductDetail; selectedSize?: string; selectedOption?: string }) {
  const recommendations = useProductRecommendations(product.slug);
  if (recommendations.isError || (!recommendations.data && recommendations.fetchStatus === 'paused')) return null;

  const data = recommendations.data;
  return (
    <>
      {!data ? (
        <Skeleton className="h-48 rounded-xl" aria-hidden />
      ) : (
        data.pairing && data.pairing.items.length > 0 && <PairingSection key={product.slug} product={product} selectedSize={selectedSize} selectedOption={selectedOption} pairing={data.pairing} />
      )}
      <RecommendationRail title="You may also like" description="Similar items from the same category." items={data?.similar} surface="product" kind="similar" />
    </>
  );
}
