import { describe, expect, test } from 'vitest';
import { fromLocalInput, toLocalInput } from './post-time.js';

describe('the session time in a post form', () => {
  test('a time typed in the form becomes an ISO time with an offset or Z', () => {
    const iso = fromLocalInput('2026-11-10T16:00');
    expect(iso).toMatch(/^2026-11-1\dT\d\d:\d\d:00\.000Z$/);
    expect(new Date(iso).getTime()).toBe(new Date('2026-11-10T16:00').getTime());
  });

  test('a stored time comes back into the form as the same minute, whatever the time zone', () => {
    const iso = '2026-11-10T10:30:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(iso)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
  });
});
