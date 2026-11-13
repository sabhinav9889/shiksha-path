// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import type { MyRecording } from '@shiksha/api-contract';
import { render, screen, within, fireEvent } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { setLinked, type AccountDeps } from '../../account/account.js';
import { wipeProfile } from '../../account/forget.js';
import type { ApiClient, ApiResult } from '../../api/api-client.js';
import { initApp, signIn, signOut } from '../../app-state.svelte.js';
import FeedbackCard from './FeedbackCard.svelte';
import { loadFeedbackCache, refreshFeedback } from './feedback-cache.js';

const rec = (over: Partial<MyRecording>): MyRecording => ({
  id: crypto.randomUUID(),
  lessonId: 'ef1-15-say-it-aloud',
  itemId: 'speak-1',
  durationMs: 4200,
  recordedAt: '2026-11-01T06:00:00.000Z',
  reviewedAt: null,
  comment: null,
  ...over,
});
const listOf = (recordings: MyRecording[]): ApiResult<unknown> => ({
  ok: true,
  value: { recordings },
});
/** A fake client: `call` answers by path, like the real one answers by contract. */
const client = (answers: {
  list?: ApiResult<unknown>;
  url?: ApiResult<unknown>;
}): ApiClient & { call: ReturnType<typeof vi.fn> } =>
  ({
    call: vi.fn((path: string) =>
      Promise.resolve(
        path.startsWith('/v1/me/recording-url')
          ? (answers.url ?? { ok: false, error: 'OFFLINE' })
          : (answers.list ?? { ok: false, error: 'OFFLINE' }),
      ),
    ),
  }) as unknown as ApiClient & { call: ReturnType<typeof vi.fn> };

let env: TestEnv;
let id: string;

beforeEach(async () => {
  signOut();
  env = await makeEnv();
  initApp(env.runtime);
  id = (await env.addProfile('प्रिया')).id;
});

describe('the feedback kept on the phone', () => {
  test('a fresh answer is kept; offline the last copy shows; a refusal clears it', async () => {
    const one = rec({ comment: 'बहुत अच्छा' });
    const fresh = await refreshFeedback(env.runtime, client({ list: listOf([one]) }), id);
    expect(fresh).toEqual({ status: 'fresh', recordings: [one] });
    const offline = await refreshFeedback(env.runtime, client({}), id);
    expect(offline).toEqual({ status: 'offline', recordings: [one] });
    expect((await refreshFeedback(env.runtime, null, id)).recordings).toEqual([one]);
    const gone = await refreshFeedback(
      env.runtime,
      client({ list: { ok: false, error: 'NOT_LINKED' } }),
      id,
    );
    expect(gone).toEqual({ status: 'off', recordings: [] });
    expect(await loadFeedbackCache(env.runtime, id)).toBeNull();
  });

  test('a damaged copy gives nothing, not a crash; removing the profile removes it', async () => {
    await env.runtime.events.setMeta(`feedback:${id}`, '{ nope');
    expect(await loadFeedbackCache(env.runtime, id)).toBeNull();
    await env.runtime.events.setMeta(`feedback:${id}`, JSON.stringify({ recordings: [{ id: 1 }] }));
    expect(await loadFeedbackCache(env.runtime, id)).toBeNull();
    await refreshFeedback(env.runtime, client({ list: listOf([rec({})]) }), id);
    await wipeProfile(env.runtime, id);
    expect(await loadFeedbackCache(env.runtime, id)).toBeNull();
  });

  test('an answer that breaks the contract is not kept', async () => {
    const bad = { ok: true, value: { recordings: [{ id: 'x' }] } } as ApiResult<unknown>;
    const result = await refreshFeedback(env.runtime, client({ list: bad }), id);
    expect(result).toEqual({ status: 'offline', recordings: [] });
  });
});

describe('the My speaking practice card', () => {
  async function open(
    recordings: MyRecording[],
    answers: { url?: ApiResult<unknown> } = {},
  ): Promise<ApiClient & { call: ReturnType<typeof vi.fn> }> {
    await signIn(id, '1234');
    await setLinked(env.runtime, id);
    const api = client({ list: listOf(recordings), ...answers });
    env.runtime.account = {
      loadAuth: () => Promise.resolve({ accessToken: () => Promise.resolve('t') }),
      makeApi: () => api,
    } as unknown as AccountDeps;
    render(FeedbackCard);
    return api;
  }

  test('shows a reviewed recording with the comment, and one still waiting for a mentor', async () => {
    await open([
      rec({ reviewedAt: '2026-11-02T06:00:00.000Z', comment: 'धीरे बोलिए, बाकी बढ़िया' }),
      rec({ recordedAt: '2026-11-03T06:00:00.000Z' }),
    ]);
    await vi.waitFor(() => screen.getByText('धीरे बोलिए, बाकी बढ़िया'));
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
    expect(screen.getByText('मेंटर के देखने का इंतज़ार')).toBeTruthy();
    expect(screen.getByText('मेंटर ने देखा')).toBeTruthy();
  });

  test('a reviewed recording with no comment says it was seen, with no empty quote', async () => {
    await open([rec({ reviewedAt: '2026-11-02T06:00:00.000Z' })]);
    await vi.waitFor(() => screen.getByText('मेंटर ने देखा'));
    expect(document.querySelector('blockquote')).toBeNull();
  });

  test('the comment is shown as text, never as markup', async () => {
    await open([
      rec({ reviewedAt: '2026-11-02T06:00:00.000Z', comment: '<b>x</b><script>1</script>' }),
    ]);
    await vi.waitFor(() => screen.getByText('<b>x</b><script>1</script>'));
    expect(document.querySelector('li b, li script')).toBeNull();
  });

  test('shows nothing when there are no recordings', async () => {
    await open([]);
    await vi.waitFor(() => expect(env.runtime.account).not.toBeNull());
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole('heading')).toBeNull();
  });

  test('Play asks for a link for that recording and shows a player', async () => {
    const one = rec({});
    const api = await open([one], {
      url: { ok: true, value: { url: 'https://x.supabase.co/storage/signed/abc' } },
    });
    const item = (await vi.waitFor(() => screen.getAllByRole('listitem')))[0] as HTMLElement;
    await fireEvent.click(within(item).getByRole('button', { name: /सुनें/ }));
    await vi.waitFor(() => expect(item.querySelector('audio')).not.toBeNull());
    expect(item.querySelector('audio')?.getAttribute('src')).toBe(
      'https://x.supabase.co/storage/signed/abc',
    );
    expect(api.call).toHaveBeenCalledWith(`/v1/me/recording-url?id=${one.id}`, expect.anything());
  });

  test('offline, Play says it needs the internet and shows no player', async () => {
    await open([rec({})]);
    const item = (await vi.waitFor(() => screen.getAllByRole('listitem')))[0] as HTMLElement;
    await fireEvent.click(within(item).getByRole('button', { name: /सुनें/ }));
    await vi.waitFor(() => screen.getByText('सुनने के लिए इंटरनेट चाहिए'));
    expect(item.querySelector('audio')).toBeNull();
  });
});
