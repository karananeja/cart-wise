import { CloudOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StatusMessage } from '@/components/StatusMessage';

/** Last-resort boundary for unexpected render errors. */
export function RouteError() {
  return (
    <StatusMessage
      icon={<CloudOff />}
      title="Something went wrong"
      description="Please reload the page. If it keeps happening, try again in a little while."
      actions={<Button onClick={() => window.location.reload()}>Reload</Button>}
    />
  );
}
