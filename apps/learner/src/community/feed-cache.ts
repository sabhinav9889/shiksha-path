import { feedPost, feedResponse, type FeedPost } from '@shiksha/api-contract';
import type { ApiClient } from '../api/api-client.js';
import type { Runtime } from '../runtime/runtime.js';

export interface FeedCopy {
  /** When this copy was saved on the phone, as an ISO time. */
  savedAt: string;
  posts: FeedPost[];
}

/** `fresh`: just from the server. `offline`: the copy on the phone. `off`: the server refused. */
export type FeedStatus = 'fresh' | 'offline' | 'off';

/** Keys end in `:<profileId>`, so removing a profile from the phone removes its feed copy too. */
const feedKey = (learnerId: string): string => `feed:${learnerId}`;

/** The server says this student may not have a feed (any more): nothing is kept. */
const REFUSED = new Set(['FEATURE_OFF', 'NOT_LINKED', 'FORBIDDEN', 'DEACTIVATED']);

/**
 * The copy on this phone. A damaged or older-build copy gives no crash: posts missing a field
 * are dropped, and the next refresh replaces the rest.
 */
export async function loadFeedCache(runtime: Runtime, learnerId: string): Promise<FeedCopy | null> {
  const raw = await runtime.events.getMeta(feedKey(learnerId));
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { savedAt, posts } = parsed as { savedAt?: unknown; posts?: unknown };
  const kept = Array.isArray(posts)
    ? posts.flatMap((item) => {
        const one = feedPost.safeParse(item);
        return one.success ? [one.data] : [];
      })
    : [];
  return { savedAt: typeof savedAt === 'string' ? savedAt : '', posts: kept };
}

/** Ask the server for the feed and keep it. Offline or any other trouble keeps the last copy. */
export async function refreshFeed(
  runtime: Runtime,
  client: ApiClient | null,
  learnerId: string,
): Promise<FeedCopy & { status: FeedStatus }> {
  const answer = (await client?.feed()) ?? null;
  const parsed = answer?.ok ? feedResponse.safeParse(answer.value) : null;
  if (parsed?.success) {
    const posts = parsed.data.posts;
    const savedAt = runtime.clock.now().toISOString();
    await runtime.events.setMeta(feedKey(learnerId), JSON.stringify({ savedAt, posts }));
    return { status: 'fresh', savedAt, posts };
  }
  if (answer && !answer.ok && REFUSED.has(answer.error)) {
    await runtime.events.setMeta(feedKey(learnerId), '');
    return { status: 'off', savedAt: '', posts: [] };
  }
  return { status: 'offline', ...(await copyOrEmpty(runtime, learnerId)) };
}

/** What is on the phone, or an empty feed when nothing is. */
async function copyOrEmpty(runtime: Runtime, learnerId: string): Promise<FeedCopy> {
  return (await loadFeedCache(runtime, learnerId)) ?? { savedAt: '', posts: [] };
}
