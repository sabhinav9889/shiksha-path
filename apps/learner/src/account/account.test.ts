// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createEvent, deriveProgress, type LearnerEvent } from '@shiksha/learner-core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signIn, signOut } from '../app-state.svelte.js';
import { navigate, router } from '../router.svelte.js';
import AuthCallback from '../screens/account/AuthCallback.svelte';
import CodeEntry from '../screens/account/CodeEntry.svelte';
import { signInWithCode } from './code-sign-in.js';
import { finishSignIn } from './finish-sign-in.js';
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

  test('a learner already on this phone is never taken over by another profile (shared phone)', async () => {
    const owner = await env.addProfile('प्रिया', '1111');
    await signInGoogle(owner.id, 'google-priya');
    expect(await linkProfile(env.runtime, owner.id)).toEqual({ kind: 'linked' });
    await env.runtime.events.append(event(owner.id, 'lesson_completed'));
    // Someone else makes a fresh profile; Google hands back the first learner's account.
    const fresh = await env.addProfile('रवि', '2222');
    await env.runtime.events.append(event(fresh.id, 'language_changed'));
    await signInGoogle(fresh.id, 'google-priya');
    expect(await linkProfile(env.runtime, fresh.id)).toEqual({ kind: 'elsewhere' });
    expect((await env.runtime.profiles.get(owner.id))?.name).toBe('प्रिया');
    await signIn(owner.id, '1111'); // the owner's PIN still opens it
    await expect(signIn(owner.id, '2222')).rejects.toThrow();
    expect(await env.runtime.profiles.get(fresh.id)).not.toBeNull();
    expect(await isLinked(env.runtime, fresh.id)).toBe(false);
    expect(await backend.google.accessToken(fresh.id)).toBeNull();
    expect(await backend.google.accessToken(owner.id)).toBe('google-priya');
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

  test('restoring a learner already on this phone keeps its PIN and drops the new one', async () => {
    const server = await existingLearner('google-priya');
    const first = await startRestore(env.runtime, '1111');
    backend.useGoogleAccount('google-priya');
    await backend.google.finishGoogleSignIn('https://app/#/auth-callback');
    await completeRestore(env.runtime, first);
    const second = await startRestore(env.runtime, '2222');
    await backend.google.finishGoogleSignIn('https://app/#/auth-callback');
    expect(await completeRestore(env.runtime, second)).toEqual({ kind: 'onPhone' });
    expect((await env.runtime.profiles.list()).map((p) => p.id)).toEqual([server.id]);
    await signIn(server.id, '1111');
    await expect(signIn(server.id, '2222')).rejects.toThrow();
    expect(await backend.google.accessToken(server.id)).toBe('google-priya');
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

  test('when linking breaks it says so and still offers the way on', async () => {
    const profile = await env.addProfile('रोहित');
    backend.useGoogleAccount('google-rohit');
    await backend.google.startGoogleSignIn(profile.id);
    await env.runtime.profiles.delete(profile.id);
    vi.spyOn(env.runtime.profiles, 'get').mockRejectedValue(new Error('storage broke'));
    navigate({ name: 'auth-callback' });
    render(AuthCallback);
    await vi.waitFor(() =>
      expect(screen.getByRole('status').textContent?.trim()).toBe(
        'अभी Google से नहीं जुड़ पाए। इंटरनेट मिलने पर फिर कोशिश करें।',
      ),
    );
    expect(screen.getByRole('button', { name: 'आगे' })).toBeTruthy();
    vi.restoreAllMocks();
  });
});

describe('backup codes', () => {
  test('a fresh profile signed in with a code takes over that learner', async () => {
    const { learnerId, code } = await backend.issueCode('कोड वाली');
    const fresh = await env.addProfile('नया', '4321');
    await env.runtime.events.append(event(fresh.id, 'language_changed'));
    expect(await signInWithCode(env.runtime, fresh.id, code)).toBe('ok');
    expect(await finishSignIn(env.runtime, fresh.id, 'code')).toBe('account.codeAdopted');
    expect((await env.runtime.profiles.get(learnerId))?.name).toBe('कोड वाली');
    await signIn(learnerId, '4321');
    expect(await isLinked(env.runtime, learnerId)).toBe(true);
  });

  test('restore with a code on an empty phone brings the progress back', async () => {
    const { learnerId, code } = await backend.issueCode('कोड वाली');
    const lesson = event(learnerId, 'lesson_completed');
    await backend.repos.events.insertMany(learnerId, [lesson]);
    const provisional = await startRestore(env.runtime, '9876', 'code');
    expect(await backend.google.accessToken(provisional)).toBeNull(); // no Google trip
    expect(await signInWithCode(env.runtime, provisional, code.toLowerCase())).toBe('ok');
    expect(await finishSignIn(env.runtime, provisional, 'code')).toBe('account.restored');
    await signIn(learnerId, '9876');
    expect(
      deriveProgress(await env.runtime.events.all(learnerId)).completedLessons.has('ef1-01'),
    ).toBe(true);
  });

  test('a wrong code changes nothing', async () => {
    const profile = await env.addProfile('रोहित');
    expect(await signInWithCode(env.runtime, profile.id, 'ABCD-EFGH')).toBe('BAD_CODE');
    expect(await backend.google.accessToken(profile.id)).toBeNull();
    expect(await isLinked(env.runtime, profile.id)).toBe(false);
  });

  test('offline it is OFFLINE, and the code is never written anywhere on the phone', async () => {
    const { code } = await backend.issueCode('A');
    const profile = await env.addProfile('रोहित');
    backend.setOnline(false);
    expect(await signInWithCode(env.runtime, profile.id, code)).toBe('OFFLINE');
    backend.setOnline(true);
    expect(await signInWithCode(env.runtime, profile.id, code)).toBe('ok');
    const stored = JSON.stringify([
      await env.runtime.events.getMeta(`linked:${profile.id}`),
      Object.values(sessionStorage),
      Object.values(localStorage),
    ]);
    expect(stored).not.toContain(code);
    expect(stored).not.toContain(code.replace('-', ''));
  });
});

describe('the code screen', () => {
  const field = () => screen.getByLabelText('अपना कोड लिखें') as HTMLInputElement;

  test('a wrong code says so and the field is cleared', async () => {
    const profile = await env.addProfile('रोहित');
    render(CodeEntry, { lang: 'hi', profileId: profile.id });
    await fireEvent.input(field(), { target: { value: 'ABCD-EFGH' } });
    await fireEvent.click(screen.getByRole('button', { name: 'कोड से जुड़ें' }));
    await vi.waitFor(() => screen.getByText('यह कोड सही नहीं है'));
    expect(field().value).toBe('');
  });

  test('too many tries says to wait', async () => {
    const profile = await env.addProfile('रोहित');
    backend.repos.limiter = {
      hit: () => Promise.resolve(false),
      count: () => Promise.resolve(Number.MAX_SAFE_INTEGER),
    };
    render(CodeEntry, { lang: 'hi', profileId: profile.id });
    await fireEvent.input(field(), { target: { value: 'ABCD-EFGH' } });
    await fireEvent.click(screen.getByRole('button', { name: 'कोड से जुड़ें' }));
    await vi.waitFor(() => screen.getByText('बहुत कोशिशें हुईं, थोड़ी देर बाद फिर करें'));
  });

  test('a right code finishes linking and leads to the picker, with the code gone from the page', async () => {
    const { code } = await backend.issueCode('कोड वाली');
    const profile = await env.addProfile('नया');
    render(CodeEntry, { lang: 'hi', profileId: profile.id });
    await fireEvent.input(field(), { target: { value: code } });
    await fireEvent.click(screen.getByRole('button', { name: 'कोड से जुड़ें' }));
    await vi.waitFor(() =>
      screen.getByText('कोड से जुड़ गया – आपकी पुरानी प्रोग्रेस इस फ़ोन पर आ गई'),
    );
    expect(document.body.innerHTML).not.toContain(code);
    await fireEvent.click(screen.getByRole('button', { name: 'आगे' }));
    expect(router.current.name).toBe('profiles');
  });
});
