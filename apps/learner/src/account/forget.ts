import type { Runtime } from '../runtime/runtime.js';

/** Set when a profile was wiped because the NGO deleted it; the picker says so once. */
export const WIPED_NOTICE = 'wipedNotice';

/**
 * Remove a profile from this phone: its record, events, recordings, settings and sign-in
 * session. The server keeps its copy (a restore brings it back) unless the NGO deleted it.
 */
export async function wipeProfile(runtime: Runtime, profileId: string): Promise<void> {
  await runtime.profiles.delete(profileId);
  await runtime.removeLearnerEvents(profileId);
  await runtime.recordings.removeLearner(profileId);
  await runtime.removeLearnerMeta(profileId);
  try {
    const auth = await runtime.account?.loadAuth();
    await auth?.signOutGoogle(profileId);
  } catch {
    // the sign-in code could not load (offline): the stored session stays, unreachable without
    // the profile, until the next sign-in code load
  }
}

/** The NGO deleted this student on request (privacy rule): wipe the phone's copy too. */
export async function wipeDeleted(runtime: Runtime, profileId: string): Promise<void> {
  await wipeProfile(runtime, profileId);
  await runtime.events.setMeta(WIPED_NOTICE, '1');
}

/** True once after a wipe-on-deletion, so the picker can say so a single time. */
export async function takeWipedNotice(runtime: Runtime): Promise<boolean> {
  if ((await runtime.events.getMeta(WIPED_NOTICE)) !== '1') return false;
  await runtime.events.setMeta(WIPED_NOTICE, '');
  return true;
}
