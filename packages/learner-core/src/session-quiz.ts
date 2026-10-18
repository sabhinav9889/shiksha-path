import type {
  BundleLesson,
  Manifest,
  ModuleBundle,
  PlacementBundle,
} from '@shiksha/content/schema';
import { evaluatePlacementSection, type SectionResult } from './evaluate.js';
import { CoreError } from './errors.js';
import { startQuiz, summarize, type ItemSource, type QuizEntry, type QuizRun } from './quiz.js';
import { dueReviews, type ReviewEntry } from './review.js';
import type { BundleStorage } from './storage.js';

const notReady = (what: string): CoreError =>
  new CoreError('MODULE_NOT_READY', `${what} is not on this phone yet`);

const moduleOf = (manifest: Manifest, lessonId: string): string | undefined =>
  manifest.modules.find((m) => m.lessons.some((l) => l.id === lessonId))?.id;

/** The stored lesson (from whatever version is installed, ready or not). */
export async function locateLesson(
  manifest: Manifest,
  storage: BundleStorage,
  lessonId: string,
): Promise<{ moduleId: string; version: string; lesson: BundleLesson }> {
  const moduleId = moduleOf(manifest, lessonId);
  const stored = moduleId ? await storage.getModule(moduleId) : null;
  const lesson = stored?.bundle.lessons.find((l) => l.id === lessonId);
  if (!moduleId || !stored || !lesson) throw notReady(`lesson ${lessonId}`);
  return { moduleId, version: stored.version, lesson };
}

export async function storedModule(
  storage: BundleStorage,
  moduleId: string,
): Promise<{ version: string; bundle: ModuleBundle }> {
  const stored = await storage.getModule(moduleId);
  if (!stored) throw notReady(`module ${moduleId}`);
  return stored;
}

/** Items of the review queue that still exist in the installed bundles. */
async function resolvableReviews(
  manifest: Manifest,
  storage: BundleStorage,
  queue: readonly ReviewEntry[],
): Promise<Map<ReviewEntry, QuizEntry>> {
  const resolved = new Map<ReviewEntry, QuizEntry>();
  for (const entry of queue) {
    const found = await locateLesson(manifest, storage, entry.lessonId).catch(() => null);
    const item = found?.lesson.items.find((i) => i.id === entry.itemId);
    if (item) resolved.set(entry, { source: { kind: 'review', lessonId: entry.lessonId }, item });
  }
  return resolved;
}

/**
 * Today's review session. Queue entries whose lesson or item is gone (content changed) are
 * dropped before the session is cut, so they can never crowd out entries that still exist.
 */
export async function reviewRun(
  manifest: Manifest,
  storage: BundleStorage,
  queue: readonly ReviewEntry[],
  today: string,
): Promise<QuizRun | null> {
  const resolved = await resolvableReviews(manifest, storage, queue);
  const entries = dueReviews([...resolved.keys()], today).map((e) => resolved.get(e) as QuizEntry);
  return entries.length === 0 ? null : startQuiz(entries);
}

export function placementEntries(placement: PlacementBundle): QuizEntry[] {
  return placement.sections.flatMap((section) =>
    section.items.map((item) => ({
      source: { kind: 'placement', track: section.track } as ItemSource,
      item,
    })),
  );
}

/** Score each section of the placement test from the answers given to its items. */
export function evaluatePlacement(placement: PlacementBundle, run: QuizRun): SectionResult[] {
  return placement.sections.flatMap((section) => {
    const answered = run.answered.filter(
      (a) => a.entry.source.kind === 'placement' && a.entry.source.track === section.track,
    );
    return answered.length === 0 ? [] : [evaluatePlacementSection(section, summarize(answered))];
  });
}

/** A run must be finished and made only of items from one kind of source. */
export function requireFinishedRun(run: QuizRun, kind: ItemSource['kind']): void {
  const wrongKind = run.entries.some((e) => e.source.kind !== kind);
  if (wrongKind || run.entries.length === 0) throw new Error(`this is not a ${kind} run`);
  if (run.answered.length < run.entries.length) throw new Error(`the ${kind} run is not finished`);
}
