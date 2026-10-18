import type { Outcome } from './scoring.js';
import { addDays } from './time.js';

/** Leitner boxes: a wrong item comes back after 1 day, then 2, then 4 as it is answered right. */
// eslint-disable-next-line no-magic-numbers -- the named interval table itself
export const REVIEW_INTERVAL_DAYS = [1, 2, 4] as const;
export const REVIEW_SESSION_SIZE = 5;

export interface ReviewEntry {
  lessonId: string;
  itemId: string;
  box: number;
  dueDay: string;
}

interface ReviewAnswer {
  lessonId: string;
  itemId: string;
  outcome: Outcome;
  fromReview: boolean;
  day: string;
}

const sameItem = (e: ReviewEntry, a: ReviewAnswer): boolean =>
  e.lessonId === a.lessonId && e.itemId === a.itemId;

const interval = (box: number): number => REVIEW_INTERVAL_DAYS[box] ?? 1;

export function applyReviewAnswer(
  queue: readonly ReviewEntry[],
  answer: ReviewAnswer,
): ReviewEntry[] {
  const { lessonId, itemId, day } = answer;
  const others = queue.filter((e) => !sameItem(e, answer));
  const existing = queue.find((e) => sameItem(e, answer));
  if (answer.outcome === 'wrong') {
    return [...others, { lessonId, itemId, box: 0, dueDay: addDays(day, interval(0)) }];
  }
  if (answer.outcome !== 'correct' || !answer.fromReview || !existing) return [...queue];
  const box = existing.box + 1;
  if (box >= REVIEW_INTERVAL_DAYS.length) return others;
  return [...others, { lessonId, itemId, box, dueDay: addDays(day, interval(box)) }];
}

const byDueThenId = (a: ReviewEntry, b: ReviewEntry): number =>
  a.dueDay.localeCompare(b.dueDay) ||
  a.lessonId.localeCompare(b.lessonId) ||
  a.itemId.localeCompare(b.itemId);

/** The next review session: what is due today or earlier, oldest first. */
export function dueReviews(queue: readonly ReviewEntry[], today: string): ReviewEntry[] {
  return queue
    .filter((e) => e.dueDay <= today)
    .sort(byDueThenId)
    .slice(0, REVIEW_SESSION_SIZE);
}
