import { Component, lazy, Suspense, type ReactNode } from 'react';
import { MapPinOff } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import type { MapViewProps } from './MapView';

const MapView = lazy(() => import('./MapView'));

/** If the map code itself fails to load, show a plain message; the form still works. */
class MapBoundary extends Component<{ fallback: ReactNode; onError?: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError?.();
  }
  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

export function MapUnavailable({ height }: { height: number }) {
  return (
    <div style={{ height }} className="flex w-full flex-col items-center justify-center gap-2 rounded-xl bg-muted text-sm text-muted-foreground">
      <MapPinOff className="size-6" aria-hidden />
      The map isn't available right now
    </div>
  );
}

export function LazyMap(props: MapViewProps) {
  return (
    <MapBoundary fallback={<MapUnavailable height={props.height} />} onError={props.onTilesFailed}>
      <Suspense fallback={<Skeleton style={{ height: props.height }} className="w-full rounded-xl" />}>
        <MapView {...props} />
      </Suspense>
    </MapBoundary>
  );
}
