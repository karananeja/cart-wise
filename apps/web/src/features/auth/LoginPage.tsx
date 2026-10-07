import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { normalizeEmail, type ChallengeResponse, type SignedInResponse } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useCompleteSignIn, usePasswordLogin, useRequestOtp } from './api';
import { AuthLayout, AuthLink, FormField, PasswordField } from './components';
import { authErrorMessage } from './messages';
import { OtpStep } from './OtpStep';
import { useReturnTo } from './useReturnTo';

/** Sign in: email + code by default; "Use password instead" is one link away. */
export function LoginPage() {
  const { returnTo, carry, params } = useReturnTo();
  const usePassword = params.get('method') === 'password';
  return usePassword ? <PasswordLogin returnTo={returnTo} carry={carry} /> : <OtpLogin returnTo={returnTo} carry={carry} initialEmail={params.get('email') ?? ''} />;
}

type Carry = ReturnType<typeof useReturnTo>['carry'];

function OtpLogin({ returnTo, carry, initialEmail }: { returnTo: string; carry: Carry; initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [fieldError, setFieldError] = useState<string>();
  const [challenge, setChallenge] = useState<ChallengeResponse>();
  const request = useRequestOtp();
  const complete = useCompleteSignIn();
  const online = useOnlineStatus();

  const send = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeEmail(email);
    if (!normalized) {
      setFieldError('Enter a valid email address');
      return;
    }
    setFieldError(undefined);
    request.mutate({ purpose: 'login', email: normalized }, { onSuccess: setChallenge });
  };

  const noAccount = request.error instanceof ApiError && request.error.code === 'NO_ACCOUNT';

  return (
    <AuthLayout
      title="Sign in"
      description="We'll email you a one-time code."
      footer={
        <>
          New here? <AuthLink to={`/signup${carry(email ? { email } : {})}`}>Create an account</AuthLink>
        </>
      }
    >
      {challenge ? (
        <OtpStep
          challenge={challenge}
          onVerified={(result) => complete(result as SignedInResponse, returnTo)}
          onBack={() => setChallenge(undefined)}
          backLabel="Use a different email"
        />
      ) : (
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <FormField
            label="Email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={fieldError}
          />
          {request.isError && (
            <Alert variant={noAccount ? 'default' : 'destructive'}>
              <AlertDescription>
                {noAccount ? (
                  <>
                    No account for this email. <AuthLink to={`/signup${carry({ email: email.trim() })}`}>Sign up?</AuthLink>
                  </>
                ) : (
                  authErrorMessage(request.error)
                )}
              </AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="h-11" disabled={request.isPending || !online}>
            {request.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Send code
          </Button>
          <AuthLink to={`/login${carry({ method: 'password' })}`}>Use password instead</AuthLink>
        </form>
      )}
    </AuthLayout>
  );
}

function PasswordLogin({ returnTo, carry }: { returnTo: string; carry: Carry }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = usePasswordLogin();
  const complete = useCompleteSignIn();
  const online = useOnlineStatus();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ email, password }, { onSuccess: (result) => complete(result, returnTo) });
  };

  return (
    <AuthLayout
      title="Sign in with password"
      footer={
        <>
          New here? <AuthLink to={`/signup${carry()}`}>Create an account</AuthLink>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" type="email" inputMode="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {login.isError && (
          <Alert variant="destructive">
            <AlertDescription>{authErrorMessage(login.error)}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="h-11" disabled={login.isPending || !online || !email || !password}>
          {login.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Sign in
        </Button>
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <AuthLink to={`/login${carry()}`}>Use a one-time code instead</AuthLink>
          <AuthLink to={`/forgot-password${carry()}`}>Forgot password?</AuthLink>
        </div>
      </form>
    </AuthLayout>
  );
}
