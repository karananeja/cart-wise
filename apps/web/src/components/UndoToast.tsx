import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';

const UNDO_MS = 6000;

export interface UndoNotice {
  /** Changes for every new notice, so the timer restarts. */
  key: number;
  message: string;
}

/** A notice that clears itself after a few seconds (used for Undo after a removal). */
export function useTimedNotice<T extends UndoNotice>(ms = UNDO_MS) {
  const [notice, setNotice] = useState<T>();
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(undefined), ms);
    return () => clearTimeout(timer);
  }, [notice, ms]);
  return [notice, setNotice] as const;
}

/** Bottom toast with Undo; the live region stays mounted so screen readers announce it. */
export function UndoToast({ notice, onUndo, onDismiss }: { notice: UndoNotice | undefined; onUndo: () => void; onDismiss: () => void }) {
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-20 z-40 flex justify-center px-4 lg:bottom-6">
      {notice && (
        <div key={notice.key} className="pointer-events-auto flex max-w-md items-center gap-3 rounded-xl bg-foreground px-4 py-3 text-sm text-background shadow-lg">
          <span className="min-w-0 truncate">{notice.message}</span>
          <Button size="sm" variant="secondary" onClick={onUndo}>
            Undo
          </Button>
          <button type="button" className="sr-only focus:not-sr-only" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
