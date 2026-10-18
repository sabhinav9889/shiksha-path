import { summarize } from '@shiksha/learner-core';
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
