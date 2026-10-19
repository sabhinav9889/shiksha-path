import { summarize, type QuizEntry } from '@shiksha/learner-core';
import type { RecordingResult } from '../../audio/recorder.js';
import { activity } from '../../activity.svelte.js';
import { appState } from '../../app-state.svelte.js';
import { navigate } from '../../router.svelte.js';

/**
 * Close the run the learner just finished: record the completion (lessons and test-outs), keep
 * the numbers for the finish screen, move there, and ask for an upload without waiting for it.
 */
export async function finishActivity(): Promise<void> {
  const { session, runtime, profile } = appState;
  const current = activity.current;
  if (!session || !runtime || !profile || !current) return;
  const summary = summarize(current.run.answered);
  const testOut =
    current.kind === 'test_out'
      ? await session.finishTestOut(current.moduleId, current.run)
      : undefined;
  if (current.kind === 'lesson') await session.finishLesson(current.run);
  activity.finish = {
    kind: current.kind,
    summary,
    streak: session.streak(),
    ...(testOut ? { testOut } : {}),
    ...(current.kind === 'lesson' ? { lessonTitle: current.lesson.title } : {}),
  };
  navigate({ name: 'finish' });
  void runtime.flush(profile.id); // saved on the phone already; uploading may take a while
}

/** Where a recording belongs: the lesson for lesson and review items, otherwise the quiz. */
function recordingKey(source: QuizEntry['source']): string {
  if (source.kind === 'lesson' || source.kind === 'review') return source.lessonId;
  return source.kind === 'test_out' ? `test-out:${source.moduleId}` : `placement:${source.track}`;
}

/** Keep a speaking recording on the phone for the signed-in learner (spec §7.1). */
export async function saveRecording(entry: QuizEntry, result: RecordingResult): Promise<void> {
  const { runtime, profile } = appState;
  if (!runtime || !profile) throw new Error('nobody is signed in');
  await runtime.recordings.put({
    id: runtime.ids.uuid(),
    learnerId: profile.id,
    lessonId: recordingKey(entry.source),
    itemId: entry.item.id,
    mime: result.mime,
    bytes: result.bytes,
    durationMs: result.durationMs,
    at: runtime.clock.now().toISOString(),
  });
}
