import {
  CoreError,
  deriveProgress,
  parseEvents,
  verifyPin,
  type LearnerSession,
} from '@shiksha/learner-core';
import { resetActivity, activity } from './activity.svelte.js';
import { uiLang, type Lang } from './i18n/index.js';
import type { Runtime } from './runtime/runtime.js';

interface AppState {
  runtime: Runtime | null;
  profile: { id: string; name: string } | null;
  /** Null until lessons have been installed at least once. */
  session: LearnerSession | null;
  lang: Lang;
}

export const appState = $state<AppState>({
  runtime: null,
  profile: null,
  session: null,
  lang: 'hi',
});

export function initApp(runtime: Runtime): void {
  appState.runtime = runtime;
}

function requireRuntime(): Runtime {
  if (!appState.runtime) throw new Error('the app has not been started');
  return appState.runtime;
}

async function languageOf(runtime: Runtime, learnerId: string): Promise<Lang> {
  const { events } = parseEvents(await runtime.events.all(learnerId));
  return uiLang(deriveProgress(events).language);
}

/** The session needs the lesson list; before the first download there is none yet. */
async function openIfInstalled(
  runtime: Runtime,
  learnerId: string,
): Promise<LearnerSession | null> {
  try {
    return await runtime.openSession(learnerId);
  } catch (error) {
    if (error instanceof CoreError && error.code === 'MANIFEST_UNAVAILABLE') return null;
    throw error;
  }
}

/** Check the PIN, then switch to that profile. Throws the core's `CoreError` for a bad PIN. */
export async function signIn(profileId: string, pin: string): Promise<void> {
  const runtime = requireRuntime();
  const profile = await verifyPin(profileId, pin, {
    store: runtime.profiles,
    clock: runtime.clock,
  });
  resetActivity();
  // Work everything out first, then switch in one step, so nobody sees a half-signed-in state.
  const lang = await languageOf(runtime, profile.id);
  const session = await openIfInstalled(runtime, profile.id);
  appState.profile = { id: profile.id, name: profile.name };
  appState.lang = lang;
  appState.session = session;
}

export function signOut(): void {
  resetActivity();
  appState.profile = null;
  appState.session = null;
  appState.lang = 'hi';
}

/**
 * Pick up newly installed content. It reads storage for a while, so afterwards it checks that the
 * same learner is still signed in and no lesson started meanwhile; otherwise the result is dropped
 * (it could belong to someone else, or swap the session under a running lesson).
 */
export async function refreshSession(): Promise<void> {
  const { runtime, profile } = appState;
  if (!runtime || !profile || activity.current) return;
  const learnerId = profile.id;
  const session = await openIfInstalled(runtime, learnerId);
  const lang = await languageOf(runtime, learnerId);
  if (appState.profile?.id !== learnerId || activity.current) return;
  appState.session = session;
  appState.lang = lang;
}
