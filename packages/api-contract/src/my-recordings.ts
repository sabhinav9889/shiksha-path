import { z } from 'zod';

/** How many of a student's recordings the list returns, newest first. */
export const MY_RECORDINGS_CAP = 50;
export const MAX_MY_COMMENT = 280;
const MAX_CONTENT_ID = 64;

const contentId = z
  .string()
  .min(1)
  .max(MAX_CONTENT_ID)
  .regex(/^[A-Za-z0-9_-]+$/);

/**
 * A student's own uploaded recording and what a mentor said about it. `reviewedAt` and `comment`
 * are null until a mentor reviews it; a review may have no comment. No mentor identity is sent.
 */
export const myRecording = z.object({
  id: z.uuid(),
  lessonId: contentId,
  itemId: contentId,
  durationMs: z.number().int().min(1),
  recordedAt: z.iso.datetime(),
  reviewedAt: z.iso.datetime().nullable(),
  comment: z.string().max(MAX_MY_COMMENT).nullable(),
});
export type MyRecording = z.infer<typeof myRecording>;

export const myRecordingsResponse = z.object({
  recordings: z.array(myRecording).max(MY_RECORDINGS_CAP),
});
export type MyRecordingsResponse = z.infer<typeof myRecordingsResponse>;

export const myRecordingUrlQuery = z.strictObject({ id: z.uuid() });
export const myRecordingUrlResponse = z.object({ url: z.string().min(1) });
export type MyRecordingUrlResponse = z.infer<typeof myRecordingUrlResponse>;
