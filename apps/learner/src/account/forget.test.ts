// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createEvent } from '@shiksha/learner-core';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { appState, initApp, signIn, signOut } from '../app-state.svelte.js';
import { navigate, router } from '../router.svelte.js';
import MeScreen from '../screens/me/MeScreen.svelte';
import ProfilesScreen from '../screens/profiles/ProfilesScreen.svelte';
import { isLinked, setLinked } from './account.js';
import { wipeProfile } from './forget.js';

let env: TestEnv;
let backend: FakeBackend;

async function linkedProfile(name: string, google: string): Promise<string> {
  const profile = await env.addProfile(name);
  backend.useGoogleAccount(google);
  await backend.google.startGoogleSignIn(profile.id);
  await backend.google.finishGoogleSignIn('x');
  await backend.serverFor(google).link({ profileId: profile.id, name });
  await setLinked(env.runtime, profile.id);
  return profile.id;
}

async function fill(learnerId: string): Promise<void> {
  await env.runtime.events.append(
    createEvent(env.runtime, learnerId, 'lesson_completed', {
      lessonId: 'ef1-01',
      correct: 5,
      scored: 5,
    }),
  );
  await env.runtime.recordings.put({
    id: crypto.randomUUID(),
    learnerId,
    lessonId: 'ef1-02',
    itemId: 's1',
    mime: 'audio/webm',
    bytes: Uint8Array.of(1),
    durationMs: 1000,
    at: '2026-10-22T10:00:00.000Z',
  });
}

async function onPhone(learnerId: string) {
  return {
    profile: await env.runtime.profiles.get(learnerId),
    events: (await env.runtime.events.all(learnerId)).length,
    recordings: (await env.runtime.recordings.pendingUpload(learnerId)).length,
    linked: await isLinked(env.runtime, learnerId),
    session: await backend.google.accessToken(learnerId),
  };
}

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
});

describe('a student deleted on request', () => {
  test("the next sync wipes them from this phone, and nobody else's data", async () => {
    const priya = await linkedProfile('प्रिया', 'google-priya');
    const rohit = await linkedProfile('रोहित', 'google-rohit');
    await fill(priya);
    await fill(rohit);
    await backend.deleteLearner(priya);
    const out = await env.runtime.sync(priya);
    expect(out.wiped).toBe(true);
    expect(await onPhone(priya)).toEqual({
      profile: null,
      events: 0,
      recordings: 0,
      linked: false,
      session: null,
    });
    expect(await onPhone(rohit)).toMatchObject({ events: 1, recordings: 1, linked: true });
    expect((await env.runtime.sync(rohit)).wiped).toBe(false);
  });

  test('the picker says so once', async () => {
    const priya = await linkedProfile('प्रिया', 'google-priya');
    await backend.deleteLearner(priya);
    await env.runtime.sync(priya);
    navigate({ name: 'profiles' });
    const first = render(ProfilesScreen);
    await vi.waitFor(() => screen.getByText('यह प्रोफ़ाइल NGO के कहने पर हटा दी गई'));
    first.unmount();
    render(ProfilesScreen);
    await vi.waitFor(() => screen.getByLabelText('आपका नाम'));
    expect(screen.queryByText('यह प्रोफ़ाइल NGO के कहने पर हटा दी गई')).toBeNull();
  });

  test('a sign-in that stopped working is not a deletion: nothing is wiped', async () => {
    const priya = await linkedProfile('प्रिया', 'google-priya');
    await backend.google.signOutGoogle(priya); // UNAUTHENTICATED, but not deleted
    expect((await env.runtime.sync(priya)).wiped).toBe(false);
    expect(await env.runtime.profiles.get(priya)).not.toBeNull();
  });

  test('a profile that was never linked is never asked about', async () => {
    const local = await env.addProfile('फ़ोन वाली');
    await env.runtime.sync(local.id);
    expect(backend.deletedChecks()).toBe(0);
  });
});

describe('removing a profile from this phone', () => {
  test('wipeProfile removes only that profile, and the server keeps it for a restore', async () => {
    const priya = await linkedProfile('प्रिया', 'google-priya');
    await fill(priya);
    await wipeProfile(env.runtime, priya);
    expect((await onPhone(priya)).profile).toBeNull();
    expect(await backend.repos.learners.findById(priya)).not.toBeNull();
  });

  test('from the me screen, with the PIN; a wrong PIN removes nothing', async () => {
    const priya = await linkedProfile('प्रिया', 'google-priya');
    await signIn(priya, '1234');
    navigate({ name: 'me' }); // the router is shared between tests
    render(MeScreen);
    await fireEvent.click(
      await vi.waitFor(() => screen.getByRole('button', { name: 'इस फ़ोन से प्रोफ़ाइल हटाएँ' })),
    );
    for (const digit of '9999') await fireEvent.click(screen.getByRole('button', { name: digit }));
    await vi.waitFor(() => screen.getByRole('alert'));
    expect(await env.runtime.profiles.get(priya)).not.toBeNull();
    for (const digit of '1234') await fireEvent.click(screen.getByRole('button', { name: digit }));
    await vi.waitFor(() => expect(router.current.name).toBe('profiles'));
    expect(await env.runtime.profiles.get(priya)).toBeNull();
    expect(appState.profile).toBeNull();
  });
});
