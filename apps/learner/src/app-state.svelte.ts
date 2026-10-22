import {
  CoreError,
  createEvent,
  deriveProgress,
  parseEvents,
  verifyPin,
  type LanguagePreference,
  type LearnerSession,
} from '@shiksha/learner-core';
import { activity, audioInUse, resetActivity } from './activity.svelte.js';
import { uiLang, type Lang } from './i18n/index.js';
import { apiFor, isLinked } from './account/account.js';
import type { Runtime } from './runtime/runtime.js';
import { DEFAULT_BRANDING, type Branding } from '@shiksha/api-contract';
import { loadBranding } from './runtime/branding.js';
import { ALL_ON, loadSwitches, refreshSwitches, type Switches } from './runtime/switches.js';

interface AppState {
  runtime: Runtime | null;
  profile: { id: string; name: string } | null;
  /** Null until lessons have been installed at least once. */
  session: LearnerSession | null;
  lang: Lang;
  /** What the server lets this learner use; every feature is on until it says otherwise. */
  switches: Switches;
  /** The platform's name and colours, for the whole phone (spec §8.1 branding). */
  brand: Branding;
}

export const appState = $state<AppState>({
  runtime: null,
  profile: null,
  session: null,
  lang: 'hi',
  switches: { ...ALL_ON },
  brand: structuredClone(DEFAULT_BRANDING),
});

/** The content version the open session was built from; -1 when there is none. */
let openedAtVersion = -1;

export function initApp(runtime: Runtime): void {
  runtime.content.keepAudio = audioInUse; // a sync never deletes audio a run on screen uses
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
  const version = runtime.content.version;
  const lang = await languageOf(runtime, profile.id);
  const session = await openIfInstalled(runtime, profile.id);
  const switches = await loadSwitches(runtime, profile.id);
  appState.profile = { id: profile.id, name: profile.name };
  appState.lang = lang;
  appState.session = session;
  appState.switches = switches;
  openedAtVersion = session ? version : -1;
  void updateSwitches(); // the cached values show at once; the server's follow when online
}

/** Show the branding stored on the phone (before the first paint, and after each sync). */
export async function reloadBranding(): Promise<void> {
  const runtime = appState.runtime;
  if (runtime) appState.brand = await loadBranding(runtime);
}

/** Show the signed-in learner's switches as stored on the phone. */
export async function reloadSwitches(): Promise<void> {
  const { runtime, profile } = appState;
  if (!runtime || !profile) return;
  const switches = await loadSwitches(runtime, profile.id);
  if (appState.profile?.id === profile.id) appState.switches = switches;
}

/** Ask the server for the signed-in learner's switches (linked profiles only), then show them. */
export async function updateSwitches(): Promise<void> {
  const { runtime, profile } = appState;
  if (!runtime || !profile) return;
  try {
    if (await isLinked(runtime, profile.id)) {
      await refreshSwitches(runtime, await apiFor(runtime, profile.id), profile.id);
    }
  } catch {
    // sign-in code could not load (offline first visit): the cached values stand
  }
  await reloadSwitches();
}

export function signOut(): void {
  resetActivity();
  appState.profile = null;
  appState.session = null;
  appState.lang = 'hi';
  appState.switches = { ...ALL_ON };
  openedAtVersion = -1;
}

/**
 * Nothing on the phone changed since this session was opened: reopening would only re-read every
 * bundle (slow on a cheap phone). Every learner action goes through the session itself; `force`
 * means events arrived from another phone, so the log changed even if lessons did not.
 */
function upToDate(version: number, force: boolean): boolean {
  return !force && appState.session !== null && version === openedAtVersion;
}

/**
 * Pick up newly installed content. It reads storage for a while, so afterwards it checks that the
 * same learner is still signed in and no lesson started meanwhile; otherwise the result is dropped
 * (it could belong to someone else, or swap the session under a running lesson).
 */
export async function refreshSession(opts: { force?: boolean } = {}): Promise<void> {
  const { runtime, profile } = appState;
  if (!runtime || !profile || activity.current) return;
  const version = runtime.content.version;
  if (upToDate(version, opts.force === true)) return;
  const learnerId = profile.id;
  const session = await openIfInstalled(runtime, learnerId);
  const lang = await languageOf(runtime, learnerId);
  if (appState.profile?.id !== learnerId || activity.current) return;
  appState.session = session;
  appState.lang = lang;
  openedAtVersion = session ? version : -1;
}

/**
 * Change the learner's language (spec §6.7). It is recorded as an event, through the session when
 * there is one so progress sees it, and the interface switches at once.
 */
export async function setLanguagePreference(preference: LanguagePreference): Promise<void> {
  const { runtime, profile, session } = appState;
  if (!runtime || !profile) return;
  if (session) await session.setLanguage(preference);
  else
    await runtime.events.append(
      createEvent(runtime, profile.id, 'language_changed', { preference }),
    );
  if (appState.profile?.id === profile.id) appState.lang = uiLang(preference);
}
