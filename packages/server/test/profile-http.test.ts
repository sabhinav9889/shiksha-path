import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import { handle, type HandlerDeps } from '../src/http/router.js';
import { memoryLogger } from '../src/logger.js';
import { memoryAuth, memoryCodeRepo } from '../src/testing/memory-auth.js';
import { makeMemoryRepos } from '../src/testing/memory-repos.js';

const BASE = 'https://x.supabase.co/functions/v1/api';
let deps: HandlerDeps;
let cohortA: string;
let cohortB: string;
let learnerA: string;

const people: Record<string, { authUserId: string; provider: string; email: string | null }> = {
  'token-a': { authUserId: 'auth-a', provider: 'google', email: 'priya@gmail.example' },
  'token-b': { authUserId: 'auth-b', provider: 'google', email: 'ravi.s@gmail.example' },
  'token-code': { authUserId: 'auth-code', provider: 'email', email: 'x@code.invalid' },
  'token-none': { authUserId: 'auth-none', provider: 'google', email: 'none@gmail.example' },
  'token-staff': { authUserId: 'auth-staff', provider: 'google', email: 'meena@ngo.example' },
};

const mentor = (name: string, cohortIds: string[], active = true) =>
  deps.staff.save({ email: `${name}@ngo.example`, role: 'mentor', name, active, cohortIds });

beforeEach(async () => {
  const repos = makeMemoryRepos();
  const auth = {
    ...memoryAuth(),
    verify: (t: string) => Promise.resolve(people[t] ?? null),
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
  cohortA = await deps.org.saveCohort({ name: 'सुबह', labId: lab });
  cohortB = await deps.org.saveCohort({ name: 'शाम', labId: lab });
  const link = async (token: string, cohort: string | null): Promise<string> => {
    const id = randomUUID();
    await deps.learners.createLinked({
      id,
      name: token,
      authUserId: people[token]?.authUserId ?? '',
    });
    if (cohort) await deps.org.setLearnerCohort(id, cohort);
    return id;
  };
  learnerA = await link('token-a', cohortA);
  await link('token-b', cohortB);
  await link('token-code', cohortA);
  await link('token-none', null);
});

const ask = (token: string): Promise<Response> =>
  handle(
    new Request(`${BASE}/v1/me/profile`, { headers: { authorization: `Bearer ${token}` } }),
    deps,
  );
const read = async (token: string): Promise<Record<string, unknown>> =>
  (await (await ask(token)).json()) as Record<string, unknown>;

describe('GET /v1/me/profile: a student sees their own email, cohort and mentors', () => {
  test('each student sees their own cohort and only that cohort’s active mentors', async () => {
    await mentor('Meena', [cohortA]);
    await mentor('Ravi', [cohortA, cohortB]);
    await mentor('Paused', [cohortA], false);
    await mentor('Other', [cohortB]);
    const a = await read('token-a');
    expect(a['email']).toBe('priya@gmail.example');
    expect(a['cohort']).toMatchObject({ name: 'सुबह' });
    expect(a['mentors']).toEqual([
      { name: 'Meena', email: 'Meena@ngo.example' },
      { name: 'Ravi', email: 'Ravi@ngo.example' },
    ]);
    const b = await read('token-b');
    expect(b['email']).toBe('ravi.s@gmail.example');
    expect(b['cohort']).toMatchObject({ name: 'शाम' });
    expect((b['mentors'] as { name: string }[]).map((m) => m.name)).toEqual(['Other', 'Ravi']);
  });

  test('no cohort means no mentors; a backup-code student has no email to show', async () => {
    await mentor('Meena', [cohortA]);
    const none = await read('token-none');
    expect(none).toMatchObject({ cohort: null, mentors: [], email: 'none@gmail.example' });
    const code = await read('token-code');
    expect(code['email']).toBeNull();
    expect(code['cohort']).toMatchObject({ name: 'सुबह' });
  });

  test('admins are not listed as mentors; staff and strangers are refused', async () => {
    await deps.staff.save({
      email: 'boss@ngo.example',
      role: 'admin',
      name: 'Boss',
      active: true,
      cohortIds: [],
    });
    expect((await read('token-a'))['mentors']).toEqual([]);
    expect((await ask('token-staff')).status).toBe(403);
    expect((await ask('nobody')).status).toBe(401);
  });

  test('a paused student gets nothing, and an answer carries no other student', async () => {
    expect(JSON.stringify(await read('token-a'))).not.toMatch(/ravi\.s|none@|code\.invalid/);
    await deps.org.setDeactivated(learnerA, true);
    const res = await ask('token-a');
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'DEACTIVATED' });
  });
});
