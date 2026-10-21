import { randomUUID } from 'node:crypto';
import { cryptoIds, createEvent, systemClock, type LearnerEvent } from '@shiksha/learner-core';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
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
