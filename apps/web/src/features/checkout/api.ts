import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CheckoutQuote, DeliveryOption, Order } from '@store/shared';
import { cartKey } from '@/features/cart/api';
import { apiGet, apiSend } from '@/lib/api';

export const checkoutKey = (addressId: number | undefined, delivery: DeliveryOption) => ['checkout', addressId ?? 'default', delivery] as const;
export const orderKey = (id: string) => ['orders', id] as const;

export function useCheckoutQuote(addressId: number | undefined, delivery: DeliveryOption, enabled: boolean) {
  return useQuery({
    queryKey: checkoutKey(addressId, delivery),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams({ delivery });
      if (addressId) params.set('addressId', String(addressId));
      return apiGet<CheckoutQuote>(`/checkout?${params}`, signal);
    },
    enabled,
    staleTime: 0,
    placeholderData: (previous) => previous,
  });
}

export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { addressId: number; delivery: DeliveryOption }) => apiSend<{ order: Order }>('POST', '/orders', input).then((r) => r.order),
    onSuccess: (order) => queryClient.setQueryData(orderKey(order.id), order),
    // Holding stock changes availability; anything else may have changed too.
    onSettled: () => void queryClient.invalidateQueries({ queryKey: cartKey }),
  });
}

export function useOrder(id: string) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: ({ signal }) => apiGet<{ order: Order }>(`/orders/${encodeURIComponent(id)}`, signal).then((r) => r.order),
    // Picks up expiry decided by the server.
    refetchInterval: (query) => (query.state.data?.status === 'pending_payment' ? 30_000 : false),
  });
}

export function useCancelOrder() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiSend<{ order: Order }>('POST', `/orders/${encodeURIComponent(id)}/cancel`, {}).then((r) => r.order),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKey(order.id), order);
      void queryClient.invalidateQueries({ queryKey: cartKey });
    },
  });
}

const dateFormat = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "Thu, 9 Oct – Sat, 11 Oct" from yyyy-mm-dd dates. */
export function formatEstimate(estimate: { from: string; to: string }): string {
  return `${dateFormat.format(new Date(estimate.from))} – ${dateFormat.format(new Date(estimate.to))}`;
}
