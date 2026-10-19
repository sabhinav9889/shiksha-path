import type { Localized } from '@shiksha/content/schema';
import {
  isLessonDone,
  isModulePlayable,
  isModuleReady,
  missingAudio,
  type LearnerSession,
} from '@shiksha/learner-core';
import type { Runtime } from '../../runtime/runtime.js';

/** ready: up to date with all audio · playable: usable but outdated or short of audio ·
 * missing: nothing usable on the phone · removed: the learner freed the space. */
export type ModuleState = 'ready' | 'playable' | 'missing' | 'removed';

export interface LessonRow {
  id: string;
  title: Localized;
  status: 'done' | 'today' | 'open';
}

export interface ModuleView {
  id: string;
  title: Localized;
  track: string;
  state: ModuleState;
  audioMissing: boolean;
  lessons: LessonRow[];
  done: number;
  testOut: 'none' | 'available' | 'passed';
}

export interface LessonsData {
  tracks: { id: string; title: Localized }[];
  modules: ModuleView[];
}

/** How a module stands on this phone (also used by the "me" screen). */
export async function stateOf(
  runtime: Runtime,
  id: string,
  manifest: Parameters<typeof isModuleReady>[1],
): Promise<ModuleState> {
  if (await isModuleReady(id, manifest, runtime.storage)) return 'ready';
  if (await isModulePlayable(id, runtime.storage)) return 'playable';
  return (await runtime.prefs.removedModules()).has(id)
    ? ('removed' as const)
    : ('missing' as const);
}

type Manifest = NonNullable<Awaited<ReturnType<Runtime['storage']['getManifest']>>>;

function rowsOf(
  entry: Manifest['modules'][number],
  manifest: Manifest,
  session: LearnerSession | null,
): LessonRow[] {
  const progress = session?.progress;
  const today = session?.todayLesson()?.lessonId;
  return entry.lessons.map((lesson) => {
    const done = progress !== undefined && isLessonDone(manifest, progress, lesson.id);
    const status = done ? 'done' : lesson.id === today ? 'today' : 'open';
    return { id: lesson.id, title: lesson.title, status };
  });
}

function testOutOf(hasTestOut: boolean, passed: boolean): ModuleView['testOut'] {
  if (!hasTestOut) return 'none';
  return passed ? 'passed' : 'available';
}

/** What the lessons screen shows, gathered once (the session itself is not reactive). */
export async function loadLessons(
  runtime: Runtime,
  session: LearnerSession | null,
): Promise<LessonsData> {
  const manifest = await runtime.storage.getManifest();
  if (!manifest) return { tracks: [], modules: [] };
  const modules: ModuleView[] = [];
  for (const entry of [...manifest.modules].sort((a, b) => a.order - b.order)) {
    const stored = await runtime.storage.getModule(entry.id);
    const lessons = rowsOf(entry, manifest, session);
    modules.push({
      id: entry.id,
      title: entry.title,
      track: entry.track,
      state: await stateOf(runtime, entry.id, manifest),
      audioMissing: stored !== null && (await missingAudio(entry.id, runtime.storage)).length > 0,
      lessons,
      done: lessons.filter((l) => l.status === 'done').length,
      testOut: testOutOf(
        stored?.bundle.test_out != null,
        session?.progress.testedOutModules.has(entry.id) ?? false,
      ),
    });
  }
  const tracks = [...manifest.tracks].sort((a, b) => a.order - b.order);
  return { tracks: tracks.map((t) => ({ id: t.id, title: t.title })), modules };
}
