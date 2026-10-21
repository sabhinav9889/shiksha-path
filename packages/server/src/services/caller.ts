import type { LearnerRepo, LearnerRow } from '../ports.js';
import { ApiFailure } from './failure.js';

/** The learner linked to the verified identity, or `NOT_LINKED`. */
export async function callerLearner(
  learners: LearnerRepo,
  authUserId: string,
): Promise<LearnerRow> {
  const learner = await learners.findByAuthUser(authUserId);
  if (!learner) throw new ApiFailure('NOT_LINKED');
  return learner;
}
