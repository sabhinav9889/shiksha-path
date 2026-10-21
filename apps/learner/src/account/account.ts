import type { Profile } from '@shiksha/learner-core';
import type { ApiClient } from '../api/api-client.js';
import type { GoogleAuth } from '../api/auth.js';
import type { Runtime } from '../runtime/runtime.js';

/** How the app reaches Google sign-in and /v1. Null on a phone-only build (no Supabase set). */
export interface AccountDeps {
  loadAuth(): Promise<GoogleAuth>;
  makeApi(token: () => Promise<string | null>): ApiClient;
}

const linkedKey = (profileId: string): string => `linked:${profileId}`;

export async function isLinked(runtime: Runtime, profileId: string): Promise<boolean> {
  return (await runtime.events.getMeta(linkedKey(profileId))) === '1';
}

export async function setLinked(runtime: Runtime, profileId: string): Promise<void> {
  await runtime.events.setMeta(linkedKey(profileId), '1');
}

/** The /v1 client acting as this profile's Google sign-in, or null when there is no backend. */
export async function apiFor(runtime: Runtime, profileId: string): Promise<ApiClient | null> {
  if (!runtime.account) return null;
  const auth = await runtime.account.loadAuth();
  return runtime.account.makeApi(() => auth.accessToken(profileId));
}

/** Start Google sign-in for a profile; the browser leaves and comes back to the callback page. */
export async function startLinking(runtime: Runtime, profileId: string): Promise<void> {
  const auth = await runtime.account?.loadAuth();
  await auth?.startGoogleSignIn(profileId);
}

/** The phone's profiles, without restores that were started and never finished. */
export async function visibleProfiles(runtime: Runtime): Promise<Profile[]> {
  const shown: Profile[] = [];
  for (const profile of await runtime.profiles.list()) {
    if ((await runtime.events.getMeta(`restoring:${profile.id}`)) !== '1') shown.push(profile);
  }
  return shown;
}
