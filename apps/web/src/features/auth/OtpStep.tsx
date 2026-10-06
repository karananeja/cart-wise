import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChallengeResponse, ResetTokenResponse, SignedInResponse } from '@store/shared';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useResendOtp, useVerifyOtp } from './api';
import { DemoSmsBanner, OtpInput } from './components';
import { authErrorMessage } from './messages';

interface OtpStepProps {
  challenge: ChallengeResponse;
  onVerified: (result: SignedInResponse | ResetTokenResponse) => void;
  onBack: () => void;
  backLabel: string;
}

/** Enter the code, with resend (after 30 s) and clear messages for wrong or expired codes. */
export function OtpStep({ challenge: initial, onVerified, onBack, backLabel }: OtpStepProps) {
  const [challenge, setChallenge] = useState(initial);
  const [secondsLeft, setSecondsLeft] = useState(initial.resendAfterSeconds);
  const verify = useVerifyOtp();
  const resend = useResendOtp();
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const submit = (code: string) => {
    setError(undefined);
    verify.mutate({ challengeId: challenge.challengeId, code }, { onSuccess: onVerified, onError: (e) => setError(authErrorMessage(e)) });
  };

  const requestNew = () => {
    setError(undefined);
    resend.mutate(challenge.challengeId, {
      onSuccess: (next) => {
        setChallenge(next);
        setSecondsLeft(next.resendAfterSeconds);
      },
      onError: (e) => setError(authErrorMessage(e)),
    });
  };

  const locked = verify.error instanceof ApiError && ['TOO_MANY_ATTEMPTS', 'CODE_EXPIRED'].includes(verify.error.code);

  return (
    <div className="flex flex-col gap-4">
      <p className="text-sm">
        Enter the code sent to <span className="font-medium">{challenge.maskedMobile}</span>.
      </p>
      <DemoSmsBanner maskedMobile={challenge.maskedMobile} code={challenge.demoCode} />
      {/* Re-mounted for each new code, so a resend starts with an empty field. */}
      <OtpInput key={`code-${challenge.demoCode}`} onComplete={submit} error={error} disabled={verify.isPending || locked} />
      {verify.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking…
        </p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Button type="button" variant="link" className="h-auto px-0" onClick={onBack}>
          {backLabel}
        </Button>
        {secondsLeft > 0 ? (
          <span className="text-muted-foreground" aria-live="polite">
            Resend code in {secondsLeft}s
          </span>
        ) : (
          <Button type="button" variant="link" className="h-auto px-0" onClick={requestNew} disabled={resend.isPending}>
            Resend code
          </Button>
        )}
      </div>
    </div>
  );
}
