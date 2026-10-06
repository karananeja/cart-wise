import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div role="status" className="bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100">
      <p className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-2 text-sm sm:px-6 lg:px-8">
        <WifiOff className="size-4" aria-hidden />
        You're offline — showing what we last loaded.
      </p>
    </div>
  );
}
