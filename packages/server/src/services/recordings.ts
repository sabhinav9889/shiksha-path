import {
  MAX_RECORDING_BYTES,
  type RecordingComplete,
  type RecordingCompleteResponse,
  type RecordingStart,
  type RecordingStartResponse,
} from '@shiksha/api-contract';
import type {
  LearnerRepo,
  RateLimiter,
  RecordingRepo,
  RecordingStorage,
  SwitchRepo,
} from '../ports.js';
import { callerLearner } from './caller.js';
import { ApiFailure } from './failure.js';
import { enforce } from './limits.js';
import { effectiveSwitches } from './me.js';

export interface RecordingDeps {
  learners: LearnerRepo;
  switches: SwitchRepo;
  limiter: RateLimiter;
  recordings: RecordingRepo;
  storage: RecordingStorage;
}

/** Every learner's recordings live under their own id: `<learnerId>/<recordingId>`. */
export const recordingPath = (learnerId: string, id: string): string => `${learnerId}/${id}`;

/**
 * Record a recording's details and hand back a short-lived upload URL for the phone. The server
 * refuses when speaking practice is off for the learner (spec §8.1), and past the daily limit.
 */
export async function startRecording(
  deps: RecordingDeps,
  authUserId: string,
  body: RecordingStart,
): Promise<RecordingStartResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  if (!(await effectiveSwitches(deps.switches, learner.id)).speaking_practice) {
    throw new ApiFailure('FEATURE_OFF');
  }
  await enforce(deps.limiter, 'recording', `recording:${learner.id}`);
  const outcome = await deps.recordings.create({
    id: body.id,
    learnerId: learner.id,
    lessonId: body.lessonId,
    itemId: body.itemId,
    mime: body.mime,
    bytes: body.bytes,
    durationMs: body.durationMs,
    recordedAt: body.at,
  });
  if (outcome === 'ownedByOther') throw new ApiFailure('FORBIDDEN');
  if (outcome === 'exists' && (await deps.recordings.get(body.id))?.status === 'uploaded') {
    return { uploadUrl: null, token: null };
  }
  const { url, token } = await deps.storage.signUpload(recordingPath(learner.id, body.id));
  return { uploadUrl: url, token };
}

/** The phone says the upload finished: the object must be there, and within the size limit. */
export async function completeRecording(
  deps: RecordingDeps,
  authUserId: string,
  body: RecordingComplete,
): Promise<RecordingCompleteResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  const row = await deps.recordings.get(body.id);
  if (!row) throw new ApiFailure('INVALID_REQUEST');
  if (row.learnerId !== learner.id) throw new ApiFailure('FORBIDDEN');
  const size = await deps.storage.size(recordingPath(learner.id, body.id));
  if (size === null || size > MAX_RECORDING_BYTES) throw new ApiFailure('INVALID_REQUEST');
  if (row.status !== 'uploaded') await deps.recordings.markUploaded(body.id, new Date());
  return { status: 'uploaded' };
}
