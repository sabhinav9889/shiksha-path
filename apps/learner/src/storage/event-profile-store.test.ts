import 'fake-indexeddb/auto';
import { createEvent, type LearnerEvent, type Profile } from '@shiksha/learner-core';
import {
  describeEventStore,
  describeProfileStore,
  fixedClock,
  sequentialIds,
} from '@shiksha/learner-core/testing';
import { describe, expect, test } from 'vitest';
import { ShikshaDb } from './db.js';
import { IdbEventStore } from './idb-event-store.js';
import { IdbProfileStore } from './idb-profile-store.js';

let counter = 0;
const freshName = (): string => `event-test-${counter++}`;

describeEventStore('IdbEventStore', () => new IdbEventStore(new ShikshaDb(freshName())));
describeProfileStore('IdbProfileStore', () => new IdbProfileStore(new ShikshaDb(freshName())));

function makeEvents(count: number): LearnerEvent[] {
  const deps = { clock: fixedClock('2026-10-18T10:00:00Z'), ids: sequentialIds() };
  return Array.from({ length: count }, (_, i) =>
    createEvent(deps, 'a', 'language_changed', { preference: i % 2 === 0 ? 'en_only' : 'hi_en' }),
  );
}

describe('IdbEventStore', () => {
  test('the same id appended from two concurrent calls is stored once', async () => {
    const store = new IdbEventStore(new ShikshaDb(freshName()));
    const [event] = makeEvents(1);
    await Promise.all([store.append(event as LearnerEvent), store.append(event as LearnerEvent)]);
    expect(await store.all('a')).toHaveLength(1);
  });

  test('events, their order and what was acknowledged survive closing and reopening', async () => {
    const name = freshName();
    const first = new ShikshaDb(name);
    const store = new IdbEventStore(first);
    const events = makeEvents(3);
    for (const event of events) await store.append(event);
    await store.markSent([events[0]?.id ?? '']);
    await store.setMeta('lastSyncedAt:a', '2026-10-18T10:00:00.000Z');
    first.close();

    const reopened = new IdbEventStore(new ShikshaDb(name));
    expect((await reopened.all('a')).map((e) => e.id)).toEqual(events.map((e) => e.id));
    expect((await reopened.pending('a', 10)).map((e) => e.id)).toEqual([
      events[1]?.id,
      events[2]?.id,
    ]);
    expect(await reopened.getMeta('lastSyncedAt:a')).toBe('2026-10-18T10:00:00.000Z');
  });

  test('stored events come back exactly as written, without storage bookkeeping fields', async () => {
    const store = new IdbEventStore(new ShikshaDb(freshName()));
    const [event] = makeEvents(1);
    await store.append(event as LearnerEvent);
    expect(await store.all('a')).toEqual([event]);
  });

  test('server events are counted only when new, and are never pending', async () => {
    const store = new IdbEventStore(new ShikshaDb(freshName()));
    const [own, other] = makeEvents(2) as [LearnerEvent, LearnerEvent];
    await store.append(own);
    expect(await store.appendSent([own, other])).toBe(1);
    expect(await store.appendSent([other])).toBe(0);
    expect(await store.all('a')).toHaveLength(2);
    expect(await store.pending('a', 10)).toEqual([]);
  });
});

describe('IdbProfileStore', () => {
  test('profiles survive closing and reopening', async () => {
    const name = freshName();
    const first = new ShikshaDb(name);
    const profile: Profile = {
      id: 'p1',
      name: 'प्रिया',
      pin: { salt: 'c2FsdA==', hash: 'aGFzaA==', iterations: 1000 },
      failedAttempts: 2,
      lockedUntil: null,
      createdAt: '2026-10-18T10:00:00.000Z',
    };
    await new IdbProfileStore(first).put(profile);
    first.close();
    expect(await new IdbProfileStore(new ShikshaDb(name)).get('p1')).toEqual(profile);
  });
});
