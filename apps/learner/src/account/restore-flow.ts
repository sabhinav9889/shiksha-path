import { createProfile, parseEvents, type Profile } from '@shiksha/learner-core';
import type { ApiClient } from '../api/api-client.js';
import type { Runtime } from '../runtime/runtime.js';
import { apiFor, setLinked } from './account.js';

const cursorKey = (learnerId: string): string => `pullCursor:${learnerId}`;
const restoringKey = (profileId: string): string => `restoring:${profileId}`;
/** Never shown: provisional profiles are hidden on the picker until the restore finishes. */
const PROVISIONAL_NAME = 'restoring';

/** Pull the learner's events newer than the stored cursor and keep them as already uploaded. */
export async function restoreEvents(
  runtime: Runtime,
  api: ApiClient | null,
  learnerId: string,
): Promise<{ pulled: number }> {
  if (!api) return { pulled: 0 };
  let after = Number((await runtime.events.getMeta(cursorKey(learnerId))) ?? 0) || 0;
  let pulled = 0;
  for (;;) {
    const page = await api.pull({ after });
    if (!page.ok) return { pulled };
    const events = parseEvents(page.value.events).events.filter((e) => e.learnerId === learnerId);
    await runtime.appendSent(events);
    pulled += events.length;
    after = page.value.cursor;
    await runtime.events.setMeta(cursorKey(learnerId), String(after));
    if (page.value.next === null) return { pulled };
  }
}

/** Remove a profile from this phone: its record, events and sign-in session. */
export async function forgetProfile(runtime: Runtime, profileId: string): Promise<void> {
  await runtime.profiles.delete(profileId);
  await runtime.removeLearnerEvents(profileId);
  await runtime.events.setMeta(restoringKey(profileId), '');
  const auth = await runtime.account?.loadAuth();
  await auth?.signOutGoogle(profileId);
}

/**
 * Make this phone's profile the server's learner: same PIN, the server's id and name, the Google
 * session moved over, then the learner's events pulled. The old local profile is removed.
 */
export async function adopt(
  runtime: Runtime,
  from: Profile,
  learner: { id: string; name: string },
): Promise<void> {
  if (from.id !== learner.id) {
    const reset = {
      ...from,
      id: learner.id,
      name: learner.name,
      failedAttempts: 0,
      lockedUntil: null,
    };
    await runtime.profiles.put(reset);
    const auth = await runtime.account?.loadAuth();
    await auth?.moveSession(from.id, learner.id);
    await runtime.profiles.delete(from.id);
    await runtime.removeLearnerEvents(from.id);
    await runtime.events.setMeta(restoringKey(from.id), '');
  }
  await setLinked(runtime, learner.id);
  await restoreEvents(runtime, await apiFor(runtime, learner.id), learner.id);
}

export async function isRestoring(runtime: Runtime, profileId: string): Promise<boolean> {
  return (await runtime.events.getMeta(restoringKey(profileId))) === '1';
}

/** Begin restoring on this phone: a hidden profile holds the new PIN while Google signs in. */
export async function startRestore(runtime: Runtime, pin: string): Promise<string> {
  for (const old of await runtime.profiles.list()) {
    if (await isRestoring(runtime, old.id)) await forgetProfile(runtime, old.id);
  }
  const profile = await createProfile(
    { name: PROVISIONAL_NAME, pin },
    { store: runtime.profiles, ids: runtime.ids, clock: runtime.clock },
  );
  await runtime.events.setMeta(restoringKey(profile.id), '1');
  const auth = await runtime.account?.loadAuth();
  await auth?.startGoogleSignIn(profile.id);
  return profile.id;
}

export type RestoreOutcome =
  { kind: 'restored'; learnerId: string } | { kind: 'none' } | { kind: 'failed' };

/** After Google sign-in: find this account's learner and bring it to the phone. */
export async function completeRestore(
  runtime: Runtime,
  provisionalId: string,
): Promise<RestoreOutcome> {
  const profile = await runtime.profiles.get(provisionalId);
  const api = await apiFor(runtime, provisionalId);
  if (!profile || !api) return { kind: 'failed' };
  const me = await api.me();
  if (!me.ok && me.error === 'NOT_LINKED') {
    await forgetProfile(runtime, provisionalId);
    return { kind: 'none' };
  }
  if (!me.ok) return { kind: 'failed' };
  await adopt(runtime, profile, me.value.learner);
  return { kind: 'restored', learnerId: me.value.learner.id };
}
