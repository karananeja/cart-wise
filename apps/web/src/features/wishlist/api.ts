import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProductSummary, WishlistView } from '@store/shared';
import { track } from '@/lib/analytics';
import { apiGet, apiSend } from '@/lib/api';

export const wishlistKey = ['wishlist'] as const;
const scope = { id: 'wishlist' };

export type WishlistAddSource = 'product_page' | 'product_card' | 'cart';
export type WishlistRemoveSource = 'product_page' | 'product_card' | 'wishlist_page' | 'moved_to_cart';

export function useWishlist() {
  return useQuery({
    queryKey: wishlistKey,
    queryFn: ({ signal }) => apiGet<WishlistView>('/wishlist', signal),
    staleTime: 30_000,
  });
}

/** Ids of saved products, so every heart on screen agrees. */
export function useSavedIds(): Set<number> {
  const { data } = useWishlist();
  return useMemo(() => new Set(data?.items.map((i) => i.product.id)), [data]);
}

type ToggleInput =
  | { product: ProductSummary; save: true; source: WishlistAddSource }
  | { product: ProductSummary; save: false; source: WishlistRemoveSource };

/** Save or remove, shown immediately and rolled back if the server refuses. */
export function useToggleWishlist() {
  const queryClient = useQueryClient();
  return useMutation({
    scope,
    mutationFn: ({ product, save }: ToggleInput) =>
      apiSend<WishlistView>(save ? 'PUT' : 'DELETE', `/wishlist/items/${encodeURIComponent(product.slug)}`),
    onMutate: async ({ product, save }) => {
      await queryClient.cancelQueries({ queryKey: wishlistKey });
      const previous = queryClient.getQueryData<WishlistView>(wishlistKey);
      const base = previous ?? { items: [], count: 0 };
      const others = base.items.filter((i) => i.product.id !== product.id);
      const items = save ? [{ product, addedAt: new Date().toISOString() }, ...others] : others;
      queryClient.setQueryData<WishlistView>(wishlistKey, { items, count: items.length });
      return { previous };
    },
    onError: (_error, _input, context) => {
      if (context?.previous) queryClient.setQueryData(wishlistKey, context.previous);
      else void queryClient.invalidateQueries({ queryKey: wishlistKey });
    },
    onSuccess: (view, { product, save, source }) => {
      queryClient.setQueryData(wishlistKey, view);
      track(save ? 'wishlist_added' : 'wishlist_removed', { productId: product.id, source });
    },
  });
}
