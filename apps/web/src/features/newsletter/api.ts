import { useMutation, useQuery } from '@tanstack/react-query';
import type { NewsletterUnsubscribeLookup } from '@store/shared';
import { apiGet, apiSend } from '@/lib/api';

export const useSubscribe = () => useMutation({ mutationFn: (email: string) => apiSend<{ ok: true }>('POST', '/newsletter', { email }) });

/** The masked address an unsubscribe link belongs to; opening the page never unsubscribes (F-018). */
export function useUnsubscribeLookup(token: string) {
  return useQuery({
    queryKey: ['newsletter', 'unsubscribe', token],
    queryFn: ({ signal }) => apiGet<NewsletterUnsubscribeLookup>(`/newsletter/unsubscribe?token=${encodeURIComponent(token)}`, signal),
    enabled: Boolean(token),
    staleTime: Infinity,
  });
}

export const useUnsubscribe = () => useMutation({ mutationFn: (token: string) => apiSend<{ ok: true }>('POST', '/newsletter/unsubscribe', { token }) });
