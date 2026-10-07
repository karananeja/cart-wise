import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import type { ChallengeResponse, ResetTokenResponse, SignedInResponse } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useResendOtp, useVerifyOtp } from './api';
import { DemoEmailBanner, EmailSentNote, OtpInput } from './components';
import { authErrorMessage } from './messages';

interface OtpStepProps {
  challenge: ChallengeResponse;
  onVerified: (result: SignedInResponse | ResetTokenResponse) => void;
  onBack: () => void;
  backLabel: string;
}

/**
 * Enter the emailed code, with resend (after 30 s) and clear messages for wrong or expired codes.
 * Without SMTP the code is shown in a demo banner instead (F-016, ADR-006).
 */
export function OtpStep({ challenge: initial, onVerified, onBack, backLabel }: OtpStepProps) {
  const [challenge, setChallenge] = useState(initial);
  // Bumped per new code, so the field re-mounts empty (a real email has no code to key on).
  const [round, setRound] = useState(0);
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
        setRound((r) => r + 1);
        setSecondsLeft(next.resendAfterSeconds);
      },
    });
  };

  const locked = verify.error instanceof ApiError && ['TOO_MANY_ATTEMPTS', 'CODE_EXPIRED'].includes(verify.error.code);
  const sendFailed = resend.error instanceof ApiError && resend.error.code === 'EMAIL_FAILED';

  return (
    <div className="flex flex-col gap-4">
      {challenge.demoCode ? (
        <>
          <p className="text-sm">
            Enter the code sent to <span className="font-medium">{challenge.maskedEmail}</span>.
          </p>
          <DemoEmailBanner maskedEmail={challenge.maskedEmail} code={challenge.demoCode} />
        </>
      ) : (
        <EmailSentNote maskedEmail={challenge.maskedEmail} />
      )}
      {/* Re-mounted for each new code, so a resend starts with an empty field. */}
      <OtpInput key={`code-${round}`} onComplete={submit} error={error} disabled={verify.isPending || locked} />
      {verify.isPending && (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden /> Checking…
        </p>
      )}
      {resend.isError && (
        <Alert variant="destructive">
          <AlertDescription className="flex flex-wrap items-center gap-x-2">
            {authErrorMessage(resend.error)}
            {sendFailed && (
              <Button type="button" variant="link" className="h-auto px-0 text-destructive" onClick={requestNew}>
                Try again
              </Button>
            )}
          </AlertDescription>
        </Alert>
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
          <span className="flex flex-wrap items-center gap-x-2">
            {/* Real emails can land in spam; a hint once the resend wait is over (30 s). */}
            {challenge.delivery === 'email' && <span className="text-muted-foreground">Check your spam folder.</span>}
            <Button type="button" variant="link" className="h-auto px-0" onClick={requestNew} disabled={resend.isPending}>
              {resend.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Resend code
            </Button>
          </span>
        )}
      </div>
    </div>
  );
}
