import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { SimOrder } from '@store/shared';
import { apiGet, apiSend } from '@/lib/api';

export const simSessionKey = ['sim', 'session'] as const;
export const simOrdersKey = ['sim', 'orders'] as const;

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
