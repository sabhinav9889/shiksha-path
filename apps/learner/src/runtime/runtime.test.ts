import 'fake-indexeddb/auto';
import { createEvent, type LearnerEvent } from '@shiksha/learner-core';
import { makeContentFixture } from '@shiksha/learner-core/test-helpers/content-fixture';
import { answerFor } from '@shiksha/learner-core/test-helpers/session-env';
import { serveBuild } from '@shiksha/learner-core/test-helpers/serve-build';
import { fixedClock, sequentialIds } from '@shiksha/learner-core/testing';
import { describe, expect, test } from 'vitest';
import { startAutoSync } from './auto-sync.js';
import { requestPersistence } from './persistence.js';
import { createRuntime } from './runtime.js';

let counter = 0;
const dbName = (): string => `runtime-test-${counter++}`;

describe('createRuntime', () => {
  async function installedRuntime() {
    const fixture = await makeContentFixture();
    const server = serveBuild(fixture.outDir);
    const fetchFn = async (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
      const range = new Headers(init?.headers).get('Range')?.match(/bytes=(\d+)-(\d+)/);
      const from = range ? Number(range[1]) : undefined;
      const to = range ? Number(range[2]) : undefined;
      const result = await server.fetcher.get(
        String(url),
        from === undefined || to === undefined ? undefined : { from, to },
      );
      return new Response(new Uint8Array(result.bytes), { status: result.status });
    };
    const runtime = createRuntime({ dbName: dbName(), contentBaseUrl: server.baseUrl, fetchFn });
    return { fixture, runtime };
  }

  test('an open session keeps working while a sync replaces a module (Review Focus 5)', async () => {
    const { fixture, runtime } = await installedRuntime();
    expect((await runtime.content.sync()).ok).toBe(true);
    const session = await runtime.openSession('learner-1');
    const { run } = await session.startLesson('ef1-01');

    await fixture.rebuild((files) => {
      const lesson = 'modules/english-foundation-1/lessons/02.md';
      files[lesson] = String(files[lesson]).replace('lesson 2.', 'lesson two.');
    });
    expect((await runtime.content.sync()).ok).toBe(true);

    const answered = await session.answer(run, answerFor(run, true));
    expect(answered.result.outcome).toBe('correct');
    const fresh = await runtime.openSession('learner-1');
    expect((await fresh.startLesson('ef1-02')).lesson.html.en).toContain('lesson two');
  });

  test('each learner has their own session and log', async () => {
    const { runtime } = await installedRuntime();
    await runtime.content.sync();
    const a = await runtime.openSession('a');
    const b = await runtime.openSession('b');
    await a.finishLesson(await playAll(a));
    expect(a.progress.completedLessons.has('ef1-01')).toBe(true);
    expect((await runtime.openSession('b')).progress.completedLessons.size).toBe(0);
    expect(b.todayLesson()?.lessonId).toBe('ef1-01');
  });

  test('syncStatus reports pending events and the last successful sync', async () => {
    const { runtime } = await installedRuntime();
    expect(await runtime.syncStatus('l')).toEqual({ lastSyncedAt: null, pending: 0 });
    const event: LearnerEvent = createEvent(
      { clock: fixedClock('2026-10-18T10:00:00Z'), ids: sequentialIds() },
      'l',
      'language_changed',
      { preference: 'en_only' },
    );
    await runtime.events.append(event);
    expect(await runtime.syncStatus('l')).toEqual({ lastSyncedAt: null, pending: 1 });
    await runtime.events.setMeta('lastSyncedAt:l', '2026-10-18T11:00:00.000Z');
    expect((await runtime.syncStatus('l')).lastSyncedAt).toBe('2026-10-18T11:00:00.000Z');
  });

  test('without a server the outbox reports a failure, never throws, and keeps the events', async () => {
    const { runtime } = await installedRuntime();
    const deps = { clock: fixedClock('2026-10-18T10:00:00Z'), ids: sequentialIds() };
    await runtime.events.append(
      createEvent(deps, 'l', 'language_changed', { preference: 'hi_en' }),
    );
    const result = await runtime.flush('l');
    expect(result).toMatchObject({ ok: false, remaining: 1 });
    expect((await runtime.syncStatus('l')).pending).toBe(1);
  });
});

async function playAll(
  session: Awaited<ReturnType<ReturnType<typeof createRuntime>['openSession']>>,
) {
  let { run } = await session.startLesson('ef1-01');
  while (run.answered.length < run.entries.length) {
    run = (await session.answer(run, answerFor(run, true))).run;
  }
  return run;
}

describe('startAutoSync', () => {
  test('runs at start and on every online event, and stops when told', async () => {
    const target = new EventTarget();
    let syncs = 0;
    let flushes = 0;
    const stop = startAutoSync({
      content: { sync: () => Promise.resolve(void syncs++) },
      flush: () => Promise.resolve(void flushes++),
      target,
    });
    expect([syncs, flushes]).toEqual([1, 1]);
    target.dispatchEvent(new Event('online'));
    expect([syncs, flushes]).toEqual([2, 2]);
    stop();
    target.dispatchEvent(new Event('online'));
    expect([syncs, flushes]).toEqual([2, 2]);
  });

  test('a failing sync or flush never throws out of the listener', () => {
    const target = new EventTarget();
    const stop = startAutoSync({
      content: { sync: () => Promise.reject(new Error('x')) },
      flush: () => Promise.reject(new Error('y')),
      target,
    });
    expect(() => target.dispatchEvent(new Event('online'))).not.toThrow();
    stop();
  });
});

describe('requestPersistence', () => {
  test('is true when granted, false when refused, unsupported or failing', async () => {
    expect(await requestPersistence({ persist: () => Promise.resolve(true) })).toBe(true);
    expect(await requestPersistence({ persist: () => Promise.resolve(false) })).toBe(false);
    expect(await requestPersistence(undefined)).toBe(false);
    expect(await requestPersistence({ persist: () => Promise.reject(new Error('no')) })).toBe(
      false,
    );
  });
});
