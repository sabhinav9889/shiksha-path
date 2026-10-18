import type { PlacementSection } from '@shiksha/content/schema';
import { describe, expect, test } from 'vitest';
import { evaluatePlacementSection, evaluateTestOut } from '../src/evaluate.js';
import type { QuizSummary } from '../src/quiz.js';

const summaryOf = (score: number, correct = 0, scored = 0): QuizSummary => ({
  total: scored,
  scored,
  correct,
  wrong: scored - correct,
  unscored: 0,
  score,
  mistakes: [],
});

const section = (over: Partial<PlacementSection> = {}): PlacementSection => ({
  track: 'english',
  items: [],
  start_rules: [
    { min_score: 0, start_lesson: 'a' },
    { min_score: 0.6, start_lesson: 'b' },
    { min_score: 0.9, start_lesson: 'c' },
  ],
  ...over,
});

describe('evaluatePlacementSection', () => {
  test.each([
    [0, 'a'],
    [0.59, 'a'],
    [0.6, 'b'],
    [0.89, 'b'],
    [0.9, 'c'],
    [1, 'c'],
  ])('score %s starts at %s', (score, lesson) => {
    const result = evaluatePlacementSection(section(), summaryOf(score));
    expect(result.startLesson).toBe(lesson);
    expect(result.score).toBe(score);
    expect(result.track).toBe('english');
  });

  test('rules in any order give the same answer', () => {
    const shuffled = section({
      start_rules: [
        { min_score: 0.9, start_lesson: 'c' },
        { min_score: 0, start_lesson: 'a' },
        { min_score: 0.6, start_lesson: 'b' },
      ],
    });
    expect(evaluatePlacementSection(shuffled, summaryOf(0.7)).startLesson).toBe('b');
  });

  test('with no rule at or below the score, the lowest rule is used', () => {
    const high = section({ start_rules: [{ min_score: 0.5, start_lesson: 'x' }] });
    expect(evaluatePlacementSection(high, summaryOf(0.1)).startLesson).toBe('x');
  });

  test('suggests English-only at the threshold and above, not below', () => {
    const s = section({ suggest_english_only_at: 0.9 });
    expect(evaluatePlacementSection(s, summaryOf(0.9)).englishOnlySuggested).toBe(true);
    expect(evaluatePlacementSection(s, summaryOf(0.89)).englishOnlySuggested).toBe(false);
  });

  test('a section without a threshold never suggests', () => {
    expect(evaluatePlacementSection(section(), summaryOf(1)).englishOnlySuggested).toBe(false);
  });
});

describe('evaluateTestOut', () => {
  test.each([
    [4, 5, true],
    [3, 5, false],
    [8, 10, true],
  ])('%s of %s against 0.8 passes: %s', (correct, scored, passed) => {
    const summary = summaryOf(correct / scored, correct, scored);
    expect(evaluateTestOut(0.8, summary)).toEqual({ score: correct / scored, passed });
  });
});
