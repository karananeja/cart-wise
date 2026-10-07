import { CircleCheck, Loader2, MailX } from 'lucide-react';
import { Link, useSearchParams } from 'react-router';
import { StatusMessage } from '@/components/StatusMessage';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ApiError } from '@/lib/api';
import { useUnsubscribe, useUnsubscribeLookup } from './api';

const shopLink = (
  <Button asChild variant="outline">
    <Link to="/">Continue shopping</Link>
  </Button>
);

/**
 * Opened from the welcome email (F-018 FR-3). Loading the page only looks the link up; the
 * shopper confirms with the button, so a mail scanner opening the link can't unsubscribe them.
 */
export function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const lookup = useUnsubscribeLookup(token);
  const unsubscribe = useUnsubscribe();

  const invalid = (
    <StatusMessage icon={<MailX />} title="This link isn't valid anymore." description="You may already have unsubscribed." actions={shopLink} />
  );
  if (!token) return invalid;
  if (unsubscribe.isSuccess) {
    return <StatusMessage icon={<CircleCheck />} title="You're unsubscribed" description="You won't get newsletter emails from us." actions={shopLink} />;
  }
  if (lookup.isPending) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center gap-3 py-16" aria-busy="true" aria-label="Loading">
        <Skeleton className="size-12 rounded-full" />
        <Skeleton className="h-6 w-64" />
        <Skeleton className="h-9 w-32" />
      </div>
    );
  }
  const gone = (error: unknown) => error instanceof ApiError && error.isNotFound;
  if (lookup.isError) {
    if (gone(lookup.error)) return invalid;
    return (
      <StatusMessage
        icon={<MailX />}
        title="We couldn't load this link right now"
        description="This is usually temporary. Please try again."
        actions={<Button onClick={() => lookup.refetch()}>Try again</Button>}
      />
    );
  }
  if (unsubscribe.isError && gone(unsubscribe.error)) return invalid;

  return (
    <StatusMessage
      icon={<MailX />}
      title={`Unsubscribe ${lookup.data.maskedEmail}?`}
      description={
        <>
          <p>You'll stop getting the newsletter. You can subscribe again from the footer any time.</p>
          {unsubscribe.isError && (
            <p role="alert" className="mt-2 text-destructive">
              Couldn't unsubscribe right now. Please try again.
            </p>
          )}
        </>
      }
      actions={
        <Button onClick={() => unsubscribe.mutate(token)} disabled={unsubscribe.isPending}>
          {unsubscribe.isPending && <Loader2 className="animate-spin" aria-hidden />}
          Unsubscribe
        </Button>
      }
    />
  );
}
