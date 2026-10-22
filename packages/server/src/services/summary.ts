import {
  addDays,
  daysBetween,
  deriveProgress,
  istDay,
  parseEvents,
  streak,
  type LearnerEvent,
} from '@shiksha/learner-core';

/** One learner's progress at a glance, for staff screens (spec §8). Re-derived, never edited. */
export interface Summary {
  lessonsDone: number;
  lessonsThisWeek: number;
  streak: number;
  lastActiveDay: string | null;
  currentLesson: string | null;
  lowScores: boolean;
  stuckLesson: string | null;
}

export type Attention = 'inactive' | 'stuck' | 'low_scores';

/** The needs-attention thresholds the owner confirmed (Plan 4a). */
const INACTIVE_DAYS = 3;
const STUCK_DAYS = 3;
const LOW_SCORE_LESSONS = 3;
const LOW_SCORE = 0.6;
const DAYS_PER_WEEK = 7;
const SUNDAY = 0;

/** Monday of the IST week holding `today` (weeks run Monday to Sunday). */
function weekStart(today: string): string {
  const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
  const back = weekday === SUNDAY ? DAYS_PER_WEEK - 1 : weekday - 1;
  return addDays(today, -back);
}

type Completed = Extract<LearnerEvent, { type: 'lesson_completed' }>;
type Started = Extract<LearnerEvent, { type: 'lesson_started' }>;

function lowScores(completed: Completed[]): boolean {
  const scored = completed.filter((e) => e.data.scored > 0).slice(-LOW_SCORE_LESSONS);
  return (
    scored.length === LOW_SCORE_LESSONS &&
    scored.every((e) => e.data.correct / e.data.scored < LOW_SCORE)
  );
}

function stuckLesson(started: Started[], done: ReadonlySet<string>): string | null {
  const days = new Map<string, Set<string>>();
  for (const e of started) {
    if (done.has(e.data.lessonId)) continue;
    days.set(e.data.lessonId, (days.get(e.data.lessonId) ?? new Set()).add(istDay(e.at)));
  }
  const stuck = [...days].filter(([, d]) => d.size >= STUCK_DAYS).map(([lesson]) => lesson);
  return stuck.at(-1) ?? null;
}

/** The summary of a learner's whole log, as of the IST day `today`. Duplicates count once. */
export function summarise(raw: readonly unknown[], today: string): Summary {
  const seen = new Set<string>();
  const events = parseEvents(raw)
    .events.filter((e) => !seen.has(e.id) && seen.add(e.id))
    .sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
  const progress = deriveProgress(events, { today });
  const completed = events.filter((e): e is Completed => e.type === 'lesson_completed');
  const started = events.filter((e): e is Started => e.type === 'lesson_started');
  const monday = weekStart(today);
  const thisWeek = new Set(
    completed
      .filter((e) => istDay(e.at) >= monday && istDay(e.at) <= today)
      .map((e) => e.data.lessonId),
  );
  const last = started.at(-1)?.data.lessonId ?? null;
  return {
    lessonsDone: progress.completedLessons.size,
    lessonsThisWeek: thisWeek.size,
    streak: streak(progress.activeDays, today).current,
    lastActiveDay: [...progress.activeDays].sort().at(-1) ?? null,
    currentLesson: last && !progress.completedLessons.has(last) ? last : null,
    lowScores: lowScores(completed),
    stuckLesson: stuckLesson(started, progress.completedLessons),
  };
}

/** Why a mentor should look at this learner now; empty when all is well. */
export function needsAttention(summary: Summary, linkedOn: string, today: string): Attention[] {
  const flags: Attention[] = [];
  if (daysBetween(summary.lastActiveDay ?? linkedOn, today) >= INACTIVE_DAYS)
    flags.push('inactive');
  if (summary.stuckLesson) flags.push('stuck');
  if (summary.lowScores) flags.push('low_scores');
  return flags;
}
