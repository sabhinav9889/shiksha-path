import { describe, expect, test } from 'vitest';
import {
  branding,
  brandingInput,
  contrastRatio,
  DEFAULT_BRANDING,
  MIN_CONTRAST,
  PAGE_BACKGROUND,
  primaryShades,
} from '../src/index.js';

describe('branding', () => {
  test('contrast follows WCAG: white on the default blue passes, white on yellow does not', () => {
    expect(MIN_CONTRAST).toBe(4.5);
    expect(contrastRatio('#ffffff', '#000000')).toBeCloseTo(21, 5);
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5);
    expect(contrastRatio('#ffffff', '#2f3ab2')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio('#ffffff', '#ffd400')).toBeLessThan(4.5);
    expect(contrastRatio('#FFFFFF', '#2F3AB2')).toBeCloseTo(contrastRatio('#ffffff', '#2f3ab2'));
  });

  test('the default is readable and valid', () => {
    expect(DEFAULT_BRANDING).toEqual({
      name: { hi: 'शिक्षा पथ', en: 'Shiksha Path' },
      primary: '#2f3ab2',
      accent: '#b45309',
      version: 0,
    });
    expect(branding.safeParse(DEFAULT_BRANDING).success).toBe(true);
    expect(contrastRatio('#ffffff', DEFAULT_BRANDING.accent)).toBeGreaterThanOrEqual(4.5);
  });

  test.each([
    ['a colour that is not #rrggbb', { primary: 'blue' }],
    ['a short colour', { accent: '#fff' }],
    ['an empty name', { name: { hi: '', en: 'X' } }],
    ['a name over 40 characters', { name: { hi: 'क', en: 'x'.repeat(41) } }],
    ['white text on yellow', { primary: '#ffd400' }],
    ['grey that passes on white but not on the page', { accent: '#767676' }],
  ])('a change with %s is refused', (_label, over) => {
    const input = { name: DEFAULT_BRANDING.name, primary: '#2f3ab2', accent: '#b45309', ...over };
    expect(brandingInput.safeParse(input).success).toBe(false);
  });

  test('a colour must also read on the page background (Plan 3b review M4)', () => {
    expect(PAGE_BACKGROUND).toBe('#f4f5fa');
    expect(contrastRatio('#ffffff', '#767676')).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(PAGE_BACKGROUND, '#767676')).toBeLessThan(4.5);
    expect(contrastRatio(PAGE_BACKGROUND, DEFAULT_BRANDING.accent)).toBeGreaterThanOrEqual(4.5);
  });

  test('the darker and softer shades follow the primary', () => {
    expect(primaryShades('#1f6f43')).toEqual({ dark: '#164e2f', soft: '#e9f1ec' });
    const { dark, soft } = primaryShades(DEFAULT_BRANDING.primary);
    expect(contrastRatio('#ffffff', dark)).toBeGreaterThan(contrastRatio('#ffffff', '#2f3ab2'));
    expect(contrastRatio(soft, '#2f3ab2')).toBeGreaterThanOrEqual(4.5);
  });
});
