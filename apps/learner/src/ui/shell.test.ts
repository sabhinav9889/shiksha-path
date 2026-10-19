import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

const SRC = join(process.cwd(), 'apps/learner/src');
const read = (path: string): string => readFileSync(join(SRC, path), 'utf8');

/** Pins the layout numbers from the design canvas, so a drive-by edit is noticed. */
describe('wide-screen layout', () => {
  test('the breakpoints are written down once in the tokens', () => {
    const tokens = read('styles/tokens.css');
    expect(tokens).toContain('--bp-tablet: 768px');
    expect(tokens).toContain('--bp-laptop: 1024px');
  });

  test('the shell puts the navigation on the left from 768 px and caps the content at 1100 px', () => {
    const shell = read('ui/Shell.svelte');
    expect(shell).toContain('@media (min-width: 768px)');
    expect(shell).toMatch(/flex-direction: row/);
    expect(shell).toContain('max-width: 1100px');
  });

  test('the navigation is a 96 px rail from 768 px and a 220 px sidebar from 1024 px', () => {
    const nav = read('ui/NavBar.svelte');
    expect(nav).toContain('@media (min-width: 768px)');
    expect(nav).toContain('width: 96px');
    expect(nav).toContain('@media (min-width: 1024px)');
    expect(nav).toContain('width: 220px');
  });

  test.each([
    'screens/practice/PracticeScreen.svelte',
    'screens/learn/LearnScreen.svelte',
    'screens/finish/FinishScreen.svelte',
    'screens/placement/PlacementScreen.svelte',
    'screens/placement/PlacementResult.svelte',
    'screens/practice/LeaveSheet.svelte',
    'ui/ConfirmSheet.svelte',
  ])('%s keeps lines readable: at most 640 px wide', (path) => {
    expect(read(path)).toContain('max-width: 640px');
  });

  test('home lays its cards in a row and lessons in two columns on wide screens', () => {
    expect(read('screens/home/HomeScreen.svelte')).toContain('@media (min-width: 768px)');
    expect(read('screens/lessons/LessonsScreen.svelte')).toContain('@media (min-width: 1024px)');
  });
});
