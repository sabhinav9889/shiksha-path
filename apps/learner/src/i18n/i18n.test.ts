import { ERROR_CODES } from '@shiksha/learner-core';
import { describe, expect, test } from 'vitest';
import { STRINGS, errorMessage, t, uiLang, type StringKey } from './index.js';

describe('the strings catalogue', () => {
  test('every string has non-empty Hindi and English, composed (NFC)', () => {
    const entries = Object.entries(STRINGS) as [StringKey, { hi: string; en: string }][];
    expect(entries.length).toBeGreaterThan(0);
    for (const [key, text] of entries) {
      expect(text.hi.trim(), `${key} hi`).not.toBe('');
      expect(text.en.trim(), `${key} en`).not.toBe('');
      expect(text.hi, `${key} NFC`).toBe(text.hi.normalize('NFC'));
    }
  });

  test('the app name is the same Devanagari text the manifest will use', () => {
    expect(t('app.name', 'hi')).toBe('शिक्षा पथ');
    expect(t('app.name', 'en')).toBe('Shiksha Path');
  });
});

describe('t', () => {
  test('fills named placeholders and leaves unknown ones as written', () => {
    expect(t('status.saved', 'en', { minutes: 10 })).toContain('10');
    expect(t('status.saved', 'hi')).toContain('{minutes}');
  });
});

describe('errorMessage', () => {
  test.each(ERROR_CODES.map((code) => [code]))('%s has a Hindi and an English message', (code) => {
    expect(errorMessage(code, 'hi').trim()).not.toBe('');
    expect(errorMessage(code, 'en').trim()).not.toBe('');
  });

  test('messages carry no technical code', () => {
    for (const code of ERROR_CODES) {
      expect(errorMessage(code, 'hi')).not.toContain(code);
      expect(errorMessage(code, 'en')).not.toContain(code);
    }
  });

  test('fills the details that the lock and wrong-PIN messages use', () => {
    expect(errorMessage('PIN_LOCKED', 'hi', { retryAfterSec: 30 })).toContain('30');
    expect(errorMessage('PIN_WRONG', 'en', { attemptsLeft: 4 })).toContain('4');
  });
});

describe('uiLang', () => {
  test('English-only learners get an English interface, everyone else Hindi', () => {
    expect(uiLang('en_only')).toBe('en');
    expect(uiLang('hi_en')).toBe('hi');
  });
});
