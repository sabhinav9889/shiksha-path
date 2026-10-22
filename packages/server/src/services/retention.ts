import type { RecordingRepo, RecordingStorage } from '../ports.js';
import { recordingPath } from './recordings.js';

/** Old rate-limit windows are only counters; a day is far past the longest window. */
const RATE_WINDOW_KEEP_SECONDS = 86_400;

export interface RetentionDeps {
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
  const rateWindows = await deps.limiter.prune(RATE_WINDOW_KEEP_SECONDS);
  return { recordings: due.length, rateWindows };
}
