import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import { handle, type HandlerDeps } from '../src/http/router.js';
import { LIMITS } from '../src/services/limits.js';
import { memoryLogger } from '../src/logger.js';
import { memoryAuth, memoryCodeRepo } from '../src/testing/memory-auth.js';
import { makeMemoryRepos } from '../src/testing/memory-repos.js';
import type { MemoryRecordingStorage } from '../src/testing/memory-recording-storage.js';

const BASE = 'https://x.supabase.co/functions/v1/api';
const DAY = 86_400_000;
let deps: HandlerDeps;
let learnerA: string;
let learnerB: string;
let staffId: string;

const people: Record<string, { authUserId: string; provider: string; email: string | null }> = {
  'token-a': { authUserId: 'auth-a', provider: 'google', email: 'a@gmail.example' },
  'token-b': { authUserId: 'auth-b', provider: 'google', email: 'b@gmail.example' },
  'token-c': { authUserId: 'auth-c', provider: 'google', email: 'c@gmail.example' },
};

beforeEach(async () => {
  const repos = makeMemoryRepos();
  deps = {
    ...repos,
    auth: { ...memoryAuth(), verify: (t: string) => Promise.resolve(people[t] ?? null) },
    codes: memoryCodeRepo(repos),
    pepper: 'test-pepper-0123456789abcdef0123456789',
    allowedOrigins: ['https://app.example.org'],
    logger: memoryLogger(),
  };
  const lab = await deps.org.saveLab({ name: 'Lab' });
  const cohort1 = await deps.org.saveCohort({ name: 'C1', labId: lab });
  const cohort2 = await deps.org.saveCohort({ name: 'C2', labId: lab });
  staffId = await deps.staff.save({
    email: 'meena@ngo.example',
    role: 'mentor',
    name: 'Meena',
    active: true,
    cohortIds: [cohort1],
  });
  const ids: Record<string, string> = {};
  for (const [token, cohort] of [
    ['token-a', cohort1],
    ['token-b', cohort2],
    ['token-c', cohort1],
  ] as const) {
    const id = randomUUID();
    ids[token] = id;
    await deps.learners.createLinked({
      id,
      name: token,
      authUserId: people[token]?.authUserId ?? '',
    });
    await deps.org.setLearnerCohort(id, cohort);
  }
  learnerA = ids['token-a'] ?? '';
  learnerB = ids['token-b'] ?? '';
});

const call = (method: string, path: string, token?: string): Promise<Response> =>
  handle(
    new Request(`${BASE}${path}`, {
      method,
      headers: token ? { authorization: `Bearer ${token}` } : {},
    }),
    deps,
  );

async function addRecording(
  learnerId: string,
  daysAgo: number,
  state: 'pending' | 'uploaded' | 'reviewed',
  comment: string | null = null,
): Promise<string> {
  const id = randomUUID();
  const at = new Date(Date.now() - daysAgo * DAY);
  await deps.recordings.create({
    id,
    learnerId,
    lessonId: 'ef1-15-say-it-aloud',
    itemId: 'speak-1',
    mime: 'audio/webm',
    bytes: 1000,
    durationMs: 4000,
    recordedAt: at.toISOString(),
  });
  if (state !== 'pending') {
    (deps.storage as MemoryRecordingStorage).put(`${learnerId}/${id}`, 1000);
    await deps.recordings.markUploaded(id, at);
  }
  if (state === 'reviewed') await deps.recordings.review(id, staffId, comment, at);
  return id;
}

describe('GET /v1/me/recordings', () => {
  test('lists only my uploaded recordings, newest first, with the review', async () => {
    const old = await addRecording(learnerA, 5, 'reviewed', 'Good, slow down a little.');
    const fresh = await addRecording(learnerA, 1, 'uploaded');
    await addRecording(learnerA, 0, 'pending');
    await addRecording(learnerB, 2, 'reviewed', 'Another student’s private feedback');
    const res = await call('GET', '/v1/me/recordings', 'token-a');
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      recordings: { id: string; reviewedAt: string | null; comment: string | null }[];
    };
    expect(body.recordings.map((r) => r.id)).toEqual([fresh, old]);
    expect(body.recordings[0]).toMatchObject({ reviewedAt: null, comment: null });
    expect(body.recordings[1]).toMatchObject({ comment: 'Good, slow down a little.' });
    expect(body.recordings[1]?.reviewedAt).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toContain('private feedback');
  });

  test('a review with no comment shows as reviewed with a null comment', async () => {
    await addRecording(learnerA, 1, 'reviewed', null);
    const res = await call('GET', '/v1/me/recordings', 'token-a');
    const body = (await res.json()) as { recordings: { reviewedAt: string; comment: null }[] };
    expect(body.recordings[0]?.comment).toBeNull();
    expect(body.recordings[0]?.reviewedAt).toEqual(expect.any(String));
  });

  test('sends no mentor identity, storage path or learner id', async () => {
    await addRecording(learnerA, 1, 'reviewed', 'Nice');
    const text = await (await call('GET', '/v1/me/recordings', 'token-a')).text();
    expect(text).not.toContain(staffId);
    expect(text).not.toContain(learnerA);
    expect(text).not.toContain('meena');
    expect(text).not.toContain('Meena');
  });

  test('a student with nothing recorded gets an empty list; no token is refused', async () => {
    const res = await call('GET', '/v1/me/recordings', 'token-c');
    expect(await res.json()).toEqual({ recordings: [] });
    expect((await call('GET', '/v1/me/recordings')).status).toBe(401);
  });
});

describe('GET /v1/me/recording-url', () => {
  test('gives my own uploaded recording a five-minute link', async () => {
    const id = await addRecording(learnerA, 1, 'uploaded');
    const res = await call('GET', `/v1/me/recording-url?id=${id}`, 'token-a');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ url: `memory://read/${learnerA}/${id}?ttl=300` });
  });

  test('another student’s recording and an unknown id answer the same: forbidden', async () => {
    const theirs = await addRecording(learnerB, 1, 'uploaded');
    const mine = await call('GET', `/v1/me/recording-url?id=${theirs}`, 'token-a');
    const unknown = await call('GET', `/v1/me/recording-url?id=${randomUUID()}`, 'token-a');
    expect(mine.status).toBe(403);
    expect(unknown.status).toBe(403);
    expect(await mine.json()).toEqual(await unknown.json());
  });

  test('a classmate in the same cohort cannot play my recording', async () => {
    const id = await addRecording(learnerA, 1, 'uploaded');
    const res = await call('GET', `/v1/me/recording-url?id=${id}`, 'token-c');
    expect(res.status).toBe(403);
  });

  test('a recording still pending upload has no link; a bad id is invalid', async () => {
    const id = await addRecording(learnerA, 0, 'pending');
    expect((await call('GET', `/v1/me/recording-url?id=${id}`, 'token-a')).status).toBe(400);
    expect((await call('GET', '/v1/me/recording-url?id=nope', 'token-a')).status).toBe(400);
    expect((await call('GET', `/v1/me/recording-url?id=${id}`)).status).toBe(401);
  });

  test('playing again and again is rate limited', async () => {
    const id = await addRecording(learnerA, 1, 'uploaded');
    for (let i = 0; i < LIMITS.playback.limit; i += 1) {
      expect((await call('GET', `/v1/me/recording-url?id=${id}`, 'token-a')).status).toBe(200);
    }
    const res = await call('GET', `/v1/me/recording-url?id=${id}`, 'token-a');
    expect(res.status).toBe(429);
  });
});
