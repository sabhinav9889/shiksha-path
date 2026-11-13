import {
  MY_RECORDINGS_CAP,
  type MyRecordingsResponse,
  type MyRecordingUrlResponse,
} from '@shiksha/api-contract';
import type { LearnerRepo, RateLimiter, RecordingRepo, RecordingStorage } from '../ports.js';
import { callerLearner } from './caller.js';
import { ApiFailure } from './failure.js';
import { enforce } from './limits.js';
import { recordingPath } from './recordings.js';

export interface MyRecordingsDeps {
  learners: LearnerRepo;
  limiter: RateLimiter;
  recordings: RecordingRepo;
  storage: RecordingStorage;
}

const PLAY_SECONDS = 300;

/**
 * The student's own uploaded recordings, newest first, with the mentor's review when there is one.
 * Which mentor reviewed it is never sent. Only rows of the caller are read, so a classmate's
 * recordings and comments can never appear here.
 */
export async function myRecordings(
  deps: MyRecordingsDeps,
  authUserId: string,
): Promise<MyRecordingsResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  const rows = (await deps.recordings.listByLearner(learner.id))
    .filter((r) => r.status === 'uploaded')
    .sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt))
    .slice(0, MY_RECORDINGS_CAP);
  return {
    recordings: rows.map((r) => ({
      id: r.id,
      lessonId: r.lessonId,
      itemId: r.itemId,
      durationMs: r.durationMs,
      recordedAt: r.recordedAt,
      reviewedAt: r.reviewedAt,
      comment: r.comment,
    })),
  };
}

/**
 * A 5-minute link to play the student's own uploaded recording. Someone else's recording and an
 * unknown id answer the same, so a student cannot probe for other students' ids.
 */
export async function myRecordingUrl(
  deps: MyRecordingsDeps,
  authUserId: string,
  id: string,
): Promise<MyRecordingUrlResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  await enforce(deps.limiter, 'playback', `playback:${learner.id}`);
  const row = await deps.recordings.get(id);
  if (!row || row.learnerId !== learner.id) throw new ApiFailure('FORBIDDEN');
  if (row.status !== 'uploaded') throw new ApiFailure('INVALID_REQUEST');
  return { url: await deps.storage.signDownload(recordingPath(learner.id, id), PLAY_SECONDS) };
}
