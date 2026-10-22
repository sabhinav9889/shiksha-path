import type { Caller, LearnerRepo, OrgRepo, StaffRepo, StaffRole } from '../ports.js';
import { ApiFailure } from './failure.js';

/** A verified staff member: role and cohorts come from the database, never from a request. */
export interface StaffCaller {
  staffId: string;
  role: StaffRole;
  cohortIds: string[];
}

const toCaller = (row: { id: string; role: StaffRole; cohortIds: string[] }): StaffCaller => ({
  staffId: row.id,
  role: row.role,
  cohortIds: [...row.cohortIds].sort(),
});

/** The caller as staff, or `NOT_STAFF` (no claimed, active staff row for this sign-in). */
export async function staffCaller(
  deps: { staff: StaffRepo },
  caller: Caller,
): Promise<StaffCaller> {
  const row = await deps.staff.byAuthUser(caller.authUserId);
  if (!row?.active) throw new ApiFailure('NOT_STAFF');
  return toCaller(row);
}

/**
 * Claim a staff invite: a Google sign-in whose email matches an unclaimed, active invite (any
 * letter case). A learner's account can never become staff.
 */
export async function claimStaff(
  deps: { staff: StaffRepo; learners: LearnerRepo },
  caller: Caller,
): Promise<StaffCaller> {
  const existing = await deps.staff.byAuthUser(caller.authUserId);
  if (existing?.active) return toCaller(existing);
  if (caller.provider !== 'google' || !caller.email) throw new ApiFailure('NOT_STAFF');
  if (await deps.learners.findByAuthUser(caller.authUserId)) throw new ApiFailure('FORBIDDEN');
  const invite = await deps.staff.byEmail(caller.email);
  if (!invite?.active || invite.authUserId) throw new ApiFailure('NOT_STAFF');
  if (!(await deps.staff.claim(invite.id, caller.authUserId))) throw new ApiFailure('NOT_STAFF');
  return toCaller(invite);
}

/**
 * A mentor reaches learners in their cohorts only; an admin reaches everyone. A learner out of
 * scope and one that does not exist answer the same, so ids cannot be probed.
 */
export async function inScope(
  deps: { org: OrgRepo },
  staff: StaffCaller,
  learnerId: string,
): Promise<void> {
  const cohort = await deps.org.cohortOfLearner(learnerId);
  if (cohort === undefined) throw new ApiFailure('FORBIDDEN');
  if (staff.role === 'admin') return;
  if (!cohort || !staff.cohortIds.includes(cohort)) throw new ApiFailure('FORBIDDEN');
}

/** The staff member's own details for the staff screens. */
export async function getStaffMe(
  deps: { staff: StaffRepo; org: OrgRepo },
  staff: StaffCaller,
): Promise<{ role: StaffRole; name: string; cohorts: { id: string; name: string }[] }> {
  const row = await deps.staff.byId(staff.staffId);
  const cohorts = await deps.org.cohorts(staff.role === 'admin' ? 'all' : staff.cohortIds);
  return {
    role: staff.role,
    name: row?.name ?? '',
    cohorts: cohorts.map(({ id, name }) => ({ id, name })),
  };
}
