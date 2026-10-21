import { appState } from '../app-state.svelte.js';
import { startLinking } from './account.js';

/** Start Google sign-in for whoever is signed in on this phone. */
export function linkSignedInProfile(): void {
  const { runtime, profile } = appState;
  // offline before the sign-in code was ever loaded: nothing happens and the learner can retry
  if (runtime && profile) startLinking(runtime, profile.id).catch(() => undefined);
}
