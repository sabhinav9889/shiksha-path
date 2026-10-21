// @vitest-environment jsdom
import type { PracticeItem } from '@shiksha/content/schema';
import type { Answer } from '@shiksha/learner-core';
import { MemoryBundleStorage } from '@shiksha/learner-core/testing';
import { fireEvent, render, screen } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { RecorderError, type Recorder, type RecordingResult } from '../../../audio/recorder.js';
import { appState } from '../../../app-state.svelte.js';
import { ALL_ON } from '../../../runtime/switches.js';
import SpeakView from './SpeakView.svelte';

const speak: Extract<PracticeItem, { type: 'speak_compare' }> = {
  id: 's1',
  type: 'speak_compare',
  prompt: { hi: 'बोलें', en: 'Say it' },
  text: 'Hello, my name is Priya.',
  model_audio: 'audio/0123456789abcdef.mp3',
};
const RESULT: RecordingResult = {
  mime: 'audio/webm',
  bytes: Uint8Array.of(1, 2),
  durationMs: 2000,
};

function fakeRecorder(
  opts: { supported?: boolean; startError?: RecorderError; stopError?: RecorderError } = {},
) {
  return {
    isSupported: () => opts.supported ?? true,
    start: vi.fn(() => (opts.startError ? Promise.reject(opts.startError) : Promise.resolve())),
    stop: vi.fn(() => (opts.stopError ? Promise.reject(opts.stopError) : Promise.resolve(RESULT))),
    cancel: vi.fn(),
  } satisfies Recorder;
}

const createUrl = vi.fn(() => 'blob:my-recording');
const revokeUrl = vi.fn();

beforeEach(() => {
  createUrl.mockClear();
  revokeUrl.mockClear();
  Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: revokeUrl });
  vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderView(
  recorder: Recorder | undefined,
  over: { locked?: boolean; onrecord?: (r: RecordingResult) => Promise<void> } = {},
) {
  const onanswer = vi.fn<(answer: Answer) => void>();
  const onrecord = vi.fn(over.onrecord ?? (() => Promise.resolve()));
  const view = render(SpeakView, {
    item: speak,
    lang: 'hi',
    storage: new MemoryBundleStorage(),
    seed: 's',
    locked: over.locked ?? false,
    onanswer,
    recorder,
    onrecord,
  });
  return { onanswer, onrecord, view };
}

const button = (name: string | RegExp): HTMLButtonElement =>
  screen.getByRole('button', { name }) as HTMLButtonElement;
const text = (): string => document.body.textContent ?? '';

describe('recording', () => {
  test('record, stop and save, then hear it, record again and move on', async () => {
    const { onanswer, onrecord } = renderView(fakeRecorder());
    expect(text()).toContain('सिर्फ़ आपको और आपके मेंटर को');
    await fireEvent.click(button('रिकॉर्ड करें'));
    await vi.waitFor(() => button('रोकें'));
    await fireEvent.click(button('रोकें'));
    await vi.waitFor(() => expect(text()).toContain('रिकॉर्डिंग सेव हो गई'));
    expect(onrecord).toHaveBeenCalledTimes(1);
    expect(onrecord).toHaveBeenCalledWith(RESULT);
    await fireEvent.click(button('मेरी रिकॉर्डिंग सुनें'));
    await vi.waitFor(() => expect(HTMLMediaElement.prototype.play).toHaveBeenCalled());
    await fireEvent.click(button('फिर से रिकॉर्ड करें'));
    await vi.waitFor(() => button('रोकें'));
    await fireEvent.click(button('रोकें'));
    await vi.waitFor(() => expect(onrecord).toHaveBeenCalledTimes(2));
    await fireEvent.click(button('आगे'));
    expect(onanswer).toHaveBeenCalledWith({ kind: 'spoken' });
  });

  test('recording stops by itself at 30 seconds and is still saved', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { onrecord } = renderView(fakeRecorder());
    await fireEvent.click(button('रिकॉर्ड करें'));
    await vi.waitFor(() => expect(text()).toContain('30 सेकंड बाकी'));
    await vi.advanceTimersByTimeAsync(10_000);
    expect(text()).toContain('20 सेकंड बाकी');
    await vi.advanceTimersByTimeAsync(20_000);
    await vi.waitFor(() => expect(onrecord).toHaveBeenCalledTimes(1));
  });

  test('the playback URL is freed when it ends and when the item goes away', async () => {
    const { view } = renderView(fakeRecorder());
    await fireEvent.click(button('रिकॉर्ड करें'));
    await vi.waitFor(() => button('रोकें'));
    await fireEvent.click(button('रोकें'));
    await vi.waitFor(() => button('मेरी रिकॉर्डिंग सुनें'));
    await fireEvent.click(button('मेरी रिकॉर्डिंग सुनें'));
    const audio = await vi.waitFor(() => document.querySelector('audio') as HTMLAudioElement);
    await fireEvent(audio, new Event('ended'));
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    await fireEvent.click(button('मेरी रिकॉर्डिंग सुनें'));
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(2));
    view.unmount();
    expect(revokeUrl).toHaveBeenCalledTimes(2);
  });
});

describe('when recording is not possible the learner can always carry on', () => {
  test.each([
    ['denied', 'माइक्रोफ़ोन की अनुमति नहीं मिली'],
    ['failed', 'रिकॉर्डिंग नहीं हो पाई'],
  ] as const)('a %s start shows the explanation and next still works', async (kind, message) => {
    const { onanswer } = renderView(fakeRecorder({ startError: new RecorderError(kind) }));
    await fireEvent.click(button('रिकॉर्ड करें'));
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain(message));
    await fireEvent.click(button('आगे'));
    expect(onanswer).toHaveBeenCalledWith({ kind: 'spoken' });
  });

  test('a phone without recording says so from the start', async () => {
    const { onanswer } = renderView(fakeRecorder({ supported: false }));
    expect(screen.getByRole('alert').textContent).toContain('रिकॉर्डिंग नहीं चल सकती');
    expect(screen.queryByRole('button', { name: 'रिकॉर्ड करें' })).toBeNull();
    await fireEvent.click(button('आगे'));
    expect(onanswer).toHaveBeenCalledWith({ kind: 'spoken' });
  });

  test('no recorder at all behaves like an unsupported phone', () => {
    renderView(undefined);
    expect(screen.getByRole('alert').textContent).toContain('रिकॉर्डिंग नहीं चल सकती');
  });

  test('a recording that is too large or fails to save shows the failure', async () => {
    renderView(fakeRecorder({ stopError: new RecorderError('too_large') }));
    await fireEvent.click(button('रिकॉर्ड करें'));
    await fireEvent.click(await vi.waitFor(() => button('रोकें')));
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('नहीं हो पाई'));
  });

  test('a save that fails shows the failure and next still works', async () => {
    const { onanswer } = renderView(fakeRecorder(), {
      onrecord: () => Promise.reject(new Error('disk')),
    });
    await fireEvent.click(button('रिकॉर्ड करें'));
    await fireEvent.click(await vi.waitFor(() => button('रोकें')));
    await vi.waitFor(() => expect(screen.getByRole('alert').textContent).toContain('नहीं हो पाई'));
    await fireEvent.click(button('आगे'));
    expect(onanswer).toHaveBeenCalledTimes(1);
  });

  test('locked disables recording and next', () => {
    renderView(fakeRecorder(), { locked: true });
    expect(button('रिकॉर्ड करें').disabled).toBe(true);
    expect(button('आगे').disabled).toBe(true);
  });

  test('moving on while recording cancels it and releases the microphone', async () => {
    const recorder = fakeRecorder();
    const { onanswer } = renderView(recorder);
    await fireEvent.click(button('रिकॉर्ड करें'));
    await vi.waitFor(() => button('रोकें'));
    await fireEvent.click(button('आगे'));
    expect(recorder.cancel).toHaveBeenCalled();
    expect(onanswer).toHaveBeenCalledWith({ kind: 'spoken' });
  });
});

describe('review fixes', () => {
  function slowRecorder() {
    let open = (): void => undefined;
    const gate = new Promise<void>((resolve) => (open = resolve));
    const recorder = {
      isSupported: () => true,
      start: vi.fn(() => gate),
      stop: vi.fn(() => Promise.resolve(RESULT)),
      cancel: vi.fn(),
    } satisfies Recorder;
    return { recorder, open };
  }

  test('a double tap on record while the microphone opens starts it once', async () => {
    const { recorder, open } = slowRecorder();
    renderView(recorder);
    await fireEvent.click(button('रिकॉर्ड करें'));
    await fireEvent.click(button('रिकॉर्ड करें'));
    open();
    await vi.waitFor(() => button('रोकें'));
    expect(recorder.start).toHaveBeenCalledTimes(1);
  });

  test('leaving while the microphone opens cancels it and never saves anything', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const { recorder, open } = slowRecorder();
    const { onrecord, view } = renderView(recorder);
    await fireEvent.click(button('रिकॉर्ड करें'));
    view.unmount();
    open();
    await vi.advanceTimersByTimeAsync(31_000);
    expect(recorder.cancel).toHaveBeenCalled();
    expect(onrecord).not.toHaveBeenCalled();
  });

  test('next while the microphone opens cancels it', async () => {
    const { recorder, open } = slowRecorder();
    const { onanswer } = renderView(recorder);
    await fireEvent.click(button('रिकॉर्ड करें'));
    await fireEvent.click(button('आगे'));
    open();
    await vi.waitFor(() => expect(recorder.cancel).toHaveBeenCalled());
    expect(onanswer).toHaveBeenCalledTimes(1);
  });

  test('hearing the recording still works after recording again during playback', async () => {
    renderView(fakeRecorder());
    await fireEvent.click(button('रिकॉर्ड करें'));
    await fireEvent.click(await vi.waitFor(() => button('रोकें')));
    await fireEvent.click(await vi.waitFor(() => button('मेरी रिकॉर्डिंग सुनें')));
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(1));
    await fireEvent.click(button('फिर से रिकॉर्ड करें')); // while it is still playing
    await fireEvent.click(await vi.waitFor(() => button('रोकें')));
    expect(revokeUrl).toHaveBeenCalledTimes(1);
    await fireEvent.click(await vi.waitFor(() => button('मेरी रिकॉर्डिंग सुनें')));
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(2));
  });

  test('a playback that fails frees its URL and can be tried again', async () => {
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockRejectedValue(new Error('no audio output'));
    renderView(fakeRecorder());
    await fireEvent.click(button('रिकॉर्ड करें'));
    await fireEvent.click(await vi.waitFor(() => button('रोकें')));
    await fireEvent.click(await vi.waitFor(() => button('मेरी रिकॉर्डिंग सुनें')));
    await vi.waitFor(() => expect(revokeUrl).toHaveBeenCalledTimes(1));
    await fireEvent.click(button('मेरी रिकॉर्डिंग सुनें'));
    await vi.waitFor(() => expect(createUrl).toHaveBeenCalledTimes(2));
  });
});

describe('with speaking practice switched off', () => {
  afterEach(() => {
    appState.switches = { ...ALL_ON };
  });

  test('there is no record button, the model audio stays and "आगे" still works', async () => {
    appState.switches = { ...ALL_ON, speaking_practice: false };
    const { onanswer } = renderView(fakeRecorder());
    expect(screen.queryByRole('button', { name: 'रिकॉर्ड करें' })).toBeNull();
    expect(text()).not.toContain('सिर्फ़ आपको और आपके मेंटर को');
    // the model audio is still offered (this test's phone has not downloaded it yet)
    await vi.waitFor(() => button('ऑडियो डाउनलोड करें'));
    await fireEvent.click(button('आगे'));
    expect(onanswer).toHaveBeenCalledWith({ kind: 'spoken' });
  });
});
