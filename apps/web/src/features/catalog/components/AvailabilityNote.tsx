import type { Availability } from '@store/shared';

/** Reflects real application inventory only (INV-3). Nothing is shown for normal stock. */
export function AvailabilityNote({ availability }: { availability: Availability }) {
  if (availability.status === 'low_stock') {
    return <p className="text-sm font-medium text-amber-700 dark:text-amber-400">Only {availability.available} left</p>;
  }
  if (availability.status === 'out_of_stock') {
    return <p className="text-sm font-medium text-muted-foreground">Out of stock</p>;
  }
  return null;
}
