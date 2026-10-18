import { describe, expect, test } from 'vitest';
import { createEvent, parseEvents } from '../src/events.js';
import { deriveProgress } from '../src/progress.js';
import {
  REVIEW_SESSION_SIZE,
  applyReviewAnswer,
  dueReviews,
  type ReviewEntry,
} from '../src/review.js';
import { fixedClock, sequentialIds } from '../src/testing/index.js';

type Answer = Parameters<typeof applyReviewAnswer>[1];
const answer = (over: Partial<Answer>): Answer => ({
  lessonId: 'ef1-01',
  itemId: 'q1',
  outcome: 'wrong',
  fromReview: false,
  day: '2026-10-18',
  ...over,
});
const entry = (over: Partial<ReviewEntry> = {}): ReviewEntry => ({
  lessonId: 'ef1-01',
  itemId: 'q1',
  box: 0,
  dueDay: '2026-10-19',
  ...over,
});

describe('applyReviewAnswer', () => {
  test('a wrong answer enters box 0, due the next day', () => {
    expect(applyReviewAnswer([], answer({}))).toEqual([entry()]);
  });

  test('correct reviews climb the boxes and leave after the last', () => {
    let queue = applyReviewAnswer([], answer({}));
    queue = applyReviewAnswer(
      queue,
      answer({ outcome: 'correct', fromReview: true, day: '2026-10-19' }),
    );
    expect(queue).toEqual([entry({ box: 1, dueDay: '2026-10-21' })]);
    queue = applyReviewAnswer(
      queue,
      answer({ outcome: 'correct', fromReview: true, day: '2026-10-21' }),
    );
    expect(queue).toEqual([entry({ box: 2, dueDay: '2026-10-25' })]);
    queue = applyReviewAnswer(
      queue,
      answer({ outcome: 'correct', fromReview: true, day: '2026-10-25' }),
    );
    expect(queue).toEqual([]);
  });

  test('a wrong answer at any box goes back to box 0, due the next day', () => {
    const queue = [entry({ box: 2, dueDay: '2026-10-25' })];
    const next = applyReviewAnswer(queue, answer({ fromReview: true, day: '2026-10-25' }));
    expect(next).toEqual([entry({ box: 0, dueDay: '2026-10-26' })]);
  });

  test('a correct answer outside review, and unscored answers, change nothing', () => {
    const queue = [entry()];
    expect(applyReviewAnswer(queue, answer({ outcome: 'correct' }))).toEqual(queue);
    expect(applyReviewAnswer(queue, answer({ outcome: 'unscored', fromReview: true }))).toEqual(
      queue,
    );
  });

  test('does not mutate the queue it is given', () => {
    const queue = [entry()];
    applyReviewAnswer(queue, answer({ outcome: 'correct', fromReview: true, day: '2026-10-19' }));
    expect(queue).toEqual([entry()]);
  });
});

describe('dueReviews', () => {
  test('returns only due entries, sorted, capped at the session size', () => {
    const queue = Array.from({ length: 7 }, (_, i) =>
      entry({ itemId: `q${7 - i}`, dueDay: i === 6 ? '2026-10-20' : '2026-10-18' }),
    );
    queue.push(entry({ itemId: 'later', dueDay: '2026-10-30' }));
    const due = dueReviews(queue, '2026-10-20');
    expect(due).toHaveLength(REVIEW_SESSION_SIZE);
    expect(due.map((e) => e.itemId)).toEqual(['q2', 'q3', 'q4', 'q5', 'q6']);
  });

  test('sorts by due day, then lesson, then item', () => {
    const queue = [
      entry({ lessonId: 'b', itemId: 'a', dueDay: '2026-10-19' }),
      entry({ lessonId: 'a', itemId: 'z', dueDay: '2026-10-19' }),
      entry({ lessonId: 'a', itemId: 'y', dueDay: '2026-10-19' }),
      entry({ lessonId: 'c', itemId: 'a', dueDay: '2026-10-18' }),
    ];
    expect(dueReviews(queue, '2026-10-19').map((e) => `${e.lessonId}/${e.itemId}`)).toEqual([
      'c/a',
      'a/y',
      'a/z',
      'b/a',
    ]);
  });
});

describe('deriveProgress review queue', () => {
  const log = (): ((at: string, source: object, outcome: string) => unknown) => {
    const clock = fixedClock('2026-10-18T10:00:00Z');
    const ids = sequentialIds();
    return (at, source, outcome) => {
      clock.set(at);
      return createEvent({ clock, ids }, 'l1', 'item_answered', {
        source,
        itemId: 'q1',
        outcome,
      } as never);
    };
  };
  const lesson = { kind: 'lesson', lessonId: 'ef1-01' };
  const review = { kind: 'review', lessonId: 'ef1-01' };
  const queueOf = (events: unknown[]): readonly ReviewEntry[] =>
    deriveProgress(parseEvents(events).events).reviewQueue;

  test('the IST day boundary decides the due day', () => {
    const make = log();
    expect(queueOf([make('2026-10-18T18:29:59Z', lesson, 'wrong')])[0]?.dueDay).toBe('2026-10-19');
    expect(queueOf([make('2026-10-18T18:30:00Z', lesson, 'wrong')])[0]?.dueDay).toBe('2026-10-20');
  });

  test('a duplicate review answer counts once', () => {
    const make = log();
    const wrong = make('2026-10-18T10:00:00Z', lesson, 'wrong');
    const right = make('2026-10-19T10:00:00Z', review, 'correct');
    expect(queueOf([wrong, right, right])).toEqual(queueOf([wrong, right]));
    expect(queueOf([wrong, right, right])[0]?.box).toBe(1);
  });

  test('test-out and placement answers never enter the queue', () => {
    const make = log();
    const events = [
      make('2026-10-18T10:00:00Z', { kind: 'test_out', moduleId: 'm' }, 'wrong'),
      make('2026-10-18T10:00:00Z', { kind: 'placement', track: 'english' }, 'wrong'),
    ];
    expect(queueOf(events)).toEqual([]);
  });
});
