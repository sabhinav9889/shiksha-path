import { RECORDING_TYPES } from '@shiksha/api-contract';
import { linkedApi } from '../account/account.js';
import type { ApiClient } from '../api/api-client.js';
import type { Recording } from '../storage/recording-store.js';
import type { Runtime } from './runtime.js';

type Outcome = 'uploaded' | 'skip' | 'stop';
type UploadType = (typeof RECORDING_TYPES)[number];

/** The recorder reports e.g. `audio/webm;codecs=opus`; the server takes the base type only. */
function uploadType(mime: string): UploadType | null {
  const base = mime.split(';')[0]?.trim().toLowerCase() ?? '';
  return (RECORDING_TYPES as readonly string[]).includes(base) ? (base as UploadType) : null;
}

async function uploadOne(api: ApiClient, recording: Recording): Promise<Outcome> {
  const { id, lessonId, itemId, durationMs, at } = recording;
  const mime = uploadType(recording.mime);
  if (!mime) return 'skip'; // a type the server never takes: it stays on the phone
  const bytes = recording.bytes.length;
  const started = await api.startRecording({ id, lessonId, itemId, mime, bytes, durationMs, at });
  if (!started.ok) return 'stop';
  const { uploadUrl } = started.value;
  if (uploadUrl && !(await api.uploadTo(uploadUrl, recording.bytes, mime))) return 'stop';
  if (!uploadUrl) return 'uploaded'; // the server already has it
  return (await api.completeRecording({ id })).ok ? 'uploaded' : 'stop';
}

/**
 * Upload this learner's waiting recordings, one by one, and free each one's bytes once the server
 * has it. Stops at the first failure (offline, switched off, rate-limited); never throws.
 */
export async function uploadRecordings(
  runtime: Runtime,
  learnerId: string,
): Promise<{ uploaded: number; left: number }> {
  const waiting = await runtime.recordings.pendingUpload(learnerId);
  const api = await linkedApi(runtime, learnerId);
  let uploaded = 0;
  for (const recording of api ? waiting : []) {
    const outcome = await uploadOne(api as ApiClient, recording).catch((): Outcome => 'stop');
    if (outcome === 'stop') break;
    if (outcome === 'skip') continue;
    await runtime.recordings.markUploaded(recording.id, runtime.clock.now().toISOString());
    uploaded += 1;
  }
  return { uploaded, left: waiting.length - uploaded };
}
