import { describe, expect, test } from 'vitest';
import { shuffleItems } from './shuffle.js';

describe('shuffleItems', () => {
  const list = ['a', 'b', 'c', 'd'] as const;

  test('keeps every item once and does not change the original', () => {
    const out = shuffleItems(list, 'seed');
    expect([...out].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(list).toEqual(['a', 'b', 'c', 'd']);
  });

  test('is repeatable: the same seed gives the same order', () => {
    expect(shuffleItems(list, 'q1-0')).toEqual(shuffleItems(list, 'q1-0'));
  });

  test('different seeds put different items first, so no answer sits in one place', () => {
    const firsts = new Set(Array.from({ length: 40 }, (_, n) => shuffleItems(list, `q-${n}`)[0]));
    expect(firsts.size).toBeGreaterThanOrEqual(3);
  });

  test('handles empty and single lists', () => {
    expect(shuffleItems([], 's')).toEqual([]);
    expect(shuffleItems(['x'], 's')).toEqual(['x']);
  });
});
