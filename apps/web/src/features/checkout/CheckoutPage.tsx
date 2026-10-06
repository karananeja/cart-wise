import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Loader2, MapPin, Plus } from 'lucide-react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router';
import { formatPrice, isDeliveryOption, maskMobile, type Address, type CheckoutQuote, type DeliveryOption } from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ErrorState } from '@/components/ErrorState';
import { useAddresses } from '@/features/addresses/api';
import { useMe } from '@/features/auth/api';
import { authErrorMessage } from '@/features/auth/messages';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { track } from '@/lib/analytics';
import { ApiError } from '@/lib/api';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { cn } from '@/lib/utils';
import { formatEstimate, useCheckoutQuote, useCreateOrder } from './api';
import { OrderSummary } from './OrderSummary';

/**
 * One page, three visible sections — Address, Delivery, Review — and one primary action,
 * Continue to payment (spec FR-3). Selections live in the URL so sign-in and adding an
 * address bring the customer back to exactly this state.
 */
export function CheckoutPage() {
  const me = useMe();
  const signedIn = Boolean(me.data?.user);
  const [params, setParams] = useSearchParams();
  const addressId = Number(params.get('addressId')) || undefined;
  const delivery: DeliveryOption = isDeliveryOption(params.get('delivery')) ? (params.get('delivery') as DeliveryOption) : 'standard';
  const quote = useCheckoutQuote(addressId, delivery, signedIn);
  const create = useCreateOrder();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const started = useRef(false);

  useEffect(() => {
    const data = quote.data;
    if (!data || started.current || data.cart.lines.length === 0) return;
    started.current = true;
    track('checkout_started', { itemCount: data.totals.itemCount, subtotalPaise: data.cart.totals.subtotalPaise });
  }, [quote.data]);

  if (me.isPending) return <CheckoutSkeleton />;
  if (!signedIn) return <Navigate to={`/login?returnTo=${encodeURIComponent(`/checkout${params.size ? `?${params}` : ''}`)}`} replace />;
  if (!quote.data) return quote.isError ? <ErrorState what="checkout" onRetry={() => void quote.refetch()} /> : <CheckoutSkeleton />;

  const q = quote.data;
  if (q.blockers.includes('EMPTY_CART')) return <Navigate to="/cart" replace />;

  const select = (changes: Record<string, string>) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(changes)) next.set(key, value);
    setParams(next, { replace: true, preventScrollReset: true });
  };
  const here = `/checkout?${params}`;
  const canContinue = q.blockers.length === 0 && online && !create.isPending;

  const onContinue = () => {
    if (!q.address) return;
    create.mutate(
      { addressId: q.address.id, delivery },
      {
        onSuccess: (order) => navigate(`/checkout/pay/${order.id}`),
        onError: (e) => {
          if (e instanceof ApiError && e.code === 'CART_CHANGED') {
            navigate('/cart', { state: { authNotice: 'Some items changed while you were checking out. Please review your cart.' } });
          }
        },
      },
    );
  };

  const continueButton = (
    <Button size="lg" className="h-12 w-full" onClick={onContinue} disabled={!canContinue}>
      {create.isPending && <Loader2 className="animate-spin" aria-hidden />}
      Continue to payment
    </Button>
  );

  return (
    <div className="flex flex-col gap-6 pb-24 lg:pb-0">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Checkout</h1>
      {q.blockers.includes('CART_ISSUES') && (
        <Alert>
          <AlertTriangle aria-hidden />
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            Some items in your cart need attention before you can continue.
            <Button asChild size="sm" variant="outline">
              <Link to="/cart">Back to cart</Link>
            </Button>
          </AlertDescription>
        </Alert>
      )}
      {create.isError && !(create.error instanceof ApiError && create.error.code === 'CART_CHANGED') && (
        <Alert variant="destructive">
          <AlertDescription>{authErrorMessage(create.error)}</AlertDescription>
        </Alert>
      )}
      {!online && (
        <Alert>
          <AlertDescription>You're offline. Reconnect to continue to payment.</AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-8 lg:grid-cols-[1fr_22rem]">
        <div className="flex flex-col gap-6">
          <Section number={1} title="Delivery address">
            <AddressSection quote={q} returnTo={here} onSelect={(id) => select({ addressId: String(id) })} />
          </Section>
          <Section number={2} title="Delivery">
            <DeliverySection quote={q} onSelect={(option) => select({ delivery: option })} />
          </Section>
          <Section number={3} title="Review items" action={<Link to="/cart" className="text-sm font-medium hover:underline">Edit cart</Link>}>
            <ul className="flex flex-col divide-y">
              {q.cart.lines.map((line) => (
                <li key={line.id} className="flex items-center gap-3 py-3">
                  <ProductImage key={line.product.thumbnailUrl} src={line.product.thumbnailUrl} alt="" className="size-14 shrink-0" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="truncate font-medium">{line.product.title}</p>
                    <p className="text-muted-foreground">
                      {line.size && <>Size {line.size} · </>}Qty {line.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-medium tabular-nums">{formatPrice(line.linePricePaise)}</p>
                </li>
              ))}
            </ul>
          </Section>
        </div>

        <OrderSummary totals={q.totals} className="lg:sticky lg:top-24">
          {q.address && (
            <p className="text-xs text-muted-foreground">
              Delivering to {q.address.fullName}, {q.address.city} {q.address.pincode} ·{' '}
              {q.delivery.find((d) => d.option === delivery)?.label}
            </p>
          )}
          <div className="hidden lg:block">{continueButton}</div>
        </OrderSummary>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t bg-background/95 px-4 py-3 backdrop-blur lg:hidden">
        <p className="flex flex-col text-sm">
          <span className="text-muted-foreground">Total to pay</span>
          <span className="text-base font-semibold tabular-nums">{formatPrice(q.totals.totalPaise)}</span>
        </p>
        <div className="flex-1">{continueButton}</div>
      </div>
    </div>
  );
}

function Section({ number, title, action, children }: { number: number; title: string; action?: React.ReactNode; children: React.ReactNode }) {
  const id = `checkout-section-${number}`;
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4 rounded-xl border p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 id={id} className="flex items-center gap-3 text-lg font-semibold">
          <span className="flex size-7 items-center justify-center rounded-full bg-foreground text-sm text-background" aria-hidden>
            {number}
          </span>
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function AddressLines({ address }: { address: Address }) {
  return (
    <span className="text-sm text-muted-foreground">
      {address.line1}, {address.line2}
      {address.landmark && <>, {address.landmark}</>}, {address.city}, {address.state} {address.pincode} · {maskMobile(address.mobile)}
    </span>
  );
}

function AddressSection({ quote, returnTo, onSelect }: { quote: CheckoutQuote; returnTo: string; onSelect: (id: number) => void }) {
  const [changing, setChanging] = useState(false);
  const addresses = useAddresses(changing);
  const addLink = `/account/addresses/new?returnTo=${encodeURIComponent(returnTo)}`;

  if (!quote.address) {
    return (
      <Button asChild className="w-fit">
        <Link to={addLink}>
          <Plus aria-hidden /> Add delivery address
        </Link>
      </Button>
    );
  }

  if (!changing) {
    return (
      <div className="flex items-start justify-between gap-4">
        <p className="flex flex-col gap-0.5">
          <span className="font-medium">
            {quote.address.fullName}
            {quote.address.isDefault && <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-xs font-normal">Default</span>}
          </span>
          <AddressLines address={quote.address} />
        </p>
        <Button variant="outline" size="sm" onClick={() => setChanging(true)}>
          Change
        </Button>
      </div>
    );
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="sr-only">Choose a delivery address</legend>
      {(addresses.data ?? []).map((address) => (
        <label key={address.id} className={cn('flex cursor-pointer items-start gap-3 rounded-lg border p-3 has-[:checked]:border-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50')}>
          <input
            type="radio"
            name="address"
            className="mt-1"
            checked={address.id === quote.address?.id}
            onChange={() => {
              onSelect(address.id);
              setChanging(false);
            }}
          />
          <span className="flex flex-col gap-0.5">
            <span className="font-medium">{address.fullName}</span>
            <AddressLines address={address} />
          </span>
        </label>
      ))}
      {addresses.isPending && <Skeleton className="h-16 rounded-lg" />}
      <Button asChild variant="link" className="w-fit px-0">
        <Link to={addLink}>
          <MapPin aria-hidden /> Add a new address
        </Link>
      </Button>
    </fieldset>
  );
}

function DeliverySection({ quote, onSelect }: { quote: CheckoutQuote; onSelect: (option: DeliveryOption) => void }) {
  return (
    <fieldset className="grid gap-3 sm:grid-cols-2">
      <legend className="sr-only">Choose delivery speed</legend>
      {quote.delivery.map((option) => (
        <label
          key={option.option}
          className="flex cursor-pointer flex-col gap-1 rounded-lg border p-4 has-[:checked]:border-foreground has-[:checked]:ring-1 has-[:checked]:ring-foreground has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium">
              <input type="radio" name="delivery" value={option.option} checked={quote.selectedDelivery === option.option} onChange={() => onSelect(option.option)} />
              {option.label}
            </span>
            <span className="font-medium tabular-nums">{option.pricePaise === 0 ? 'Free' : formatPrice(option.pricePaise)}</span>
          </span>
          <span className="text-sm text-muted-foreground">Arrives {formatEstimate(option.estimate)}</span>
          {option.freeDeliveryShortfallPaise ? (
            <span className="text-xs text-emerald-700 dark:text-emerald-400">Add {formatPrice(option.freeDeliveryShortfallPaise)} more for free delivery</span>
          ) : null}
        </label>
      ))}
    </fieldset>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]" role="status" aria-label="Loading checkout">
      <div className="flex flex-col gap-6">
        <Skeleton className="h-28 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
