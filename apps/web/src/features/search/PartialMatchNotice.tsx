import { Info } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function PartialMatchNotice({ query }: { query: string }) {
  return (
    <Alert>
      <Info aria-hidden />
      <AlertDescription>
        No results for all of “{query}”. Showing products that match some of your words.
      </AlertDescription>
    </Alert>
  );
}
