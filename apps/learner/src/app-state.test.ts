// @vitest-environment jsdom
import { createEvent } from '@shiksha/learner-core';
import { beforeEach, describe, expect, test } from 'vitest';
import { activity } from './activity.svelte.js';
import { appState, initApp, refreshSession, signIn, signOut } from './app-state.svelte.js';
import { makeEnv } from '../test/helpers/installed-runtime.js';

beforeEach(() => {
  signOut();
});

describe('signIn', () => {
  test('the right PIN opens the profile and its session', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    expect(appState.profile).toEqual({ id: profile.id, name: 'प्रिया' });
    expect(appState.session?.todayLesson()?.lessonId).toBe('ef1-01');
    expect(appState.lang).toBe('hi');
  });

  test('a wrong PIN rejects with PIN_WRONG and signs nobody in', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const profile = await env.addProfile('प्रिया');
    await expect(signIn(profile.id, '0000')).rejects.toMatchObject({ code: 'PIN_WRONG' });
    expect(appState.profile).toBeNull();
    expect(appState.session).toBeNull();
  });

  test('an English-only learner gets an English interface', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const profile = await env.addProfile('Priya');
    await env.runtime.events.append(
      createEvent(env.runtime, profile.id, 'language_changed', { preference: 'en_only' }),
    );
    await signIn(profile.id, '1234');
    expect(appState.lang).toBe('en');
  });

  test('before any lessons are installed sign-in still works, and refresh opens the session later', async () => {
    const env = await makeEnv({ install: false });
    initApp(env.runtime);
    const profile = await env.addProfile('प्रिया');
    await signIn(profile.id, '1234');
    expect(appState.profile?.id).toBe(profile.id);
    expect(appState.session).toBeNull();
    await env.runtime.content.sync();
    await refreshSession();
    expect(appState.session).not.toBeNull();
  });
});

describe('a shared phone', () => {
  test('two learners never share a session or an activity', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const [a, b] = [await env.addProfile('A'), await env.addProfile('B')];
    await signIn(a.id, '1234');
    const sessionA = appState.session;
    const started = await sessionA?.startLesson('ef1-01');
    activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>) };
    await signIn(b.id, '1234'); // without signing A out first
    expect(appState.profile?.id).toBe(b.id);
    expect(appState.session).not.toBe(sessionA);
    expect(activity.current).toBeNull();
    expect(appState.session?.progress.completedLessons.size).toBe(0);
  });

  test('signOut clears the profile, session and activity', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const profile = await env.addProfile('A');
    await signIn(profile.id, '1234');
    signOut();
    expect([appState.profile, appState.session, activity.current, activity.finish]).toEqual([
      null,
      null,
      null,
      null,
    ]);
  });

  test('refreshSession leaves the session alone while an activity is running', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const profile = await env.addProfile('A');
    await signIn(profile.id, '1234');
    const before = appState.session;
    const started = await before?.startLesson('ef1-01');
    activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>) };
    await refreshSession();
    expect(appState.session).toBe(before);
  });
});

describe('a slow refresh', () => {
  function gatedOpen(env: Awaited<ReturnType<typeof makeEnv>>, slowId: string) {
    // Through appState: Svelte's proxy has already cached the original function.
    const runtime = appState.runtime as typeof env.runtime;
    const real = runtime.openSession.bind(runtime);
    let release = (): void => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    runtime.openSession = async (id) => {
      if (id === slowId) await gate;
      return real(id);
    };
    return () => release();
  }

  test('is dropped when a different learner signed in meanwhile', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const [a, b] = [await env.addProfile('A'), await env.addProfile('B')];
    await signIn(a.id, '1234');
    const release = gatedOpen(env, a.id);
    const refreshing = refreshSession(); // A's refresh is stuck opening A's session
    await signIn(b.id, '1234');
    const sessionB = appState.session;
    release();
    await refreshing;
    expect(appState.profile?.id).toBe(b.id);
    expect(appState.session).toBe(sessionB);
  });

  test('is dropped when a lesson started meanwhile', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const a = await env.addProfile('A');
    await signIn(a.id, '1234');
    const before = appState.session;
    const release = gatedOpen(env, a.id);
    const refreshing = refreshSession();
    const started = await before?.startLesson('ef1-01');
    activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>) };
    release();
    await refreshing;
    expect(appState.session).toBe(before);
  });
});

describe('reopening the session', () => {
  test('is skipped while the stored content has not changed, and done after it changed', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const runtime = appState.runtime as typeof env.runtime;
    const real = runtime.openSession.bind(runtime);
    let opens = 0;
    runtime.openSession = (id) => {
      opens += 1;
      return real(id);
    };
    const profile = await env.addProfile('A');
    await signIn(profile.id, '1234');
    expect(opens).toBe(1);
    await refreshSession();
    await refreshSession();
    expect(opens).toBe(1);
    await env.runtime.content.remove('aptitude-1');
    await refreshSession();
    expect(opens).toBe(2);
  });
});

describe('the audio of the run in progress', () => {
  test('is kept by a sync that would otherwise remove it', async () => {
    const env = await makeEnv();
    initApp(env.runtime);
    const profile = await env.addProfile('A');
    await signIn(profile.id, '1234');
    const started = await appState.session?.startLesson('ef1-01');
    activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>) };
    const lessonAudio = started?.lesson.audio?.hi ?? '';
    expect(lessonAudio).not.toBe('');
    await env.fixture.rebuild((files) => {
      files['modules/english-foundation-1/audio/intro.mp3'] = new TextEncoder().encode('new-intro');
    });
    await env.runtime.content.sync();
    expect(await env.runtime.storage.hasAudio(lessonAudio)).toBe(true);
    activity.current = null;
    await env.runtime.content.sync();
    expect(await env.runtime.storage.hasAudio(lessonAudio)).toBe(false);
  });
});
