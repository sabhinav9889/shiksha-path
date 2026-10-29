// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import type { FeedPost } from '@shiksha/api-contract';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { wipeProfile } from '../account/forget.js';
import type { ApiClient, ApiResult } from '../api/api-client.js';
import { loadFeedCache, refreshFeed } from './feed-cache.js';

const post = (title: string): FeedPost => ({
  id: crypto.randomUUID(),
  title,
  body: '',
  authorName: null,
  toCohort: false,
  createdAt: '2026-11-01T00:00:00.000Z',
  editedAt: null,
  session: null,
});
const clientAnswering = (answer: ApiResult<{ posts: FeedPost[] }>): ApiClient =>
  ({ feed: vi.fn(() => Promise.resolve(answer)) }) as unknown as ApiClient;

let env: TestEnv;
let id: string;

beforeEach(async () => {
  env = await makeEnv();
  id = (await env.addProfile('प्रिया')).id;
});

describe('the feed kept on the phone', () => {
  test('a fresh answer is shown and kept for offline reading', async () => {
    const client = clientAnswering({ ok: true, value: { posts: [post('मॉक')] } });
    const result = await refreshFeed(env.runtime, client, id);
    expect(result.posts.map((p) => p.title)).toEqual(['मॉक']);
    expect(result.status).toBe('fresh');
    const cached = await loadFeedCache(env.runtime, id);
    expect(cached?.posts.map((p) => p.title)).toEqual(['मॉक']);
    expect(cached?.savedAt).toBeTruthy();
  });

  test('offline, or with no server, the last copy stays and is shown', async () => {
    await refreshFeed(
      env.runtime,
      clientAnswering({ ok: true, value: { posts: [post('A')] } }),
      id,
    );
    const offline = await refreshFeed(
      env.runtime,
      clientAnswering({ ok: false, error: 'OFFLINE' }),
      id,
    );
    expect(offline).toMatchObject({ status: 'offline', posts: [{ title: 'A' }] });
    const none = await refreshFeed(env.runtime, null, id);
    expect(none).toMatchObject({ status: 'offline', posts: [{ title: 'A' }] });
    expect((await loadFeedCache(env.runtime, id))?.posts).toHaveLength(1);
  });

  test.each(['FEATURE_OFF', 'NOT_LINKED', 'FORBIDDEN', 'DEACTIVATED'] as const)(
    'when the server says %s the copy is cleared, so a switched-off feed is not kept',
    async (error) => {
      await refreshFeed(
        env.runtime,
        clientAnswering({ ok: true, value: { posts: [post('A')] } }),
        id,
      );
      const result = await refreshFeed(env.runtime, clientAnswering({ ok: false, error }), id);
      expect(result).toMatchObject({ status: 'off', posts: [] });
      expect(await loadFeedCache(env.runtime, id)).toBeNull();
    },
  );

  test('a copy from an older or damaged build never crashes the screen', async () => {
    const key = `feed:${id}`;
    await env.runtime.events.setMeta(key, '{ not json');
    expect(await loadFeedCache(env.runtime, id)).toBeNull();
    await env.runtime.events.setMeta(key, JSON.stringify({ posts: [{ id: 'x', title: 'y' }] }));
    expect((await loadFeedCache(env.runtime, id))?.posts).toEqual([]);
    await env.runtime.events.setMeta(key, JSON.stringify({ posts: 'nope' }));
    expect((await loadFeedCache(env.runtime, id))?.posts).toEqual([]);
  });

  test('removing a profile from the phone removes its feed copy too', async () => {
    await refreshFeed(
      env.runtime,
      clientAnswering({ ok: true, value: { posts: [post('A')] } }),
      id,
    );
    const other = (await env.addProfile('दूसरा')).id;
    await refreshFeed(
      env.runtime,
      clientAnswering({ ok: true, value: { posts: [post('B')] } }),
      other,
    );
    await wipeProfile(env.runtime, id);
    expect(await loadFeedCache(env.runtime, id)).toBeNull();
    expect((await loadFeedCache(env.runtime, other))?.posts).toHaveLength(1);
  });
});
