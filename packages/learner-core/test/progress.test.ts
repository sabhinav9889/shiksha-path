import { describe, expect, test } from 'vitest';
import { createEvent, parseEvents, type EventData, type EventType } from '../src/events.js';
import {
  deriveProgress,
  isLessonDone,
  needsPlacement,
  todayLesson,
  trackProgress,
} from '../src/progress.js';
import { fixedClock, sequentialIds } from '../src/testing/index.js';
import { makeManifest } from './helpers/manifest.js';

const manifest = makeManifest();

function log(): {
  add<T extends EventType>(type: T, data: EventData[T], at?: string): void;
  events: unknown[];
} {
  const clock = fixedClock('2026-10-18T10:00:00Z');
  const ids = sequentialIds();
  const events: unknown[] = [];
  return {
    events,
    add: (type, data, at) => {
      if (at) clock.set(at);
      events.push(createEvent({ clock, ids }, 'l1', type, data));
    },
  };
}

const progressOf = (events: unknown[]): ReturnType<typeof deriveProgress> =>
  deriveProgress(parseEvents(events).events);

const completed = (lessonId: string): EventData['lesson_completed'] => ({
  lessonId,
  correct: 4,
  scored: 5,
});

const placed = (
  english: string,
  englishOnlySuggested = false,
): EventData['placement_completed'] => ({
  sections: [
    { track: 'english', score: 0.9, startLesson: english },
    { track: 'aptitude', score: 0.5, startLesson: 'apt-01' },
  ],
  englishOnlySuggested,
});

describe('deriveProgress', () => {
  test('an empty log is a fresh learner', () => {
    const state = progressOf([]);
    expect(state.language).toBe('hi_en');
    expect(state.completedLessons.size).toBe(0);
    expect(state.testedOutModules.size).toBe(0);
    expect(state.placements).toEqual([]);
    expect(state.suggestEnglishOnly).toBe(false);
  });

  test('lesson_completed marks the lesson done', () => {
    const l = log();
    l.add('lesson_completed', completed('ef1-01'));
    expect(isLessonDone(manifest, progressOf(l.events), 'ef1-01')).toBe(true);
  });

  test('the same event twice gives the same state as once', () => {
    const l = log();
    l.add('lesson_completed', completed('ef1-01'));
    l.add('item_answered', {
      source: { kind: 'lesson', lessonId: 'ef1-01' },
      itemId: 'q1',
      outcome: 'correct',
    });
    expect(progressOf([...l.events, ...l.events])).toEqual(progressOf(l.events));
  });

  test('events are ordered by time, so the later language change wins', () => {
    const l = log();
    l.add('language_changed', { preference: 'en_only' }, '2026-10-18T12:00:00Z');
    l.add('language_changed', { preference: 'hi_en' }, '2026-10-18T09:00:00Z');
    expect(progressOf(l.events).language).toBe('en_only');
  });

  test('unknown events never arrive, and a lesson missing from the manifest counts nowhere', () => {
    const l = log();
    l.add('lesson_completed', completed('retired-lesson'));
    const state = progressOf([...l.events, { type: 'from_the_future' }]);
    expect(state.completedLessons.has('retired-lesson')).toBe(true);
    expect(trackProgress(manifest, state, 'english')).toEqual({ done: 0, total: 3 });
  });

  test('a passed test-out marks the whole module done; a failed one does not', () => {
    const l = log();
    l.add('test_out_completed', { moduleId: 'english-foundation-1', score: 0.9, passed: true });
    l.add('test_out_completed', { moduleId: 'aptitude-1', score: 0.2, passed: false });
    const state = progressOf(l.events);
    expect(isLessonDone(manifest, state, 'ef1-03')).toBe(true);
    expect(isLessonDone(manifest, state, 'apt-01')).toBe(false);
  });

  test('only the first placement sets start lessons; later ones are listed', () => {
    const l = log();
    l.add('placement_completed', placed('ef1-02'), '2026-10-18T10:00:00Z');
    l.add('placement_completed', placed('ef1-03'), '2026-10-19T10:00:00Z');
    const state = progressOf(l.events);
    expect(state.placements).toHaveLength(2);
    expect(state.startLessonByTrack).toEqual({ english: 'ef1-02', aptitude: 'apt-01' });
  });

  test('the English-only suggestion lasts until any language change', () => {
    const l = log();
    l.add('placement_completed', placed('ef1-03', true), '2026-10-18T10:00:00Z');
    expect(progressOf(l.events).suggestEnglishOnly).toBe(true);
    l.add('language_changed', { preference: 'hi_en' }, '2026-10-18T11:00:00Z');
    expect(progressOf(l.events).suggestEnglishOnly).toBe(false);
  });

  test('skipping placement sets no start lessons and ends the placement prompt', () => {
    const l = log();
    expect(needsPlacement(progressOf(l.events))).toBe(true);
    l.add('placement_skipped', {});
    const state = progressOf(l.events);
    expect(state.placementSkipped).toBe(true);
    expect(needsPlacement(state)).toBe(false);
    expect(state.startLessonByTrack).toEqual({});
  });

  test('a recorded placement also ends the placement prompt', () => {
    const l = log();
    l.add('placement_completed', placed('ef1-01'));
    expect(needsPlacement(progressOf(l.events))).toBe(false);
  });

  test('active days are the India-time days with an answered item', () => {
    const l = log();
    const source = { kind: 'lesson', lessonId: 'ef1-01' } as const;
    l.add('item_answered', { source, itemId: 'q1', outcome: 'correct' }, '2026-10-18T18:29:00Z');
    l.add('item_answered', { source, itemId: 'q2', outcome: 'wrong' }, '2026-10-18T18:31:00Z');
    l.add('lesson_started', { lessonId: 'ef1-02', moduleVersion: 'v' }, '2026-10-25T10:00:00Z');
    expect([...progressOf(l.events).activeDays].sort()).toEqual(['2026-10-18', '2026-10-19']);
  });
});

describe('todayLesson and trackProgress', () => {
  test('a new learner starts at the first English lesson', () => {
    expect(todayLesson(manifest, progressOf([]))).toEqual({
      moduleId: 'english-foundation-1',
      lessonId: 'ef1-01',
      track: 'english',
    });
  });

  test('moves on lesson by lesson', () => {
    const l = log();
    l.add('lesson_completed', completed('ef1-01'));
    l.add('lesson_completed', completed('ef1-02'));
    expect(todayLesson(manifest, progressOf(l.events))?.lessonId).toBe('ef1-03');
  });

  test('a strong English student lands on aptitude', () => {
    const l = log();
    l.add('test_out_completed', { moduleId: 'english-foundation-1', score: 1, passed: true });
    expect(todayLesson(manifest, progressOf(l.events))?.lessonId).toBe('apt-01');
  });

  test('a placement start lesson skips the earlier lessons', () => {
    const l = log();
    l.add('placement_completed', placed('ef1-03'));
    const state = progressOf(l.events);
    expect(todayLesson(manifest, state)?.lessonId).toBe('ef1-03');
    expect(trackProgress(manifest, state, 'english')).toEqual({ done: 2, total: 3 });
  });

  test('nothing is left when everything is done', () => {
    const l = log();
    for (const id of ['ef1-01', 'ef1-02', 'ef1-03', 'apt-01', 'apt-02']) {
      l.add('lesson_completed', completed(id));
    }
    expect(todayLesson(manifest, progressOf(l.events))).toBeNull();
  });
});

describe('a mentor setting the level (level_set)', () => {
  test('moves that track past a placement, and the other track keeps the placement', () => {
    const l = log();
    l.add('placement_completed', placed('ef1-02'), '2026-10-18T10:00:00Z');
    l.add('level_set', { track: 'english', startLesson: 'ef1-03' }, '2026-10-19T10:00:00Z');
    expect(progressOf(l.events).startLessonByTrack).toEqual({
      english: 'ef1-03',
      aptitude: 'apt-01',
    });
  });

  test('wins over a placement taken after it, and the latest of two wins', () => {
    const l = log();
    l.add('level_set', { track: 'english', startLesson: 'ef1-01' }, '2026-10-18T09:00:00Z');
    l.add('level_set', { track: 'english', startLesson: 'ef1-03' }, '2026-10-20T09:00:00Z');
    l.add('placement_completed', placed('ef1-02'), '2026-10-19T10:00:00Z');
    expect(progressOf([...l.events].reverse()).startLessonByTrack.english).toBe('ef1-03');
  });

  test('naming a lesson that is not installed leaves today on the first unfinished lesson', () => {
    const l = log();
    l.add('level_set', { track: 'english', startLesson: 'ef9-99' }, '2026-10-19T10:00:00Z');
    const state = progressOf(l.events);
    expect(todayLesson(manifest, state)?.lessonId).toBe('ef1-01');
  });

  test('an app that predates it drops the event without failing', () => {
    const l = log();
    l.add('level_set', { track: 'english', startLesson: 'ef1-03' });
    const unknown = { ...(l.events[0] as object), type: 'from_the_future' };
    expect(parseEvents([unknown])).toEqual({ events: [], ignored: 1 });
    expect(parseEvents(l.events).events).toHaveLength(1);
  });
});
