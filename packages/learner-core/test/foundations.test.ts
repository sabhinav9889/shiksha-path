import { describe, expect, test } from 'vitest';
import { CoreError, ERROR_CODES } from '../src/errors.js';
import { languageView, pickText } from '../src/language.js';
import { cryptoIds, systemClock } from '../src/ports.js';
import { fixedClock, sequentialIds } from '../src/testing/index.js';
import { addDays, daysBetween, istDay } from '../src/time.js';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('istDay', () => {
  test.each([
    ['2026-10-18T18:29:59Z', '2026-10-18'],
    ['2026-10-18T18:30:00Z', '2026-10-19'],
    ['2026-12-31T20:00:00Z', '2027-01-01'],
  ])('%s is %s in India', (iso, day) => {
    expect(istDay(new Date(iso))).toBe(day);
    expect(istDay(iso)).toBe(day);
  });
});

describe('day arithmetic', () => {
  test('addDays crosses month ends and leap days', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  test('daysBetween is signed', () => {
    expect(daysBetween('2026-10-18', '2026-10-21')).toBe(3);
    expect(daysBetween('2026-10-21', '2026-10-18')).toBe(-3);
  });
});

describe('languageView', () => {
  test('Hindi is primary only above 0.5, with English on the toggle', () => {
    expect(languageView(0.8, 'hi_en')).toEqual({ primary: 'hi', toggle: 'en' });
    expect(languageView(0.5, 'hi_en')).toEqual({ primary: 'en', toggle: 'hi' });
    expect(languageView(0.2, 'hi_en')).toEqual({ primary: 'en', toggle: 'hi' });
  });

  test('English-only has no toggle', () => {
    expect(languageView(0.8, 'en_only')).toEqual({ primary: 'en', toggle: null });
  });

  test('pickText returns the requested language', () => {
    expect(pickText({ hi: 'नमस्ते', en: 'Hello' }, 'hi')).toBe('नमस्ते');
    expect(pickText({ hi: 'नमस्ते', en: 'Hello' }, 'en')).toBe('Hello');
  });
});

describe('CoreError', () => {
  test('is an Error that keeps its code and details', () => {
    const error = new CoreError('LOW_STORAGE', 'no room', { needed: 5 });
    expect(error).toBeInstanceOf(Error);
    expect([error.name, error.code, error.message]).toEqual([
      'CoreError',
      'LOW_STORAGE',
      'no room',
    ]);
    expect(error.details).toEqual({ needed: 5 });
  });

  test('lists exactly the agreed codes', () => {
    expect([...ERROR_CODES]).toEqual([
      'LOW_STORAGE',
      'DOWNLOAD_FAILED',
      'BUNDLE_CORRUPT',
      'BUNDLE_TOO_LARGE',
      'MANIFEST_UNAVAILABLE',
      'MODULE_NOT_READY',
      'PIN_INVALID',
      'PIN_WRONG',
      'PIN_LOCKED',
      'NAME_INVALID',
      'PROFILE_NOT_FOUND',
    ]);
  });
});

describe('ports and fakes', () => {
  test('cryptoIds gives distinct UUID v4 values', () => {
    const [a, b] = [cryptoIds.uuid(), cryptoIds.uuid()];
    expect(a).toMatch(UUID_V4);
    expect(a).not.toBe(b);
  });

  test('systemClock returns a Date', () => {
    expect(systemClock.now()).toBeInstanceOf(Date);
  });

  test('fixedClock can be set and advanced', () => {
    const clock = fixedClock('2026-10-18T10:00:00Z');
    expect(clock.now().toISOString()).toBe('2026-10-18T10:00:00.000Z');
    clock.advanceMs(1500);
    expect(clock.now().toISOString()).toBe('2026-10-18T10:00:01.500Z');
    clock.set('2027-01-01T00:00:00Z');
    expect(clock.now().toISOString()).toBe('2027-01-01T00:00:00.000Z');
  });

  test('sequentialIds are unique and UUID-shaped', () => {
    const ids = sequentialIds();
    const first = ids.uuid();
    expect(first).toBe('00000000-0000-4000-8000-000000000001');
    expect(first).toMatch(UUID_V4);
    expect(ids.uuid()).toBe('00000000-0000-4000-8000-000000000002');
  });
});
