import { KeyRound } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * The delivery OTP (spec FR-14). Shown only to the owner while out for delivery; screen readers
 * hear the digits one by one.
 */
export function DeliveryCode({ code, compact = false }: { code: string; compact?: boolean }) {
  const spoken = code.split('').join(' ');
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-xl border border-sky-300 bg-sky-50 text-sky-950 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100',
        compact ? 'px-3 py-2 text-sm' : 'p-4',
      )}
    >
      <KeyRound className={compact ? 'size-4' : 'size-5'} aria-hidden />
      <p>
        Share code{' '}
        <span role="img" aria-label={`delivery code ${spoken}`} className={cn('font-mono font-semibold tracking-[0.3em]', compact ? 'text-base' : 'text-2xl')}>
          {code}
        </span>{' '}
        with the delivery partner
      </p>
    </div>
  );
}
