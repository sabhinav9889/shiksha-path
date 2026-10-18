import type { PracticeItem } from '@shiksha/content/schema';
import { describe, expect, test } from 'vitest';
import {
  answerCurrent,
  currentEntry,
  isFinished,
  startQuiz,
  summarize,
  type QuizEntry,
} from '../src/quiz.js';
import type { Answer } from '../src/scoring.js';

const L = { hi: 'क', en: 'a' };
const mcq = (id: string): PracticeItem => ({
  id,
  type: 'mcq_meaning',
  prompt: L,
  options: [
    { id: 'a', text: L, correct: true },
    { id: 'b', text: L, why_wrong: L },
  ],
});
const speak: PracticeItem = {
  id: 's1',
  type: 'speak_compare',
  prompt: L,
  text: 'Hi',
  model_audio: 'audio/x',
};
const entry = (item: PracticeItem): QuizEntry => ({
  source: { kind: 'lesson', lessonId: 'l1' },
  item,
});
const right: Answer = { kind: 'choice', optionId: 'a' };
const wrong: Answer = { kind: 'choice', optionId: 'b' };

describe('quiz progression', () => {
  const entries = [entry(mcq('q1')), entry(mcq('q2')), entry(mcq('q3'))];

  test('advances one item per answer and finishes after the last', () => {
    let run = startQuiz(entries);
    const seen: string[] = [];
    while (!isFinished(run)) {
      seen.push(currentEntry(run)?.item.id ?? '');
      run = answerCurrent(run, right).run;
    }
    expect(seen).toEqual(['q1', 'q2', 'q3']);
    expect(currentEntry(run)).toBeNull();
    expect(run.answered).toHaveLength(3);
  });

  test('answering returns the entry and its result, and does not mutate the old run', () => {
    const run = startQuiz(entries);
    const out = answerCurrent(run, wrong);
    expect(out.entry.item.id).toBe('q1');
    expect(out.result.outcome).toBe('wrong');
    expect(run.answered).toHaveLength(0);
    expect(currentEntry(run)?.item.id).toBe('q1');
  });

  test('answering a finished run throws', () => {
    let run = startQuiz([entry(mcq('q1'))]);
    run = answerCurrent(run, right).run;
    expect(() => answerCurrent(run, right)).toThrow(Error);
  });

  test('an empty quiz cannot start', () => {
    expect(() => startQuiz([])).toThrow(Error);
  });
});

describe('summarize', () => {
  test('counts outcomes and lists mistakes in answered order', () => {
    let run = startQuiz([entry(mcq('q1')), entry(mcq('q2')), entry(mcq('q3')), entry(speak)]);
    for (const answer of [right, wrong, right, { kind: 'spoken' } as Answer]) {
      run = answerCurrent(run, answer).run;
    }
    const summary = summarize(run.answered);
    expect([
      summary.total,
      summary.scored,
      summary.correct,
      summary.wrong,
      summary.unscored,
    ]).toEqual([4, 3, 2, 1, 1]);
    expect(summary.score).toBeCloseTo(2 / 3);
    expect(summary.mistakes.map((m) => m.entry.item.id)).toEqual(['q2']);
  });

  test('a run with nothing scored has score 1', () => {
    const run = answerCurrent(startQuiz([entry(speak)]), { kind: 'spoken' }).run;
    expect(summarize(run.answered).score).toBe(1);
  });
});
