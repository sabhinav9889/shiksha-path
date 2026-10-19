import type { Localized, Manifest } from '@shiksha/content/schema';
import { isModulePlayable, type LearnerSession } from '@shiksha/learner-core';
import type { Runtime } from '../../runtime/runtime.js';

export interface HomeData {
  /** `download`: nothing playable on the phone yet. `done`: every playable lesson is finished. */
  state: 'download' | 'ready' | 'done';
  today: { lessonId: string; title: Localized; questions: number } | null;
  streak: { current: number; activeToday: boolean };
  tracks: { id: string; title: Localized; done: number; total: number }[];
  reviewDue: number;
  /** The starting test is installed and the learner has neither taken nor skipped it. */
  placement: boolean;
  sync: { lastSyncedAt: string | null; pending: number };
}

async function findToday(
  runtime: Runtime,
  manifest: Manifest,
  session: LearnerSession,
): Promise<HomeData['today']> {
  const ref = session.todayLesson();
  if (!ref) return null;
  const entry = manifest.modules.find((m) => m.id === ref.moduleId);
  const title = entry?.lessons.find((l) => l.id === ref.lessonId)?.title;
  const stored = await runtime.storage.getModule(ref.moduleId);
  const lesson = stored?.bundle.lessons.find((l) => l.id === ref.lessonId);
  return {
    lessonId: ref.lessonId,
    title: title ?? { hi: ref.lessonId, en: ref.lessonId },
    questions: lesson?.items.length ?? 0,
  };
}

/** Everything the home screen shows, gathered once (the session itself is not reactive). */
export async function loadHome(
  runtime: Runtime,
  learnerId: string,
  session: LearnerSession | null,
): Promise<HomeData> {
  const sync = await runtime.syncStatus(learnerId);
  const empty: HomeData = {
    state: 'download',
    today: null,
    streak: { current: 0, activeToday: false },
    tracks: [],
    reviewDue: 0,
    placement: false,
    sync,
  };
  const manifest = await runtime.storage.getManifest();
  if (!session || !manifest) return empty;
  const playable = await Promise.all(
    manifest.modules.map((m) => isModulePlayable(m.id, runtime.storage)),
  );
  if (!playable.some(Boolean)) return empty;

  const today = await findToday(runtime, manifest, session);
  const tracks = [...manifest.tracks]
    .sort((a, b) => a.order - b.order)
    .map((track) => ({ id: track.id, title: track.title, ...session.trackProgress(track.id) }));
  return {
    state: today ? 'ready' : 'done',
    today,
    streak: session.streak(),
    tracks,
    reviewDue: session.reviewDue().length,
    placement: session.needsPlacement() && (await runtime.storage.getPlacement()) !== null,
    sync,
  };
}
