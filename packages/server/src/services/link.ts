import type { LinkRequest, LinkResponse } from '@shiksha/api-contract';
import {
  LinkConflict,
  type Caller,
  type LearnerDataRepo,
  type LearnerRepo,
  type RateLimiter,
} from '../ports.js';
import { enforce } from './limits.js';
import { ApiFailure } from './failure.js';

/**
 * Link a Google identity to a learner. An identity that already has a learner gets it back (a new
 * phone); otherwise the phone's profile id becomes the learner id, unless someone already has it.
 */
/** Only a Google sign-in makes a new learner; email identities are the server's own codes. */
const MAY_CREATE = 'google';

async function linkOnce(
  deps: { learners: LearnerRepo; data: LearnerDataRepo },
  { authUserId, provider }: Caller,
  request: LinkRequest,
): Promise<LinkResponse> {
  const existing = await deps.learners.findByAuthUser(authUserId);
  if (existing) return { learnerId: existing.id, name: existing.name, created: false };
  if (provider !== MAY_CREATE) throw new ApiFailure('FORBIDDEN');
  // A student deleted on request stays deleted: their old id is never made a learner again.
  if ((await deps.data.deleted([request.profileId])).length > 0) throw new ApiFailure('FORBIDDEN');
  if (await deps.learners.findById(request.profileId)) throw new ApiFailure('PROFILE_TAKEN');
  await deps.learners.createLinked({ id: request.profileId, name: request.name, authUserId });
  return { learnerId: request.profileId, name: request.name, created: true };
}

/** Link the caller to a learner. A request racing another for the same rows re-reads once. */
export async function linkLearner(
  deps: { learners: LearnerRepo; limiter: RateLimiter; data: LearnerDataRepo },
  who: Caller,
  request: LinkRequest,
): Promise<LinkResponse> {
  await enforce(deps.limiter, 'link', `link:${who.authUserId}`);
  try {
    return await linkOnce(deps, who, request);
  } catch (error) {
    if (!(error instanceof LinkConflict)) throw error;
    return linkOnce(deps, who, request);
  }
}
