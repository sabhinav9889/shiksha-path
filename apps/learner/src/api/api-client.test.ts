import { randomUUID } from 'node:crypto';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { createApiClient } from './api-client.js';

const BASE = 'https://x.supabase.co/functions/v1/api';
const learnerId = randomUUID();

afterEach(() => {
  vi.useRealTimers();
});

function client(
  reply: (url: string, init: RequestInit) => Promise<Response>,
  token: string | null = 'tok',
  timeoutMs?: number,
) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchFn = ((url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return reply(String(url), init ?? {});
  }) as typeof fetch;
  const api = createApiClient({
    baseUrl: BASE,
    token: () => Promise.resolve(token),
    fetchFn,
    ...(timeoutMs ? { timeoutMs } : {}),
  });
  return { api, calls };
}

const answer = (status: number, body: unknown): Promise<Response> =>
  Promise.resolve(new Response(JSON.stringify(body), { status }));

describe('createApiClient', () => {
  test('sends the token and JSON, and parses the answer', async () => {
    const { api, calls } = client(() => answer(200, { accepted: [learnerId], rejected: [] }));
    const result = await api.push({ learnerId, events: [{}] });
    expect(result).toEqual({ ok: true, value: { accepted: [learnerId], rejected: [] } });
    expect(calls[0]?.url).toBe(`${BASE}/v1/sync/push`);
    const headers = new Headers(calls[0]?.init.headers);
    expect(headers.get('authorization')).toBe('Bearer tok');
    expect(headers.get('content-type')).toBe('application/json');
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({ learnerId, events: [{}] });
  });

  test('each call goes to its route', async () => {
    const replies: Record<string, unknown> = {
      [`${BASE}/v1/learners/link`]: { learnerId, name: 'A', created: true },
      [`${BASE}/v1/sync/pull?after=7`]: { events: [], next: null },
      [`${BASE}/v1/me`]: {
        learner: { id: learnerId, name: 'A' },
        switches: {
          ai_doubts: true,
          speaking_practice: true,
          placement_test: true,
          english_only_option: true,
          mentor_booking: true,
          community_feed: true,
        },
      },
    };
    const { api } = client((url) => answer(200, replies[url]));
    expect((await api.link({ profileId: learnerId, name: 'A' })).ok).toBe(true);
    expect((await api.pull({ after: 7 })).ok).toBe(true);
    expect((await api.me()).ok).toBe(true);
  });

  test.each([
    [401, 'UNAUTHENTICATED'],
    [403, 'NOT_LINKED'],
    [409, 'PROFILE_TAKEN'],
    [413, 'TOO_LARGE'],
    [500, 'INTERNAL'],
  ])('a %s answer becomes its code', async (status, code) => {
    const { api } = client(() => answer(status, { error: code }));
    expect(await api.me()).toEqual({ ok: false, error: code });
  });

  test('an answer that breaks the contract is INTERNAL', async () => {
    const { api } = client(() => answer(200, { accepted: 'everything' }));
    expect(await api.push({ learnerId, events: [{}] })).toEqual({ ok: false, error: 'INTERNAL' });
    const odd = client(() => Promise.resolve(new Response('<html>', { status: 502 })));
    expect(await odd.api.me()).toEqual({ ok: false, error: 'INTERNAL' });
  });

  test('no network is OFFLINE', async () => {
    const { api } = client(() => Promise.reject(new TypeError('Failed to fetch')));
    expect(await api.me()).toEqual({ ok: false, error: 'OFFLINE' });
  });

  test('a server that never answers is OFFLINE after the timeout', async () => {
    vi.useFakeTimers();
    const { api } = client(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
        }),
      'tok',
      5000,
    );
    const pending = api.me();
    await vi.advanceTimersByTimeAsync(5000);
    expect(await pending).toEqual({ ok: false, error: 'OFFLINE' });
  });

  test('without a sign-in nothing is sent', async () => {
    const { api, calls } = client(() => answer(200, {}), null);
    expect(await api.me()).toEqual({ ok: false, error: 'UNAUTHENTICATED' });
    expect(calls).toHaveLength(0);
  });
});
