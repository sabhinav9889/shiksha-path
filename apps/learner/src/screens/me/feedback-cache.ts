import { myRecordingsResponse, type MyRecording } from '@shiksha/api-contract';
import type { ApiClient, ApiResult } from '../../api/api-client.js';
import type { Runtime } from '../../runtime/runtime.js';

/** `fresh`: just from the server. `offline`: the copy on the phone. `off`: the server refused. */
export type FeedbackStatus = 'fresh' | 'offline' | 'off';

/** Keys end in `:<profileId>`, so removing a profile from the phone removes this copy too. */
const key = (learnerId: string): string => `feedback:${learnerId}`;

/** The server says this student has no such list (any more): nothing is kept. */
const REFUSED = new Set(['NOT_LINKED', 'FORBIDDEN', 'DEACTIVATED', 'FEATURE_OFF']);

const isRefusal = (answer: ApiResult<unknown> | null): boolean =>
  answer !== null && !answer.ok && REFUSED.has(answer.error);

/** The copy on this phone; a damaged or older-build copy gives null, never a crash. */
export async function loadFeedbackCache(
  runtime: Runtime,
  learnerId: string,
): Promise<MyRecording[] | null> {
  const raw = await runtime.events.getMeta(key(learnerId));
  if (!raw) return null;
  try {
    const parsed = myRecordingsResponse.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data.recordings : null;
  } catch {
    return null;
  }
}

/** Ask the server and keep the answer. Offline or any other trouble keeps the last copy. */
export async function refreshFeedback(
  runtime: Runtime,
  client: ApiClient | null,
  learnerId: string,
): Promise<{ status: FeedbackStatus; recordings: MyRecording[] }> {
  const answer = (await client?.call('/v1/me/recordings', myRecordingsResponse)) ?? null;
  const parsed = answer?.ok ? myRecordingsResponse.safeParse(answer.value) : null;
  if (parsed?.success) {
    await runtime.events.setMeta(key(learnerId), JSON.stringify(parsed.data));
    return { status: 'fresh', recordings: parsed.data.recordings };
  }
  if (isRefusal(answer)) {
    await runtime.events.setMeta(key(learnerId), '');
    return { status: 'off', recordings: [] };
  }
  return { status: 'offline', recordings: (await loadFeedbackCache(runtime, learnerId)) ?? [] };
}
