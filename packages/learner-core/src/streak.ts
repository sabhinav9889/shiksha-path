import { addDays } from './time.js';

/**
 * Consecutive active days ending today. If today has no activity yet the streak is still alive
 * through yesterday, so a learner is never told they lost it before the day is over. Days after
 * `today` (a wrong phone clock) are ignored.
 */
export function streak(
  activeDays: ReadonlySet<string>,
  today: string,
): { current: number; activeToday: boolean } {
  const activeToday = activeDays.has(today);
  let day = activeToday ? today : addDays(today, -1);
  let current = 0;
  while (activeDays.has(day)) {
    current += 1;
    day = addDays(day, -1);
  }
  return { current, activeToday };
}
