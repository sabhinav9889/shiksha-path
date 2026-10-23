import { z } from 'zod';

const MAX_NAME = 40;
const MAX_ID = 64;
const MAX_COHORT = 500;
const contentId = z
  .string()
  .min(1)
  .max(MAX_ID)
  .regex(/^[A-Za-z0-9_-]+$/);

/** A real calendar day, YYYY-MM-DD (refuses 2026-13-40). */
const day = z.iso.date();

export const codeIssueRequest = z.union([
  z.strictObject({ learnerId: z.uuid() }),
  z.strictObject({ name: z.string().trim().min(1).max(MAX_NAME), cohortId: z.uuid() }),
]);
export const codeIssueResponse = z.object({ learnerId: z.uuid(), code: z.string() });
export const codeResetRequest = z.strictObject({ learnerId: z.uuid() });
export const codeResetResponse = z.object({ code: z.string() });

export const levelRequest = z.strictObject({
  learnerId: z.uuid(),
  track: contentId,
  startLesson: contentId,
});
export const levelResponse = z.object({ eventId: z.uuid() });

export const attendanceRequest = z.strictObject({
  cohortId: z.uuid(),
  day,
  present: z.array(z.uuid()).max(MAX_COHORT),
});
export const attendanceResponse = z.object({ marked: z.number().int() });
