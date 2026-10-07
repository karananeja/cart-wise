import { useState } from 'react';
import { Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { apiUrl } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';

export const invoiceFileName = (orderId: string) => `Cartwise-Invoice-${orderId}.pdf`;

/**
 * Downloads the order's demo tax invoice (F-019). Fetched rather than linked, so a failure can be
 * shown here instead of as a broken download. Only rendered for paid orders.
 */
export function DownloadInvoiceButton({ orderId, className }: { orderId: string; className?: string }) {
  const online = useOnlineStatus();
  const [state, setState] = useState<'idle' | 'downloading' | 'error'>('idle');

  async function download() {
    setState('downloading');
    try {
      const response = await fetch(apiUrl(`/orders/${encodeURIComponent(orderId)}/invoice.pdf`));
      if (!response.ok) throw new Error(`Invoice ${response.status}`);
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = invoiceFileName(orderId);
      document.body.append(link);
      link.click();
      link.remove();
      // Revoked a little later: some browsers start reading the file only after the click returns.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setState('idle');
    } catch {
      setState('error');
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Button variant="outline" className={className} disabled={!online || state === 'downloading'} aria-busy={state === 'downloading'} onClick={() => void download()}>
        {state === 'downloading' ? <Loader2 className="animate-spin" aria-hidden /> : <Download aria-hidden />}
        Download invoice
      </Button>
      {state === 'error' && (
        <p role="alert" className="text-sm text-destructive">
          Couldn't download the invoice. Please try again.
        </p>
      )}
    </div>
  );
}
