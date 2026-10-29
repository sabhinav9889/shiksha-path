import { describe, expect, test } from 'vitest';
import { countdown, safeLink, sessionState, sessionWhen } from './session-time.js';

const start = '2026-11-10T10:30:00.000Z'; // 16:00 in India

describe('a session time', () => {
  test('is shown on India time, the same for everyone', () => {
    expect(sessionWhen(start, 'en')).toMatch(/10 Nov 2026/);
    expect(sessionWhen(start, 'en')).toMatch(/4:00/);
  });

  test('is upcoming, live or over by the clock and its length', () => {
    const at = (iso: string): Date => new Date(iso);
    expect(sessionState(start, 60, at('2026-11-10T10:29:59.000Z'))).toBe('upcoming');
    expect(sessionState(start, 60, at('2026-11-10T10:30:00.000Z'))).toBe('live');
    expect(sessionState(start, 60, at('2026-11-10T11:29:59.000Z'))).toBe('live');
    expect(sessionState(start, 60, at('2026-11-10T11:30:00.000Z'))).toBe('over');
  });

  test('only an https link is a link', () => {
    expect(safeLink('https://meet.google.com/abc')).toBe('https://meet.google.com/abc');
    for (const bad of ['javascript:alert(1)', 'http://x.org', 'data:text/html,x', 'x', '', null]) {
      expect(safeLink(bad)).toBeNull();
    }
  });

  test('counts down in days, then hours and minutes, then says on now or over', () => {
    const at = (iso: string): Date => new Date(iso);
    const start = '2026-11-10T10:30:00.000Z';
    expect(countdown(start, 60, at('2026-11-07T10:30:00.000Z'), 'hi')).toBe('3 दिन बाद');
    expect(countdown(start, 60, at('2026-11-09T10:30:00.000Z'), 'en')).toBe('in 1 day');
    expect(countdown(start, 60, at('2026-11-10T07:15:00.000Z'), 'hi')).toBe('3 घंटे 15 मिनट में');
    expect(countdown(start, 60, at('2026-11-10T07:15:00.000Z'), 'en')).toBe('in 3 h 15 min');
    expect(countdown(start, 60, at('2026-11-10T10:29:30.000Z'), 'en')).toBe('in 0 h 1 min');
    expect(countdown(start, 60, at('2026-11-10T11:00:00.000Z'), 'hi')).toBe('अभी चल रहा है');
    expect(countdown(start, 60, at('2026-11-10T11:30:00.000Z'), 'en')).toBe('Over');
  });
});
