import { FEATURE_KEYS, type FeatureKey, type MeResponse } from '@shiksha/api-contract';
import type { LearnerRepo, SwitchRepo } from '../ports.js';
import { callerLearner } from './caller.js';

/** Only the known feature keys, in a fixed order. */
export function knownSwitches(
  values: Record<string, boolean>,
): Partial<Record<FeatureKey, boolean>> {
  return Object.fromEntries(
    FEATURE_KEYS.filter((key) => values[key] !== undefined).map((key) => [key, values[key]]),
  );
}

/** Every feature switch for a learner: the individual override wins, a missing switch is on. */
export async function effectiveSwitches(
  switches: SwitchRepo,
  learnerId: string,
): Promise<Record<FeatureKey, boolean>> {
  const [all, overrides] = await Promise.all([
    switches.allStudents(),
    switches.overrides(learnerId),
  ]);
  return Object.fromEntries(
    FEATURE_KEYS.map((key) => [key, overrides[key] ?? all[key] ?? true]),
  ) as Record<FeatureKey, boolean>;
}

/** The learner and every feature switch. */
export async function getMe(
  deps: { learners: LearnerRepo; switches: SwitchRepo },
  authUserId: string,
): Promise<MeResponse> {
  const learner = await callerLearner(deps.learners, authUserId);
  const switches = await effectiveSwitches(deps.switches, learner.id);
  return { learner: { id: learner.id, name: learner.name }, switches };
}
