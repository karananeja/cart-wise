import { CheckCircle2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useLocation } from 'react-router';
import { Button } from '@/components/ui/button';
import type { AuthNoticeState } from './api';

/** One-off message after signing in or out ("We kept your cart"), carried in history state. */
export function AuthNotice() {
  const location = useLocation();
  const message = (location.state as AuthNoticeState | null)?.authNotice;
  const [dismissed, setDismissed] = useState<string>();
  useEffect(() => setDismissed(undefined), [location.key]);
  if (!message || dismissed === location.key) return null;
  return (
    <div role="status" className="mb-6 flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100">
      <CheckCircle2 className="size-4 shrink-0" aria-hidden />
      <p className="flex-1">{message}</p>
      <Button variant="ghost" size="icon-sm" aria-label="Dismiss" onClick={() => setDismissed(location.key)}>
        <X aria-hidden />
      </Button>
    </div>
  );
}
