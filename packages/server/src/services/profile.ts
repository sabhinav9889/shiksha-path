import type { ProfileResponse } from '@shiksha/api-contract';
import type { Caller, LearnerRepo, OrgRepo, StaffRepo } from '../ports.js';
import { callerLearner } from './caller.js';

export interface ProfileDeps {
  learners: LearnerRepo;
  org: OrgRepo;
  staff: StaffRepo;
}

/**
 * The signed-in student's own email, current cohort and that cohort's active mentors. Only their
 * own: the cohort comes from their own row, and a student with no cohort sees no mentors. The
 * email is the caller's own, given back to them and never stored or logged.
 */
export async function getProfile(deps: ProfileDeps, who: Caller): Promise<ProfileResponse> {
  const learner = await callerLearner(deps.learners, who.authUserId);
  const email = who.provider === 'google' ? who.email : null;
  const cohortId = (await deps.org.cohortOfLearner(learner.id)) ?? null;
  if (!cohortId) return { email, cohort: null, mentors: [] };
  const [cohort] = await deps.org.cohorts([cohortId]);
  const mentors = (await deps.staff.list())
    .filter((s) => s.role === 'mentor' && s.active && s.cohortIds.includes(cohortId))
    .map(({ name, email: workEmail }) => ({ name, email: workEmail }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return { email, cohort: cohort ? { id: cohort.id, name: cohort.name } : null, mentors };
}
