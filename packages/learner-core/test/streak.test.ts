import { describe, expect, test } from 'vitest';
import { streak } from '../src/streak.js';

const days = (...d: string[]): ReadonlySet<string> => new Set(d);
const run = days('2026-10-16', '2026-10-17', '2026-10-18');

describe('streak', () => {
  test('counts consecutive active days ending today', () => {
    expect(streak(run, '2026-10-18')).toEqual({ current: 3, activeToday: true });
  });

  test('stays alive until the end of the next day', () => {
    expect(streak(run, '2026-10-19')).toEqual({ current: 3, activeToday: false });
  });

  test('is gone after a missed day', () => {
    expect(streak(run, '2026-10-20')).toEqual({ current: 0, activeToday: false });
  });

  test('a gap resets the count', () => {
    const gap = days('2026-10-14', '2026-10-16', '2026-10-17');
    expect(streak(gap, '2026-10-17').current).toBe(2);
  });

  test('a future-dated active day is ignored', () => {
    expect(streak(days('2026-10-25'), '2026-10-18')).toEqual({ current: 0, activeToday: false });
    expect(streak(days('2026-10-18', '2026-10-25'), '2026-10-18').current).toBe(1);
  });

  test('no days, no streak', () => {
    expect(streak(days(), '2026-10-18')).toEqual({ current: 0, activeToday: false });
  });
});
