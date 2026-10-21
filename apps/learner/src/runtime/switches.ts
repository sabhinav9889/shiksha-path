import { FEATURE_KEYS, type FeatureKey } from '@shiksha/api-contract';
import type { ApiClient } from '../api/api-client.js';
import type { Runtime } from './runtime.js';

export type Switches = Record<FeatureKey, boolean>;

/** Before the server has said anything (or on a phone-only build) every feature is on. */
export const ALL_ON: Switches = Object.fromEntries(
  FEATURE_KEYS.map((key) => [key, true]),
) as Switches;

const switchesKey = (learnerId: string): string => `switches:${learnerId}`;

/** Only real booleans count; a missing or odd value leaves that feature on. */
function fromCache(raw: string): Switches {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ...ALL_ON };
  }
  const cached = typeof parsed === 'object' && parsed !== null ? parsed : {};
  const switches = { ...ALL_ON };
  for (const key of FEATURE_KEYS) {
    const value: unknown = (cached as Record<string, unknown>)[key];
    if (typeof value === 'boolean') switches[key] = value;
  }
  return switches;
}

/** This learner's last known switches on this phone. */
export async function loadSwitches(runtime: Runtime, learnerId: string): Promise<Switches> {
  const raw = await runtime.events.getMeta(switchesKey(learnerId));
  return raw ? fromCache(raw) : { ...ALL_ON };
}

/** Ask /v1/me for the learner's switches and keep them; on any failure the cache stays. */
export async function refreshSwitches(
  runtime: Runtime,
  client: ApiClient | null,
  learnerId: string,
): Promise<void> {
  const me = await client?.me();
  if (!me?.ok) return;
  await runtime.events.setMeta(switchesKey(learnerId), JSON.stringify(me.value.switches));
}
