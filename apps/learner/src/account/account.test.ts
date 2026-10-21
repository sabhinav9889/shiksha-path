// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createEvent, deriveProgress, type LearnerEvent } from '@shiksha/learner-core';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signIn, signOut } from '../app-state.svelte.js';
import { navigate, router } from '../router.svelte.js';
import AuthCallback from '../screens/account/AuthCallback.svelte';
import { isLinked } from './account.js';
import { linkProfile } from './link-flow.js';
import { completeRestore, restoreEvents, startRestore } from './restore-flow.js';

let env: TestEnv;
let backend: ReturnType<typeof makeFakeBackend>;

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
});

/** Sign in with the fake Google for a profile, as the callback page would after the redirect. */
async function signInGoogle(profileId: string, googleAccount: string): Promise<void> {
  backend.useGoogleAccount(googleAccount);
  await backend.google.startGoogleSignIn(profileId);
  await backend.google.finishGoogleSignIn('https://app/#/auth-callback');
}

const event = (learnerId: string, type: 'lesson_completed' | 'language_changed'): LearnerEvent =>
  type === 'lesson_completed'
    ? createEvent(env.runtime, learnerId, type, { lessonId: 'ef1-01', correct: 5, scored: 5 })
    : createEvent(env.runtime, learnerId, type, { preference: 'hi_en' });

/** A learner that already exists on the server, with one finished lesson, from "another phone". */
async function existingLearner(
  googleAccount: string,
): Promise<{ id: string; events: LearnerEvent[] }> {
  const other = await env.addProfile('प्रिया');
  const api = backend.serverFor(googleAccount);
  await api.link({ profileId: other.id, name: 'प्रिया' });
  const events = [event(other.id, 'language_changed'), event(other.id, 'lesson_completed')];
  await api.push({ learnerId: other.id, events });
  await env.runtime.profiles.delete(other.id); // it lived on the other phone, not this one
  return { id: other.id, events };
}

describe('linking a profile', () => {
  test('a new profile links and is marked linked', async () => {
    const profile = await env.addProfile('रोहित');
    await signInGoogle(profile.id, 'google-rohit');
    expect(await linkProfile(env.runtime, profile.id)).toEqual({ kind: 'linked' });
    expect(await isLinked(env.runtime, profile.id)).toBe(true);
  });

  test('a fresh profile signed in to an existing learner takes it over with all its progress', async () => {
    const server = await existingLearner('google-priya');
    const fresh = await env.addProfile('नया', '4321');
    await env.runtime.events.append(event(fresh.id, 'language_changed'));
    await signInGoogle(fresh.id, 'google-priya');
    expect(await linkProfile(env.runtime, fresh.id)).toEqual({
      kind: 'adopted',
      learnerId: server.id,
    });

    expect(await env.runtime.profiles.get(fresh.id)).toBeNull();
    const adopted = await env.runtime.profiles.get(server.id);
    expect(adopted?.name).toBe('प्रिया');
    await signIn(server.id, '4321'); // the PIN chosen on this phone still works
    const local = await env.runtime.events.all(server.id);
    expect(local.map((e) => e.id).sort()).toEqual(server.events.map((e) => e.id).sort());
    expect(await env.runtime.events.pending(server.id, 100)).toEqual([]); // not uploaded again
    expect(await env.runtime.events.all(fresh.id)).toEqual([]);
    expect(await isLinked(env.runtime, server.id)).toBe(true);
    expect(await backend.google.accessToken(server.id)).toBe('google-priya');
  });

  test('a profile with its own learning is never merged into another learner', async () => {
    const server = await existingLearner('google-priya');
    const busy = await env.addProfile('दूसरा');
    await env.runtime.events.append(event(busy.id, 'lesson_completed'));
    await signInGoogle(busy.id, 'google-priya');
    expect(await linkProfile(env.runtime, busy.id)).toEqual({ kind: 'elsewhere' });
    expect(await env.runtime.profiles.get(busy.id)).not.toBeNull();
    expect(await env.runtime.events.all(busy.id)).toHaveLength(1);
    expect(await env.runtime.profiles.get(server.id)).toBeNull();
    expect(await isLinked(env.runtime, busy.id)).toBe(false);
    expect(await backend.google.accessToken(busy.id)).toBeNull(); // that session is dropped
  });

  test('offline, the profile stays usable and unlinked', async () => {
    const profile = await env.addProfile('रोहित');
    await signInGoogle(profile.id, 'google-rohit');
    backend.setOnline(false);
    expect(await linkProfile(env.runtime, profile.id)).toEqual({
      kind: 'failed',
      error: 'OFFLINE',
    });
    expect(await isLinked(env.runtime, profile.id)).toBe(false);
    await signIn(profile.id, '1234');
  });
});

describe('restoring on a new phone', () => {
  test('recovers the learner, their events and their progress', async () => {
    const server = await existingLearner('google-priya');
    const provisional = await startRestore(env.runtime, '9876');
    backend.useGoogleAccount('google-priya');
    await backend.google.finishGoogleSignIn('https://app/#/auth-callback');
    expect(await completeRestore(env.runtime, provisional)).toEqual({
      kind: 'restored',
      learnerId: server.id,
    });
    await signIn(server.id, '9876');
    const local = await env.runtime.events.all(server.id);
    expect(deriveProgress(local).completedLessons.has('ef1-01')).toBe(true);
    expect(await env.runtime.profiles.get(provisional)).toBeNull();
  });

  test('restoring twice adds nothing', async () => {
    const server = await existingLearner('google-priya');
    for (let round = 0; round < 2; round += 1) {
      const provisional = await startRestore(env.runtime, '9876');
      backend.useGoogleAccount('google-priya');
      await backend.google.finishGoogleSignIn('https://app/#/auth-callback');
      await completeRestore(env.runtime, provisional);
    }
    expect(await env.runtime.events.all(server.id)).toHaveLength(server.events.length);
    expect((await env.runtime.profiles.list()).map((p) => p.id)).toEqual([server.id]);
  });

  test('a Google account with no learner creates nothing', async () => {
    const provisional = await startRestore(env.runtime, '9876');
    backend.useGoogleAccount('google-nobody');
    await backend.google.finishGoogleSignIn('https://app/#/auth-callback');
    expect(await completeRestore(env.runtime, provisional)).toEqual({ kind: 'none' });
    expect(await env.runtime.profiles.list()).toEqual([]);
  });
});

describe('restoreEvents', () => {
  test('is idempotent and leaves nothing to upload', async () => {
    const server = await existingLearner('google-priya');
    const api = backend.serverFor('google-priya');
    expect(await restoreEvents(env.runtime, api, server.id)).toEqual({ pulled: 2 });
    expect(await restoreEvents(env.runtime, api, server.id)).toEqual({ pulled: 0 });
    expect(await env.runtime.events.all(server.id)).toHaveLength(2);
    expect(await env.runtime.events.pending(server.id, 100)).toEqual([]);
  });
});

describe('the sign-in callback page', () => {
  test('with no sign-in in progress it goes to the profile picker', async () => {
    navigate({ name: 'auth-callback' });
    render(AuthCallback);
    await vi.waitFor(() => expect(router.current.name).toBe('profiles'));
  });

  test('after linking it says so and leads to the picker', async () => {
    const profile = await env.addProfile('रोहित');
    backend.useGoogleAccount('google-rohit');
    await backend.google.startGoogleSignIn(profile.id);
    navigate({ name: 'auth-callback' });
    render(AuthCallback);
    // "Google से जुड़ रहे हैं…" shows first; wait for the finished message
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent?.trim()).toBe('Google से जुड़ गया'),
    );
    expect(await isLinked(env.runtime, profile.id)).toBe(true);
  });
});
