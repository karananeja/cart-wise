import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ORDER_FLOW, type CancelReason, type Order, type OrderList, type ReturnReason } from '@store/shared';
import { orderKey } from '@/features/checkout/api';
import { visitorId } from '@/lib/analytics';
import { apiGet, apiSend } from '@/lib/api';

export const ordersKey = ['orders', 'list'] as const;

/** Paid orders, newest first, 10 at a time (spec FR-4). */
export function useOrders() {
  return useInfiniteQuery({
    queryKey: ordersKey,
    queryFn: ({ pageParam, signal }) => apiGet<OrderList>(`/orders${pageParam ? `?cursor=${encodeURIComponent(pageParam)}` : ''}`, signal),
    initialPageParam: '',
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  });
}

const inProgress = (order: Order | undefined) =>
  !!order && ((ORDER_FLOW as readonly string[]).includes(order.status) && order.status !== 'delivered' || order.returns.some((r) => r.status !== 'refunded'));

/** One order. Refreshes while it is moving, so operator changes show up (spec §11). */
export function useOrderDetails(id: string) {
  return useQuery({
    queryKey: orderKey(id),
    queryFn: ({ signal }) => apiGet<{ order: Order }>(`/orders/${encodeURIComponent(id)}`, signal).then((r) => r.order),
    refetchInterval: (query) => (inProgress(query.state.data) ? 30_000 : false),
    refetchOnWindowFocus: true,
  });
}

function useOrderMutation<T>(send: (input: T) => Promise<{ order: Order }>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: T) => send(input).then((r) => r.order),
    onSuccess: (order) => {
      queryClient.setQueryData(orderKey(order.id), order);
      void queryClient.invalidateQueries({ queryKey: ordersKey });
    },
  });
}

export function useCancelPaidOrder(orderId: string) {
  return useOrderMutation((input: { reason?: CancelReason }) =>
    apiSend<{ order: Order }>('POST', `/orders/${encodeURIComponent(orderId)}/cancel`, { ...input, visitorId: visitorId() }),
  );
}

export function useRequestReturn(orderId: string) {
  return useOrderMutation((lines: { orderLineId: number; reason: ReturnReason }[]) =>
    apiSend<{ order: Order }>('POST', `/orders/${encodeURIComponent(orderId)}/returns`, { lines }),
  );
}
