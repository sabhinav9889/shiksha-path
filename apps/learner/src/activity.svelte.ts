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

// Plain values, not deep reactive state: runs and results travel into the core and IndexedDB,
// which must receive the objects themselves, never Svelte proxies of them.
let current = $state.raw<Activity | null>(null);
let finish = $state.raw<FinishInfo | null>(null);
let placementResult = $state.raw<PlacementRecord | null>(null);

export const activity = {
  get current(): Activity | null {
    return current;
  },
  set current(value: Activity | null) {
    current = value;
  },
  get finish(): FinishInfo | null {
    return finish;
  },
  set finish(value: FinishInfo | null) {
    finish = value;
  },
  get placementResult(): PlacementRecord | null {
    return placementResult;
  },
  set placementResult(value: PlacementRecord | null) {
    placementResult = value;
  },
};

export function resetActivity(): void {
  activity.current = null;
  activity.finish = null;
  activity.placementResult = null;
}

/** Audio the current run may still play: the lesson's own audio and its items' audio. */
export function audioInUse(): ReadonlySet<string> {
  // eslint-disable-next-line svelte/prefer-svelte-reactivity -- a one-off answer, never observed
  const paths = new Set<string>();
  if (!current) return paths;
  if (current.kind === 'lesson') {
    for (const path of Object.values(current.lesson.audio ?? {})) if (path) paths.add(path);
  }
  for (const { item } of current.run.entries) {
    if (item.type === 'listen_choose') paths.add(item.audio);
    if (item.type === 'speak_compare') paths.add(item.model_audio);
  }
  return paths;
}
