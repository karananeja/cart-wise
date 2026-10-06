import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, LocateFixed, MapPin, Search } from 'lucide-react';
import type { GeoPlace } from '@store/shared';
import { Button } from '@/components/ui/button';
import { useDebouncedValue } from '@/lib/useDebouncedValue';
import { reversePlace, searchPlaces } from './api';
import { LazyMap } from './LazyMap';

export interface PickedLocation {
  latitude: number;
  longitude: number;
  place: GeoPlace | null;
}

interface LocationPickerProps {
  initial?: { latitude: number; longitude: number } | null;
  onConfirm: (location: PickedLocation) => void;
  onManual: () => void;
}

const MAP_HEIGHT = 320;

/**
 * Step 1 of adding an address (spec FR-6): search, use current location, or tap/drag on the
 * map; the resolved address shows underneath. Everything here is optional — manual entry is
 * always one tap away, and the picker says so when the map or search can't help.
 */
export function LocationPicker({ initial, onConfirm, onManual }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const debounced = useDebouncedValue(query.trim(), 400);
  const [results, setResults] = useState<GeoPlace[]>();
  const [searching, setSearching] = useState(false);
  const [position, setPosition] = useState(initial ?? null);
  const [place, setPlace] = useState<GeoPlace | null>(null);
  const [resolving, setResolving] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [mapFailed, setMapFailed] = useState(false);
  const reverseRequest = useRef<AbortController | undefined>(undefined);

  useEffect(() => {
    if (debounced.length < 3) {
      setResults(undefined);
      return;
    }
    const controller = new AbortController();
    setSearching(true);
    searchPlaces(debounced, controller.signal)
      .then((places) => {
        setResults(places);
        setProblem(undefined);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') setProblem("Location search isn't available right now. You can tap the map or enter the address manually.");
      })
      .finally(() => setSearching(false));
    return () => controller.abort();
  }, [debounced]);

  const resolve = useCallback((latitude: number, longitude: number) => {
    setPosition({ latitude, longitude });
    reverseRequest.current?.abort();
    const controller = new AbortController();
    reverseRequest.current = controller;
    setResolving(true);
    reversePlace(latitude, longitude, controller.signal)
      .then((found) => {
        setPlace(found);
        setProblem(undefined);
      })
      .catch((e: Error) => {
        if (e.name !== 'AbortError') {
          setPlace(null);
          setProblem("We couldn't look up this spot. You can still confirm it and fill in the details.");
        }
      })
      .finally(() => {
        if (reverseRequest.current === controller) setResolving(false);
      });
  }, []);

  const choose = (result: GeoPlace) => {
    reverseRequest.current?.abort();
    setPosition({ latitude: result.latitude, longitude: result.longitude });
    setPlace(result);
    setResults(undefined);
    setQuery(result.label);
  };

  const useCurrentLocation = () => {
    if (!('geolocation' in navigator)) {
      setProblem("This browser can't share your location. Search or tap the map instead.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos.coords.latitude, pos.coords.longitude),
      () => setProblem('Location access is off — search or tap the map instead.'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="location-search" className="text-sm font-medium">
          Search for your area, street or landmark
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            id="location-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Indiranagar, Bengaluru"
            className="h-10 w-full rounded-lg border border-input bg-background pr-9 pl-9 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
          />
          {searching && <Loader2 className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground" aria-hidden />}
        </div>
        {results && (
          <ul aria-label="Matching places" className="flex flex-col divide-y rounded-lg border">
            {results.length === 0 ? (
              <li className="px-3 py-2 text-sm text-muted-foreground">No places found — try a nearby area or enter the address manually.</li>
            ) : (
              results.map((result) => (
                <li key={`${result.latitude},${result.longitude}`}>
                  <button type="button" onClick={() => choose(result)} className="flex w-full items-start gap-2 px-3 py-2 text-left text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none">
                    <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                    <span>
                      {result.label}
                      {result.pincode && <span className="text-muted-foreground"> · {result.pincode}</span>}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        )}
        <Button type="button" variant="outline" className="w-fit" onClick={useCurrentLocation}>
          <LocateFixed aria-hidden /> Use my current location
        </Button>
      </div>

      <section aria-label="Map — tap to place the pin, or drag it">
        <LazyMap position={position} onPick={resolve} onTilesFailed={() => setMapFailed(true)} height={MAP_HEIGHT} />
      </section>

      <div aria-live="polite" className="flex min-h-10 flex-col gap-1 text-sm">
        {resolving ? (
          <p className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden /> Finding the address…
          </p>
        ) : place ? (
          <p>
            <span className="text-muted-foreground">Near:</span> <span className="font-medium">{[place.label, place.pincode].filter(Boolean).join(' ')}</span>
          </p>
        ) : position ? (
          <p className="text-muted-foreground">Pin placed.</p>
        ) : (
          <p className="text-muted-foreground">Search, use your location, or tap the map to place the pin.</p>
        )}
        {(problem || mapFailed) && <p className="text-amber-800 dark:text-amber-300">{problem ?? "The map isn't available right now. Search still works, or enter the address manually."}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" size="lg" className="h-11" disabled={!position || resolving} onClick={() => position && onConfirm({ ...position, place })}>
          Confirm location
        </Button>
        <Button type="button" variant="link" className="px-0" onClick={onManual}>
          Enter address manually instead
        </Button>
      </div>
    </div>
  );
}
