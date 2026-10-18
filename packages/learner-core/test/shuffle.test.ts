import { describe, expect, test } from 'vitest';
import { shuffleWords } from '../src/shuffle.js';

const SEEDS = 200;

describe('shuffleWords', () => {
  const words = ['I', 'am', 'Priya'];

  test('is deterministic for a seed', () => {
    expect(shuffleWords(words, 'seed-1')).toEqual(shuffleWords(words, 'seed-1'));
  });

  test('is a permutation of the input and does not change it', () => {
    const input = ['one', 'two', 'three', 'four'];
    const copy = [...input];
    const out = shuffleWords(input, 'x');
    expect([...out].sort()).toEqual([...input].sort());
    expect(input).toEqual(copy);
  });

  test('never returns the original order when words differ', () => {
    for (let i = 0; i < SEEDS; i += 1) {
      expect(shuffleWords(words, `seed-${i}`)).not.toEqual(words);
    }
  });

  test('different seeds give different orders', () => {
    const seen = new Set(
      Array.from({ length: SEEDS }, (_, i) => shuffleWords(words, `s${i}`).join()),
    );
    expect(seen.size).toBeGreaterThan(1);
  });

  test('identical words come back unchanged', () => {
    expect(shuffleWords(['a', 'a', 'a'], 'x')).toEqual(['a', 'a', 'a']);
  });
});
