import type { InventorySimulation } from './inventory.js';

interface Timers {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  now: () => number;
}

const realTimers: Timers = {
  setTimeout: (fn, ms) => {
    const handle = setTimeout(fn, ms);
    handle.unref?.();
    return handle;
  },
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: Date.now,
};

/**
 * Runs automatic inventory ticks at the chosen interval while either switch is on (F-011).
 * No timer exists while both are off. `reschedule` applies new settings immediately.
 */
export function createSimScheduler(simulation: InventorySimulation, timers: Timers = realTimers) {
  let handle: unknown;
  let nextAt: number | null = null;

  const clear = () => {
    if (handle !== undefined) timers.clearTimeout(handle);
    handle = undefined;
    nextAt = null;
  };

  const schedule = () => {
    clear();
    const settings = simulation.getSettings();
    if (!settings.autoDecrease && !settings.autoRestock) return;
    const ms = settings.intervalSeconds * 1000;
    nextAt = timers.now() + ms;
    handle = timers.setTimeout(() => {
      try {
        const current = simulation.getSettings();
        simulation.tick({ decrease: current.autoDecrease, restock: current.autoRestock });
      } catch (error) {
        console.error('Inventory simulation tick failed', error);
      }
      schedule();
    }, ms);
  };

  return {
    start: schedule,
    reschedule: schedule,
    stop: clear,
    nextTickAt: (): string | null => (nextAt === null ? null : new Date(nextAt).toISOString()),
  };
}

export type SimScheduler = ReturnType<typeof createSimScheduler>;
