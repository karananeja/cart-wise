import { useEffect, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';

export interface MapViewProps {
  position: { latitude: number; longitude: number } | null;
  /** Map tap or pin drag. Omitted for a read-only preview. */
  onPick?: (latitude: number, longitude: number) => void;
  onTilesFailed?: () => void;
  height: number;
}

const INDIA_CENTRE: [number, number] = [22.5, 79];

/** A drawn pin (no image files), so it works with any bundler setup. */
const pin = L.divIcon({
  className: '',
  html: '<svg width="32" height="42" viewBox="0 0 32 42" aria-hidden="true"><path d="M16 41s14-15.6 14-25A14 14 0 0 0 2 16c0 9.4 14 25 14 25z" fill="#111" stroke="#fff" stroke-width="2"/><circle cx="16" cy="16" r="5" fill="#fff"/></svg>',
  iconSize: [32, 42],
  iconAnchor: [16, 41],
});

function Recenter({ position }: { position: MapViewProps['position'] }) {
  const map = useMap();
  useEffect(() => {
    if (position) map.setView([position.latitude, position.longitude], Math.max(map.getZoom(), 16));
  }, [map, position]);
  return null;
}

function TapToPick({ onPick }: { onPick: (latitude: number, longitude: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

/** OpenStreetMap via Leaflet (ADR-004). Loaded lazily, only on the address screens. */
export default function MapView({ position, onPick, onTilesFailed, height }: MapViewProps) {
  const center: [number, number] = position ? [position.latitude, position.longitude] : INDIA_CENTRE;
  const interactive = Boolean(onPick);
  const handlers = useMemo(
    () => ({
      dragend: (event: L.DragEndEvent) => {
        const { lat, lng } = (event.target as L.Marker).getLatLng();
        onPick?.(lat, lng);
      },
    }),
    [onPick],
  );

  return (
    <MapContainer
      center={center}
      zoom={position ? 16 : 4}
      style={{ height }}
      className="z-0 w-full rounded-xl"
      scrollWheelZoom={interactive}
      dragging={interactive}
      zoomControl={interactive}
      doubleClickZoom={interactive}
      touchZoom={interactive}
      keyboard={interactive}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
        eventHandlers={{ tileerror: () => onTilesFailed?.() }}
      />
      <Recenter position={position} />
      {onPick && <TapToPick onPick={onPick} />}
      {position && (
        <Marker position={[position.latitude, position.longitude]} icon={pin} draggable={interactive} eventHandlers={handlers} title="Delivery location" alt="Delivery location" />
      )}
    </MapContainer>
  );
}
