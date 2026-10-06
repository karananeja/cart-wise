import { expect, it, vi } from 'vitest';
import type { InventorySimulation, SimSettings } from './inventory.js';
import { createSimScheduler } from './scheduler.js';

function fakes(initial: SimSettings) {
  let settings = initial;
  let now = 0;
  const pending: { at: number; fn: () => void; id: number }[] = [];
  let nextId = 1;
  const tick = vi.fn();
  const simulation = { getSettings: () => settings, tick } as unknown as InventorySimulation;
  const timers = {
    setTimeout: (fn: () => void, ms: number) => {
      const id = nextId++;
      pending.push({ at: now + ms, fn, id });
      return id;
    },
    clearTimeout: (id: unknown) => {
      const i = pending.findIndex((p) => p.id === id);
      if (i >= 0) pending.splice(i, 1);
    },
    now: () => now,
  };
  const advance = (ms: number) => {
    now += ms;
    for (;;) {
      const due = pending.filter((p) => p.at <= now).sort((a, b) => a.at - b.at)[0];
      if (!due) break;
      pending.splice(pending.indexOf(due), 1);
      due.fn();
    }
  };
  return { simulation, timers, tick, advance, pending, set: (next: SimSettings) => (settings = next) };
}

it('has no timer while both switches are off', () => {
  const f = fakes({ autoDecrease: false, autoRestock: false, intervalSeconds: 60 });
  const scheduler = createSimScheduler(f.simulation, f.timers);
  scheduler.start();
  expect(f.pending).toHaveLength(0);
  expect(scheduler.nextTickAt()).toBeNull();
});

it('ticks at the interval with the current switches, and reschedules on change', () => {
  const f = fakes({ autoDecrease: true, autoRestock: false, intervalSeconds: 10 });
  const scheduler = createSimScheduler(f.simulation, f.timers);
  scheduler.start();
  expect(scheduler.nextTickAt()).toBe(new Date(10_000).toISOString());
  f.advance(9_999);
  expect(f.tick).not.toHaveBeenCalled();
  f.advance(1);
  expect(f.tick).toHaveBeenCalledWith({ decrease: true, restock: false });
  f.advance(10_000);
  expect(f.tick).toHaveBeenCalledTimes(2);

  f.set({ autoDecrease: true, autoRestock: true, intervalSeconds: 300 });
  scheduler.reschedule();
  expect(f.pending).toHaveLength(1);
  f.advance(299_999);
  expect(f.tick).toHaveBeenCalledTimes(2);
  f.advance(1);
  expect(f.tick).toHaveBeenLastCalledWith({ decrease: true, restock: true });

  f.set({ autoDecrease: false, autoRestock: false, intervalSeconds: 300 });
  scheduler.reschedule();
  expect(f.pending).toHaveLength(0);
  expect(scheduler.nextTickAt()).toBeNull();
});
