import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import { handle, type HandlerDeps } from '../src/http/router.js';
import { memoryLogger } from '../src/logger.js';
import { memoryAuth, memoryCodeRepo } from '../src/testing/memory-auth.js';
import { makeMemoryRepos } from '../src/testing/memory-repos.js';

const BASE = 'https://x.supabase.co/functions/v1/api';
let deps: HandlerDeps;
let cohort: string;
let learner: string;

beforeEach(async () => {
  const repos = makeMemoryRepos();
  const people: Record<string, { authUserId: string; email: string | null }> = {
    'token-staff': { authUserId: 'auth-staff', email: 'mentor@ngo.example' },
    'token-learner': { authUserId: 'auth-learner', email: null },
  };
  const auth = {
    ...memoryAuth(),
    verify: (t: string) => {
      const who = people[t];
      return Promise.resolve(who ? { ...who, provider: 'google' } : null);
    },
  };
  deps = {
    ...repos,
    auth,
    codes: memoryCodeRepo(repos),
    pepper: 'test-pepper-0123456789abcdef0123456789',
    allowedOrigins: ['https://app.example.org'],
    logger: memoryLogger(),
  };
  const lab = await deps.org.saveLab({ name: 'Lab' });
  cohort = await deps.org.saveCohort({ name: 'C1', labId: lab });
  await deps.staff.save({
    email: 'mentor@ngo.example',
    role: 'mentor',
    name: 'Meena',
    active: true,
    cohortIds: [cohort],
  });
  learner = randomUUID();
  await deps.learners.createLinked({ id: learner, name: 'A', authUserId: 'auth-learner' });
  await deps.org.setLearnerCohort(learner, cohort);
});

const call = (method: string, path: string, token: string, body?: unknown): Promise<Response> =>
  handle(
    new Request(`${BASE}${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    deps,
  );

const post = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  title: 'Mock interview',
  body: 'Bring a pen',
  audience: { kind: 'cohort', cohortId: cohort },
  session: null,
  ...over,
});

describe('the community routes', () => {
  test('a mentor posts to their cohort; the student reads it; both are refused otherwise', async () => {
    await call('POST', '/v1/staff/claim', 'token-staff', {});
    const made = await call('POST', '/v1/staff/community/post', 'token-staff', post());
    expect(made.status).toBe(200);
    const { id } = (await made.json()) as { id: string };
    const feed = await call('GET', '/v1/community/feed', 'token-learner');
    expect(feed.status).toBe(200);
    const body = (await feed.json()) as { posts: { id: string; authorName: string }[] };
    expect(body.posts).toMatchObject([{ id, authorName: 'Meena' }]);
    const list = await call('GET', '/v1/staff/community/posts', 'token-staff');
    expect(((await list.json()) as { posts: unknown[] }).posts).toHaveLength(1);
    // A learner's token is not staff; a staff token is not a learner.
    expect((await call('GET', '/v1/staff/community/posts', 'token-learner')).status).toBe(403);
    expect((await call('GET', '/v1/community/feed', 'token-staff')).status).not.toBe(200);
    expect((await call('GET', '/v1/community/feed', 'nobody')).status).toBe(401);
  });

  test('a mentor may not post to everyone, and a bad link or an unknown key is refused', async () => {
    await call('POST', '/v1/staff/claim', 'token-staff', {});
    const everyone = await call(
      'POST',
      '/v1/staff/community/post',
      'token-staff',
      post({ audience: { kind: 'all' } }),
    );
    expect(everyone.status).toBe(403);
    const session = { startsAt: '2026-11-10T10:00:00+05:30', minutes: 60, link: 'http://x.org' };
    expect(
      (await call('POST', '/v1/staff/community/post', 'token-staff', post({ session }))).status,
    ).toBe(400);
    expect(
      (await call('POST', '/v1/staff/community/post', 'token-staff', post({ pinned: 1 }))).status,
    ).toBe(400);
    expect(await deps.posts.feed(cohort, 30)).toEqual([]);
  });

  test('the author deletes; a second delete and a bad id are refused', async () => {
    await call('POST', '/v1/staff/claim', 'token-staff', {});
    const made = await call('POST', '/v1/staff/community/post', 'token-staff', post());
    const { id } = (await made.json()) as { id: string };
    expect((await call('POST', '/v1/staff/community/delete', 'token-staff', { id })).status).toBe(
      200,
    );
    expect((await call('POST', '/v1/staff/community/delete', 'token-staff', { id })).status).toBe(
      403,
    );
    expect(
      (await call('POST', '/v1/staff/community/delete', 'token-staff', { id: 'x' })).status,
    ).toBe(400);
  });
});
