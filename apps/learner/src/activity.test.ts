// @vitest-environment jsdom
import type { PracticeItem } from '@shiksha/content/schema';
import { startQuiz } from '@shiksha/learner-core';
import { describe, expect, test } from 'vitest';
import { activity, resetActivity } from './activity.svelte.js';

describe('activity', () => {
  test('holds plain data, never a reactive proxy, so it can be stored or cloned', () => {
    const item: PracticeItem = {
      id: 'q1',
      type: 'word_order',
      prompt: { hi: 'क', en: 'a' },
      words: ['a', 'b'],
    };
    const current = {
      kind: 'review' as const,
      run: startQuiz([{ source: { kind: 'review', lessonId: 'l' }, item }]),
    };
    activity.current = current;
    // a deep reactive state would hand back a proxy instead of the object stored
    expect(activity.current).toBe(current);
    expect(activity.current?.run).toBe(current.run);
    expect(() => structuredClone(activity.current)).not.toThrow();
    const finish = {
      kind: 'review' as const,
      summary: { total: 1, scored: 1, correct: 1, wrong: 0, unscored: 0, score: 1, mistakes: [] },
      streak: { current: 1, activeToday: true },
    };
    activity.finish = finish;
    expect(activity.finish).toBe(finish);
    resetActivity();
    expect([activity.current, activity.finish, activity.placementResult]).toEqual([
      null,
      null,
      null,
    ]);
  });
});
