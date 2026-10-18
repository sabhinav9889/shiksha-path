import type { BundleLesson, Manifest } from '@shiksha/content/schema';
import { evaluateTestOut } from './evaluate.js';
import { CoreError } from './errors.js';
import {
  createEvent,
  parseEvents,
  type EventData,
  type EventType,
  type LearnerEvent,
} from './events.js';
import { languageView, type LanguagePreference, type LanguageView } from './language.js';
import type { EventStore } from './outbox.js';
import type { Clock, Ids } from './ports.js';
import {
  deriveProgress,
  needsPlacement,
  todayLesson,
  trackProgress,
  type LessonRef,
  type PlacementRecord,
  type ProgressState,
} from './progress.js';
import { answerCurrent, startQuiz, summarize } from './quiz.js';
import type { QuizEntry, QuizRun, QuizSummary } from './quiz.js';
import type { ReviewEntry } from './review.js';
import { dueReviews } from './review.js';
import type { Answer, ItemResult } from './scoring.js';
import {
  evaluatePlacement,
  locateLesson,
  placementEntries,
  requireFinishedRun,
  reviewRun,
  storedModule,
} from './session-quiz.js';
import type { BundleStorage } from './storage.js';
import { streak } from './streak.js';
import { istDay } from './time.js';

interface StoredContent {
  /** Lessons that can be opened from the stored bundles. */
  lessons: ReadonlySet<string>;
  /** `lessonId/itemId` of every stored practice item. */
  items: ReadonlySet<string>;
}

async function readStoredContent(
  manifest: Manifest,
  storage: BundleStorage,
): Promise<StoredContent> {
  const lessons = new Set<string>();
  const items = new Set<string>();
  for (const entry of manifest.modules) {
    for (const lesson of (await storage.getModule(entry.id))?.bundle.lessons ?? []) {
      lessons.add(lesson.id);
      for (const item of lesson.items) items.add(`${lesson.id}/${item.id}`);
    }
  }
  return { lessons, items };
}

export interface SessionDeps {
  learnerId: string;
  storage: BundleStorage;
  events: EventStore;
  clock: Clock;
  ids: Ids;
}

/**
 * Everything a learner does, with no network: reads installed lessons from storage, records each
 * action as an event first, then recomputes progress from the whole log.
 */
export class LearnerSession {
  private constructor(
    private readonly deps: SessionDeps,
    private readonly manifest: Manifest,
    private log: LearnerEvent[],
    private readonly stored: StoredContent,
  ) {}

  static async open(deps: SessionDeps): Promise<LearnerSession> {
    const manifest = await deps.storage.getManifest();
    if (!manifest)
      throw new CoreError('MANIFEST_UNAVAILABLE', 'no lessons are saved on this phone');
    // Newer apps may write shapes this one does not know: keep what is valid, never fail to open.
    const { events: log } = parseEvents(await deps.events.all(deps.learnerId));
    return new LearnerSession(deps, manifest, log, await readStoredContent(manifest, deps.storage));
  }

  /** Derived from the log on every read, so a corrected phone clock takes effect at once. */
  get progress(): ProgressState {
    return deriveProgress(this.log, { today: this.today() });
  }

  private today(): string {
    return istDay(this.deps.clock.now());
  }

  private async record<T extends EventType>(type: T, data: EventData[T]): Promise<void> {
    const event = createEvent(this.deps, this.deps.learnerId, type, data);
    await this.deps.events.append(event);
    this.log = [...this.log, event];
  }

  todayLesson(): LessonRef | null {
    return todayLesson(this.manifest, this.progress, this.stored.lessons);
  }

  trackProgress(track: string): { done: number; total: number } {
    return trackProgress(this.manifest, this.progress, track);
  }

  streak(): { current: number; activeToday: boolean } {
    return streak(this.progress.activeDays, this.today());
  }

  reviewDue(): ReviewEntry[] {
    const known = this.progress.reviewQueue.filter((e) =>
      this.stored.items.has(`${e.lessonId}/${e.itemId}`),
    );
    return dueReviews(known, this.today());
  }

  needsPlacement(): boolean {
    return needsPlacement(this.progress);
  }

  async startLesson(
    lessonId: string,
  ): Promise<{ lesson: BundleLesson; run: QuizRun; view: LanguageView }> {
    const { version, lesson } = await locateLesson(this.manifest, this.deps.storage, lessonId);
    await this.record('lesson_started', { lessonId, moduleVersion: version });
    const source = { kind: 'lesson', lessonId } as const;
    const run = startQuiz(lesson.items.map((item) => ({ source, item })));
    return { lesson, run, view: languageView(lesson.hi_ratio, this.progress.language) };
  }

  async answer(run: QuizRun, answer: Answer): Promise<{ run: QuizRun; result: ItemResult }> {
    const out = answerCurrent(run, answer);
    const { source, item } = out.entry;
    await this.record('item_answered', {
      source,
      itemId: item.id,
      outcome: out.result.outcome,
    });
    return { run: out.run, result: out.result };
  }

  async finishLesson(run: QuizRun): Promise<QuizSummary> {
    requireFinishedRun(run, 'lesson');
    const first = run.entries[0]?.source;
    const lessonId = first?.kind === 'lesson' ? first.lessonId : '';
    const summary = summarize(run.answered);
    await this.record('lesson_completed', {
      lessonId,
      correct: summary.correct,
      scored: summary.scored,
    });
    return summary;
  }

  async startReview(): Promise<QuizRun | null> {
    const { storage } = this.deps;
    return reviewRun(this.manifest, storage, this.progress.reviewQueue, this.today());
  }

  async startTestOut(moduleId: string): Promise<{ run: QuizRun; passMark: number }> {
    const { bundle } = await storedModule(this.deps.storage, moduleId);
    if (!bundle.test_out) throw new CoreError('MODULE_NOT_READY', `${moduleId} has no test-out`);
    const source = { kind: 'test_out', moduleId } as const;
    const entries: QuizEntry[] = bundle.test_out.items.map((item) => ({ source, item }));
    return { run: startQuiz(entries), passMark: bundle.test_out.pass_mark };
  }

  async finishTestOut(moduleId: string, run: QuizRun): Promise<{ score: number; passed: boolean }> {
    requireFinishedRun(run, 'test_out');
    const { bundle } = await storedModule(this.deps.storage, moduleId);
    const outcome = evaluateTestOut(bundle.test_out?.pass_mark ?? 1, summarize(run.answered));
    await this.record('test_out_completed', { moduleId, ...outcome });
    return outcome;
  }

  async startPlacement(): Promise<QuizRun | null> {
    const placement = await this.deps.storage.getPlacement();
    return placement ? startQuiz(placementEntries(placement.bundle)) : null;
  }

  async finishPlacement(run: QuizRun): Promise<PlacementRecord> {
    requireFinishedRun(run, 'placement');
    const placement = await this.deps.storage.getPlacement();
    if (!placement)
      throw new CoreError('MODULE_NOT_READY', 'the placement test is not on this phone');
    const results = evaluatePlacement(placement.bundle, run);
    const sections = results.map(({ track, score, startLesson }) => ({
      track,
      score,
      startLesson,
    }));
    const englishOnlySuggested = results.some((r) => r.englishOnlySuggested);
    await this.record('placement_completed', { sections, englishOnlySuggested });
    return { at: this.deps.clock.now().toISOString(), sections, englishOnlySuggested };
  }

  async skipPlacement(): Promise<void> {
    await this.record('placement_skipped', {});
  }

  async setLanguage(preference: LanguagePreference): Promise<void> {
    await this.record('language_changed', { preference });
  }
}
