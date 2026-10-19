import { describe, expect, test, vi } from 'vitest';
import {
  AUDIO_BITS_PER_SECOND,
  MAX_RECORDING_MS,
  MIME_PREFERENCE,
  RecorderError,
  createRecorder,
  pickMimeType,
} from './recorder.js';

type Listener = (event: { data?: Blob }) => void;

/** A stand-in for MediaRecorder: hands out the chunks it was given when stopped. */
function fakeRecorderClass(
  opts: { chunks?: Uint8Array[]; supported?: string[]; failOnStart?: boolean } = {},
) {
  const created: FakeRecorder[] = [];
  class FakeRecorder {
    static isTypeSupported = (mime: string): boolean =>
      (opts.supported ?? MIME_PREFERENCE).includes(mime);
    state: 'inactive' | 'recording' = 'inactive';
    private listeners: Record<string, Listener[]> = {};
    constructor(
      readonly stream: unknown,
      readonly options: { mimeType?: string; audioBitsPerSecond?: number },
    ) {
      created.push(this);
    }
    addEventListener(type: string, listener: Listener): void {
      (this.listeners[type] ??= []).push(listener);
    }
    private emit(type: string, event: { data?: Blob } = {}): void {
      for (const listener of this.listeners[type] ?? []) listener(event);
    }
    start(): void {
      if (opts.failOnStart) throw new Error('boom');
      this.state = 'recording';
    }
    stop(): void {
      if (this.state !== 'recording') return;
      this.state = 'inactive';
      for (const chunk of opts.chunks ?? [Uint8Array.of(1, 2), Uint8Array.of(3)]) {
        this.emit('dataavailable', { data: new Blob([new Uint8Array(chunk)]) });
      }
      this.emit('stop');
    }
    fail(): void {
      this.emit('error');
    }
  }
  return { ctor: FakeRecorder as unknown as typeof MediaRecorder, created };
}

function fakeDevices(opts: { error?: string } = {}) {
  const tracks: { stop: ReturnType<typeof vi.fn> }[] = [];
  let calls = 0;
  const mediaDevices = {
    getUserMedia: (): Promise<MediaStream> => {
      calls += 1;
      if (opts.error)
        return Promise.reject(Object.assign(new Error(opts.error), { name: opts.error }));
      const track = { stop: vi.fn() };
      tracks.push(track);
      return Promise.resolve({ getTracks: () => [track] } as unknown as MediaStream);
    },
  };
  return { mediaDevices, tracks, calls: () => calls };
}

const failureOf = async (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (error: RecorderError) => error.kind,
  );

describe('pickMimeType', () => {
  test('takes the first supported type in order of preference', () => {
    expect(MIME_PREFERENCE).toEqual([
      'audio/webm;codecs=opus',
      'audio/ogg;codecs=opus',
      'audio/mp4',
    ]);
    expect(pickMimeType((m) => m !== 'audio/webm;codecs=opus')).toBe('audio/ogg;codecs=opus');
    expect(pickMimeType(() => false)).toBe('');
  });
});

describe('createRecorder', () => {
  test('records, then returns the joined bytes, the type and how long it took', async () => {
    const { ctor, created } = fakeRecorderClass();
    const devices = fakeDevices();
    let now = 1000;
    const recorder = createRecorder({
      mediaDevices: devices.mediaDevices,
      recorderCtor: ctor,
      now: () => now,
    });
    await recorder.start();
    now = 3500;
    const result = await recorder.stop();
    expect(result).toEqual({
      mime: 'audio/webm;codecs=opus',
      bytes: Uint8Array.of(1, 2, 3),
      durationMs: 2500,
    });
    expect(created[0]?.options).toEqual({
      mimeType: 'audio/webm;codecs=opus',
      audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
    });
    expect(devices.tracks[0]?.stop).toHaveBeenCalled();
  });

  test('a refused microphone is "denied" and the microphone is released', async () => {
    const { ctor } = fakeRecorderClass();
    for (const name of ['NotAllowedError', 'SecurityError']) {
      const recorder = createRecorder({
        mediaDevices: fakeDevices({ error: name }).mediaDevices,
        recorderCtor: ctor,
      });
      expect(await failureOf(recorder.start())).toBe('denied');
    }
  });

  test('no microphone is "failed"', async () => {
    const { ctor } = fakeRecorderClass();
    const recorder = createRecorder({
      mediaDevices: fakeDevices({ error: 'NotFoundError' }).mediaDevices,
      recorderCtor: ctor,
    });
    expect(await failureOf(recorder.start())).toBe('failed');
  });

  test('a browser without MediaRecorder or media devices is "unsupported"', async () => {
    const noRecorder = createRecorder({
      mediaDevices: fakeDevices().mediaDevices,
      recorderCtor: undefined as never,
    });
    expect(noRecorder.isSupported()).toBe(false);
    expect(await failureOf(noRecorder.start())).toBe('unsupported');
    const noDevices = createRecorder({
      mediaDevices: undefined as never,
      recorderCtor: fakeRecorderClass().ctor,
    });
    expect(noDevices.isSupported()).toBe(false);
    expect(await failureOf(noDevices.start())).toBe('unsupported');
  });

  test('stops by itself at 30 seconds, and stop() still returns that recording', async () => {
    expect(MAX_RECORDING_MS).toBe(30_000);
    const { ctor } = fakeRecorderClass();
    const timers: (() => void)[] = [];
    const setTimer = ((fn: () => void) => {
      timers.push(fn);
      return 1;
    }) as unknown as typeof setTimeout;
    const devices = fakeDevices();
    const recorder = createRecorder({
      mediaDevices: devices.mediaDevices,
      recorderCtor: ctor,
      setTimer,
    });
    await recorder.start();
    timers[0]?.();
    expect(devices.tracks[0]?.stop).toHaveBeenCalled();
    expect((await recorder.stop()).bytes).toEqual(Uint8Array.of(1, 2, 3));
  });

  test('a second start while recording does not open a second microphone stream', async () => {
    const devices = fakeDevices();
    const recorder = createRecorder({
      mediaDevices: devices.mediaDevices,
      recorderCtor: fakeRecorderClass().ctor,
    });
    await recorder.start();
    await recorder.start();
    expect(devices.calls()).toBe(1);
  });

  test('a recording over 1 MiB is "too_large"', async () => {
    const { ctor } = fakeRecorderClass({ chunks: [new Uint8Array(1_048_577)] });
    const recorder = createRecorder({
      mediaDevices: fakeDevices().mediaDevices,
      recorderCtor: ctor,
    });
    await recorder.start();
    expect(await failureOf(recorder.stop())).toBe('too_large');
  });

  test('cancel releases the microphone and leaves nothing to stop', async () => {
    const devices = fakeDevices();
    const recorder = createRecorder({
      mediaDevices: devices.mediaDevices,
      recorderCtor: fakeRecorderClass().ctor,
    });
    await recorder.start();
    recorder.cancel();
    expect(devices.tracks[0]?.stop).toHaveBeenCalled();
    expect(await failureOf(recorder.stop())).toBe('failed');
  });

  test('a recorder that cannot start is "failed" and releases the microphone', async () => {
    const devices = fakeDevices();
    const recorder = createRecorder({
      mediaDevices: devices.mediaDevices,
      recorderCtor: fakeRecorderClass({ failOnStart: true }).ctor,
    });
    expect(await failureOf(recorder.start())).toBe('failed');
    expect(devices.tracks[0]?.stop).toHaveBeenCalled();
  });

  test('an error while recording makes stop() "failed"', async () => {
    const { ctor, created } = fakeRecorderClass();
    const recorder = createRecorder({
      mediaDevices: fakeDevices().mediaDevices,
      recorderCtor: ctor,
    });
    await recorder.start();
    (created[0] as unknown as { fail(): void }).fail();
    expect(await failureOf(recorder.stop())).toBe('failed');
  });

  test('stop with nothing recorded is "failed"', async () => {
    const { ctor } = fakeRecorderClass({ chunks: [] });
    const recorder = createRecorder({
      mediaDevices: fakeDevices().mediaDevices,
      recorderCtor: ctor,
    });
    await recorder.start();
    expect(await failureOf(recorder.stop())).toBe('failed');
  });
});
