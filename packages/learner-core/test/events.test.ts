import { describe, expect, test } from 'vitest';
import { createEvent, learnerEventSchema, parseEvents } from '../src/events.js';
import { fixedClock, sequentialIds } from '../src/testing/index.js';

const deps = (): {
  clock: ReturnType<typeof fixedClock>;
  ids: ReturnType<typeof sequentialIds>;
} => ({
  clock: fixedClock('2026-10-18T10:00:00Z'),
  ids: sequentialIds(),
});

describe('createEvent', () => {
  test('builds a valid event with a UUID id and the clock time', () => {
    const event = createEvent(deps(), 'learner-1', 'lesson_completed', {
      lessonId: 'ef1-01',
      correct: 4,
      scored: 5,
    });
    expect(event.id).toBe('00000000-0000-4000-8000-000000000001');
    expect(event.at).toBe('2026-10-18T10:00:00.000Z');
    expect(event.learnerId).toBe('learner-1');
    expect(learnerEventSchema.safeParse(event).success).toBe(true);
  });
});

describe('parseEvents', () => {
  const good = createEvent(deps(), 'l1', 'language_changed', { preference: 'en_only' });

  test('keeps valid events', () => {
    expect(parseEvents([good])).toEqual({ events: [good], ignored: 0 });
  });

  test('counts unknown types and malformed objects as ignored', () => {
    const unknownType = { ...good, type: 'from_the_future', data: {} };
    const badData = { ...good, data: { preference: 'klingon' } };
    const result = parseEvents([good, unknownType, badData, 42, null, 'x']);
    expect(result.events).toEqual([good]);
    expect(result.ignored).toBe(5);
  });

  test('ignores an event whose id is not a UUID', () => {
    expect(parseEvents([{ ...good, id: 'not-a-uuid' }]).ignored).toBe(1);
  });

  test('ignores a timestamp that is not ISO UTC', () => {
    expect(parseEvents([{ ...good, at: 'yesterday' }]).ignored).toBe(1);
  });

  test('keeps an event with extra unknown fields (newer app versions)', () => {
    const richer = { ...good, device: 'x', data: { ...good.data, extra: 1 } };
    const result = parseEvents([richer]);
    expect(result.ignored).toBe(0);
    expect(result.events).toHaveLength(1);
  });
});
