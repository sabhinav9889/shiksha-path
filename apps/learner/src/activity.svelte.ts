import type { BundleLesson, Localized } from '@shiksha/content/schema';
import type { LanguageView, PlacementRecord, QuizRun, QuizSummary } from '@shiksha/learner-core';

/** What the learner is doing right now; lives in memory only (a reload ends the run). */
export type Activity =
  | { kind: 'lesson'; lesson: BundleLesson; run: QuizRun; view: LanguageView }
  | { kind: 'review'; run: QuizRun }
  | { kind: 'test_out'; moduleId: string; passMark: number; run: QuizRun }
  | { kind: 'placement'; run: QuizRun };

export interface FinishInfo {
  kind: Activity['kind'];
  summary: QuizSummary;
  streak: { current: number; activeToday: boolean };
  testOut?: { score: number; passed: boolean };
  lessonTitle?: Localized;
}

export const activity = $state<{
  current: Activity | null;
  finish: FinishInfo | null;
  placementResult: PlacementRecord | null;
}>({
  current: null,
  finish: null,
  placementResult: null,
});

export function resetActivity(): void {
  activity.current = null;
  activity.finish = null;
  activity.placementResult = null;
}
