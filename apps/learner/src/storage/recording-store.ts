/** Speaking practice recordings stay on the phone until they are uploaded (spec §7.1). */
export const MAX_RECORDING_BYTES = 1_048_576;

export interface Recording {
  id: string;
  learnerId: string;
  lessonId: string;
  itemId: string;
  mime: string;
  bytes: Uint8Array;
  durationMs: number;
  at: string;
  /** Set once the server has it: the bytes are then dropped from the phone (spec §7.1). */
  uploadedAt?: string | null;
}

export interface RecordingStore {
  /** Replaces any earlier recording of the same learner, lesson and item. */
  put(recording: Recording): Promise<void>;
  latest(learnerId: string, lessonId: string, itemId: string): Promise<Recording | null>;
  /** Recordings still on this phone, waiting to upload. */
  summary(learnerId: string): Promise<{ count: number; bytes: number }>;
  pendingUpload(learnerId: string): Promise<Recording[]>;
  markUploaded(id: string, at: string): Promise<void>;
  delete(id: string): Promise<void>;
}
