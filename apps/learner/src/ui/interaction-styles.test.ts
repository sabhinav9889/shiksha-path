import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const tokens = readFileSync(join(process.cwd(), 'apps/learner/src/styles/tokens.css'), 'utf8');

/** Pins the app-wide touch and pointer feel, so a drive-by edit is noticed. */
describe('interaction styles', () => {
  test('everything you can press shows a pointer, and a disabled one does not', () => {
    expect(tokens).toMatch(/button:not\(:disabled\)[^{]*\{[^}]*cursor: pointer/s);
    expect(tokens).toMatch(/a\[href\][^{]*\{[^}]*cursor: pointer/s);
    expect(tokens).toMatch(/button:disabled[^{]*\{[^}]*cursor: not-allowed/s);
  });

  test('a pointer device gets a hover state and every device a press state', () => {
    expect(tokens).toContain('@media (hover: hover)');
    expect(tokens).toMatch(/:hover/);
    expect(tokens).toMatch(/:active/);
  });

  test('keyboard focus is clearly visible', () => {
    expect(tokens).toMatch(/:focus-visible[^{]*\{[^}]*outline: 3px solid var\(--color-primary\)/s);
  });

  test('people who ask for less motion get none', () => {
    expect(tokens).toMatch(/prefers-reduced-motion: reduce[\s\S]*transition: none/);
  });
});

describe('site icons', () => {
  const html = readFileSync(join(process.cwd(), 'apps/learner/index.html'), 'utf8');
  const publicDir = join(process.cwd(), 'apps/learner/public');

  test.each([
    ['rel="icon" type="image/svg+xml"', 'favicon.svg'],
    ['rel="icon" type="image/png" sizes="32x32"', 'icons/favicon-32.png'],
    ['rel="apple-touch-icon"', 'icons/apple-touch-icon.png'],
  ])('the page links %s to a file that exists', (attrs, file) => {
    expect(html).toContain(attrs);
    expect(html).toContain(file);
    expect(() => readFileSync(join(publicDir, file))).not.toThrow();
  });
});
