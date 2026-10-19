import { MAX_RECORDING_BYTES } from '../storage/recording-store.js';

export const MAX_RECORDING_MS = 30_000;
export const AUDIO_BITS_PER_SECOND = 32_000;
/** Opus in WebM is what Chrome on Android records; the others cover older and Apple browsers. */
export const MIME_PREFERENCE: readonly string[] = [
  'audio/webm;codecs=opus',
  'audio/ogg;codecs=opus',
  'audio/mp4',
];

export type RecorderFailure = 'denied' | 'unsupported' | 'failed' | 'too_large';

export class RecorderError extends Error {
  constructor(readonly kind: RecorderFailure) {
    super(`recording ${kind}`);
    this.name = 'RecorderError';
  }
}

export interface RecordingResult {
  mime: string;
  bytes: Uint8Array;
  durationMs: number;
}

export interface Recorder {
  isSupported(): boolean;
  start(): Promise<void>;
  stop(): Promise<RecordingResult>;
  cancel(): void;
}

interface RecorderDeps {
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  recorderCtor?: typeof MediaRecorder;
  setTimer?: typeof setTimeout;
  now?: () => number;
}

interface Take {
  stream: MediaStream;
  mime: string;
  recorder: MediaRecorder;
  chunks: Blob[];
  startedAt: number;
  endedAt: number | null;
  errored: boolean;
  finished: Promise<void>;
}

export function pickMimeType(isSupported: (mime: string) => boolean): string {
  return MIME_PREFERENCE.find((mime) => isSupported(mime)) ?? '';
}

const DENIED = new Set(['NotAllowedError', 'SecurityError']);

function release(stream: MediaStream): void {
  for (const track of stream.getTracks()) track.stop();
}

async function joined(chunks: Blob[]): Promise<Uint8Array> {
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

/** Start a MediaRecorder on the stream and collect what it records until it stops. */
function begin(stream: MediaStream, Ctor: typeof MediaRecorder, now: () => number): Take {
  const mime = pickMimeType((m) => Ctor.isTypeSupported(m));
  const recorder = new Ctor(stream, {
    ...(mime ? { mimeType: mime } : {}),
    audioBitsPerSecond: AUDIO_BITS_PER_SECOND,
  });
  let done = (): void => undefined;
  const finished = new Promise<void>((resolve) => (done = resolve));
  const take: Take = {
    stream,
    mime,
    recorder,
    chunks: [],
    startedAt: now(),
    endedAt: null,
    errored: false,
    finished,
  };
  recorder.addEventListener('dataavailable', (event) => {
    if (event.data.size > 0) take.chunks.push(event.data);
  });
  recorder.addEventListener('error', () => (take.errored = true));
  recorder.addEventListener('stop', () => done());
  recorder.start();
  return take;
}

function end(take: Take, now: () => number): void {
  if (take.recorder.state === 'recording') take.recorder.stop();
  take.endedAt ??= now();
  release(take.stream);
}

async function openMicrophone(devices: Pick<MediaDevices, 'getUserMedia'>): Promise<MediaStream> {
  try {
    return await devices.getUserMedia({ audio: true });
  } catch (error) {
    throw new RecorderError(DENIED.has((error as Error).name) ? 'denied' : 'failed');
  }
}

async function result(take: Take): Promise<RecordingResult> {
  await take.finished;
  const bytes = await joined(take.chunks);
  if (take.errored || bytes.length === 0) throw new RecorderError('failed');
  if (bytes.length > MAX_RECORDING_BYTES) throw new RecorderError('too_large');
  const durationMs = (take.endedAt ?? take.startedAt) - take.startedAt;
  return { mime: take.recorder.mimeType || take.mime, bytes, durationMs };
}

/** Open the microphone and start recording, unless the learner cancelled meanwhile. */
async function openTake(
  mic: Pick<MediaDevices, 'getUserMedia'>,
  Recorder: typeof MediaRecorder,
  attempt: { cancelled: boolean },
  now: () => number,
): Promise<Take> {
  const stream = await openMicrophone(mic);
  if (attempt.cancelled) {
    release(stream); // the learner left before the microphone opened
    throw new RecorderError('failed');
  }
  try {
    return begin(stream, Recorder, now);
  } catch {
    release(stream);
    throw new RecorderError('failed');
  }
}

function defaultDevices(): Pick<MediaDevices, 'getUserMedia'> | undefined {
  return typeof navigator === 'undefined' ? undefined : navigator.mediaDevices;
}

/**
 * The microphone behind a small, safe interface: one take at a time, stopped automatically after
 * 30 s, the microphone always released, and every problem reported as a `RecorderError`.
 */
export function createRecorder(deps: RecorderDeps = {}): Recorder {
  const devices = 'mediaDevices' in deps ? deps.mediaDevices : defaultDevices();
  const Ctor = 'recorderCtor' in deps ? deps.recorderCtor : globalThis.MediaRecorder;
  const setTimer = deps.setTimer ?? setTimeout;
  const now = deps.now ?? Date.now;
  let take: Take | null = null;
  /** A start waiting for the microphone; a second tap shares it, and cancel marks it. */
  let pending: { promise: Promise<void>; cancelled: boolean } | null = null;

  const isSupported = (): boolean => Boolean(devices?.getUserMedia && Ctor);

  function start(): Promise<void> {
    if (!devices?.getUserMedia || !Ctor) return Promise.reject(new RecorderError('unsupported'));
    if (take) return Promise.resolve();
    if (pending) return pending.promise; // never two microphone streams
    const attempt = { cancelled: false, promise: Promise.resolve() };
    attempt.promise = openTake(devices, Ctor, attempt, now)
      .then((opened) => {
        take = opened;
        setTimer(() => {
          if (take === opened) end(opened, now);
        }, MAX_RECORDING_MS);
      })
      .finally(() => {
        if (pending === attempt) pending = null;
      });
    pending = attempt;
    return attempt.promise;
  }

  async function stop(): Promise<RecordingResult> {
    const current = take;
    take = null;
    if (!current) throw new RecorderError('failed');
    end(current, now);
    return result(current);
  }

  function cancel(): void {
    if (pending) pending.cancelled = true;
    if (take) end(take, now);
    take = null;
  }

  return { isSupported, start, stop, cancel };
}
