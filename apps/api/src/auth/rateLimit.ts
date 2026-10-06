/**
 * Failed password sign-ins per identifier: 5 in 15 minutes, then locked until the window
 * passes. In memory (ADR-003): resets when the API restarts, which is fine for a local MVP.
 */
export function createLoginLimiter(options = { maxFailures: 5, windowMs: 15 * 60 * 1000 }, clock: () => number = Date.now) {
  const failures = new Map<string, number[]>();

  const recent = (key: string) => (failures.get(key) ?? []).filter((t) => clock() - t < options.windowMs);

  return {
    /** Seconds until the identifier may try again, or 0 when allowed. */
    retryAfterSeconds(key: string): number {
      const times = recent(key);
      if (times.length < options.maxFailures) return 0;
      return Math.ceil((times[0]! + options.windowMs - clock()) / 1000);
    },
    fail(key: string) {
      failures.set(key, [...recent(key), clock()]);
    },
    reset(key: string) {
      failures.delete(key);
    },
  };
}

export type LoginLimiter = ReturnType<typeof createLoginLimiter>;
