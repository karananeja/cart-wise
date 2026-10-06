import { useState, type FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { checkSignup, type ChallengeResponse, type FieldErrors, type SignedInResponse } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { useCompleteSignIn, useSignupStart } from './api';
import { AuthLayout, AuthLink, FormField, PasswordField } from './components';
import { authErrorMessage, fieldErrors } from './messages';
import { OtpStep } from './OtpStep';
import { useReturnTo } from './useReturnTo';

export function SignupPage() {
  const { returnTo, carry, params } = useReturnTo();
  const [form, setForm] = useState({ name: '', email: '', mobile: params.get('mobile') ?? '', password: '' });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [challenge, setChallenge] = useState<ChallengeResponse>();
  const start = useSignupStart();
  const complete = useCompleteSignIn();
  const online = useOnlineStatus();

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const { errors: found, values } = checkSignup(form);
    setErrors(found);
    const first = Object.keys(found)[0];
    if (first) {
      event.currentTarget.querySelector<HTMLInputElement>(`[name="${first}"]`)?.focus();
      return;
    }
    start.mutate(values, { onSuccess: setChallenge, onError: (e) => setErrors(fieldErrors(e)) });
  };

  const taken = start.error && Object.keys(fieldErrors(start.error)).length > 0;

  return (
    <AuthLayout
      title={challenge ? 'Verify your mobile' : 'Create your account'}
      footer={
        <>
          Already have an account? <AuthLink to={`/login${carry()}`}>Sign in</AuthLink>
        </>
      }
    >
      {challenge ? (
        <OtpStep
          challenge={challenge}
          onVerified={(result) => complete(result as SignedInResponse, returnTo)}
          onBack={() => setChallenge(undefined)}
          backLabel="Edit details"
        />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
          <FormField label="Full name" name="name" autoComplete="name" value={form.name} onChange={set('name')} error={errors.name} />
          <FormField label="Email" name="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} error={errors.email} />
          <FormField
            label="Mobile number"
            name="mobile"
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={form.mobile}
            onChange={set('mobile')}
            error={errors.mobile}
            hint="We'll send a code to verify it."
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
            error={errors.password}
            hint="At least 8 characters."
          />
          {taken && (
            <p className="text-sm">
              <AuthLink to={`/login${carry()}`}>Sign in instead</AuthLink>
            </p>
          )}
          {start.isError && !taken && (
            <Alert variant="destructive">
              <AlertDescription>{authErrorMessage(start.error)}</AlertDescription>
            </Alert>
          )}
          <Button type="submit" size="lg" className="h-11" disabled={start.isPending || !online}>
            {start.isPending && <Loader2 className="animate-spin" aria-hidden />}
            Continue
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
