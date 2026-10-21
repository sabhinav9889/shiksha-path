import { randomUUID } from 'node:crypto';
import { cryptoIds, createEvent, systemClock } from '@shiksha/learner-core';
import { beforeEach, describe, expect, test } from 'vitest';
import { handle, type HandlerDeps } from '../src/http/router.js';
import { memoryLogger, type MemoryLogger } from '../src/logger.js';
import type { Auth } from '../src/ports.js';
import { linkLearner } from '../src/services/link.js';
import { makeMemoryRepos } from '../src/testing/memory-repos.js';

const APP = 'https://app.example.org';
const BASE = 'https://x.supabase.co/functions/v1/api';
let deps: HandlerDeps;
let logger: MemoryLogger;
let a: string;
let b: string;

beforeEach(async () => {
  const repos = makeMemoryRepos();
  const tokens: Record<string, string> = {
    'token-a': 'auth-a',
    'token-b': 'auth-b',
    'token-c': 'auth-c',
  };
  const auth: Auth = {
    verify: (t) =>
      Promise.resolve(tokens[t] ? { authUserId: tokens[t], provider: 'google' } : null),
  };
  logger = memoryLogger();
  deps = { ...repos, auth, allowedOrigins: [APP], logger };
  a = (
    await linkLearner(
      repos,
      { authUserId: 'auth-a', provider: 'google' },
      { profileId: randomUUID(), name: 'A' },
    )
  ).learnerId;
  b = (
    await linkLearner(
      repos,
      { authUserId: 'auth-b', provider: 'google' },
      { profileId: randomUUID(), name: 'B' },
    )
  ).learnerId;
});

function call(
  method: string,
  path: string,
  opts: { token?: string; body?: unknown; raw?: string; origin?: string; base?: string } = {},
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers.authorization = `Bearer ${opts.token}`;
  if (opts.origin) headers.origin = opts.origin;
  const body = opts.raw ?? (opts.body === undefined ? undefined : JSON.stringify(opts.body));
  const init: RequestInit = body === undefined ? { method, headers } : { method, headers, body };
  return handle(new Request(`${opts.base ?? BASE}${path}`, init), deps);
}

const json = async (response: Response): Promise<unknown> => response.json();
const event = (learnerId: string) =>
  createEvent({ clock: systemClock, ids: cryptoIds }, learnerId, 'language_changed', {
    preference: 'hi_en',
  });

describe('each route', () => {
  test('link creates a learner for a new identity', async () => {
    const profileId = randomUUID();
    const res = await call('POST', '/v1/learners/link', {
      token: 'token-c',
      body: { profileId, name: 'C' },
    });
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ learnerId: profileId, name: 'C', created: true });
  });

  test('push, then pull back', async () => {
    const events = [event(a), event(a)];
    const push = await call('POST', '/v1/sync/push', {
      token: 'token-a',
      body: { learnerId: a, events },
    });
    expect(push.status).toBe(200);
    expect(((await json(push)) as { accepted: string[] }).accepted).toHaveLength(2);
    const pull = await call('GET', '/v1/sync/pull?after=0', { token: 'token-a' });
    expect(await json(pull)).toMatchObject({ events, next: null });
    expect(
      ((await json(await call('GET', '/v1/sync/pull', { token: 'token-a' }))) as { cursor: number })
        .cursor,
    ).toBeGreaterThan(0);
  });

  test('me lists the learner and every switch', async () => {
    const res = await call('GET', '/v1/me', { token: 'token-a' });
    const body = (await json(res)) as {
      learner: { id: string };
      switches: Record<string, boolean>;
    };
    expect(body.learner.id).toBe(a);
    expect(Object.keys(body.switches)).toHaveLength(6);
  });

  test('the same route works without the function prefix', async () => {
    const res = await call('GET', '/v1/me', { token: 'token-a', base: 'https://api.example.org' });
    expect(res.status).toBe(200);
  });
});

describe('refusals', () => {
  test('no token or a bad token is 401', async () => {
    expect((await call('GET', '/v1/me')).status).toBe(401);
    const bad = await call('GET', '/v1/me', { token: 'nope' });
    expect([bad.status, await json(bad)]).toEqual([401, { error: 'UNAUTHENTICATED' }]);
  });

  test('every route checks the caller before reading the body', async () => {
    for (const path of ['/v1/learners/link', '/v1/sync/push']) {
      expect((await call('POST', path, { raw: '{not json' })).status).toBe(401);
    }
  });

  test('broken JSON and a body that breaks the contract are 400', async () => {
    const broken = await call('POST', '/v1/sync/push', { token: 'token-a', raw: '{not json' });
    expect([broken.status, await json(broken)]).toEqual([400, { error: 'INVALID_REQUEST' }]);
    const empty = await call('POST', '/v1/sync/push', {
      token: 'token-a',
      body: { learnerId: a, events: [] },
    });
    expect(empty.status).toBe(400);
    const extra = await call('GET', '/v1/sync/pull?after=0&sneaky=1', { token: 'token-a' });
    expect(extra.status).toBe(400);
  });

  test('a body over 256 KB is 413', async () => {
    const res = await call('POST', '/v1/sync/push', { token: 'token-a', raw: 'x'.repeat(300_000) });
    expect([res.status, await json(res)]).toEqual([413, { error: 'TOO_LARGE' }]);
  });

  test('pushing as someone else is 403 FORBIDDEN', async () => {
    const res = await call('POST', '/v1/sync/push', {
      token: 'token-a',
      body: { learnerId: b, events: [event(b)] },
    });
    expect([res.status, await json(res)]).toEqual([403, { error: 'FORBIDDEN' }]);
  });

  test('an identity with no learner is 403 NOT_LINKED', async () => {
    const res = await call('GET', '/v1/me', { token: 'token-c' });
    expect([res.status, await json(res)]).toEqual([403, { error: 'NOT_LINKED' }]);
  });

  test("claiming another learner's id is 409 PROFILE_TAKEN", async () => {
    const res = await call('POST', '/v1/learners/link', {
      token: 'token-c',
      body: { profileId: a, name: 'C' },
    });
    expect([res.status, await json(res)]).toEqual([409, { error: 'PROFILE_TAKEN' }]);
  });

  test('an unexpected failure is 500 with nothing but the code', async () => {
    deps.learners.findByAuthUser = () =>
      Promise.reject(new Error('connection refused at 10.0.0.5:5432'));
    const res = await call('GET', '/v1/me', { token: 'token-a' });
    expect(res.status).toBe(500);
    expect(await res.text()).toBe('{"error":"INTERNAL"}');
  });

  test('an unknown route is 404', async () => {
    const res = await call('GET', '/v1/nothing', { token: 'token-a' });
    expect([res.status, await json(res)]).toEqual([404, { error: 'INVALID_REQUEST' }]);
  });
});

describe('CORS', () => {
  test('an allowed origin is echoed; another is not', async () => {
    const allowed = await call('GET', '/v1/me', { token: 'token-a', origin: APP });
    expect(allowed.headers.get('access-control-allow-origin')).toBe(APP);
    expect(allowed.headers.get('vary')).toBe('Origin');
    const other = await call('GET', '/v1/me', { token: 'token-a', origin: 'https://evil.example' });
    expect(other.headers.get('access-control-allow-origin')).toBeNull();
  });

  test('a preflight is answered with 204 and the allowed methods and headers', async () => {
    const res = await call('OPTIONS', '/v1/sync/push', { origin: APP });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST, OPTIONS');
    expect(res.headers.get('access-control-allow-headers')).toBe('authorization, content-type');
  });
});

describe('streamed bodies', () => {
  test('a body with no content-length is cut off once it passes the limit', async () => {
    const CHUNK = 16_384;
    let pulled = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += CHUNK;
        controller.enqueue(new Uint8Array(CHUNK).fill(32)); // spaces: valid JSON padding
        if (pulled > 2_000_000) controller.close();
      },
    });
    const request = new Request(`${BASE}/v1/sync/push`, {
      method: 'POST',
      headers: { authorization: 'Bearer token-a', 'content-type': 'application/json' },
      body: stream,
      duplex: 'half',
    } as RequestInit);
    const res = await handle(request, deps);
    expect(res.status).toBe(413);
    expect(pulled).toBeLessThanOrEqual(262_145 + 65_536);
  });
});

describe('logging', () => {
  test('every request logs one line with its route, status and time', async () => {
    await call('GET', '/v1/me', { token: 'token-a' });
    await call('GET', '/v1/me');
    expect(logger.entries).toHaveLength(2);
    expect(logger.entries[0]).toMatchObject({ level: 'info', route: 'GET /v1/me', status: 200 });
    expect(logger.entries[1]).toMatchObject({ route: 'GET /v1/me', status: 401 });
    expect(logger.entries[1]?.code).toBe('UNAUTHENTICATED');
    expect(typeof logger.entries[0]?.ms).toBe('number');
  });

  test('a server failure logs at error level as INTERNAL', async () => {
    deps.learners.findByAuthUser = () => Promise.reject(new Error('db down: secret details'));
    const res = await call('GET', '/v1/me', { token: 'token-a' });
    expect(res.status).toBe(500);
    expect(logger.entries.at(-1)).toMatchObject({ level: 'error', code: 'INTERNAL', status: 500 });
    expect(JSON.stringify(logger.entries)).not.toContain('secret details');
  });

  test('nothing personal or secret is ever logged', async () => {
    await call('POST', '/v1/learners/link', {
      token: 'token-c',
      body: { profileId: randomUUID(), name: 'Priya Sharma' },
    });
    await call('POST', '/v1/sync/push', { token: 'token-a', body: { learnerId: a, events: [] } });
    const logged = JSON.stringify(logger.entries);
    for (const secret of ['Priya', 'token-c', 'token-a', 'profileId', 'events']) {
      expect(logged).not.toContain(secret);
    }
    expect(logged).not.toMatch(/name|email/);
  });

  test('an unknown route logs too', async () => {
    await call('GET', '/v1/nope', { token: 'token-a' });
    expect(logger.entries.at(-1)).toMatchObject({ route: 'GET /v1/nope', status: 404 });
  });
});
