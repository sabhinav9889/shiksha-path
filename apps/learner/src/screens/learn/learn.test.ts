// @vitest-environment jsdom
import { createEvent } from '@shiksha/learner-core';
import { MemoryBundleStorage } from '@shiksha/learner-core/testing';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { makeEnv, type TestEnv } from '../../../test/helpers/installed-runtime.js';
import { audioObjectUrl } from '../../audio/audio-source.js';
import { activity } from '../../activity.svelte.js';
import { appState, initApp, signIn, signOut } from '../../app-state.svelte.js';
import { navigate, router } from '../../router.svelte.js';
import LearnScreen from './LearnScreen.svelte';

let env: TestEnv;
const createUrl = vi.fn(() => 'blob:lesson-audio');
const revokeUrl = vi.fn();

beforeEach(async () => {
  signOut();
  createUrl.mockClear();
  revokeUrl.mockClear();
  Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
  env = await makeEnv();
  initApp(env.runtime);
});

afterEach(() => {
  vi.restoreAllMocks();
});

async function openLesson(preference?: 'en_only'): Promise<void> {
  const profile = await env.addProfile('प्रिया');
  if (preference) {
    await env.runtime.events.append(
      createEvent(env.runtime, profile.id, 'language_changed', { preference }),
    );
  }
  await signIn(profile.id, '1234');
  const started = await appState.session?.startLesson('ef1-01');
  activity.current = { kind: 'lesson', ...(started as NonNullable<typeof started>) };
  navigate({ name: 'learn', lessonId: 'ef1-01' });
  render(LearnScreen);
}

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const text = (): string => document.body.textContent ?? '';

describe('audioObjectUrl', () => {
  test('is null for a file that is not stored', async () => {
    expect(
      await audioObjectUrl(new MemoryBundleStorage(), 'audio/0123456789abcdef.mp3'),
    ).toBeNull();
  });

  test.each([
    ['mp3', 'audio/mpeg'],
    ['m4a', 'audio/mp4'],
    ['ogg', 'audio/ogg'],
    ['opus', 'audio/ogg'],
    ['webm', 'audio/webm'],
  ])('a .%s file becomes a %s Blob URL that can be revoked', async (extension, type) => {
    const storage = new MemoryBundleStorage();
    const path = `audio/0123456789abcdef.${extension}`;
    await storage.putAudio(path, Uint8Array.of(1, 2, 3));
    const result = await audioObjectUrl(storage, path);
    expect(result?.url).toBe('blob:lesson-audio');
    expect((createUrl.mock.calls[0] as unknown as [Blob])[0].type).toBe(type);
    result?.revoke();
    expect(revokeUrl).toHaveBeenCalledWith('blob:lesson-audio');
  });
});

describe('the lesson text', () => {
  test('shows the lesson in the primary language and toggles to the other', async () => {
    await openLesson();
    await vi.waitFor(() => expect(text()).toContain('यह पाठ 1 है'));
    expect(screen.getByRole('heading', { name: 'पाठ 1' })).toBeTruthy();
    await fireEvent.click(button('English में देखें'));
    expect(text()).toContain('This is lesson 1');
    expect(screen.getByRole('heading', { name: 'Lesson 1' })).toBeTruthy();
    await fireEvent.click(button('हिंदी में देखें'));
    expect(text()).toContain('यह पाठ 1 है');
  });

  test('an English-only learner sees English and no toggle', async () => {
    await openLesson('en_only');
    await vi.waitFor(() => expect(text()).toContain('This is lesson 1'));
    expect(screen.queryByRole('button', { name: /देखें|View in/ })).toBeNull();
  });

  test('the practice button goes to practice, back clears the lesson and returns', async () => {
    await openLesson();
    await vi.waitFor(() => button('अभ्यास करें'));
    await fireEvent.click(button('अभ्यास करें'));
    expect(router.current.name).toBe('practice');
    expect(activity.current).not.toBeNull();
    await fireEvent.click(button('वापस'));
    expect(router.current.name).toBe('lessons');
    expect(activity.current).toBeNull();
  });

  test('with no lesson in progress (a reload) it goes back to the lessons list', async () => {
    navigate({ name: 'learn', lessonId: 'ef1-01' });
    render(LearnScreen);
    await vi.waitFor(() => expect(router.current.name).toBe('lessons'));
  });
});

describe('lesson audio', () => {
  test('plays the stored audio and frees the URL when it ends', async () => {
    await openLesson();
    await vi.waitFor(() => button('पाठ सुनें'));
    await fireEvent.click(button('पाठ सुनें'));
    await vi.waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    const audio = document.querySelector('audio') as HTMLAudioElement;
    expect(audio.getAttribute('src')).toBe('blob:lesson-audio');
    await fireEvent(audio, new Event('ended'));
    expect(revokeUrl).toHaveBeenCalledWith('blob:lesson-audio');
  });

  test('missing audio offers a download, then plays after it arrives', async () => {
    const [victim] = await env.runtime.storage.listAudio();
    const owner = (await env.runtime.storage.getModule('english-foundation-1'))?.bundle.audio ?? [];
    expect(owner.some((a) => a.path === victim)).toBe(true);
    for (const path of await env.runtime.storage.listAudio())
      await env.runtime.storage.removeAudio(path);
    await openLesson();
    await vi.waitFor(() => button('ऑडियो डाउनलोड करें'));
    await fireEvent.click(button('ऑडियो डाउनलोड करें'));
    await vi.waitFor(() => button('पाठ सुनें'), { timeout: 5000 });
  });
});

describe('hardening', () => {
  test('two quick taps, or leaving while the audio loads, never leave an audio URL behind', async () => {
    const { MemoryBundleStorage: Store } = await import('@shiksha/learner-core/testing');
    const AudioButton = (await import('./AudioButton.svelte')).default;
    const storage = new Store();
    const path = 'audio/0123456789abcdef.mp3';
    await storage.putAudio(path, Uint8Array.of(1, 2, 3));
    const real = storage.getAudio.bind(storage);
    let open = (): void => undefined;
    let gate = new Promise<void>((resolve) => (open = resolve));
    storage.getAudio = async (p) => {
      await gate;
      return real(p);
    };
    const first = render(AudioButton, { storage, path, label: 'सुनें' });
    const play = await vi.waitFor(() => screen.getByRole('button', { name: 'सुनें' }));
    await fireEvent.click(play);
    await fireEvent.click(play);
    open();
    await vi.waitFor(() => expect(createUrl.mock.calls.length).toBeGreaterThan(0));
    first.unmount();
    expect(revokeUrl.mock.calls.length).toBe(createUrl.mock.calls.length);

    gate = new Promise<void>((resolve) => (open = resolve));
    const second = render(AudioButton, { storage, path, label: 'सुनें' });
    await fireEvent.click(await vi.waitFor(() => screen.getByRole('button', { name: 'सुनें' })));
    second.unmount(); // gone before the audio finished loading
    open();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(revokeUrl.mock.calls.length).toBe(createUrl.mock.calls.length);
  });

  test('an audio download that fails says so', async () => {
    for (const p of await env.runtime.storage.listAudio()) await env.runtime.storage.removeAudio(p);
    env.runtime.content.fetchAudio = () => Promise.resolve({ ok: false, error: 'DOWNLOAD_FAILED' });
    await openLesson();
    await fireEvent.click(await vi.waitFor(() => button('ऑडियो डाउनलोड करें')));
    await vi.waitFor(() =>
      expect(screen.getByRole('alert').textContent).toContain('ऑडियो डाउनलोड नहीं हुआ'),
    );
  });
});
