import type { UnreviewedRecordings } from '@shiksha/api-contract/staff';
import type { AuditRepo, OrgRepo, RecordingRepo, RecordingStorage } from '../ports.js';
import { withAudit } from './audit.js';
import { ApiFailure } from './failure.js';
import { recordingPath } from './recordings.js';
import { inScope, type StaffCaller } from './staff.js';

export interface ReviewDeps {
  org: OrgRepo;
  recordings: RecordingRepo;
  storage: RecordingStorage;
  audit: AuditRepo;
}

const DOWNLOAD_SECONDS = 300;
export const MAX_COMMENT = 280;

/** The caller's cohorts' recordings waiting for a mentor, oldest first. */
export async function listUnreviewed(
  deps: ReviewDeps,
  staff: StaffCaller,
): Promise<UnreviewedRecordings> {
  const scope = staff.role === 'admin' ? 'all' : staff.cohortIds;
  const students = await deps.org.students(scope);
  const names = new Map(students.map((s) => [s.id, s.name]));
  const rows = await deps.recordings.unreviewed(staff.role === 'admin' ? 'all' : [...names.keys()]);
  return {
    recordings: rows.map((r) => ({
      id: r.id,
      learnerId: r.learnerId,
      learnerName: names.get(r.learnerId) ?? '',
      lessonId: r.lessonId,
      itemId: r.itemId,
      durationMs: r.durationMs,
      uploadedAt: r.uploadedAt ?? r.recordedAt,
    })),
  };
}

/** A recording in scope, or FORBIDDEN (unknown and out of scope answer the same). */
async function scopedRecording(deps: ReviewDeps, staff: StaffCaller, id: string) {
  const row = await deps.recordings.get(id);
  if (!row) throw new ApiFailure('FORBIDDEN');
  await inScope(deps, staff, row.learnerId);
  return row;
}

/** A 5-minute link to play an uploaded recording. */
export async function recordingUrl(
  deps: ReviewDeps,
  staff: StaffCaller,
  id: string,
): Promise<{ url: string }> {
  const row = await scopedRecording(deps, staff, id);
  if (row.status !== 'uploaded') throw new ApiFailure('INVALID_REQUEST');
  return {
    url: await deps.storage.signDownload(recordingPath(row.learnerId, id), DOWNLOAD_SECONDS),
  };
}

/** Mark a recording reviewed, with an optional short comment. The comment is never logged. */
export async function reviewRecording(
  deps: ReviewDeps,
  staff: StaffCaller,
  input: { id: string; comment?: string | undefined },
): Promise<{ reviewedAt: string }> {
  const comment = input.comment?.trim() || null;
  if (comment && comment.length > MAX_COMMENT) throw new ApiFailure('INVALID_REQUEST');
  const row = await scopedRecording(deps, staff, input.id);
  if (row.status !== 'uploaded') throw new ApiFailure('INVALID_REQUEST');
  const record = {
    staff,
    action: 'recording_reviewed' as const,
    learnerId: row.learnerId,
    details: { recordingId: row.id },
  };
  const reviewedAt = await withAudit(deps, record, () =>
    deps.recordings.review(row.id, staff.staffId, comment, new Date()),
  );
  return { reviewedAt };
}
