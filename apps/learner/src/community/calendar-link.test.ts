import { describe, expect, test } from 'vitest';
import { calendarLink } from './calendar-link.js';

describe('the Add to calendar link', () => {
  const link = calendarLink({
    title: 'Mock interview & tips',
    startsAt: '2026-11-10T10:30:00.000Z',
    minutes: 45,
    joinLink: 'https://meet.google.com/abc-defg-hij',
  });
  const url = new URL(link);

  test('is a Google Calendar template with the start and end in UTC', () => {
    expect(url.origin + url.pathname).toBe('https://calendar.google.com/calendar/render');
    expect(url.searchParams.get('action')).toBe('TEMPLATE');
    expect(url.searchParams.get('dates')).toBe('20261110T103000Z/20261110T111500Z');
  });

  test('carries the title and the join link as text, safely encoded', () => {
    expect(url.searchParams.get('text')).toBe('Mock interview & tips');
    expect(url.searchParams.get('details')).toBe('https://meet.google.com/abc-defg-hij');
    expect(link).not.toContain(' ');
  });

  test('has no details when the session has no link', () => {
    const plain = new URL(
      calendarLink({
        title: 'T',
        startsAt: '2026-11-10T10:30:00.000Z',
        minutes: 15,
        joinLink: null,
      }),
    );
    expect(plain.searchParams.has('details')).toBe(false);
  });
});
