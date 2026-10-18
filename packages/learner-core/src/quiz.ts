import type { PracticeItem } from '@shiksha/content/schema';
import { scoreItem, type Answer, type ItemResult } from './scoring.js';

export type ItemSource =
  | { kind: 'lesson'; lessonId: string }
  | { kind: 'review'; lessonId: string }
  | { kind: 'test_out'; moduleId: string }
  | { kind: 'placement'; track: string };

export interface QuizEntry {
  source: ItemSource;
  item: PracticeItem;
}

export interface AnsweredEntry {
  entry: QuizEntry;
  result: ItemResult;
}

export interface QuizRun {
  readonly entries: readonly QuizEntry[];
  readonly answered: readonly AnsweredEntry[];
}

export interface QuizSummary {
  total: number;
  scored: number;
  correct: number;
  wrong: number;
  unscored: number;
  score: number;
  mistakes: AnsweredEntry[];
}

export function startQuiz(entries: readonly QuizEntry[]): QuizRun {
  if (entries.length === 0) throw new Error('a quiz needs at least one item');
  return { entries: [...entries], answered: [] };
}

export function isFinished(run: QuizRun): boolean {
  return run.answered.length >= run.entries.length;
}

export function currentEntry(run: QuizRun): QuizEntry | null {
  return run.entries[run.answered.length] ?? null;
}

export function answerCurrent(
  run: QuizRun,
  answer: Answer,
): { run: QuizRun; entry: QuizEntry; result: ItemResult } {
  const entry = currentEntry(run);
  if (!entry) throw new Error('the quiz is already finished');
  const result = scoreItem(entry.item, answer);
  return { run: { ...run, answered: [...run.answered, { entry, result }] }, entry, result };
}

export function summarize(answered: readonly AnsweredEntry[]): QuizSummary {
  const count = (outcome: ItemResult['outcome']): number =>
    answered.filter((a) => a.result.outcome === outcome).length;
  const [correct, wrong, unscored] = [count('correct'), count('wrong'), count('unscored')];
  const scored = correct + wrong;
  return {
    total: answered.length,
    scored,
    correct,
    wrong,
    unscored,
    score: scored === 0 ? 1 : correct / scored,
    mistakes: answered.filter((a) => a.result.outcome === 'wrong'),
  };
}
