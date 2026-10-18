const IST_OFFSET_MS = 19_800_000; // UTC+05:30
const MS_PER_DAY = 86_400_000;
const DAY_LENGTH = 10; // "YYYY-MM-DD"

/** The calendar day (YYYY-MM-DD) in India time for an instant. */
export function istDay(at: Date | string): string {
  const ms = (typeof at === 'string' ? new Date(at) : at).getTime();
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, DAY_LENGTH);
}

const dayMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);

export function addDays(day: string, n: number): string {
  return new Date(dayMs(day) + n * MS_PER_DAY).toISOString().slice(0, DAY_LENGTH);
}

/** Signed whole days from `from` to `to`. */
export function daysBetween(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / MS_PER_DAY);
}
