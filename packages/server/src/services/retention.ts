import type { LearnerDataRepo, RecordingRepo, RecordingStorage } from '../ports.js';
import { recordingPath } from './recordings.js';

/** A signed upload URL lives 2 hours; two days covers any upload racing a deletion. */
const DAY_MS = 86_400_000;
const SWEEP_DELETED_MS = 2 * DAY_MS;
/** Old rate-limit windows are only counters; a day is far past the longest window. */
const RATE_WINDOW_KEEP_SECONDS = 86_400;

export interface RetentionDeps {
  data: Pick<LearnerDataRepo, 'deletedSince'>;
  recordings: RecordingRepo;
  storage: RecordingStorage;
  limiter: { prune(olderThanSeconds: number): Promise<number> };
}

/**
 * The nightly clean-up (privacy rule, retention table): recordings 30 days after mentor review,
 * unreviewed ones 90 days after upload, abandoned uploads after 7 days. Files go first, so a
 * failure never leaves a file whose row is gone. Safe to run again.
 */
export async function runRetention(
  deps: RetentionDeps,
  now: Date,
): Promise<{ recordings: number; rateWindows: number }> {
  const due = await deps.recordings.due(now);
  await deps.storage.remove(due.map((r) => recordingPath(r.learnerId, r.id)));
  await deps.recordings.delete(due.map((r) => r.id));
  for (const id of await deps.data.deletedSince(new Date(now.getTime() - SWEEP_DELETED_MS))) {
    await deps.storage.removePrefix(id); // a late upload by a student deleted on request
  }
  const rateWindows = await deps.limiter.prune(RATE_WINDOW_KEEP_SECONDS);
  return { recordings: due.length, rateWindows };
}
