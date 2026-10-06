import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { normalizeMobile, type ChallengeResponse, type SignedInResponse } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useCompleteSignIn, usePasswordLogin, useRequestOtp } from './api';
import { AuthLayout, AuthLink, FormField, PasswordField } from './components';
import { authErrorMessage } from './messages';
import { OtpStep } from './OtpStep';
import { useReturnTo } from './useReturnTo';

/** Sign in: mobile + code by default; "Use password instead" is one link away. */
export function LoginPage() {
  const { returnTo, carry, params } = useReturnTo();
  const usePassword = params.get('method') === 'password';
  return usePassword ? <PasswordLogin returnTo={returnTo} carry={carry} /> : <OtpLogin returnTo={returnTo} carry={carry} initialMobile={params.get('mobile') ?? ''} />;
}

type Carry = ReturnType<typeof useReturnTo>['carry'];

function OtpLogin({ returnTo, carry, initialMobile }: { returnTo: string; carry: Carry; initialMobile: string }) {
  const [mobile, setMobile] = useState(initialMobile);
  const [fieldError, setFieldError] = useState<string>();
  const [challenge, setChallenge] = useState<ChallengeResponse>();
  const request = useRequestOtp();
  const complete = useCompleteSignIn();
  const online = useOnlineStatus();

  const send = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeMobile(mobile);
    if (!normalized) {
      setFieldError('Enter a 10-digit Indian mobile number');
      return;
    }
    setFieldError(undefined);
    request.mutate({ purpose: 'login', mobile: normalized }, { onSuccess: setChallenge });
  };

  const noAccount = request.error instanceof ApiError && request.error.code === 'NO_ACCOUNT';

  return (
    <AuthLayout
      title="Sign in"
      description="We'll send a one-time code to your mobile."
      footer={
        <>
          New here? <AuthLink to={`/signup${carry(mobile ? { mobile } : {})}`}>Create an account</AuthLink>
        </>
      }
    >
      {challenge ? (
        <OtpStep
          challenge={challenge}
          onVerified={(result) => complete(result as SignedInResponse, returnTo)}
          onBack={() => setChallenge(undefined)}
          backLabel="Use a different number"
        />
      ) : (
        <form onSubmit={send} className="flex flex-col gap-4" noValidate>
          <FormField
            label="Mobile number"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            placeholder="98765 43210"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            error={fieldError}
          />
          {request.isError && (
            <Alert variant={noAccount ? 'default' : 'destructive'}>
              <AlertDescription>
                {noAccount ? (
                  <>
                    No account for this number. <AuthLink to={`/signup${carry({ mobile })}`}>Sign up?</AuthLink>
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
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const login = usePasswordLogin();
  const complete = useCompleteSignIn();
  const online = useOnlineStatus();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    login.mutate({ identifier, password }, { onSuccess: (result) => complete(result, returnTo) });
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
        <FormField label="Email or mobile" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
        <PasswordField label="Password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {login.isError && (
          <Alert variant="destructive">
            <AlertDescription>{authErrorMessage(login.error)}</AlertDescription>
          </Alert>
        )}
        <Button type="submit" size="lg" className="h-11" disabled={login.isPending || !online || !identifier || !password}>
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
