import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cryptoIds, createEvent, systemClock, type LearnerEvent } from '@shiksha/learner-core';
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { PgCodeRepo } from '../../packages/server/src/adapters/pg-code-repo.js';
import { PgLearnerRepo } from '../../packages/server/src/adapters/pg-learner-repo.js';
import { PgRateLimiter } from '../../packages/server/src/adapters/pg-rate-limiter.js';
import { PgSwitchRepo } from '../../packages/server/src/adapters/pg-switch-repo.js';
import { createSupabaseAuth } from '../../packages/server/src/adapters/supabase-auth.js';
import { issueCode } from '../../packages/server/src/services/codes.js';
import { connect } from './db.js';
import { deleteUser, localStack, makeUser } from './stack.js';

// Needs `npm run functions:serve` running next to the local stack.
const sql = connect();
let a: { id: string; accessToken: string; learner: string };
let b: { id: string; accessToken: string; learner: string };

async function api(path: string, token: string, body?: unknown): Promise<Response> {
  const init: RequestInit = {
    method: body === undefined ? 'GET' : 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
  };
  if (body !== undefined) init.body = JSON.stringify(body);
  return fetch(`${localStack().functionsUrl}${path}`, init);
}

const event = (learnerId: string): LearnerEvent =>
  createEvent({ clock: systemClock, ids: cryptoIds }, learnerId, 'language_changed', {
    preference: 'hi_en',
  });

beforeAll(async () => {
  for (const name of ['a', 'b'] as const) {
    const user = await makeUser();
    const learner = randomUUID();
    const res = await api('/v1/learners/link', user.accessToken, { profileId: learner, name });
    expect(res.status).toBe(200);
    if (name === 'a') a = { ...user, learner };
    else b = { ...user, learner };
  }
  // B has learning of its own, so "B sees only B's rows" is checked against real rows.
  const res = await api('/v1/sync/push', b.accessToken, {
    learnerId: b.learner,
    events: [event(b.learner)],
  });
  expect(res.status).toBe(200);
});

afterAll(async () => {
  for (const user of [a, b]) {
    await sql`delete from learners where id = ${user.learner}`;
    await deleteUser(user.id);
  }
  await sql.end();
});

describe('the /v1 API served by the Edge Function', () => {
  test('a learner pushes events, pushes them again, and pulls them back', async () => {
    const events = [event(a.learner), event(a.learner), event(a.learner)];
    for (let round = 0; round < 2; round += 1) {
      const res = await api('/v1/sync/push', a.accessToken, { learnerId: a.learner, events });
      expect(((await res.json()) as { accepted: string[] }).accepted).toHaveLength(3);
    }
    const rows =
      await sql`select count(*)::int as n from learner_events where learner_id = ${a.learner}`;
    expect(rows[0]?.n).toBe(3);
    const pull = (await (await api('/v1/sync/pull?after=0', a.accessToken)).json()) as {
      events: LearnerEvent[];
    };
    expect(pull.events.map((e) => e.id).sort()).toEqual(events.map((e) => e.id).sort());
  });

  test("another learner can neither read A's events nor push as A", async () => {
    const res = await api('/v1/sync/pull?after=0', b.accessToken);
    expect(res.status).toBe(200);
    const pull = (await res.json()) as { events: LearnerEvent[] };
    expect(pull.events.length).toBeGreaterThan(0);
    expect(pull.events.every((e) => e.learnerId === b.learner)).toBe(true);
    const push = await api('/v1/sync/push', b.accessToken, {
      learnerId: a.learner,
      events: [event(a.learner)],
    });
    expect(push.status).toBe(403);
  });

  test('me returns all six switches', async () => {
    const me = (await (await api('/v1/me', a.accessToken)).json()) as {
      switches: Record<string, boolean>;
    };
    expect(Object.keys(me.switches)).toHaveLength(6);
  });

  test("going around the API with a student's token still shows only their rows and writes nothing", async () => {
    const { apiUrl, anonKey } = localStack();
    const headers = {
      apikey: anonKey,
      authorization: `Bearer ${b.accessToken}`,
      'content-type': 'application/json',
    };
    const read = await fetch(`${apiUrl}/rest/v1/learner_events?select=learner_id`, { headers });
    expect(read.status).toBe(200);
    const rows = (await read.json()) as { learner_id: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.learner_id === b.learner)).toBe(true);
    const write = await fetch(`${apiUrl}/rest/v1/learner_events`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: randomUUID(),
        learner_id: a.learner,
        type: 'x',
        at: new Date().toISOString(),
        data: {},
      }),
    });
    expect(write.ok).toBe(false);
    const forA =
      await sql`select count(*)::int as n from learner_events where learner_id = ${a.learner} and type = 'x'`;
    expect(forA[0]?.n).toBe(0);
  });
});

describe('sign-ups', () => {
  // Supabase cannot keep email login for server-made users while refusing self sign-up, so
  // sign-up stays on with confirmation required: a stranger gets no session (Plan 3b ruling).
  test('nobody can sign themselves up with an email and password and get a session', async () => {
    const { apiUrl, anonKey } = localStack();
    const client = createClient(apiUrl, anonKey, { auth: { persistSession: false } });
    const { data, error } = await client.auth.signUp({
      email: `${randomUUID()}@test.local`,
      password: `pw-${randomUUID()}`,
    });
    expect(error !== null || data.session === null).toBe(true);
    expect(data.session).toBeNull();
  });

  test('an email sign-in /v1 did not issue cannot create a learner', async () => {
    const user = await makeUser('email');
    const res = await api('/v1/learners/link', user.accessToken, {
      profileId: randomUUID(),
      name: 'stranger',
    });
    expect(res.status).toBe(403);
    await deleteUser(user.id);
  });

  test('a user the server creates can still sign in with a password', async () => {
    const user = await makeUser(); // admin createUser, then signInWithPassword
    expect(user.accessToken).toBeTruthy();
    await deleteUser(user.id);
  });
});

describe('recordings through the function and the bucket', () => {
  const recording = (over: Record<string, unknown> = {}) => ({
    id: randomUUID(),
    lessonId: 'ef1-02',
    itemId: 's1',
    mime: 'audio/webm',
    bytes: 4,
    durationMs: 1000,
    at: new Date().toISOString(),
    ...over,
  });
  const upload = (
    url: string,
    bytes: Uint8Array<ArrayBuffer>,
    type = 'audio/webm',
  ): Promise<Response> =>
    fetch(url, { method: 'PUT', headers: { 'content-type': type }, body: bytes });

  async function begin(token: string, body: Record<string, unknown>): Promise<string> {
    const res = await api('/v1/recordings/start', token, body);
    expect(res.status).toBe(200);
    const { uploadUrl } = (await res.json()) as { uploadUrl: string };
    return uploadUrl;
  }

  test('start, upload to the signed URL, then complete', async () => {
    const body = recording();
    const url = await begin(a.accessToken, body);
    expect((await upload(url, Uint8Array.of(1, 2, 3, 4))).ok).toBe(true);
    const done = await api('/v1/recordings/complete', a.accessToken, { id: body.id });
    expect([done.status, await done.json()]).toEqual([200, { status: 'uploaded' }]);
    const [row] = await sql`select status, learner_id from recordings where id = ${body.id}`;
    expect(row).toEqual({ status: 'uploaded', learner_id: a.learner });
  });

  test('the bucket refuses more than 1 MB or a type that is not audio, whatever was declared', async () => {
    const big = await begin(a.accessToken, recording());
    expect((await upload(big, new Uint8Array(1_048_577))).ok).toBe(false);
    const html = await begin(a.accessToken, recording());
    expect((await upload(html, new TextEncoder().encode('<b>x</b>'), 'text/html')).ok).toBe(false);
  });

  test("another student can neither read nor list A's recordings with their own token", async () => {
    const body = recording();
    await upload(await begin(a.accessToken, body), Uint8Array.of(9, 9));
    const { apiUrl, anonKey } = localStack();
    const headers = { apikey: anonKey, authorization: `Bearer ${b.accessToken}` };
    const read = await fetch(`${apiUrl}/storage/v1/object/recordings/${a.learner}/${body.id}`, {
      headers,
    });
    expect(read.ok).toBe(false);
    const list = await fetch(`${apiUrl}/storage/v1/object/list/recordings`, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify({ prefix: a.learner }),
    });
    const listed = list.ok ? ((await list.json()) as unknown[]) : [];
    expect(listed).toEqual([]);
    await begin(b.accessToken, recording()); // B has a recording row of their own
    const rest = await fetch(`${apiUrl}/rest/v1/recordings?select=learner_id`, { headers });
    expect(rest.status).toBe(200);
    const rows = (await rest.json()) as { learner_id: string }[];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.learner_id === b.learner)).toBe(true);
  });
});

describe('backup codes through the function', () => {
  test('a code signs in, the session reaches /v1/me, and a wrong code is BAD_CODE', async () => {
    // The pepper is the local placeholder from the functions' .env.local (not a secret).
    const env = readFileSync('supabase/functions/.env.local', 'utf8');
    const pepper = /^CODE_PEPPER=(.+)$/m.exec(env)?.[1] ?? '';
    const { apiUrl, serviceKey } = localStack();
    const deps = {
      learners: new PgLearnerRepo(sql),
      switches: new PgSwitchRepo(sql),
      codes: new PgCodeRepo(sql),
      auth: createSupabaseAuth(apiUrl, serviceKey),
      limiter: new PgRateLimiter(sql),
      pepper,
    };
    const { learnerId, code } = await issueCode(deps, { name: 'कोड' });
    const res = await fetch(`${localStack().functionsUrl}/v1/auth/code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    expect(res.status).toBe(200);
    const { accessToken } = (await res.json()) as { accessToken: string };
    const me = (await (await api('/v1/me', accessToken)).json()) as { learner: { id: string } };
    expect(me.learner.id).toBe(learnerId);
    const wrong = await fetch(`${localStack().functionsUrl}/v1/auth/code`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ code: 'ABCD-EFGH' }),
    });
    expect([wrong.status, await wrong.json()]).toEqual([401, { error: 'BAD_CODE' }]);
    const [row] = await sql<{ auth_user_id: string }[]>`
      select auth_user_id from login_codes where learner_id = ${learnerId}`;
    await sql`delete from learners where id = ${learnerId}`;
    await deps.auth.deleteUser(row?.auth_user_id ?? '');
  });
});

describe('a mentor reviewing a recording through the function', () => {
  /** A claimed mentor (Google stand-in) whose one cohort holds learner A. */
  async function mentorOfA(): Promise<{ token: string; cleanup: () => Promise<void> }> {
    const mentor = await makeUser();
    const [user] = await sql<
      { email: string }[]
    >`select email from auth.users where id = ${mentor.id}`;
    const [cohort] = await sql<{ id: string }[]>`
      insert into cohorts (name) values ('review cohort') returning id`;
    const cohortId = cohort?.id ?? '';
    await sql`update learners set cohort_id = ${cohortId} where id = ${a.learner}`;
    const [staff] = await sql<{ id: string }[]>`
      insert into staff (email, role, name) values (${user?.email ?? ''}, 'mentor', 'M') returning id`;
    const staffId = staff?.id ?? '';
    await sql`insert into staff_cohorts (staff_id, cohort_id) values (${staffId}, ${cohortId})`;
    expect((await api('/v1/staff/claim', mentor.accessToken, {})).status).toBe(200);
    return {
      token: mentor.accessToken,
      async cleanup() {
        await sql`delete from staff where id = ${staffId}`;
        await sql`update learners set cohort_id = null where id = ${a.learner}`;
        await sql`delete from cohorts where id = ${cohortId}`;
        await deleteUser(mentor.id);
      },
    };
  }

  async function uploadedByA(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
    const id = randomUUID();
    const start = await api('/v1/recordings/start', a.accessToken, {
      id,
      lessonId: 'ef1-02',
      itemId: 's1',
      mime: 'audio/webm',
      bytes: bytes.length,
      durationMs: 1000,
      at: new Date().toISOString(),
    });
    const { uploadUrl } = (await start.json()) as { uploadUrl: string };
    await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'audio/webm' },
      body: bytes,
    });
    await api('/v1/recordings/complete', a.accessToken, { id });
    return id;
  }

  test('plays it through a signed link, and reviews it', async () => {
    const mentor = await mentorOfA();
    const id = await uploadedByA(Uint8Array.of(5, 6, 7));
    const link = await api(`/v1/staff/recording-url?id=${id}`, mentor.token);
    expect(link.status).toBe(200);
    const { url } = (await link.json()) as { url: string };
    expect([...new Uint8Array(await (await fetch(url)).arrayBuffer())]).toEqual([5, 6, 7]);
    const review = await api('/v1/staff/recordings/review', mentor.token, { id, comment: 'ok' });
    expect(review.status).toBe(200);
    expect((await api(`/v1/staff/recording-url?id=${id}`, b.accessToken)).status).toBe(403);
    await mentor.cleanup();
  });
});
