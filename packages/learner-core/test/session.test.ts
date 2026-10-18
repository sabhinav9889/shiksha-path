import { beforeEach, describe, expect, test } from 'vitest';
import type { CoreError } from '../src/errors.js';
import { createEvent } from '../src/events.js';
import { LearnerSession } from '../src/session.js';
import { MemoryBundleStorage } from '../src/testing/index.js';
import {
  APT,
  EN,
  LEARNER,
  makeSessionEnv,
  playRun,
  type SessionEnv,
} from './helpers/session-env.js';

let env: SessionEnv;
beforeEach(async () => {
  env = await makeSessionEnv();
});

const codeOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: CoreError) => error.code,
  );

const ONE_DAY_MS = 86_400_000;

describe('open', () => {
  test('without a saved manifest it is MANIFEST_UNAVAILABLE', async () => {
    const empty = new MemoryBundleStorage();
    const open = LearnerSession.open({
      learnerId: LEARNER,
      storage: empty,
      events: env.events,
      clock: env.clock,
      ids: env.ids,
    });
    expect(await codeOf(open)).toBe('MANIFEST_UNAVAILABLE');
  });

  test('a new learner needs placement and starts at the first lesson', async () => {
    const session = await env.open();
    expect(session.needsPlacement()).toBe(true);
    expect(session.todayLesson()?.lessonId).toBe('ef1-01');
  });
});

describe('startLesson', () => {
  test('a module with no stored bundle is MODULE_NOT_READY and records nothing', async () => {
    await env.storage.removeModule(EN);
    const session = await env.open();
    expect(await codeOf(session.startLesson('ef1-01'))).toBe('MODULE_NOT_READY');
    expect(await env.events.all(LEARNER)).toEqual([]);
  });

  test('a lesson id that is not in the stored bundle is MODULE_NOT_READY', async () => {
    const stored = await env.storage.getModule(EN);
    if (!stored) throw new Error('fixture module missing');
    const lessons = stored.bundle.lessons.filter((l) => l.id !== 'ef1-03');
    await env.storage.putModule(EN, stored.version, { ...stored.bundle, lessons });
    const session = await env.open();
    expect(await codeOf(session.startLesson('ef1-03'))).toBe('MODULE_NOT_READY');
    expect(await codeOf(session.startLesson('no-such-lesson'))).toBe('MODULE_NOT_READY');
  });

  test('a playable but out-of-date module still plays from its old bundle', async () => {
    const manifest = await env.storage.getManifest();
    if (!manifest) throw new Error('fixture manifest missing');
    const modules = manifest.modules.map((m) =>
      m.id === EN ? { ...m, version: 'ffffffffffff' } : m,
    );
    await env.storage.putManifest({ ...manifest, modules });
    const session = await env.open();
    const { lesson, run } = await session.startLesson('ef1-01');
    expect(lesson.id).toBe('ef1-01');
    expect(run.entries).toHaveLength(5);
  });

  test('records lesson_started with the stored module version', async () => {
    const session = await env.open();
    await session.startLesson('ef1-01');
    const [event] = await env.events.all(LEARNER);
    expect(event).toMatchObject({ type: 'lesson_started', data: { lessonId: 'ef1-01' } });
  });

  test("the view follows the learner's language choice", async () => {
    const session = await env.open();
    expect((await session.startLesson('ef1-01')).view).toEqual({ primary: 'hi', toggle: 'en' });
    await session.setLanguage('en_only');
    expect((await session.startLesson('ef1-01')).view).toEqual({ primary: 'en', toggle: null });
  });
});

describe('finishing runs', () => {
  test('finishLesson refuses a review run', async () => {
    const session = await env.open();
    await playRun(session, (await session.startLesson('ef1-01')).run, [2]);
    env.clock.advanceMs(ONE_DAY_MS);
    const review = await session.startReview();
    if (!review) throw new Error('expected a review');
    const done = await playRun(session, review);
    await expect(session.finishLesson(done)).rejects.toThrow(Error);
  });

  test('finishLesson refuses an unfinished run', async () => {
    const session = await env.open();
    const { run } = await session.startLesson('ef1-01');
    await expect(session.finishLesson(run)).rejects.toThrow('not finished');
  });
});

describe('reviews', () => {
  test('startReview is null when nothing is due', async () => {
    const session = await env.open();
    expect(await session.startReview()).toBeNull();
  });

  test('an item that was removed from the bundle is skipped', async () => {
    const session = await env.open();
    await playRun(session, (await session.startLesson('ef1-01')).run, [2]);
    const stored = await env.storage.getModule(EN);
    if (!stored) throw new Error('fixture module missing');
    const lessons = stored.bundle.lessons.map((l) =>
      l.id === 'ef1-01' ? { ...l, items: l.items.filter((i) => i.id !== 'q3') } : l,
    );
    await env.storage.putModule(EN, stored.version, { ...stored.bundle, lessons });
    env.clock.advanceMs(ONE_DAY_MS);
    expect(await session.startReview()).toBeNull();
  });

  test('stale entries never crowd out a review that still exists', async () => {
    const day = '2026-10-18T10:00:00Z';
    env.clock.set(day);
    const source = { kind: 'lesson', lessonId: 'ef1-01' } as const;
    for (let i = 0; i < 6; i += 1) {
      const data = { source, itemId: `ghost${i}`, outcome: 'wrong' } as const;
      await env.events.append(createEvent(env, LEARNER, 'item_answered', data));
    }
    const session = await env.open();
    await playRun(session, (await session.startLesson('ef1-01')).run, [2]);
    env.clock.advanceMs(ONE_DAY_MS);
    const review = await session.startReview();
    expect(review?.entries.map((e) => e.item.id)).toEqual(['q3']);
  });
});

describe('placement', () => {
  test('startPlacement is null when the phone has no placement test', async () => {
    await env.storage.removePlacement();
    const session = await env.open();
    expect(await session.startPlacement()).toBeNull();
  });

  test('skipping placement ends the prompt and keeps the first lesson', async () => {
    const session = await env.open();
    await session.skipPlacement();
    expect(session.needsPlacement()).toBe(false);
    expect(session.todayLesson()?.lessonId).toBe('ef1-01');
  });
});

describe('test-outs', () => {
  test('a module that is not on the phone cannot be tested out', async () => {
    await env.storage.removeModule(APT);
    const session = await env.open();
    expect(await codeOf(session.startTestOut(APT))).toBe('MODULE_NOT_READY');
  });
});
