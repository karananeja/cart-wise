import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Address, AddressInput, GeoPlace } from '@store/shared';
import { apiGet, apiSend } from '@/lib/api';

export const addressesKey = ['addresses'] as const;

export function useAddresses(enabled = true) {
  return useQuery({
    queryKey: addressesKey,
    queryFn: ({ signal }) => apiGet<{ addresses: Address[] }>('/addresses', signal).then((r) => r.addresses),
    enabled,
  });
}

function useAddressMutation<TInput, TResult extends { addresses: Address[] }>(fn: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result) => queryClient.setQueryData(addressesKey, result.addresses),
  });
}

export const useCreateAddress = () =>
  useAddressMutation((input: { values: AddressInput; makeDefault?: boolean }) =>
    apiSend<{ addresses: Address[] }>('POST', '/addresses', { ...input.values, makeDefault: input.makeDefault ?? false }),
  );

export const useUpdateAddress = () =>
  useAddressMutation((input: { id: number; values: AddressInput }) => apiSend<{ addresses: Address[] }>('PUT', `/addresses/${input.id}`, input.values));

export const useDeleteAddress = () =>
  useAddressMutation((id: number) => apiSend<{ addresses: Address[]; promotedId: number | null }>('DELETE', `/addresses/${id}`));

export const useSetDefaultAddress = () =>
  useAddressMutation((id: number) => apiSend<{ addresses: Address[] }>('POST', `/addresses/${id}/default`, {}));

export const searchPlaces = (q: string, signal?: AbortSignal) =>
  apiGet<{ places: GeoPlace[] }>(`/geo/search?q=${encodeURIComponent(q)}`, signal).then((r) => r.places);

export const reversePlace = (latitude: number, longitude: number, signal?: AbortSignal) =>
  apiGet<{ place: GeoPlace | null }>(`/geo/reverse?lat=${latitude}&lon=${longitude}`, signal).then((r) => r.place);
