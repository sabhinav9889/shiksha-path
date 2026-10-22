import { addDays, createEvent, cryptoIds, istDay, systemClock } from '@shiksha/learner-core';
import type { AttendanceRepo, AuditRepo, EventRepo, OrgRepo, SummaryRepo } from '../ports.js';
import { withAudit } from './audit.js';
import { issueCode, resetCode, type CodeDeps } from './codes.js';
import { ApiFailure } from './failure.js';
import { inScope, type StaffCaller } from './staff.js';
import { refreshSummary } from './sync.js';

export interface MentorActionDeps extends CodeDeps {
  org: OrgRepo;
  audit: AuditRepo;
  events: EventRepo;
  summaries: SummaryRepo;
  attendance: AttendanceRepo;
}

/** A cohort the caller works with (any cohort for an admin), or FORBIDDEN. */
function ownCohort(staff: StaffCaller, cohortId: string): void {
  if (staff.role !== 'admin' && !staff.cohortIds.includes(cohortId)) {
    throw new ApiFailure('FORBIDDEN');
  }
}

/**
 * A backup code (spec §5.3): for a student already in scope, or for a new student placed in one
 * of the caller's cohorts. The code is returned once and never logged.
 */
export async function issueStudentCode(
  deps: MentorActionDeps,
  staff: StaffCaller,
  input: { learnerId: string } | { name: string; cohortId: string },
): Promise<{ learnerId: string; code: string }> {
  if ('learnerId' in input) await inScope(deps, staff, input.learnerId);
  else ownCohort(staff, input.cohortId);
  const target = 'learnerId' in input ? input.learnerId : null;
  const record = { staff, action: 'code_issued' as const, learnerId: target, details: {} };
  return withAudit(deps, record, async () => {
    const out = await issueCode(deps, 'learnerId' in input ? input : { name: input.name });
    if ('cohortId' in input) await deps.org.setLearnerCohort(out.learnerId, input.cohortId);
    return out;
  });
}

export async function resetStudentCode(
  deps: MentorActionDeps,
  staff: StaffCaller,
  input: { learnerId: string },
): Promise<{ code: string }> {
  await inScope(deps, staff, input.learnerId);
  const record = { staff, action: 'code_reset' as const, learnerId: input.learnerId, details: {} };
  return withAudit(deps, record, () => resetCode(deps, input.learnerId));
}

/** A mentor's level decision, as a server-written level_set event the phone pulls. */
export async function setLevel(
  deps: MentorActionDeps,
  staff: StaffCaller,
  input: { learnerId: string; track: string; startLesson: string },
): Promise<{ eventId: string }> {
  await inScope(deps, staff, input.learnerId);
  const { track, startLesson } = input;
  const event = createEvent({ clock: systemClock, ids: cryptoIds }, input.learnerId, 'level_set', {
    track,
    startLesson,
  });
  const record = {
    staff,
    action: 'level_set' as const,
    learnerId: input.learnerId,
    details: { track, startLesson },
  };
  await withAudit(deps, record, () => deps.events.insertMany(input.learnerId, [event]));
  await refreshSummary(deps, input.learnerId);
  return { eventId: event.id };
}

/**
 * Mark a lab day for a whole cohort: listed learners present, the rest absent. Marking again
 * replaces that day. A future day or a learner outside the cohort writes nothing.
 */
export async function markAttendance(
  deps: MentorActionDeps,
  staff: StaffCaller,
  input: { cohortId: string; day: string; present: string[] },
): Promise<{ marked: number }> {
  ownCohort(staff, input.cohortId);
  if (input.day > istDay(new Date())) throw new ApiFailure('INVALID_REQUEST');
  const members = (await deps.org.students([input.cohortId])).map((s) => s.id);
  if (input.present.some((id) => !members.includes(id))) throw new ApiFailure('FORBIDDEN');
  const record = {
    staff,
    action: 'attendance_marked' as const,
    learnerId: null,
    details: { cohortId: input.cohortId, day: input.day, present: input.present.length },
  };
  const marked = await withAudit(deps, record, () =>
    deps.attendance.markDay({
      learnerIds: members,
      present: new Set(input.present),
      day: input.day,
      staffId: staff.staffId,
    }),
  );
  return { marked };
}

const ATTENDANCE_DAYS = 30;

/** The first IST day of the attendance window a student detail shows. */
export const attendanceFrom = (): string => addDays(istDay(new Date()), -ATTENDANCE_DAYS);
