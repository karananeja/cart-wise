import { useEffect, useId, useRef, useState } from 'react';
import { ChevronDown, Loader2, Minus, Play, Plus, Search } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { cn } from 'cn';
import {
  MAX_ON_HAND,
  SIM_INTERVALS,
  type InventoryChange,
  type InventoryFilter,
  type SimInventoryProduct,
  type SimInventoryUnit,
  type SimIntervalSeconds,
} from '@store/shared';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { ErrorState } from '@/components/ErrorState';
import { ProductImage } from '@/features/catalog/components/ProductImage';
import { formatDateTime } from '@/features/orders/format';
import { ApiError } from '@/lib/api';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { useOnlineStatus } from '@/lib/useOnlineStatus';
import { simInventoryKey, simSessionKey, useRunAutomation, useSaveAutomation, useSetOnHand, useSimAutomation, useSimInventory } from './api';

const FILTERS: { value: InventoryFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'low', label: 'Low stock' },
  { value: 'sold_out', label: 'Sold out' },
];

const STATUS_LABELS: Record<SimInventoryUnit['status'], string> = {
  in_stock: 'In stock',
  low_stock: 'Low stock',
  out_of_stock: 'Sold out',
};

const SOURCE_LABELS: Record<InventoryChange['source'], string> = {
  manual: 'Manual',
  auto_decrease: 'Auto decrease',
  auto_restock: 'Auto restock',
};

const INTERVAL_OPTION_LABELS: Record<SimIntervalSeconds, string> = { 10: '10 seconds', 30: '30 seconds', 60: '60 seconds', 300: '5 minutes' };

/** Inventory tab of the Simulation Console (F-011): real stock, by hand or automatically. */
export function SimInventoryPage() {
  return (
    <div className="flex flex-col gap-6">
      <SimulationPanel />
      <InventoryList />
    </div>
  );
}

// ── Automation ────────────────────────────────────────────────────────────────────────────

function useSecondsUntil(at: string | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!at) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [at]);
  return at ? Math.max(0, Math.round((Date.parse(at) - now) / 1000)) : null;
}

function SimulationPanel() {
  const automation = useSimAutomation();
  const save = useSaveAutomation();
  const run = useRunAutomation();
  const online = useOnlineStatus();
  const queryClient = useQueryClient();
  const data = automation.data;
  const seconds = useSecondsUntil(data?.nextTickAt ?? null);
  const latest = data?.log[0]?.id;

  // Automatic changes show up in the stock list too.
  useEffect(() => {
    if (latest !== undefined) void queryClient.invalidateQueries({ queryKey: simInventoryKey });
  }, [latest, queryClient]);

  if (automation.isPending) return <Skeleton className="h-48 rounded-xl" />;
  if (automation.isError || !data) return <ErrorState what="the simulation settings" onRetry={() => void automation.refetch()} />;

  const update = (patch: Partial<{ autoDecrease: boolean; autoRestock: boolean; intervalSeconds: SimIntervalSeconds }>) =>
    save.mutate({ autoDecrease: data.autoDecrease, autoRestock: data.autoRestock, intervalSeconds: data.intervalSeconds, ...patch });
  const anyOn = data.autoDecrease || data.autoRestock;
  const busy = save.isPending || !online;

  return (
    <section aria-labelledby="sim-panel" className="flex flex-col gap-4 rounded-xl border p-4 text-sm sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="sim-panel" className="text-lg font-semibold">
          Simulation
        </h2>
        <p className="text-muted-foreground" aria-live="polite">
          {anyOn && seconds !== null ? `Next tick in ${seconds}s` : 'Automation is off'}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <SwitchField label="Automatic decrease" hint="1–3 random available units lose 1" checked={data.autoDecrease} disabled={busy} onChange={(v) => update({ autoDecrease: v })} />
        <SwitchField label="Automatic restock" hint="Low or sold-out items refill" checked={data.autoRestock} disabled={busy} onChange={(v) => update({ autoRestock: v })} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="sim-interval">Interval</Label>
          <select
            id="sim-interval"
            className="h-9 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            value={data.intervalSeconds}
            disabled={busy}
            onChange={(e) => update({ intervalSeconds: Number(e.target.value) as SimIntervalSeconds })}
          >
            {SIM_INTERVALS.map((s) => (
              <option key={s} value={s}>
                {INTERVAL_OPTION_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button size="sm" variant="outline" disabled={!anyOn || run.isPending || !online} aria-describedby={anyOn ? undefined : 'sim-run-hint'} onClick={() => run.mutate()}>
          {run.isPending ? <Loader2 className="animate-spin" aria-hidden /> : <Play aria-hidden />}
          Run once now
        </Button>
        {!anyOn && (
          <span id="sim-run-hint" className="text-xs text-muted-foreground">
            Turn on decrease or restock first
          </span>
        )}
      </div>
      {(save.isError || run.isError) && (
        <Alert variant="destructive">
          <AlertDescription>Something went wrong. Please try again.</AlertDescription>
        </Alert>
      )}
      <ChangeLog changes={data.log} />
    </section>
  );
}

function SwitchField({ label, hint, checked, disabled, onChange }: { label: string; hint: string; checked: boolean; disabled: boolean; onChange: (value: boolean) => void }) {
  const id = useId();
  return (
    <div className="flex items-start gap-3">
      <Switch id={id} checked={checked} disabled={disabled} onCheckedChange={onChange} aria-describedby={`${id}-hint`} className="mt-0.5" />
      <div className="flex flex-col">
        <Label htmlFor={id}>{label}</Label>
        <span id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </span>
      </div>
    </div>
  );
}

function ChangeLog({ changes }: { changes: InventoryChange[] }) {
  return (
    <div className="flex flex-col gap-2 border-t pt-3">
      <h3 id="sim-log" className="font-medium">
        Recent changes
      </h3>
      {changes.length === 0 ? (
        <p className="text-muted-foreground">No changes yet</p>
      ) : (
        <ul aria-labelledby="sim-log" className="flex flex-col gap-1">
          {changes.map((c) => (
            <li key={c.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
              <span className="text-foreground">
                {c.title}
                {c.size && ` (${c.size})`}
              </span>
              <span className="tabular-nums">
                {c.fromOnHand} → {c.toOnHand}
              </span>
              <span>· {SOURCE_LABELS[c.source]}</span>
              <span>· {formatDateTime(c.at)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Stock list ────────────────────────────────────────────────────────────────────────────

function InventoryList() {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<InventoryFilter>('all');
  const q = useDebouncedValue(query.trim(), 250);
  const inventory = useSimInventory(q, filter);
  const queryClient = useQueryClient();
  const expired = inventory.error instanceof ApiError && inventory.error.code === 'OPERATOR_REQUIRED';
  const products = inventory.data?.pages.flatMap((p) => p.products) ?? [];

  useEffect(() => {
    if (expired) queryClient.setQueryData(simSessionKey, { signedIn: false });
  }, [expired, queryClient]);

  return (
    <section aria-labelledby="sim-stock" className="flex flex-col gap-4">
      <h2 id="sim-stock" className="text-lg font-semibold">
        Stock
      </h2>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex flex-1 flex-col gap-1.5">
          <Label htmlFor="sim-search">Search products</Label>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input id="sim-search" type="search" className="h-9 pl-8" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
        </div>
        <fieldset className="flex flex-wrap gap-1">
          <legend className="sr-only">Show</legend>
          {FILTERS.map((f) => (
            <label
              key={f.value}
              className="cursor-pointer rounded-lg border px-3 py-1.5 text-sm has-[:checked]:border-foreground has-[:checked]:bg-muted has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50"
            >
              <input type="radio" name="sim-filter" className="sr-only" value={f.value} checked={filter === f.value} onChange={() => setFilter(f.value)} />
              {f.label}
            </label>
          ))}
        </fieldset>
      </div>

      {inventory.isPending ? (
        <div className="flex flex-col gap-3" aria-label="Loading stock">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : inventory.isError && !expired ? (
        <ErrorState what="stock" onRetry={() => void inventory.refetch()} />
      ) : products.length === 0 ? (
        <p className="text-sm text-muted-foreground">No products match</p>
      ) : (
        <>
          <ul className={cn('flex flex-col gap-3', inventory.isPlaceholderData && 'opacity-60')}>
            {products.map((p) => (
              <li key={p.productId}>
                <ProductRow product={p} />
              </li>
            ))}
          </ul>
          {inventory.hasNextPage && (
            <Button variant="outline" className="w-fit self-center" disabled={inventory.isFetchingNextPage} onClick={() => void inventory.fetchNextPage()}>
              {inventory.isFetchingNextPage && <Loader2 className="animate-spin" aria-hidden />}
              Show more
            </Button>
          )}
        </>
      )}
    </section>
  );
}

function Counts({ unit, className }: { unit: Pick<SimInventoryUnit, 'onHand' | 'held' | 'available' | 'status'>; className?: string }) {
  return (
    <dl className={cn('grid grid-cols-4 gap-2 text-xs sm:text-sm', className)}>
      {(
        [
          ['On hand', unit.onHand],
          ['Held', unit.held],
          ['Available', unit.available],
        ] as const
      ).map(([label, value]) => (
        <div key={label} className="flex flex-col">
          <dt className="text-muted-foreground">{label}</dt>
          <dd className="font-medium tabular-nums">{value}</dd>
        </div>
      ))}
      <div className="flex flex-col">
        <dt className="text-muted-foreground">Status</dt>
        <dd
          className={cn(
            'font-medium',
            unit.status === 'out_of_stock' && 'text-destructive',
            unit.status === 'low_stock' && 'text-amber-700 dark:text-amber-400',
          )}
        >
          {STATUS_LABELS[unit.status]}
        </dd>
      </div>
    </dl>
  );
}

function ProductRow({ product }: { product: SimInventoryProduct }) {
  const [open, setOpen] = useState(false);
  const sized = product.units.some((u) => u.size !== null);
  // Sizes for clothing and shoes, options for phones, tablets and laptops (F-013 FR-14).
  const options = product.units.some((u) => u.kind === 'option');
  const titleId = useId();

  return (
    <article aria-labelledby={titleId} className="flex flex-col gap-3 rounded-xl border p-3 text-sm sm:p-4">
      <div className="flex items-start gap-3">
        <ProductImage src={product.thumbnailUrl} alt="" className="size-12 shrink-0" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 id={titleId} className="font-medium break-words">
            {product.title}
          </h3>
          <p className="text-xs text-muted-foreground">{product.categoryName}</p>
        </div>
      </div>
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <Counts unit={product} className="md:flex-1" />
        {!sized && <StockStepper product={product} unit={product.units[0]!} />}
      </div>
      {sized && (
        <>
          <Button variant="ghost" size="sm" className="w-fit" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
            <ChevronDown className={cn('transition-transform', open && 'rotate-180')} aria-hidden />
            {open ? `Hide ${options ? 'options' : 'sizes'}` : `Show ${options ? 'options' : 'sizes'}`}
          </Button>
          {open && (
            <ul className="flex flex-col divide-y rounded-lg border">
              {product.units.map((unit) => (
                <li key={unit.variantId} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-col gap-1 md:flex-1">
                    <span className="font-medium">{unit.kind === 'option' ? `Option ${unit.size}` : `Size ${unit.size}`}</span>
                    <Counts unit={unit} />
                  </div>
                  <StockStepper product={product} unit={unit} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </article>
  );
}

function StockStepper({ product, unit }: { product: SimInventoryProduct; unit: SimInventoryUnit }) {
  const setOnHand = useSetOnHand();
  const online = useOnlineStatus();
  const [draft, setDraft] = useState(String(unit.onHand));
  const [error, setError] = useState<string>();
  const inputId = useId();
  const editing = useRef(false);
  const name = `${product.title}${unit.size ? ` ${unit.kind === 'option' ? 'option' : 'size'} ${unit.size}` : ''}`;

  // Follow server values (other changes, automation) unless the operator is typing.
  useEffect(() => {
    if (!editing.current) setDraft(String(unit.onHand));
  }, [unit.onHand]);

  const commit = (value: number) => {
    setError(undefined);
    if (!Number.isInteger(value) || value < 0 || value > MAX_ON_HAND) {
      setError(`Enter a whole number from 0 to ${MAX_ON_HAND}`);
      setDraft(String(unit.onHand));
      return;
    }
    if (value === unit.onHand) return;
    setDraft(String(value));
    setOnHand.mutate(
      { productId: unit.productId, variantId: unit.variantId, onHand: value },
      {
        onError: (e) => {
          setDraft(String(unit.onHand));
          if (e instanceof ApiError && e.code === 'BELOW_HELD') {
            const held = Number(e.details?.held ?? unit.held);
            setError(`${held} ${held === 1 ? 'unit is' : 'units are'} held in checkout — on hand can't go lower`);
          } else setError('Something went wrong. Please try again.');
        },
      },
    );
  };

  const disabled = !online || setOnHand.isPending;
  const atHeld = unit.onHand <= unit.held;

  return (
    <div className="flex flex-col gap-1 md:items-end">
      <div className="flex items-center gap-1">
        <Button variant="outline" size="icon" className="size-9" aria-label={`Decrease stock for ${name}`} disabled={disabled || atHeld || unit.onHand <= 0} onClick={() => commit(unit.onHand - 1)}>
          <Minus aria-hidden />
        </Button>
        <label htmlFor={inputId} className="sr-only">
          On hand for {name}
        </label>
        <Input
          id={inputId}
          inputMode="numeric"
          className="h-9 w-20 text-center tabular-nums"
          value={draft}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          onFocus={() => {
            editing.current = true;
          }}
          onChange={(e) => setDraft(e.target.value.replace(/\D/g, '').slice(0, 3))}
          onBlur={() => {
            editing.current = false;
            commit(draft === '' ? Number.NaN : Number(draft));
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <Button variant="outline" size="icon" className="size-9" aria-label={`Increase stock for ${name}`} disabled={disabled || unit.onHand >= MAX_ON_HAND} onClick={() => commit(unit.onHand + 1)}>
          <Plus aria-hidden />
        </Button>
        {setOnHand.isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
      </div>
      {unit.held > 0 && <p className="text-xs text-muted-foreground">{unit.held} held in checkout</p>}
      {error && (
        <p id={`${inputId}-error`} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
