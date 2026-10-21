// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createEvent, type LearnerEvent } from '@shiksha/learner-core';
import { beforeEach, describe, expect, test } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { setLinked } from '../account/account.js';
import { appState, initApp, refreshSession, signIn, signOut } from '../app-state.svelte.js';
import { pullNew } from './pull.js';

let env: TestEnv;
let backend: FakeBackend;
let learner: string;

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  const profile = await env.addProfile('प्रिया');
  learner = profile.id;
  backend.useGoogleAccount('google-priya');
  await backend.google.startGoogleSignIn(learner);
  await backend.google.finishGoogleSignIn('x');
  await backend.serverFor('google-priya').link({ profileId: learner, name: 'प्रिया' });
  await setLinked(env.runtime, learner);
});

const lesson = (lessonId: string): LearnerEvent =>
  createEvent(env.runtime, learner, 'lesson_completed', { lessonId, correct: 5, scored: 5 });

const onServer = async (): Promise<string[]> =>
  (await backend.repos.events.page(learner, 0, 500)).events.map((e) => e.id);

describe('uploading', () => {
  test('a linked profile uploads its pending events and marks them sent', async () => {
    const events = [lesson('ef1-01'), lesson('ef1-02')];
    for (const e of events) await env.runtime.events.append(e);
    const result = await env.runtime.flush(learner);
    expect(result).toMatchObject({ ok: true, remaining: 0 });
    expect((await onServer()).sort()).toEqual(events.map((e) => e.id).sort());
    expect(await env.runtime.events.pending(learner, 100)).toEqual([]);
    expect((await env.runtime.syncStatus(learner)).lastSyncedAt).not.toBeNull();
  });

  test('an event the server refuses leaves the queue but stays in the log', async () => {
    const good = lesson('ef1-01');
    const broken = { ...lesson('ef1-02'), data: { nonsense: true } } as unknown as LearnerEvent;
    await env.runtime.events.append(good);
    await env.runtime.events.append(broken);
    await env.runtime.flush(learner);
    expect(await onServer()).toEqual([good.id]);
    expect(await env.runtime.events.pending(learner, 100)).toEqual([]);
    expect(await env.runtime.events.all(learner)).toHaveLength(2);
  });

  test.each([
    ['an expired sign-in', () => backend.google.signOutGoogle(learner)],
    ['no network', () => Promise.resolve(backend.setOnline(false))],
    [
      'a server error',
      () => {
        backend.repos.events.insertMany = () => Promise.reject(new Error('db down'));
        return Promise.resolve();
      },
    ],
  ])('%s keeps every event pending and says so plainly', async (_case, breakIt) => {
    await env.runtime.events.append(lesson('ef1-01'));
    await breakIt();
    const result = await env.runtime.flush(learner);
    expect(result.ok).toBe(false);
    expect(await env.runtime.events.pending(learner, 100)).toHaveLength(1);
  });

  test('a profile that is not linked never calls the server', async () => {
    const other = await env.addProfile('रोहित');
    await env.runtime.events.append(
      createEvent(env.runtime, other.id, 'language_changed', { preference: 'hi_en' }),
    );
    const result = await env.runtime.flush(other.id);
    expect(result.ok).toBe(false);
    expect((await backend.repos.events.page(other.id, 0, 500)).events).toEqual([]);
  });
});

describe('pulling', () => {
  test('adds events made on another phone, once', async () => {
    const fromOtherPhone = lesson('ef1-03');
    await backend.serverFor('google-priya').push({ learnerId: learner, events: [fromOtherPhone] });
    expect(await pullNew(env.runtime, learner)).toEqual({ added: 1 });
    expect(await pullNew(env.runtime, learner)).toEqual({ added: 0 });
    expect((await env.runtime.events.all(learner)).map((e) => e.id)).toEqual([fromOtherPhone.id]);
    expect(await env.runtime.events.pending(learner, 100)).toEqual([]);
  });

  test('the open session sees what a pull added', async () => {
    await signIn(learner, '1234');
    expect(appState.session?.progress.completedLessons.has('ef1-03')).toBe(false);
    await backend
      .serverFor('google-priya')
      .push({ learnerId: learner, events: [lesson('ef1-03')] });
    await pullNew(env.runtime, learner);
    await refreshSession({ force: true });
    expect(appState.session?.progress.completedLessons.has('ef1-03')).toBe(true);
  });

  test('a failing pull changes nothing and does not throw', async () => {
    await backend
      .serverFor('google-priya')
      .push({ learnerId: learner, events: [lesson('ef1-03')] });
    backend.setOnline(false);
    expect(await pullNew(env.runtime, learner)).toEqual({ added: 0 });
    expect(await env.runtime.events.getMeta(`pullCursor:${learner}`)).toBeNull();
    backend.setOnline(true);
    expect(await pullNew(env.runtime, learner)).toEqual({ added: 1 });
  });

  test('sync uploads, then pulls', async () => {
    await env.runtime.events.append(lesson('ef1-01'));
    await backend
      .serverFor('google-priya')
      .push({ learnerId: learner, events: [lesson('ef1-02')] });
    const out = await env.runtime.sync(learner);
    expect(out.flush.ok).toBe(true);
    expect(out.added).toBe(1);
    expect(await env.runtime.events.all(learner)).toHaveLength(2);
  });
});
