import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, test } from 'vitest';
import { handle, type HandlerDeps } from '../src/http/router.js';
import { memoryLogger } from '../src/logger.js';
import { memoryAuth, memoryCodeRepo } from '../src/testing/memory-auth.js';
import { makeMemoryRepos } from '../src/testing/memory-repos.js';

const BASE = 'https://x.supabase.co/functions/v1/api';
const HOUR = 3_600_000;
let deps: HandlerDeps;
let cohort: string;

const people: Record<string, { authUserId: string; provider: string; email: string | null }> = {
  'token-staff': { authUserId: 'auth-staff', provider: 'google', email: 'meena@ngo.example' },
  'token-a': { authUserId: 'auth-a', provider: 'google', email: 'a@gmail.example' },
  'token-b': { authUserId: 'auth-b', provider: 'google', email: 'b@gmail.example' },
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
  cohort = await deps.org.saveCohort({ name: 'C1', labId: lab });
  await deps.staff.save({
    email: 'meena@ngo.example',
    role: 'mentor',
    name: 'Meena',
    active: true,
    cohortIds: [cohort],
  });
  for (const token of ['token-a', 'token-b']) {
    const id = randomUUID();
    await deps.learners.createLinked({
      id,
      name: token,
      authUserId: people[token]?.authUserId ?? '',
    });
    await deps.org.setLearnerCohort(id, cohort);
  }
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
const inHours = (n: number): string => new Date(Date.now() + n * HOUR).toISOString();

describe('the booking routes', () => {
  test('a mentor publishes, a student lists and books, a second student is told it is taken', async () => {
    await call('POST', '/v1/staff/claim', 'token-staff', {});
    const made = await call('POST', '/v1/staff/booking/slot', 'token-staff', {
      startsAt: inHours(48),
      minutes: 30,
      link: 'https://meet.example/room',
    });
    expect(made.status).toBe(200);
    const { id: slotId } = (await made.json()) as { id: string };
    const list = await call('GET', '/v1/booking/slots', 'token-a');
    const open = (await list.json()) as { slots: { id: string; mentorName: string }[] };
    expect(open.slots).toMatchObject([{ id: slotId, mentorName: 'Meena' }]);
    expect(JSON.stringify(open)).not.toContain('meet.example');
    const body = { slotId, topic: 'career', note: 'CV help' };
    const booked = await call('POST', '/v1/booking/book', 'token-a', body);
    expect(booked.status).toBe(200);
    const taken = await call('POST', '/v1/booking/book', 'token-b', body);
    expect(taken.status).toBe(409);
    expect(await taken.json()).toEqual({ error: 'SLOT_TAKEN' });
    const mine = await call('GET', '/v1/booking/mine', 'token-a');
    expect(((await mine.json()) as { bookings: { link: string }[] }).bookings[0]?.link).toBe(
      'https://meet.example/room',
    );
    const staff = await call('GET', '/v1/staff/booking/slots', 'token-staff');
    const row = ((await staff.json()) as { slots: { booking: { note: string } }[] }).slots[0];
    expect(row?.booking.note).toBe('CV help');
  });

  test('bad input and the wrong caller are refused', async () => {
    await call('POST', '/v1/staff/claim', 'token-staff', {});
    const slot = { startsAt: inHours(48), minutes: 30, link: null };
    expect(
      (await call('POST', '/v1/staff/booking/slot', 'token-staff', { ...slot, minutes: 20 }))
        .status,
    ).toBe(400);
    expect(
      (
        await call('POST', '/v1/staff/booking/slot', 'token-staff', {
          ...slot,
          link: 'http://x.org',
        })
      ).status,
    ).toBe(400);
    expect((await call('POST', '/v1/staff/booking/slot', 'token-a', slot)).status).toBe(403); // a student is not staff
    expect((await call('GET', '/v1/booking/slots', 'token-staff')).status).toBe(403); // staff is not a student
    expect((await call('GET', '/v1/booking/slots', 'nobody')).status).toBe(401);
    const bad = { slotId: randomUUID(), topic: 'career', note: 'x', learnerId: randomUUID() };
    expect((await call('POST', '/v1/booking/book', 'token-a', bad)).status).toBe(400);
    expect((await call('POST', '/v1/booking/cancel', 'token-a', { id: 'x' })).status).toBe(400);
  });

  test('a student cancels their booking, and the owner removes a slot', async () => {
    await call('POST', '/v1/staff/claim', 'token-staff', {});
    const slot = await call('POST', '/v1/staff/booking/slot', 'token-staff', {
      startsAt: inHours(72),
      minutes: 45,
      link: null,
    });
    const { id: slotId } = (await slot.json()) as { id: string };
    const book = await call('POST', '/v1/booking/book', 'token-a', { slotId, topic: 'doubt' });
    const { id } = (await book.json()) as { id: string };
    expect((await call('POST', '/v1/booking/cancel', 'token-b', { id })).status).toBe(403);
    expect((await call('POST', '/v1/booking/cancel', 'token-a', { id })).status).toBe(200);
    expect((await call('POST', '/v1/booking/cancel', 'token-a', { id })).status).toBe(403);
    expect(
      (await call('POST', '/v1/staff/booking/slot/remove', 'token-staff', { id: slotId })).status,
    ).toBe(200);
    expect(
      (await call('POST', '/v1/staff/booking/slot/remove', 'token-staff', { id: slotId })).status,
    ).toBe(403);
  });
});
