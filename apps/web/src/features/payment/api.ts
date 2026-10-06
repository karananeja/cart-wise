import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Order, PaymentAttemptView, PaymentConfig, PaymentInput, PaymentQuote } from '@store/shared';
import { cartKey } from '@/features/cart/api';
import { orderKey } from '@/features/checkout/api';
import { visitorId } from '@/lib/analytics';
import { apiGet, apiSend } from '@/lib/api';

type AttemptResult = { attempt: PaymentAttemptView; order?: Order };

export const paymentQuoteKey = (orderId: string, offerId: string | null, bin: string | undefined) =>
  ['payment-quote', orderId, offerId ?? 'none', bin ?? 'none'] as const;
export const attemptKey = (id: string) => ['payments', id] as const;

/** Amount to pay and offer eligibility, decided by the server for the chosen offer and the card's first 6 digits. */
export function usePaymentQuote(orderId: string, offerId: string | null, bin: string | undefined, enabled = true) {
  return useQuery({
    queryKey: paymentQuoteKey(orderId, offerId, bin),
    queryFn: ({ signal }) => {
      const params = new URLSearchParams();
      if (offerId) params.set('offerId', offerId);
      if (bin) params.set('bin', bin);
      return apiGet<PaymentQuote>(`/orders/${encodeURIComponent(orderId)}/payment-quote?${params}`, signal);
    },
    enabled,
    placeholderData: (previous) => previous,
  });
}

/** Keeps the order (and, once paid, the cart) in step with what an attempt returned. */
function useApplyResult() {
  const queryClient = useQueryClient();
  return (result: AttemptResult) => {
    queryClient.setQueryData(attemptKey(result.attempt.id), result);
    if (result.order) {
      queryClient.setQueryData(orderKey(result.order.id), result.order);
      if (result.order.status === 'confirmed') void queryClient.invalidateQueries({ queryKey: cartKey });
    }
  };
}

/** Card attempts send only the first 6 and last 4 digits (spec FR-12). */
export function useStartPayment(orderId: string) {
  const apply = useApplyResult();
  return useMutation({
    mutationFn: (input: PaymentInput) =>
      apiSend<AttemptResult>('POST', `/orders/${encodeURIComponent(orderId)}/payments`, { ...input, visitorId: visitorId() }),
    onSuccess: apply,
  });
}

export function useVerifyCardOtp() {
  const apply = useApplyResult();
  return useMutation({
    mutationFn: ({ attemptId, otp }: { attemptId: string; otp: string }) =>
      apiSend<AttemptResult>('POST', `/payments/${encodeURIComponent(attemptId)}/verify`, { otp }),
    onSuccess: apply,
  });
}

export function useUpiResponse() {
  const apply = useApplyResult();
  return useMutation({
    mutationFn: ({ attemptId, approve }: { attemptId: string; approve: boolean }) =>
      apiSend<AttemptResult>('POST', `/payments/${encodeURIComponent(attemptId)}/upi-response`, { approve }),
    onSuccess: apply,
  });
}

export function useCancelAttempt() {
  const apply = useApplyResult();
  return useMutation({
    mutationFn: (attemptId: string) => apiSend<AttemptResult>('POST', `/payments/${encodeURIComponent(attemptId)}/cancel`, {}),
    onSuccess: apply,
  });
}

/** Polled every 2 seconds while a UPI request waits for approval. */
export function useAttempt(id: string | undefined) {
  const apply = useApplyResult();
  return useQuery({
    queryKey: attemptKey(id ?? ''),
    queryFn: async ({ signal }) => {
      const result = await apiGet<AttemptResult>(`/payments/${encodeURIComponent(id!)}`, signal);
      apply(result);
      return result;
    },
    enabled: Boolean(id),
    refetchInterval: (query) => (query.state.data?.attempt.status === 'pending' ? 2000 : false),
  });
}

/** Whether Razorpay (test mode) is configured on the server (F-014). */
export function usePaymentConfig() {
  return useQuery({
    queryKey: ['payment-config'],
    queryFn: ({ signal }) => apiGet<PaymentConfig>('/payments/config', signal),
    staleTime: Infinity,
  });
}

/** Razorpay Checkout's success response, checked by the server before the order is confirmed. */
export function useVerifyRazorpay() {
  const apply = useApplyResult();
  return useMutation({
    mutationFn: ({ attemptId, ...response }: { attemptId: string; razorpayPaymentId: string; razorpayOrderId: string; razorpaySignature: string }) =>
      apiSend<AttemptResult>('POST', `/payments/${encodeURIComponent(attemptId)}/razorpay/verify`, response),
    onSuccess: apply,
  });
}
