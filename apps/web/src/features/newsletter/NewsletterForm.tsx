import { useId, useState, type FormEvent } from 'react';
import { CircleCheck, Loader2 } from 'lucide-react';
import { normalizeEmail } from '@store/shared';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/api';
import { useSubscribe } from './api';

const INVALID = 'Enter a valid email address';

/**
 * The footer's one form (F-018 FR-3). New and existing subscribers see the same success message,
 * so it never reveals whether an address was already on the list.
 */
export function NewsletterForm() {
  const id = useId();
  const [email, setEmail] = useState('');
  const [invalid, setInvalid] = useState(false);
  const subscribe = useSubscribe();
  const error = subscribe.error instanceof ApiError ? subscribe.error : null;
  const fieldError = invalid || error?.code === 'INVALID_EMAIL' ? INVALID : undefined;
  const problem =
    subscribe.isError && !fieldError
      ? error?.status === 429
        ? 'Too many sign-ups from here. Please try again later.'
        : "Couldn't subscribe right now. Please try again."
      : null;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const normalized = normalizeEmail(email);
    setInvalid(!normalized);
    if (!normalized) return;
    subscribe.mutate(normalized, { onSuccess: () => track('newsletter_subscribed', { source: 'footer' }) });
  };

  return (
    <div className="flex flex-col gap-2">
      {!subscribe.isSuccess && (
        <form onSubmit={submit} noValidate className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">Offers and new arrivals. In this demo, only a welcome email is sent.</p>
          <label htmlFor={id} className="sr-only">
            Email for the newsletter
          </label>
          <div className="flex gap-2">
            <Input
              id={id}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              aria-invalid={fieldError ? true : undefined}
              aria-describedby={fieldError ? `${id}-error` : undefined}
              className="h-10 bg-background"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setInvalid(false);
              }}
            />
            <Button type="submit" className="h-10 shrink-0" disabled={subscribe.isPending}>
              {subscribe.isPending && <Loader2 className="animate-spin" aria-hidden />}
              Subscribe
            </Button>
          </div>
          {fieldError && (
            <p id={`${id}-error`} className="text-sm text-destructive">
              {fieldError}
            </p>
          )}
        </form>
      )}
      {/* Results are announced politely; the success message replaces the form. */}
      <p role="status" className={subscribe.isSuccess ? 'flex items-center gap-2 text-sm font-medium' : 'text-sm text-destructive empty:hidden'}>
        {subscribe.isSuccess ? (
          <>
            <CircleCheck className="size-4 shrink-0 text-emerald-600" aria-hidden /> You're subscribed. Thanks!
          </>
        ) : (
          problem
        )}
      </p>
    </div>
  );
}
