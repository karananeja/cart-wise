import { useSearchParams } from 'react-router';
import { safeReturnTo } from '@store/shared';

/** Where to go after signing in (same-site paths only), and a query string that keeps it. */
export function useReturnTo() {
  const [params] = useSearchParams();
  const returnTo = safeReturnTo(params.get('returnTo'));
  const carry = (extra: Record<string, string> = {}) => {
    const next = new URLSearchParams(extra);
    if (returnTo !== '/') next.set('returnTo', returnTo);
    const qs = next.toString();
    return qs ? `?${qs}` : '';
  };
  return { returnTo, carry, params };
}
