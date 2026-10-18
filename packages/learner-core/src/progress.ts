import type { Manifest } from '@shiksha/content/schema';
import type { LearnerEvent } from './events.js';
import type { LanguagePreference } from './language.js';
import { applyReviewAnswer, type ReviewEntry } from './review.js';
import { istDay } from './time.js';

export interface PlacementRecord {
  at: string;
  sections: { track: string; score: number; startLesson: string }[];
  englishOnlySuggested: boolean;
}

export interface ProgressState {
  completedLessons: ReadonlySet<string>;
  testedOutModules: ReadonlySet<string>;
  placements: readonly PlacementRecord[];
  startLessonByTrack: Readonly<Record<string, string>>;
  language: LanguagePreference;
  suggestEnglishOnly: boolean;
  placementSkipped: boolean;
  activeDays: ReadonlySet<string>;
  reviewQueue: readonly ReviewEntry[];
}

export interface LessonRef {
  moduleId: string;
  lessonId: string;
  track: string;
}

export function needsPlacement(state: ProgressState): boolean {
  return state.placements.length === 0 && !state.placementSkipped;
}

/** Drop repeated ids (first wins), then order by time and id so replay is deterministic. */
function normalise(events: readonly LearnerEvent[]): LearnerEvent[] {
  const seen = new Set<string>();
  const unique = events.filter((e) => !seen.has(e.id) && seen.add(e.id));
  return unique.sort((a, b) => a.at.localeCompare(b.at) || a.id.localeCompare(b.id));
}

type Mutable = {
  -readonly [K in keyof ProgressState]: ProgressState[K] extends ReadonlySet<infer V>
    ? Set<V>
    : ProgressState[K] extends readonly (infer V)[]
      ? V[]
      : ProgressState[K] extends Readonly<Record<string, string>>
        ? Record<string, string>
        : ProgressState[K];
};

function apply(state: Mutable, event: LearnerEvent, today: string | undefined): void {
  switch (event.type) {
    case 'lesson_completed':
      state.completedLessons.add(event.data.lessonId);
      break;
    case 'item_answered':
      recordAnswer(state, event, today);
      break;
    case 'test_out_completed':
      if (event.data.passed) state.testedOutModules.add(event.data.moduleId);
      break;
    case 'placement_completed':
      recordPlacement(state, event);
      break;
    case 'placement_skipped':
      state.placementSkipped = true;
      break;
    case 'language_changed':
      state.language = event.data.preference;
      state.suggestEnglishOnly = false;
      break;
    default:
      break; // lesson_started changes nothing derived
  }
}

function recordAnswer(
  state: Mutable,
  event: Extract<LearnerEvent, { type: 'item_answered' }>,
  today: string | undefined,
): void {
  const { source, itemId, outcome } = event.data;
  const day = istDay(event.at);
  // Stamped after "today": the phone clock was wrong. Ignore it until that day really arrives, so
  // it cannot add a phantom streak day or overwrite a real answer's review date.
  if (today !== undefined && day > today) return;
  state.activeDays.add(day);
  if (source.kind !== 'lesson' && source.kind !== 'review') return;
  const fromReview = source.kind === 'review';
  state.reviewQueue = applyReviewAnswer(state.reviewQueue, {
    lessonId: source.lessonId,
    itemId,
    outcome,
    fromReview,
    day,
  });
}

function recordPlacement(
  state: Mutable,
  event: Extract<LearnerEvent, { type: 'placement_completed' }>,
): void {
  const { sections, englishOnlySuggested } = event.data;
  if (state.placements.length === 0) {
    for (const s of sections) state.startLessonByTrack[s.track] = s.startLesson;
    state.suggestEnglishOnly = englishOnlySuggested;
  }
  state.placements.push({ at: event.at, sections, englishOnlySuggested });
}

/** Replay the append-only log into the learner's current state. */
export function deriveProgress(
  events: readonly LearnerEvent[],
  opts: { today?: string } = {},
): ProgressState {
  const state: Mutable = {
    completedLessons: new Set(),
    testedOutModules: new Set(),
    placements: [],
    startLessonByTrack: {},
    language: 'hi_en',
    suggestEnglishOnly: false,
    placementSkipped: false,
    activeDays: new Set(),
    reviewQueue: [],
  };
  for (const event of normalise(events)) apply(state, event, opts.today);
  return state;
}

/** Lessons of a track in learning order (module order, then lesson order). */
export function lessonOrder(manifest: Manifest, track: string): LessonRef[] {
  return manifest.modules
    .filter((m) => m.track === track)
    .sort((a, b) => a.order - b.order)
    .flatMap((m) =>
      [...m.lessons]
        .sort((a, b) => a.order - b.order)
        .map((l) => ({ moduleId: m.id, lessonId: l.id, track })),
    );
}

function isDone(order: LessonRef[], state: ProgressState, ref: LessonRef, index: number): boolean {
  if (state.completedLessons.has(ref.lessonId) || state.testedOutModules.has(ref.moduleId)) {
    return true;
  }
  const start = order.findIndex((r) => r.lessonId === state.startLessonByTrack[ref.track]);
  return start > index;
}

export function isLessonDone(manifest: Manifest, state: ProgressState, lessonId: string): boolean {
  for (const track of manifest.tracks) {
    const order = lessonOrder(manifest, track.id);
    const index = order.findIndex((r) => r.lessonId === lessonId);
    const ref = order[index];
    if (ref) return isDone(order, state, ref, index);
  }
  return false;
}

/** The next lesson: tracks in order, so testing out of English lands the learner on aptitude. */
export function todayLesson(
  manifest: Manifest,
  state: ProgressState,
  playable?: ReadonlySet<string>,
): LessonRef | null {
  const tracks = [...manifest.tracks].sort((a, b) => a.order - b.order);
  for (const track of tracks) {
    const order = lessonOrder(manifest, track.id);
    const next = order.find(
      (ref, i) => !isDone(order, state, ref, i) && (playable?.has(ref.lessonId) ?? true),
    );
    if (next) return next;
  }
  return null;
}

export function trackProgress(
  manifest: Manifest,
  state: ProgressState,
  track: string,
): { done: number; total: number } {
  const order = lessonOrder(manifest, track);
  return { done: order.filter((r, i) => isDone(order, state, r, i)).length, total: order.length };
}
