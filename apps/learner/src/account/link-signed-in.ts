import { appState } from '../app-state.svelte.js';
import { startLinking } from './account.js';

/** Start Google sign-in for whoever is signed in on this phone. */
export function linkSignedInProfile(): void {
  const { runtime, profile } = appState;
  if (runtime && profile) void startLinking(runtime, profile.id);
}
