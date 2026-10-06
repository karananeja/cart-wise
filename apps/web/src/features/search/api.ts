import { keepPreviousData, useQuery } from '@tanstack/react-query';
import type { SearchSuggestions } from '@store/shared';
import { apiGet } from '@/lib/api';

export function useSearchSuggestions(query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search', 'suggestions', query.toLowerCase()],
    queryFn: ({ signal }) => apiGet<SearchSuggestions>(`/search/suggestions?q=${encodeURIComponent(query)}`, signal),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 5 * 60_000,
    // Suggestions are a shortcut; never retry or surface errors (spec FR-7).
    retry: false,
  });
}
