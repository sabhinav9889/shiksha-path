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
  appState.session = null;
  appState.profile = { id: profile.id, name: profile.name };
  appState.lang = await languageOf(runtime, profile.id);
  appState.session = await openIfInstalled(runtime, profile.id);
}

export function signOut(): void {
  resetActivity();
  appState.profile = null;
  appState.session = null;
  appState.lang = 'hi';
}

/** Pick up newly installed content, but never swap the session under a lesson in progress. */
export async function refreshSession(): Promise<void> {
  const { runtime, profile } = appState;
  if (!runtime || !profile || activity.current) return;
  appState.session = await openIfInstalled(runtime, profile.id);
  appState.lang = await languageOf(runtime, profile.id);
}
