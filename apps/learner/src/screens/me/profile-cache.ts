import { profileResponse, type ProfileResponse } from '@shiksha/api-contract';
import type { ApiClient } from '../../api/api-client.js';
import type { Runtime } from '../../runtime/runtime.js';

/** `fresh`: just from the server. `offline`: the copy on the phone. `off`: the server refused. */
export type ProfileStatus = 'fresh' | 'offline' | 'off';

/** Keys end in `:<profileId>`, so removing a profile from the phone removes this copy too. */
const key = (learnerId: string): string => `profileCard:${learnerId}`;

/** The server says this student has no such details (any more): nothing is kept. */
const REFUSED = new Set(['NOT_LINKED', 'FORBIDDEN', 'DEACTIVATED']);

/** The copy on this phone; a damaged or older-build copy gives null, never a crash. */
export async function loadProfileCache(
  runtime: Runtime,
  learnerId: string,
): Promise<ProfileResponse | null> {
  const raw = await runtime.events.getMeta(key(learnerId));
  if (!raw) return null;
  try {
    const parsed = profileResponse.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Ask the server and keep the answer. Offline or any other trouble keeps the last copy. */
export async function refreshProfile(
  runtime: Runtime,
  client: ApiClient | null,
  learnerId: string,
): Promise<{ status: ProfileStatus; card: ProfileResponse | null }> {
  const answer = (await client?.profile()) ?? null;
  const parsed = answer?.ok ? profileResponse.safeParse(answer.value) : null;
  if (parsed?.success) {
    await runtime.events.setMeta(key(learnerId), JSON.stringify(parsed.data));
    return { status: 'fresh', card: parsed.data };
  }
  if (answer && !answer.ok && REFUSED.has(answer.error)) {
    await runtime.events.setMeta(key(learnerId), '');
    return { status: 'off', card: null };
  }
  return { status: 'offline', card: await loadProfileCache(runtime, learnerId) };
}
