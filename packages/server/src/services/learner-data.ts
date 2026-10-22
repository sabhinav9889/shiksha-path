import type { LearnerEvent } from '@shiksha/learner-core';
import type {
  CodeAuth,
  LearnerDataRepo,
  RateLimiter,
  RecordingRepo,
  RecordingRow,
  RecordingStorage,
} from '../ports.js';
import { ApiFailure } from './failure.js';
import { enforce } from './limits.js';
import { recordingPath } from './recordings.js';

export interface LearnerDataDeps {
  data: LearnerDataRepo;
  recordings: RecordingRepo;
  storage: RecordingStorage;
  auth: Pick<CodeAuth, 'deleteUser' | 'emailOf'>;
}

/** Everything the server holds about a student, in plain JSON (privacy rule: export). */
export interface LearnerExport {
  learner: { id: string; name: string; cohortId: string | null; createdAt: string };
  identities: { email: string | null }[];
  events: LearnerEvent[];
  overrides: Record<string, boolean>;
  recordings: Omit<RecordingRow, 'learnerId'>[];
}

export async function exportLearner(
  deps: LearnerDataDeps,
  learnerId: string,
): Promise<{ data: LearnerExport; recordings: { id: string; mime: string; bytes: Uint8Array }[] }> {
  const rows = await deps.data.rows(learnerId);
  if (!rows) throw new ApiFailure('INVALID_REQUEST');
  const recordingRows = await deps.recordings.listByLearner(learnerId);
  const identities = await Promise.all(
    rows.authUserIds.map(async (id) => ({ email: await deps.auth.emailOf(id) })),
  );
  const recordings = [];
  for (const row of recordingRows) {
    const bytes = await deps.storage.read(recordingPath(learnerId, row.id));
    if (bytes) recordings.push({ id: row.id, mime: row.mime, bytes });
  }
  const { learner, events, overrides } = rows;
  const listed = recordingRows.map((row) => {
    const copy: Partial<RecordingRow> = { ...row };
    delete copy.learnerId; // the export is about this learner already
    return copy as Omit<RecordingRow, 'learnerId'>;
  });
  return { data: { learner, identities, events, overrides, recordings: listed }, recordings };
}

/**
 * Delete a student on request: their recordings' files, their sign-ins (which removes the Google
 * email, name and avatar Supabase keeps), then every row in one transaction, leaving only a
 * tombstone id so their phones can wipe their copy. Each step can run again after a failure.
 */
export async function deleteLearner(
  deps: LearnerDataDeps,
  learnerId: string,
): Promise<{ events: number; recordings: number; authUsers: number }> {
  const rows = await deps.data.rows(learnerId);
  if (!rows) throw new ApiFailure('INVALID_REQUEST');
  const recordings = await deps.recordings.listByLearner(learnerId);
  await deps.storage.remove(recordings.map((r) => recordingPath(learnerId, r.id)));
  for (const id of rows.authUserIds) await deps.auth.deleteUser(id);
  const { events } = await deps.data.deleteWithTombstone(learnerId);
  return { events, recordings: recordings.length, authUsers: rows.authUserIds.length };
}

/**
 * Which of a phone's profiles were deleted on request (public: a deleted student has no sign-in
 * left). Only ever answers about the ids asked; limited per network.
 */
export async function checkDeleted(
  deps: { data: LearnerDataRepo; limiter: RateLimiter },
  learnerIds: string[],
  clientKey: string,
): Promise<{ deleted: string[] }> {
  await enforce(deps.limiter, 'deletedCheck', `deleted-check:ip:${clientKey}`);
  return { deleted: await deps.data.deleted(learnerIds) };
}
