import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { EMPTY_CART, type AddToCartRequest, type CartView } from '@store/shared';
import { track } from '@/lib/analytics';
import { apiGet, apiSend } from '@/lib/api';

export const cartKey = ['cart'] as const;
/** Cart mutations run one at a time, so responses always reflect the latest change. */
const scope = { id: 'cart' };

export function useCart() {
  return useQuery({
    queryKey: cartKey,
    queryFn: ({ signal }) => apiGet<CartView>('/cart', signal),
    staleTime: 30_000,
  });
}

type AddInput = AddToCartRequest & { source: 'product_page' | 'undo' | 'wishlist' | 'recommendation'; productId: number; pricePaise: number };

export function useAddToCart() {
  const queryClient = useQueryClient();
  return useMutation({
    scope,
    mutationFn: ({ productSlug, size, quantity }: AddInput) =>
      apiSend<CartView>('POST', '/cart/lines', { productSlug, size, quantity }),
    onSuccess: (cart, input) => {
      queryClient.setQueryData(cartKey, cart);
      track('cart_item_added', {
        productId: input.productId,
        size: input.size ?? null,
        quantity: input.quantity ?? 1,
        pricePaise: input.pricePaise,
        source: input.source,
      });
    },
  });
}

/** Snapshot-and-restore for optimistic changes. */
function useOptimisticCart() {
  const queryClient = useQueryClient();
  return {
    async apply(change: (cart: CartView) => CartView) {
      await queryClient.cancelQueries({ queryKey: cartKey });
      const previous = queryClient.getQueryData<CartView>(cartKey);
      if (previous) queryClient.setQueryData(cartKey, change(previous));
      return { previous };
    },
    restore(previous: CartView | undefined) {
      if (previous) queryClient.setQueryData(cartKey, previous);
    },
    settle(cart: CartView) {
      queryClient.setQueryData(cartKey, cart);
    },
  };
}

export function useUpdateCartLine() {
  const optimistic = useOptimisticCart();
  return useMutation({
    scope,
    mutationFn: ({ lineId, quantity }: { lineId: number; quantity: number }) =>
      apiSend<CartView>('PATCH', `/cart/lines/${lineId}`, { quantity }),
    onMutate: ({ lineId, quantity }) =>
      optimistic.apply((cart) => ({
        ...cart,
        lines: cart.lines.map((line) => (line.id === lineId ? { ...line, quantity } : line)),
      })),
    onError: (_error, _input, context) => optimistic.restore(context?.previous),
    onSuccess: (cart) => optimistic.settle(cart),
  });
}

export function useRemoveCartLine() {
  const optimistic = useOptimisticCart();
  return useMutation({
    scope,
    mutationFn: ({ lineId }: { lineId: number; productId: number; size: string | null; quantity: number }) =>
      apiSend<CartView>('DELETE', `/cart/lines/${lineId}`),
    onMutate: ({ lineId }) => optimistic.apply((cart) => ({ ...cart, lines: cart.lines.filter((line) => line.id !== lineId) })),
    onError: (_error, _input, context) => optimistic.restore(context?.previous),
    onSuccess: (cart, input) => {
      optimistic.settle(cart);
      track('cart_item_removed', { productId: input.productId, size: input.size, quantity: input.quantity, reason: 'removed' });
    },
  });
}

/** The cart, or an empty one before it has loaded (never undefined for rendering). */
export function cartOrEmpty(cart: CartView | undefined): CartView {
  return cart ?? EMPTY_CART;
}
