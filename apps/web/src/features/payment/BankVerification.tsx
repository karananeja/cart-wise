import { useState } from 'react';
import { Landmark, Loader2 } from 'lucide-react';
import type { Order, PaymentAttemptView } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { OtpInput } from '@/features/auth/components';
import { ApiError } from '@/lib/api';
import { useCancelAttempt, useVerifyCardOtp } from './api';
import { paymentErrorMessage } from './messages';

interface BankVerificationProps {
  attempt: PaymentAttemptView;
  onSucceeded: (order: Order) => void;
  onFailed: (attempt: PaymentAttemptView) => void;
}

/** The simulated bank OTP step (spec FR-11). The code is shown on screen; nothing is sent. */
export function BankVerification({ attempt, onSucceeded, onFailed }: BankVerificationProps) {
  const verify = useVerifyCardOtp();
  const cancel = useCancelAttempt();
  const [error, setError] = useState<string>();
  const [round, setRound] = useState(0);

  const settle = (result: { attempt: PaymentAttemptView; order?: Order }) => {
    if (result.attempt.status === 'succeeded' && result.order) onSucceeded(result.order);
    else if (result.attempt.status === 'failed') onFailed(result.attempt);
  };

  const submit = (otp: string) => {
    setError(undefined);
    verify.mutate(
      { attemptId: attempt.id, otp },
      {
        onSuccess: settle,
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'INVALID_CODE') {
            const left = Number(e.details?.attemptsLeft ?? 0);
            setError(`That code is not right. ${left} ${left === 1 ? 'attempt' : 'attempts'} left.`);
          } else if (e instanceof ApiError && e.code === 'ATTEMPT_NOT_PENDING' && e.details?.attempt) {
            onFailed(e.details.attempt as PaymentAttemptView);
          } else {
            setError(paymentErrorMessage(e));
          }
          setRound((r) => r + 1);
        },
      },
    );
  };

  return (
    <section aria-labelledby="bank-verification" className="flex flex-col gap-4 rounded-xl border p-5">
      <h2 id="bank-verification" className="flex items-center gap-2 text-lg font-semibold">
        <Landmark className="size-5" aria-hidden /> Demo bank verification
      </h2>
      <p className="text-sm">
        Confirm the payment of <span className="font-medium">{attempt.label}</span> with the code your bank sent.
      </p>
      {attempt.demoCode && (
        <div role="status" className="rounded-xl border border-dashed border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
          <span className="font-medium">Demo bank SMS:</span> your code is <span className="font-mono font-semibold tracking-widest">{attempt.demoCode}</span>. No real message is sent.
        </div>
      )}
      <OtpInput key={round} onComplete={submit} error={error} disabled={verify.isPending || cancel.isPending} />
      {verify.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Verifying…
        </p>
      )}
      {cancel.isError && (
        <Alert variant="destructive">
          <AlertDescription>{paymentErrorMessage(cancel.error)}</AlertDescription>
        </Alert>
      )}
      <Button
        type="button"
        variant="outline"
        className="w-fit"
        disabled={verify.isPending || cancel.isPending}
        onClick={() => cancel.mutate(attempt.id, { onSuccess: (result) => onFailed(result.attempt) })}
      >
        Cancel
      </Button>
    </section>
  );
}
