import { beforeEach, describe, expect, test } from 'vitest';
import { createEvent, type LearnerEvent } from '../src/events.js';
import { OUTBOX_BATCH_SIZE, flushOutbox, retryDelayMs, type SyncTransport } from '../src/outbox.js';
import { deriveProgress } from '../src/progress.js';
import {
  MemoryEventStore,
  describeEventStore,
  fixedClock,
  sequentialIds,
} from '../src/testing/index.js';

describeEventStore('MemoryEventStore', () => new MemoryEventStore());

let store: MemoryEventStore;
let clock: ReturnType<typeof fixedClock>;
let ids: ReturnType<typeof sequentialIds>;

beforeEach(() => {
  store = new MemoryEventStore();
  clock = fixedClock('2026-10-18T10:00:00Z');
  ids = sequentialIds();
});

async function fill(learnerId: string, count: number): Promise<LearnerEvent[]> {
  const events: LearnerEvent[] = [];
  for (let i = 0; i < count; i += 1) {
    clock.advanceMs(1000);
    const data = { lessonId: `l${i}`, correct: 1, scored: 1 };
    const event = createEvent({ clock, ids }, learnerId, 'lesson_completed', data);
    await store.append(event);
    events.push(event);
  }
  return events;
}

/** A fake server that records pushes; `behave` can make a push throw or accept only some ids. */
function transport(
  behave: (call: number, events: LearnerEvent[]) => string[] | Error = (_n, e) =>
    e.map((x) => x.id),
): SyncTransport & { pushes: LearnerEvent[][]; server: LearnerEvent[] } {
  const pushes: LearnerEvent[][] = [];
  const server: LearnerEvent[] = [];
  return {
    pushes,
    server,
    push(_learnerId, events) {
      pushes.push(events);
      const result = behave(pushes.length, events);
      if (result instanceof Error) return Promise.reject(result);
      server.push(...events.filter((e) => result.includes(e.id)));
      return Promise.resolve({ accepted: result });
    },
  };
}

const flush = (t: SyncTransport, learnerId = 'a'): ReturnType<typeof flushOutbox> =>
  flushOutbox(learnerId, { store, transport: t, clock });

describe('retryDelayMs', () => {
  test('is 0, then 5 s doubling, capped at 15 minutes', () => {
    expect([0, 1, 2, 3, 4].map(retryDelayMs)).toEqual([0, 5000, 10_000, 20_000, 40_000]);
    expect(retryDelayMs(8)).toBe(640_000);
    expect(retryDelayMs(9)).toBe(900_000);
    expect(retryDelayMs(500)).toBe(900_000);
  });
});

describe('flushOutbox', () => {
  test('sends 120 events in batches of 50, 50 and 20 and records the sync time', async () => {
    await fill('a', 120);
    const t = transport();
    const result = await flush(t);
    expect(OUTBOX_BATCH_SIZE).toBe(50);
    expect(t.pushes.map((p) => p.length)).toEqual([50, 50, 20]);
    expect(result).toEqual({ ok: true, sent: 120, remaining: 0, nextAttemptInMs: null });
    expect(await store.pending('a', 1000)).toEqual([]);
    expect(await store.getMeta('lastSyncedAt:a')).toBe(clock.now().toISOString());
  });

  test('with nothing to send it succeeds without calling the server', async () => {
    const t = transport();
    expect(await flush(t)).toEqual({ ok: true, sent: 0, remaining: 0, nextAttemptInMs: null });
    expect(t.pushes).toHaveLength(0);
  });

  test('a failure keeps the rest pending, backs off, and a later success drains it', async () => {
    await fill('a', 120);
    const failing = transport((call, e) =>
      call === 2 ? new Error('offline') : e.map((x) => x.id),
    );
    const first = await flush(failing);
    expect(first).toEqual({ ok: false, sent: 50, remaining: 70, nextAttemptInMs: 5000 });
    const dead = transport(() => new Error('offline'));
    expect((await flush(dead)).nextAttemptInMs).toBe(10_000);
    const ok = await flush(transport());
    expect(ok).toEqual({ ok: true, sent: 70, remaining: 0, nextAttemptInMs: null });
    const again = await flush(transport(() => new Error('offline')));
    expect(again.nextAttemptInMs).toBeNull();
  });

  test('the delay doubles and is capped from the 9th failure', async () => {
    await fill('a', 1);
    const delays: (number | null)[] = [];
    for (let i = 0; i < 10; i += 1) {
      delays.push((await flush(transport(() => new Error('offline')))).nextAttemptInMs);
    }
    expect(delays).toEqual([
      5000, 10_000, 20_000, 40_000, 80_000, 160_000, 320_000, 640_000, 900_000, 900_000,
    ]);
  });

  test('only accepted ids are marked sent; the rest stay pending', async () => {
    const events = await fill('a', 5);
    const allowed = events.slice(0, 2).map((e) => e.id);
    const t = transport((call) => (call === 1 ? allowed : []));
    const result = await flush(t);
    expect(result).toMatchObject({ ok: false, sent: 2, remaining: 3 });
    expect((await store.pending('a', 10)).map((e) => e.id)).toEqual(
      events.slice(2).map((e) => e.id),
    );
  });

  test('a transport that accepts none stops after one push', async () => {
    await fill('a', 3);
    const t = transport(() => []);
    const result = await flush(t);
    expect(result).toMatchObject({ ok: false, sent: 0, remaining: 3 });
    expect(t.pushes).toHaveLength(1);
  });

  test('ids the server accepts that were not sent are ignored', async () => {
    await fill('a', 2);
    const result = await flush(transport(() => ['not-an-event-id']));
    expect(result).toMatchObject({ ok: false, sent: 0, remaining: 2 });
  });

  test('two simultaneous flushes share one run', async () => {
    await fill('a', 120);
    const t = transport();
    const [x, y] = await Promise.all([flush(t), flush(t)]);
    expect(t.pushes.map((p) => p.length)).toEqual([50, 50, 20]);
    expect(x).toEqual(y);
  });

  test("learner A's flush never sends learner B's events", async () => {
    await fill('a', 3);
    await fill('b', 4);
    const t = transport();
    await flush(t, 'a');
    expect(t.server.every((e) => e.learnerId === 'a')).toBe(true);
    expect(await store.pending('b', 10)).toHaveLength(4);
  });

  test('never throws, even when the store itself fails', async () => {
    await fill('a', 2);
    const broken = Object.create(store, {
      pending: { value: () => Promise.reject(new Error('disk')) },
    }) as MemoryEventStore;
    const result = await flushOutbox('a', { store: broken, transport: transport(), clock });
    expect(result.ok).toBe(false);
  });
});

describe('restoring on a second device', () => {
  test('events pulled back from the server rebuild the same progress', async () => {
    const events = await fill('a', 10);
    const t = transport();
    await flush(t);
    const fresh = new MemoryEventStore();
    for (const event of t.server) await fresh.append(event);
    for (const event of t.server) await fresh.append(event); // pulled twice
    expect(await fresh.all('a')).toHaveLength(events.length);
    expect(deriveProgress(await fresh.all('a'))).toEqual(deriveProgress(await store.all('a')));
  });
});
