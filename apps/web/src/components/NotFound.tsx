import { SearchX } from 'lucide-react';
import { Link } from 'react-router';
import { Button } from '@/components/ui/button';
import { StatusMessage } from './StatusMessage';

export function NotFound({ title = "We couldn't find that page" }: { title?: string }) {
  return (
    <StatusMessage
      icon={<SearchX />}
      title={title}
      description="It may have moved, or the link may be mistyped."
      actions={
        <>
          <Button asChild>
            <Link to="/products">Browse all products</Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/">Go to home</Link>
          </Button>
        </>
      }
    />
  );
}
