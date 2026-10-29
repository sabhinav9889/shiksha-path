import { describe, expect, test } from 'vitest';
import { safeLink, sessionState, sessionWhen } from './session-time.js';

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
});
