import type { LinkRequest, LinkResponse } from '@shiksha/api-contract';
import { LinkConflict, type LearnerRepo } from '../ports.js';
import { ApiFailure } from './failure.js';

/**
 * Link a Google identity to a learner. An identity that already has a learner gets it back (a new
 * phone); otherwise the phone's profile id becomes the learner id, unless someone already has it.
 */
async function linkOnce(
  deps: { learners: LearnerRepo },
  authUserId: string,
  request: LinkRequest,
): Promise<LinkResponse> {
  const existing = await deps.learners.findByAuthUser(authUserId);
  if (existing) return { learnerId: existing.id, name: existing.name, created: false };
  if (await deps.learners.findById(request.profileId)) throw new ApiFailure('PROFILE_TAKEN');
  await deps.learners.createLinked({ id: request.profileId, name: request.name, authUserId });
  return { learnerId: request.profileId, name: request.name, created: true };
}

/** Link the caller to a learner. A request racing another for the same rows re-reads once. */
export async function linkLearner(
  deps: { learners: LearnerRepo },
  authUserId: string,
  request: LinkRequest,
): Promise<LinkResponse> {
  try {
    return await linkOnce(deps, authUserId, request);
  } catch (error) {
    if (!(error instanceof LinkConflict)) throw error;
    return linkOnce(deps, authUserId, request);
  }
}
