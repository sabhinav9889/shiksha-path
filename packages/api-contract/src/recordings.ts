import { z } from 'zod';

/** Speaking recordings (spec §6.5, security rule: recordings ≤ 1 MB, checked type and size). */
export const MAX_RECORDING_BYTES = 1_048_576;
export const MAX_RECORDING_MS = 31_000;
export const RECORDING_TYPES = ['audio/webm', 'audio/ogg', 'audio/mp4'] as const;

const MAX_CONTENT_ID = 64;

/** Lesson and item ids are content ids: letters, digits, dash and underscore only. */
const contentId = z
  .string()
  .min(1)
  .max(MAX_CONTENT_ID)
  .regex(/^[A-Za-z0-9_-]+$/);

export const recordingStart = z.strictObject({
  id: z.uuid(),
  lessonId: contentId,
  itemId: contentId,
  mime: z.enum(RECORDING_TYPES),
  bytes: z.number().int().min(1).max(MAX_RECORDING_BYTES),
  durationMs: z.number().int().min(1).max(MAX_RECORDING_MS),
  at: z.iso.datetime(),
});
export type RecordingStart = z.infer<typeof recordingStart>;

/** Where to upload; both null when the server already has this recording. */
export const recordingStartResponse = z.object({
  uploadUrl: z.string().nullable(),
  token: z.string().nullable(),
});
export type RecordingStartResponse = z.infer<typeof recordingStartResponse>;

export const recordingComplete = z.strictObject({ id: z.uuid() });
export type RecordingComplete = z.infer<typeof recordingComplete>;

export const recordingCompleteResponse = z.object({ status: z.literal('uploaded') });
export type RecordingCompleteResponse = z.infer<typeof recordingCompleteResponse>;
