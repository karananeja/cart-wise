import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { InventoryChange, InventoryFilter, SimAutomation, SimInventoryPage, SimInventoryProduct, SimInventoryUnit, SimIntervalSeconds, SimOrder } from '@store/shared';
import { apiGet, apiSend } from '@/lib/api';

export const simSessionKey = ['sim', 'session'] as const;
export const simOrdersKey = ['sim', 'orders'] as const;
export const simInventoryKey = ['sim', 'inventory'] as const;
export const simAutomationKey = ['sim', 'automation'] as const;

export function useSimSession() {
  return useQuery({ queryKey: simSessionKey, queryFn: ({ signal }) => apiGet<{ signedIn: boolean }>('/sim/session', signal) });
}

export function useSimSignIn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (password: string) => apiSend<{ signedIn: boolean }>('POST', '/sim/session', { password }),
    onSuccess: (data) => queryClient.setQueryData(simSessionKey, data),
  });
}

export function useSimSignOut() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend<{ signedIn: boolean }>('DELETE', '/sim/session'),
    onSuccess: (data) => {
      queryClient.setQueryData(simSessionKey, data);
      queryClient.removeQueries({ queryKey: simOrdersKey });
      queryClient.removeQueries({ queryKey: simInventoryKey });
      queryClient.removeQueries({ queryKey: simAutomationKey });
    },
  });
}

export function useSimOrders(enabled: boolean) {
  return useQuery({
    queryKey: simOrdersKey,
    queryFn: ({ signal }) => apiGet<{ orders: SimOrder[] }>('/sim/orders', signal).then((r) => r.orders),
    enabled,
  });
}

/** Any operator action: the list is refreshed afterwards. */
export function useSimAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ path, body = {} }: { path: string; body?: unknown }) => apiSend<{ order: SimOrder }>('POST', `/sim${path}`, body),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: simOrdersKey }),
  });
}

// ── Inventory simulation (F-011) ──────────────────────────────────────────────────────────

export function useSimInventory(q: string, filter: InventoryFilter) {
  return useInfiniteQuery({
    queryKey: [...simInventoryKey, q, filter],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) => {
      const params = new URLSearchParams({ filter });
      if (q) params.set('q', q);
      if (pageParam) params.set('cursor', pageParam);
      return apiGet<SimInventoryPage>(`/sim/inventory?${params}`, signal);
    },
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: (previous) => previous,
  });
}

/** Sets a unit's on-hand stock; the product row and the change log refresh. */
export function useSetOnHand() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { productId: number; variantId: number | null; onHand: number }) =>
      apiSend<{ unit: SimInventoryUnit; product: SimInventoryProduct }>('PUT', '/sim/inventory/units', input),
    onSuccess: ({ product }) => {
      queryClient.setQueriesData<{ pages: SimInventoryPage[]; pageParams: unknown[] }>({ queryKey: simInventoryKey }, (data) =>
        data ? { ...data, pages: data.pages.map((page) => ({ ...page, products: page.products.map((p) => (p.productId === product.productId ? product : p)) })) } : data,
      );
      void queryClient.invalidateQueries({ queryKey: simAutomationKey });
    },
  });
}

export function useSimAutomation() {
  return useQuery({
    queryKey: simAutomationKey,
    queryFn: ({ signal }) => apiGet<SimAutomation>('/sim/automation', signal),
    // Keeps the log and next tick current while the simulation runs.
    refetchInterval: (query) => (query.state.data?.autoDecrease || query.state.data?.autoRestock ? 5_000 : false),
  });
}

export function useSaveAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { autoDecrease: boolean; autoRestock: boolean; intervalSeconds: SimIntervalSeconds }) => apiSend<SimAutomation>('PUT', '/sim/automation', input),
    onSuccess: (data) => queryClient.setQueryData(simAutomationKey, data),
  });
}

export function useRunAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiSend<{ changes: InventoryChange[]; automation: SimAutomation }>('POST', '/sim/automation/run', {}),
    onSuccess: ({ automation }) => {
      queryClient.setQueryData(simAutomationKey, automation);
      void queryClient.invalidateQueries({ queryKey: simInventoryKey });
    },
  });
}
