import { beforeEach, describe, expect, test } from 'vitest';
import { handle, type HandlerDeps } from '../src/http/router.js';
import { memoryLogger } from '../src/logger.js';
import { memoryAuth, memoryCodeRepo } from '../src/testing/memory-auth.js';
import { makeMemoryRepos } from '../src/testing/memory-repos.js';

const BASE = 'https://x.supabase.co/functions/v1/api';
let deps: HandlerDeps;

beforeEach(() => {
  const repos = makeMemoryRepos();
  const auth = {
    ...memoryAuth(),
    verify: (t: string) =>
      Promise.resolve(
        t === 'token-c'
          ? { authUserId: 'auth-c', provider: 'google', email: 'auth-c@ngo.example' }
          : null,
      ),
  };
  deps = {
    ...repos,
    auth,
    codes: memoryCodeRepo(repos),
    pepper: 'test-pepper-0123456789abcdef0123456789',
    allowedOrigins: ['https://app.example.org'],
    logger: memoryLogger(),
  };
});

const post = (path: string, body: unknown): Promise<Response> =>
  handle(
    new Request(`${BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: 'Bearer token-c' },
      body: JSON.stringify(body),
    }),
    deps,
  );

describe('POST /v1/staff/admin/cohort/delete and /lab/delete', () => {
  test('a mentor is refused; an admin deletes an empty one and gets 409 for a busy one', async () => {
    const lab = await deps.org.saveLab({ name: 'Lab' });
    const cohort = await deps.org.saveCohort({ name: 'C1', labId: lab });
    await deps.staff.save({
      email: 'auth-c@ngo.example',
      role: 'mentor',
      name: 'M',
      active: true,
      cohortIds: [cohort],
    });
    await post('/v1/staff/claim', {});
    expect((await post('/v1/staff/admin/cohort/delete', { id: cohort })).status).toBe(403);
    const [mentor] = await deps.staff.list();
    await deps.staff.save({ ...mentor!, role: 'admin', cohortIds: [] });
    const busy = await post('/v1/staff/admin/lab/delete', { id: lab });
    expect(busy.status).toBe(409);
    expect(await busy.json()).toEqual({ error: 'NOT_EMPTY' });
    expect((await post('/v1/staff/admin/cohort/delete', { id: cohort })).status).toBe(200);
    expect((await post('/v1/staff/admin/lab/delete', { id: lab })).status).toBe(200);
    expect((await post('/v1/staff/admin/lab/delete', { id: 'not-a-uuid' })).status).toBe(400);
  });
});
