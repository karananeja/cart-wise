import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import {
  EMPTY_CART,
  EMPTY_WISHLIST,
  type ChallengeResponse,
  type MeResponse,
  type ResetTokenResponse,
  type SignedInResponse,
  type SignupInput,
} from '@store/shared';
import { addressesKey } from '@/features/addresses/api';
import { cartKey } from '@/features/cart/api';
import { wishlistKey } from '@/features/wishlist/api';
import { apiGet, apiSend } from '@/lib/api';
import { recentSearchesStore } from '@/lib/recentSearches';
import { recentlyViewedStore } from '@/lib/recentlyViewed';

export const meKey = ['me'] as const;

export function useMe() {
  return useQuery({
    queryKey: meKey,
    queryFn: ({ signal }) => apiGet<MeResponse>('/auth/me', signal),
    staleTime: Infinity,
  });
}

export const useSignupStart = () =>
  useMutation({ mutationFn: (input: SignupInput) => apiSend<ChallengeResponse>('POST', '/auth/signup', input) });

export const useRequestOtp = () =>
  useMutation({
    mutationFn: (input: { purpose: 'login' | 'reset'; email: string }) =>
      apiSend<ChallengeResponse>('POST', '/auth/otp', input),
  });

export const useResendOtp = () =>
  useMutation({ mutationFn: (challengeId: string) => apiSend<ChallengeResponse>('POST', '/auth/otp/resend', { challengeId }) });

export const useVerifyOtp = () =>
  useMutation({
    mutationFn: (input: { challengeId: string; code: string }) =>
      apiSend<SignedInResponse | ResetTokenResponse>('POST', '/auth/verify', input),
  });

export const usePasswordLogin = () =>
  useMutation({
    mutationFn: (input: { email: string; password: string }) => apiSend<SignedInResponse>('POST', '/auth/password', input),
  });

export const useResetPassword = () =>
  useMutation({
    mutationFn: (input: { resetToken: string; newPassword: string }) => apiSend<SignedInResponse>('POST', '/auth/reset', input),
  });

/** History state carrying a one-off notice to show on the next page. */
export interface AuthNoticeState {
  authNotice?: string;
}

function welcomeNotice({ user, merged }: SignedInResponse): string | undefined {
  const first = user.name.split(' ')[0];
  const kept = [merged.cart && 'cart', merged.wishlist && 'wishlist'].filter(Boolean).join(' and ');
  return kept ? `Welcome, ${first}. We kept your ${kept}.` : undefined;
}

/** After any successful sign-in: refresh account-dependent data and go back where the shopper was. */
export function useCompleteSignIn() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return (result: SignedInResponse, returnTo: string) => {
    queryClient.setQueryData<MeResponse>(meKey, { user: result.user });
    void queryClient.invalidateQueries({ queryKey: cartKey });
    void queryClient.invalidateQueries({ queryKey: wishlistKey });
    navigate(returnTo, { replace: true, state: { authNotice: welcomeNotice(result) } satisfies AuthNoticeState });
  };
}

/** Signs out this device: the browser becomes a fresh guest; the account keeps its items. */
export function useLogout() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  return useMutation({
    mutationFn: () => apiSend<{ ok: true }>('POST', '/auth/logout', {}),
    onSuccess: () => {
      // A fresh guest device, not a removal: the account keeps its history.
      recentlyViewedStore.setAll([]);
      recentSearchesStore.setAll([]);
      queryClient.setQueryData<MeResponse>(meKey, { user: null });
      queryClient.setQueryData(cartKey, EMPTY_CART);
      queryClient.setQueryData(wishlistKey, EMPTY_WISHLIST);
      queryClient.removeQueries({ queryKey: addressesKey });
      navigate(window.location.pathname === '/account' ? '/' : window.location.pathname + window.location.search, {
        replace: true,
        state: { authNotice: "You've signed out." } satisfies AuthNoticeState,
      });
    },
  });
}
