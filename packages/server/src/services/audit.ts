import type { AuditDetails, AuditEntry, AuditRepo } from '../ports.js';
import { ApiFailure } from './failure.js';
import type { StaffCaller } from './staff.js';

export type AuditAction =
  | 'code_issued'
  | 'code_reset'
  | 'level_set'
  | 'attendance_marked'
  | 'recording_reviewed'
  | 'student_edited'
  | 'student_moved'
  | 'student_deactivated'
  | 'student_reactivated'
  | 'student_deleted'
  | 'switch_changed'
  | 'override_changed'
  | 'branding_changed'
  | 'cohort_saved'
  | 'lab_saved'
  | 'cohort_deleted'
  | 'lab_deleted'
  | 'staff_invited'
  | 'staff_changed'
  | 'staff_deleted'
  | 'post_created'
  | 'post_edited'
  | 'post_deleted';

/** Never in the log: a code, a token, or what a mentor wrote (privacy rule). */
const FORBIDDEN_KEYS = new Set(['code', 'token', 'comment']);

/**
 * Do `work` and, only if it succeeds, record who did what to whom. `details` hold ids, keys and
 * old → new values; a key that could carry a secret or free text is refused outright.
 */
export interface AuditRecord {
  staff: StaffCaller;
  action: AuditAction;
  learnerId: string | null;
  details: AuditDetails;
}

export async function withAudit<T>(
  deps: { audit: AuditRepo },
  record: AuditRecord,
  work: () => Promise<T>,
): Promise<T> {
  const bad = Object.keys(record.details).find((key) => FORBIDDEN_KEYS.has(key));
  if (bad) throw new Error(`audit details may not include "${bad}"`);
  const result = await work();
  const { staff, action, learnerId, details } = record;
  await deps.audit.add({ staffId: staff.staffId, action, learnerId, details });
  return result;
}

const MAX_PAGE = 100;

/** The log for admins, newest first. `next` continues it; null when there is no more. */
export async function listAudit(
  deps: { audit: AuditRepo },
  staff: StaffCaller,
  before: number | null,
  limit: number,
): Promise<{ entries: AuditEntry[]; next: number | null }> {
  if (staff.role !== 'admin') throw new ApiFailure('FORBIDDEN');
  const size = Math.min(Math.max(limit, 1), MAX_PAGE);
  const entries = await deps.audit.page(before, size);
  return { entries, next: entries.length === size ? (entries.at(-1)?.id ?? null) : null };
}
