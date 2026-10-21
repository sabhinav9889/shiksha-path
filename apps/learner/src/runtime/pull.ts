import { apiFor, isLinked } from '../account/account.js';
import { restoreEvents } from '../account/restore-flow.js';
import type { Runtime } from './runtime.js';

/** Fetch events made on other phones since the last pull. Never throws. */
export async function pullNew(runtime: Runtime, learnerId: string): Promise<{ added: number }> {
  try {
    if (!(await isLinked(runtime, learnerId))) return { added: 0 };
    const { pulled } = await restoreEvents(runtime, await apiFor(runtime, learnerId), learnerId);
    return { added: pulled };
  } catch {
    return { added: 0 };
  }
}
