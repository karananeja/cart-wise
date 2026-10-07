import { useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Eye, EyeOff, Mail } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export function AuthLayout({ title, description, children, footer }: { title: string; description?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-4 sm:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
      {footer && <div className="border-t pt-4 text-sm text-muted-foreground">{footer}</div>}
    </div>
  );
}

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  error?: string;
  hint?: string;
  trailing?: ReactNode;
  ref?: Ref<HTMLInputElement>;
}

/** Labelled input with its error and hint linked for screen readers. */
export function FormField({ label, error, hint, trailing, className, ...input }: FormFieldProps) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <Label htmlFor={id}>{label}</Label>
      <div className="relative">
        <Input id={id} aria-invalid={error ? true : undefined} aria-describedby={describedBy} className={cn('h-10', trailing && 'pr-11')} {...input} />
        {trailing && <div className="absolute inset-y-0 right-1 flex items-center">{trailing}</div>}
      </div>
      {hint && !error && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

export function PasswordField(props: Omit<FormFieldProps, 'type' | 'trailing'>) {
  const [visible, setVisible] = useState(false);
  return (
    <FormField
      {...props}
      type={visible ? 'text' : 'password'}
      trailing={
        <Button type="button" variant="ghost" size="icon-sm" onClick={() => setVisible((v) => !v)} aria-label={visible ? 'Hide password' : 'Show password'} aria-pressed={visible}>
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </Button>
      }
    />
  );
}

/** Without MSG91 email settings (ADR-007), the "email" is shown here instead of being sent. */
export function DemoEmailBanner({ maskedEmail, code }: { maskedEmail: string; code: string }) {
  return (
    <div role="status" className="flex items-start gap-3 rounded-xl border border-dashed border-sky-300 bg-sky-50 p-3 text-sm text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100">
      <Mail className="mt-0.5 size-4 shrink-0" aria-hidden />
      <p>
        <span className="font-medium">Demo email to {maskedEmail}:</span> your code is{' '}
        <span className="font-mono font-semibold tracking-widest">{code}</span>. No real email is sent.
      </p>
    </div>
  );
}

/** With MSG91, the code really went out: say where, politely announced. */
export function EmailSentNote({ maskedEmail }: { maskedEmail: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm">
      <Mail className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span>
        We emailed a code to <span className="font-medium">{maskedEmail}</span>.
      </span>
    </p>
  );
}

/**
 * One numeric field for the 6-digit code: supports paste and one-time-code autofill, and
 * submits by itself once all digits are in.
 */
export function OtpInput({ onComplete, error, disabled }: { onComplete: (code: string) => void; error?: string; disabled?: boolean }) {
  const [code, setCode] = useState('');
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => ref.current?.focus(), []);
  // Clear after a wrong code so the next attempt starts fresh.
  useEffect(() => {
    if (error) setCode('');
  }, [error]);

  return (
    <FormField
      ref={ref}
      label="6-digit code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      value={code}
      disabled={disabled}
      error={error}
      className="[&_input]:font-mono [&_input]:text-lg [&_input]:tracking-[0.5em]"
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, '').slice(0, 6);
        setCode(digits);
        if (digits.length === 6) onComplete(digits);
      }}
    />
  );
}

export function AuthLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="font-medium text-foreground underline underline-offset-4">
      {children}
    </Link>
  );
}
