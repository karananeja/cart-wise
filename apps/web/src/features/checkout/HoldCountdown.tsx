import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';

const ANNOUNCE_AT = [300, 60];

/**
 * Shows the remaining payment hold as m:ss. Screen readers hear it only at 5 minutes,
 * 1 minute and expiry, not every second.
 */
export function HoldCountdown({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const remaining = () => Math.max(0, Math.round((Date.parse(expiresAt) - Date.now()) / 1000));
  const [seconds, setSeconds] = useState(remaining);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      const left = remaining();
      setSeconds(left);
      if (ANNOUNCE_AT.includes(left)) setAnnouncement(`${left / 60} ${left === 60 ? 'minute' : 'minutes'} left to pay`);
      if (left === 0) {
        clearInterval(timer);
        setAnnouncement('Your hold has expired');
        onExpire();
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const label = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  return (
    <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-950 dark:bg-amber-950/40 dark:text-amber-100">
      <Clock className="size-4" aria-hidden />
      <span>
        We're holding your items for <span className="font-semibold tabular-nums">{label}</span>
      </span>
      <span className="sr-only" aria-live="polite">
        {announcement}
      </span>
    </p>
  );
}
