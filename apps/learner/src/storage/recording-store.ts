/** Speaking practice recordings stay on the phone until Plan 3 uploads them (spec §7.1). */
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
}

export interface RecordingStore {
  /** Replaces any earlier recording of the same learner, lesson and item. */
  put(recording: Recording): Promise<void>;
  latest(learnerId: string, lessonId: string, itemId: string): Promise<Recording | null>;
  summary(learnerId: string): Promise<{ count: number; bytes: number }>;
  delete(id: string): Promise<void>;
}
