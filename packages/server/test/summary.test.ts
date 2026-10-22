import {
  createEvent,
  type EventData,
  type EventType,
  type LearnerEvent,
} from '@shiksha/learner-core';
import { fixedClock, sequentialIds } from '@shiksha/learner-core/testing';
import { describe, expect, test } from 'vitest';
import { needsAttention, summarise } from '../src/services/summary.js';

/** Events at given IST days (10:00 IST = 04:30 UTC). */
function log() {
  const clock = fixedClock('2026-10-01T04:30:00Z');
  const ids = sequentialIds();
  const events: LearnerEvent[] = [];
  return {
    events,
    add<T extends EventType>(type: T, data: EventData[T], day: string): void {
      clock.set(`${day}T04:30:00Z`);
      events.push(createEvent({ clock, ids }, 'l1', type, data));
    },
  };
}

const answer = (lessonId: string) => ({
  source: { kind: 'lesson' as const, lessonId },
  itemId: 'q1',
  outcome: 'correct' as const,
});
const done = (lessonId: string, correct = 5, scored = 5) => ({ lessonId, correct, scored });
const started = (lessonId: string) => ({ lessonId, moduleVersion: '1' });

describe('summarise', () => {
  test('counts each completed lesson once, even completed twice or sent twice', () => {
    const l = log();
    l.add('lesson_completed', done('ef1-01'), '2026-10-19');
    l.add('lesson_completed', done('ef1-01'), '2026-10-20');
    const summary = summarise([...l.events, l.events[0] as LearnerEvent], '2026-10-21');
    expect(summary.lessonsDone).toBe(1);
  });

  test('"this week" is Monday to Sunday in India time', () => {
    const l = log();
    l.add('lesson_completed', done('ef1-01'), '2026-10-18'); // Sunday: last week
    l.add('lesson_completed', done('ef1-02'), '2026-10-19'); // Monday
    l.add('lesson_completed', done('ef1-03'), '2026-10-22'); // Thursday
    expect(summarise(l.events, '2026-10-22').lessonsThisWeek).toBe(2);
  });

  test('streak, last active day and the lesson in progress', () => {
    const l = log();
    l.add('item_answered', answer('ef1-01'), '2026-10-20');
    l.add('item_answered', answer('ef1-01'), '2026-10-21');
    l.add('lesson_started', started('ef1-02'), '2026-10-21');
    const s = summarise(l.events, '2026-10-21');
    expect(s).toMatchObject({ streak: 2, lastActiveDay: '2026-10-21', currentLesson: 'ef1-02' });
  });

  test('stuck: one lesson started on 3 different days without finishing; not 3 times in a day', () => {
    const sameDay = log();
    for (let n = 0; n < 3; n += 1) sameDay.add('lesson_started', started('ef1-03'), '2026-10-20');
    expect(summarise(sameDay.events, '2026-10-21').stuckLesson).toBeNull();
    const l = log();
    for (const day of ['2026-10-18', '2026-10-19', '2026-10-20']) {
      l.add('lesson_started', started('ef1-03'), day);
    }
    expect(summarise(l.events, '2026-10-21').stuckLesson).toBe('ef1-03');
    l.add('lesson_completed', done('ef1-03'), '2026-10-21');
    expect(summarise(l.events, '2026-10-21').stuckLesson).toBeNull();
  });

  test('low scores: the last three each under 60%, ignoring lessons with nothing scored', () => {
    const l = log();
    l.add('lesson_completed', done('a', 2, 5), '2026-10-18');
    l.add('lesson_completed', done('b', 1, 5), '2026-10-19');
    l.add('lesson_completed', done('x', 0, 0), '2026-10-19');
    l.add('lesson_completed', done('c', 0, 5), '2026-10-20');
    expect(summarise(l.events, '2026-10-21').lowScores).toBe(true);
    l.add('lesson_completed', done('d', 4, 5), '2026-10-21');
    expect(summarise(l.events, '2026-10-21').lowScores).toBe(false);
  });
});

describe('needsAttention', () => {
  const quiet = summarise([], '2026-10-21');

  test('inactive at exactly 3 days, not at 2; counted from linking when never active', () => {
    expect(
      needsAttention({ ...quiet, lastActiveDay: '2026-10-18' }, '2026-10-01', '2026-10-21'),
    ).toEqual(['inactive']);
    expect(
      needsAttention({ ...quiet, lastActiveDay: '2026-10-19' }, '2026-10-01', '2026-10-21'),
    ).toEqual([]);
    expect(needsAttention(quiet, '2026-10-20', '2026-10-21')).toEqual([]);
    expect(needsAttention(quiet, '2026-10-17', '2026-10-21')).toEqual(['inactive']);
  });

  test('stuck and low scores are flagged too', () => {
    const s = { ...quiet, lastActiveDay: '2026-10-21', stuckLesson: 'ef1-03', lowScores: true };
    expect(needsAttention(s, '2026-10-01', '2026-10-21')).toEqual(['stuck', 'low_scores']);
  });
});
