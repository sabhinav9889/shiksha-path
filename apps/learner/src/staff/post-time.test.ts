import { describe, expect, test } from 'vitest';
import { fromLocalInput, toLocalInput } from './post-time.js';

describe('the session time in a post form', () => {
  test('a time typed in the form is India time, whatever the browser clock says', () => {
    expect(fromLocalInput('2026-11-10T16:00')).toBe('2026-11-10T10:30:00.000Z');
    expect(toLocalInput('2026-11-10T10:30:00.000Z')).toBe('2026-11-10T16:00');
  });

  test('a stored time comes back into the form as the same minute, whatever the time zone', () => {
    const iso = '2026-11-10T10:30:00.000Z';
    expect(fromLocalInput(toLocalInput(iso))).toBe(iso);
    expect(toLocalInput(iso)).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d$/);
  });
});
