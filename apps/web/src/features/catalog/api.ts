import { keepPreviousData, useQuery } from '@tanstack/react-query';
import {
  serializeListingParams,
  type Category,
  type ListingParams,
  type ListingResponse,
  type ProductDetail,
} from '@store/shared';
import { apiGet } from '@/lib/api';

export const catalogKeys = {
  categories: ['categories'] as const,
  listing: (query: string) => ['products', 'list', query] as const,
  product: (slug: string) => ['products', 'detail', slug] as const,
};

export function useCategories() {
  return useQuery({
    queryKey: catalogKeys.categories,
    queryFn: ({ signal }) => apiGet<{ categories: Category[] }>('/categories', signal).then((r) => r.categories),
    staleTime: Infinity,
  });
}

export function useProductListing(params: ListingParams, options: { enabled?: boolean } = {}) {
  const query = serializeListingParams(params).toString();
  return useQuery({
    queryKey: catalogKeys.listing(query),
    queryFn: ({ signal }) => apiGet<ListingResponse>(`/products${query ? `?${query}` : ''}`, signal),
    placeholderData: keepPreviousData,
    enabled: options.enabled ?? true,
  });
}

export function useProduct(slug: string) {
  return useQuery({
    queryKey: catalogKeys.product(slug),
    queryFn: ({ signal }) => apiGet<{ product: ProductDetail }>(`/products/${encodeURIComponent(slug)}`, signal).then((r) => r.product),
  });
}
