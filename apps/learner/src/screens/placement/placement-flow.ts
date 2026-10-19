import { activity, resetActivity } from '../../activity.svelte.js';
import { appState } from '../../app-state.svelte.js';
import { navigate } from '../../router.svelte.js';

/** Open the starting test (spec §6.3). False when the phone has no placement test. */
export async function startPlacementRun(): Promise<boolean> {
  const run = await appState.session?.startPlacement();
  if (!run) return false;
  activity.current = { kind: 'placement', run };
  navigate({ name: 'placement' });
  return true;
}

/** Record the result (only the first one sets start lessons) and show it. */
export async function finishPlacementRun(): Promise<void> {
  const current = activity.current;
  if (!appState.session || current?.kind !== 'placement') return;
  activity.placementResult = await appState.session.finishPlacement(current.run);
  navigate({ name: 'placement-result' });
}

/** The learner chose to start from the beginning. */
export async function skipPlacementRun(): Promise<void> {
  await appState.session?.skipPlacement();
  resetActivity();
  navigate({ name: 'home' });
}
