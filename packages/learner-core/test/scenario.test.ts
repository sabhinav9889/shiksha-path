import { describe, expect, test } from 'vitest';
import type { LearnerEvent } from '../src/events.js';
import { flushOutbox, type SyncTransport } from '../src/outbox.js';
import type { LearnerSession } from '../src/session.js';
import { MemoryEventStore } from '../src/testing/index.js';
import { EN, LEARNER, answerFor, makeSessionEnv, playRun } from './helpers/session-env.js';

const ONE_DAY_MS = 86_400_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Answer a placement run: `englishRight` of the English items correctly, everything else right. */
async function placeWith(session: LearnerSession, englishRight: number): Promise<number> {
  let run = await session
    .startPlacement()
    .then((r) => r ?? Promise.reject(new Error('no placement')));
  let english = 0;
  while (run.answered.length < run.entries.length) {
    const source = run.entries[run.answered.length]?.source;
    const isEnglish = source?.kind === 'placement' && source.track === 'english';
    const right = !isEnglish || english < englishRight;
    if (isEnglish) english += 1;
    run = (await session.answer(run, answerFor(run, right))).run;
  }
  return (await session.finishPlacement(run)).sections.length;
}

describe('a learner, offline, from first lesson to a second device', () => {
  test('the whole journey', async () => {
    const env = await makeSessionEnv();
    env.server.reset(); // from here on nothing may touch the network except the outbox transport
    const session = await env.open();

    // 1. the first lesson is the first English lesson
    expect(session.todayLesson()).toMatchObject({ lessonId: 'ef1-01', track: 'english' });

    // 2. one wrong answer, then finish: the log holds the whole story with unique ids
    const { run } = await session.startLesson('ef1-01');
    const summary = await session.finishLesson(await playRun(session, run, [2]));
    expect(summary).toMatchObject({ total: 5, correct: 4, wrong: 1 });
    const log = await env.events.all(LEARNER);
    expect(log.map((e) => e.type)).toEqual([
      'lesson_started',
      ...Array<string>(5).fill('item_answered'),
      'lesson_completed',
    ]);
    expect(new Set(log.map((e) => e.id)).size).toBe(log.length);
    expect(log.every((e) => UUID.test(e.id))).toBe(true);

    // 3. the wrong item is not due today but is due after one India day
    expect(session.reviewDue()).toEqual([]);
    expect(session.streak()).toEqual({ current: 1, activeToday: true });
    env.clock.advanceMs(ONE_DAY_MS);
    expect(session.reviewDue()).toHaveLength(1);
    const review = await session.startReview();
    expect(review?.entries.map((e) => e.source.kind)).toEqual(['review']);
    await playRun(session, review ?? (undefined as never));
    expect(session.progress.reviewQueue[0]).toMatchObject({ itemId: 'q3', box: 1 });

    // 4. activity on the second day makes the streak 2
    expect(session.streak()).toEqual({ current: 2, activeToday: true });

    // 5. placement: 3 of 5 English correct starts at ef1-02 and does not suggest English-only
    expect(session.needsPlacement()).toBe(true);
    await placeWith(session, 3);
    expect(session.progress.startLessonByTrack.english).toBe('ef1-02');
    expect(session.progress.suggestEnglishOnly).toBe(false);
    expect(session.needsPlacement()).toBe(false);

    // 6. with English lessons still open, a passed test-out moves today's lesson to aptitude
    expect(session.todayLesson()?.track).toBe('english');
    const testOut = await session.startTestOut(EN);
    expect(testOut.passMark).toBeGreaterThan(0);
    const outcome = await session.finishTestOut(EN, await playRun(session, testOut.run));
    expect(outcome).toEqual({ score: 1, passed: true });
    expect(session.todayLesson()).toMatchObject({ lessonId: 'apt-01', track: 'aptitude' });

    // 7. the outbox: the first push reaches the server but the reply is lost, then the network
    //    is down, then it works; the server de-duplicates by event id
    const server = new Map<string, LearnerEvent>();
    let calls = 0;
    const transport: SyncTransport = {
      push(_learner, events) {
        calls += 1;
        for (const event of events) server.set(event.id, event);
        if (calls === 1) return Promise.reject(new Error('reply lost'));
        if (calls === 2) return Promise.reject(new Error('offline'));
        return Promise.resolve({ accepted: events.map((e) => e.id) });
      },
    };
    const deps = { store: env.events, transport, clock: env.clock };
    expect((await flushOutbox(LEARNER, deps)).ok).toBe(false);
    expect((await flushOutbox(LEARNER, deps)).ok).toBe(false);
    expect(await flushOutbox(LEARNER, deps)).toMatchObject({ ok: true, remaining: 0 });
    const local = await env.events.all(LEARNER);
    expect([...server.keys()].sort()).toEqual(local.map((e) => e.id).sort());
    expect(await env.events.getMeta(`lastSyncedAt:${LEARNER}`)).toBe(env.clock.now().toISOString());

    // 8. a brand-new phone filled from the server rebuilds the same progress
    const restored = new MemoryEventStore();
    for (const event of server.values()) await restored.append(event);
    const second = await env.open(LEARNER, restored);
    expect(second.progress).toEqual(session.progress);
    expect(second.todayLesson()).toEqual(session.todayLesson());

    expect(env.server.requests).toHaveLength(0);
  });

  test('a first placement that scores 100% suggests English-only', async () => {
    const env = await makeSessionEnv();
    const session = await env.open('learner-2');
    await placeWith(session, 5);
    expect(session.progress.startLessonByTrack.english).toBe('ef1-03');
    expect(session.progress.suggestEnglishOnly).toBe(true);
    await session.setLanguage('en_only');
    expect(session.progress.suggestEnglishOnly).toBe(false);
    expect(session.progress.language).toBe('en_only');
  });

  test('two learners on one phone keep separate progress', async () => {
    const env = await makeSessionEnv();
    const a = await env.open('a');
    const b = await env.open('b');
    await a.finishLesson(await playRun(a, (await a.startLesson('ef1-01')).run));
    expect(a.progress.completedLessons.has('ef1-01')).toBe(true);
    expect((await env.open('b')).progress.completedLessons.size).toBe(0);
    expect(b.todayLesson()?.lessonId).toBe('ef1-01');
  });
});
