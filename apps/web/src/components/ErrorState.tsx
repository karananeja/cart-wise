import type { ReactNode } from 'react';
import { CloudOff, RefreshCw, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { StatusMessage } from './StatusMessage';

/** Friendly failure state; never shows technical detail (NFR-7). */
export function ErrorState({ what, onRetry }: { what: string; onRetry: () => void }) {
  const online = useOnlineStatus();
  if (!online) return <OfflineState what={what} />;
  return (
    <StatusMessage
      icon={<CloudOff />}
      title={`We couldn't load ${what} right now`}
      description="This is usually temporary. Please try again."
      actions={
        <Button onClick={onRetry}>
          <RefreshCw aria-hidden /> Try again
        </Button>
      }
    />
  );
}

/**
 * What to show while a query has no data: its error state, the offline state when the request
 * is paused for lack of a connection (it would otherwise wait forever), or the loading placeholder.
 */
export function QueryFallback({
  query,
  what,
  loading,
}: {
  query: { isError: boolean; fetchStatus: string; refetch: () => unknown };
  what: string;
  loading: ReactNode;
}) {
  if (query.isError) return <ErrorState what={what} onRetry={() => void query.refetch()} />;
  if (query.fetchStatus === 'paused') return <OfflineState what={what} />;
  return <>{loading}</>;
}

export function OfflineState({ what }: { what: string }) {
  return (
    <StatusMessage
      icon={<WifiOff />}
      title="You're offline"
      description={`We'll load ${what} as soon as you're back online.`}
    />
  );
}
