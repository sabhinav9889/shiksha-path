import { z } from 'zod';
import { FEATURE_KEYS } from './me.js';

export const summary = z.object({
  lessonsDone: z.number().int(),
  lessonsThisWeek: z.number().int(),
  streak: z.number().int(),
  lastActiveDay: z.string().nullable(),
  currentLesson: z.string().nullable(),
  lowScores: z.boolean(),
  stuckLesson: z.string().nullable(),
});
export type StudentSummary = z.infer<typeof summary>;

const attention = z.array(z.enum(['inactive', 'stuck', 'low_scores']));

/** The caller's cohorts and their students, those needing attention first (spec §8). */
export const staffCohorts = z.object({
  cohorts: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      students: z.array(
        z.object({
          id: z.uuid(),
          name: z.string(),
          deactivated: z.boolean(),
          summary: summary.nullable(),
          attention,
          lastSyncedAt: z.string().nullable(),
        }),
      ),
    }),
  ),
});
export type StaffCohorts = z.infer<typeof staffCohorts>;

export const studentQuery = z.strictObject({ id: z.uuid() });

/** One student, for a mentor in scope (spec §8 student detail). */
export const studentDetail = z.object({
  student: z.object({
    id: z.uuid(),
    name: z.string(),
    cohortId: z.uuid().nullable(),
    deactivated: z.boolean(),
  }),
  summary: summary.nullable(),
  attention,
  recent: z.array(z.unknown()),
  weakLessons: z.array(z.object({ lessonId: z.string(), wrong: z.number().int() })),
  recordings: z.array(
    z.object({
      id: z.uuid(),
      lessonId: z.string(),
      itemId: z.string(),
      durationMs: z.number().int(),
      recordedAt: z.string(),
      status: z.enum(['pending', 'uploaded']),
      reviewedAt: z.string().nullable(),
      comment: z.string().nullable(),
    }),
  ),
  attendance: z.array(z.object({ date: z.string(), present: z.boolean() })),
  switches: z.record(z.enum(FEATURE_KEYS), z.boolean()),
  hasCode: z.boolean(),
});
export type StudentDetail = z.infer<typeof studentDetail>;

export const recordingsQuery = z.strictObject({ status: z.literal('unreviewed') });

export const unreviewedRecordings = z.object({
  recordings: z.array(
    z.object({
      id: z.uuid(),
      learnerId: z.uuid(),
      learnerName: z.string(),
      lessonId: z.string(),
      itemId: z.string(),
      durationMs: z.number().int(),
      uploadedAt: z.string(),
    }),
  ),
});
export type UnreviewedRecordings = z.infer<typeof unreviewedRecordings>;

export const recordingUrlQuery = z.strictObject({ id: z.uuid() });
export const recordingUrlResponse = z.object({ url: z.string() });

const MAX_COMMENT = 280;
export const reviewRequest = z.strictObject({
  id: z.uuid(),
  comment: z.string().max(MAX_COMMENT).optional(),
});
export const reviewResponse = z.object({ reviewedAt: z.string() });
