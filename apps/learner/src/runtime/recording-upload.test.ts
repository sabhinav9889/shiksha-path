// @vitest-environment jsdom
import 'fake-indexeddb/auto';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeFakeBackend, type FakeBackend } from '../../test/helpers/fake-backend.js';
import { makeEnv, type TestEnv } from '../../test/helpers/installed-runtime.js';
import { setLinked } from '../account/account.js';
import { initApp, signIn, signOut } from '../app-state.svelte.js';
import MeScreen from '../screens/me/MeScreen.svelte';
import type { Recording } from '../storage/recording-store.js';
import { uploadRecordings } from './recording-upload.js';

let env: TestEnv;
let backend: FakeBackend;
let learner: string;

function connection(type: string | null): void {
  Object.defineProperty(navigator, 'connection', {
    value: type === null ? undefined : { type },
    configurable: true,
  });
}

async function linkedProfile(name: string, googleAccount: string): Promise<string> {
  const profile = await env.addProfile(name);
  backend.useGoogleAccount(googleAccount);
  await backend.google.startGoogleSignIn(profile.id);
  await backend.google.finishGoogleSignIn('x');
  await backend.serverFor(googleAccount).link({ profileId: profile.id, name });
  await setLinked(env.runtime, profile.id);
  return profile.id;
}

let n = 0;
const recording = (learnerId: string, itemId = `s${n}`): Recording => ({
  id: crypto.randomUUID(),
  learnerId,
  lessonId: 'ef1-02',
  itemId: `${itemId}-${n++}`,
  mime: 'audio/webm',
  bytes: Uint8Array.of(1, 2, 3, 4),
  durationMs: 2000,
  at: '2026-10-22T10:00:00.000Z',
});

beforeEach(async () => {
  signOut();
  backend = makeFakeBackend();
  env = await makeEnv({ account: backend.account });
  initApp(env.runtime);
  learner = await linkedProfile('प्रिया', 'google-priya');
  for (let i = 0; i < 2; i += 1) await env.runtime.recordings.put(recording(learner));
});

afterEach(() => connection(null));

const onServer = (learnerId: string) => backend.repos.recordings.listByLearner(learnerId);

describe('uploading recordings', () => {
  test('on Wi-Fi a sync uploads them and frees their space on the phone', async () => {
    connection('wifi');
    const out = await env.runtime.sync(learner);
    expect(out.recordings).toEqual({ uploaded: 2, left: 0 });
    expect((await onServer(learner)).map((r) => r.status)).toEqual(['uploaded', 'uploaded']);
    expect(backend.repos.storage.paths()).toHaveLength(2);
    expect(await env.runtime.recordings.summary(learner)).toEqual({ count: 0, bytes: 0 });
    expect(await env.runtime.recordings.pendingUpload(learner)).toEqual([]);
  });

  test.each([
    ['mobile data', 'cellular'],
    ['a browser that cannot tell', null],
  ])('on %s a sync uploads nothing', async (_label, type) => {
    connection(type);
    const out = await env.runtime.sync(learner);
    expect(out.recordings).toEqual({ uploaded: 0, left: 2 });
    expect(await onServer(learner)).toEqual([]);
  });

  test('the learner can upload on purpose over mobile data (the lab button)', async () => {
    connection('cellular');
    expect(await uploadRecordings(env.runtime, learner)).toEqual({ uploaded: 2, left: 0 });
  });

  test('a profile that is not linked uploads nothing', async () => {
    connection('wifi');
    const other = await env.addProfile('रोहित');
    await env.runtime.recordings.put(recording(other.id));
    expect(await uploadRecordings(env.runtime, other.id)).toEqual({ uploaded: 0, left: 1 });
  });

  test('a failed upload keeps the bytes, and the next try sends it', async () => {
    backend.failUploads(true);
    expect(await uploadRecordings(env.runtime, learner)).toEqual({ uploaded: 0, left: 2 });
    expect((await env.runtime.recordings.summary(learner)).bytes).toBe(8);
    backend.failUploads(false);
    expect(await uploadRecordings(env.runtime, learner)).toEqual({ uploaded: 2, left: 0 });
  });

  test.each([
    [
      'speaking practice switched off',
      () => backend.repos.setOverride(learner, 'speaking_practice', false),
    ],
    [
      'the server rate limit',
      () => {
        backend.repos.limiter = {
          hit: () => Promise.resolve(false),
          count: () => Promise.resolve(Number.MAX_SAFE_INTEGER),
        };
        return Promise.resolve();
      },
    ],
    ['no network', () => Promise.resolve(backend.setOnline(false))],
  ])('with %s everything stays on the phone, without an error', async (_label, breakIt) => {
    await breakIt();
    expect(await uploadRecordings(env.runtime, learner)).toEqual({ uploaded: 0, left: 2 });
    expect((await env.runtime.recordings.summary(learner)).count).toBe(2);
  });

  test('a real recorder type (with codecs) uploads as its base type; an odd one waits alone', async () => {
    const real = { ...recording(learner), mime: 'audio/webm;codecs=opus' };
    const odd = { ...recording(learner), mime: 'audio/wav' };
    await env.runtime.recordings.put(odd);
    await env.runtime.recordings.put(real);
    expect(await uploadRecordings(env.runtime, learner)).toEqual({ uploaded: 3, left: 1 });
    expect((await backend.repos.recordings.get(real.id))?.mime).toBe('audio/webm');
    expect((await env.runtime.recordings.pendingUpload(learner)).map((r) => r.id)).toEqual([
      odd.id,
    ]);
  });

  test("one profile's recordings are never uploaded as another's", async () => {
    const rohit = await linkedProfile('रोहित', 'google-rohit');
    await env.runtime.recordings.put(recording(rohit));
    await uploadRecordings(env.runtime, learner);
    expect(await onServer(rohit)).toEqual([]);
    expect((await onServer(learner)).every((r) => r.learnerId === learner)).toBe(true);
    expect(await env.runtime.recordings.pendingUpload(rohit)).toHaveLength(1);
  });
});

describe('the me screen', () => {
  test('shows how many wait, and the button uploads them even on mobile data', async () => {
    connection('cellular');
    await signIn(learner, '1234');
    render(MeScreen);
    await vi.waitFor(() => screen.getByText('2 रिकॉर्डिंग अपलोड होनी हैं'));
    await fireEvent.click(screen.getByRole('button', { name: 'रिकॉर्डिंग अपलोड करें' }));
    await vi.waitFor(() => screen.getByText('सब रिकॉर्डिंग अपलोड हो गईं'));
    expect(await onServer(learner)).toHaveLength(2);
  });

  test('when the upload cannot happen it says the recordings are saved on the phone', async () => {
    backend.setOnline(false);
    await signIn(learner, '1234');
    render(MeScreen);
    await fireEvent.click(
      await vi.waitFor(() => screen.getByRole('button', { name: 'रिकॉर्डिंग अपलोड करें' })),
    );
    await vi.waitFor(() => screen.getByText('फ़ोन में सेव · इंटरनेट मिलते ही अपलोड'));
  });
});
