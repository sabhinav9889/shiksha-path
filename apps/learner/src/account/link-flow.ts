import type { ApiError } from '@shiksha/api-contract';
import type { Runtime } from '../runtime/runtime.js';
import { apiFor, setLinked } from './account.js';
import { adopt } from './restore-flow.js';

export type LinkOutcome =
  | { kind: 'linked' }
  | { kind: 'adopted'; learnerId: string }
  | { kind: 'elsewhere' }
  | { kind: 'failed'; error: ApiError | 'OFFLINE' };

/** Only the first language choice: a profile like this has not learned anything yet. */
const hasLearning = async (runtime: Runtime, profileId: string): Promise<boolean> =>
  (await runtime.events.all(profileId)).some((e) => e.type !== 'language_changed');

/**
 * After Google sign-in, link the phone's profile. If this Google account already has a learner, a
 * fresh profile takes it over; one with its own learning is left alone (never merge two learners).
 */
export async function linkProfile(runtime: Runtime, profileId: string): Promise<LinkOutcome> {
  const profile = await runtime.profiles.get(profileId);
  const api = await apiFor(runtime, profileId);
  if (!profile || !api) return { kind: 'failed', error: 'INTERNAL' };
  const result = await api.link({ profileId, name: profile.name });
  if (!result.ok) return { kind: 'failed', error: result.error };
  if (result.value.learnerId === profileId) {
    await setLinked(runtime, profileId);
    return { kind: 'linked' };
  }
  if (await hasLearning(runtime, profileId)) {
    const auth = await runtime.account?.loadAuth();
    await auth?.signOutGoogle(profileId);
    return { kind: 'elsewhere' };
  }
  await adopt(runtime, profile, { id: result.value.learnerId, name: result.value.name });
  return { kind: 'adopted', learnerId: result.value.learnerId };
}
