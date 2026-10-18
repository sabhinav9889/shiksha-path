import type { Clock, Ids } from '../ports.js';

export function fixedClock(
  iso: string,
): Clock & { set(iso: string): void; advanceMs(ms: number): void } {
  let current = new Date(iso).getTime();
  return {
    now: () => new Date(current),
    set: (next) => {
      current = new Date(next).getTime();
    },
    advanceMs: (ms) => {
      current += ms;
    },
  };
}

/** UUID-shaped ids that count up: 00000000-0000-4000-8000-000000000001, …002, … */
export function sequentialIds(): Ids {
  let n = 0;
  return {
    uuid: () => {
      n += 1;
      return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
    },
  };
}
