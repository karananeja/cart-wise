import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { normalizeEmail, passwordProblem, type ChallengeResponse, type ResetTokenResponse } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useCompleteSignIn, useRequestOtp, useResetPassword } from './api';
import { AuthLayout, AuthLink, FormField, PasswordField } from './components';
import { authErrorMessage } from './messages';
import { OtpStep } from './OtpStep';
import { useReturnTo } from './useReturnTo';

/** Email → code to that email → new password (signs in, other devices signed out). */
export function ForgotPasswordPage() {
  const { returnTo, carry } = useReturnTo();
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [challenge, setChallenge] = useState<ChallengeResponse>();
  const [resetToken, setResetToken] = useState<string>();
  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string>();
  const request = useRequestOtp();
  const reset = useResetPassword();
  const complete = useCompleteSignIn();

  const sendCode = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeEmail(email);
    setEmailError(normalized ? undefined : 'Enter a valid email address');
    if (normalized) request.mutate({ purpose: 'reset', email: normalized }, { onSuccess: setChallenge });
  };

  const save = (event: FormEvent) => {
    event.preventDefault();
    const problem = passwordProblem(password);
    setPasswordError(problem);
    if (problem || !resetToken) return;
    reset.mutate({ resetToken, newPassword: password }, { onSuccess: (result) => complete(result, returnTo) });
  };

  let body;
  if (resetToken) {
    body = (
      <form onSubmit={save} className="flex flex-col gap-4" noValidate>
        <PasswordField label="New password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} error={passwordError} hint="At least 8 characters." />
        {reset.isError && (
          <Alert variant="destructive">
            <AlertDescription>{authErrorMessage(reset.error)}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="h-11" disabled={reset.isPending}>
          {reset.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Save and sign in
        </Button>
      </form>
    );
  } else if (challenge) {
    body = (
      <OtpStep
        challenge={challenge}
        onVerified={(result) => setResetToken((result as ResetTokenResponse).resetToken)}
        onBack={() => setChallenge(undefined)}
        backLabel="Start again"
      />
    );
  } else {
    body = (
      <form onSubmit={sendCode} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} error={emailError} />
        {request.isError && (
          <Alert variant="destructive">
            <AlertDescription>{authErrorMessage(request.error)}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="h-11" disabled={request.isPending || !email}>
          {request.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Send code
        </Button>
      </form>
    );
  }

  return (
    <AuthLayout
      title={resetToken ? 'Choose a new password' : 'Reset your password'}
      description={resetToken ? 'This signs you out on your other devices.' : "We'll email a code to the address on your account."}
      footer={
        <>
          Remembered it? <AuthLink to={`/login${carry({ method: 'password' })}`}>Sign in</AuthLink>
        </>
      }
    >
      {body}
    </AuthLayout>
  );
}
