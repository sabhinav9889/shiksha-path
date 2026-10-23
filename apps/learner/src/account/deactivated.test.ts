// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { createEvent } from '@shiksha/learner-core';
import { render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { initApp, signIn, signOut } from '../app-state.svelte.js';
import { navigate } from '../router.svelte.js';
import MeScreen from '../screens/me/MeScreen.svelte';
import { setLinked } from './account.js';

let env: TestEnv;
let backend: FakeBackend;
let learner: string;
const MESSAGE = 'आपकी प्रोफ़ाइल अभी बंद है — अपने मेंटर से बात करें';

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

const lesson = () =>
  createEvent(env.runtime, learner, 'lesson_completed', {
    lessonId: 'ef1-01',
    correct: 5,
    scored: 5,
  });

describe('a deactivated student', () => {
  test('keeps learning offline, is told why, and uploads once reactivated', async () => {
    await backend.repos.org.setDeactivated(learner, true);
    await env.runtime.events.append(lesson());
    const out = await env.runtime.sync(learner);
    expect(out.deactivated).toBe(true);
    expect(await env.runtime.events.pending(learner, 10)).toHaveLength(1);

    await signIn(learner, '1234');
    navigate({ name: 'me' });
    const me = render(MeScreen);
    await vi.waitFor(() => screen.getByText(MESSAGE));
    me.unmount();

    await backend.repos.org.setDeactivated(learner, false);
    const back = await env.runtime.sync(learner);
    expect(back.deactivated).toBe(false);
    expect(await env.runtime.events.pending(learner, 10)).toEqual([]);
    render(MeScreen);
    await vi.waitFor(() => screen.getByRole('button', { name: /अभी sync करें/ }));
    expect(screen.queryByText(MESSAGE)).toBeNull();
  });
});
