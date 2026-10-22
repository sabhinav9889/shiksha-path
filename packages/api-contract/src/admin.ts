import { z } from 'zod';
import { FEATURE_KEYS } from './me.js';
import { summary } from './staff-read.js';

const MAX_NAME = 80;
const name = z.string().trim().min(1).max(MAX_NAME);
const MAX_EMAIL = 254;
const MAX_CURSOR = 200;

export const idResponse = z.object({ id: z.uuid() });
export const okResponse = z.object({ ok: z.literal(true) });

export const labRequest = z.strictObject({ id: z.uuid().optional(), name });
export const cohortRequest = z.strictObject({
  id: z.uuid().optional(),
  name,
  labId: z.uuid().nullable(),
});
export const staffRequest = z.strictObject({
  id: z.uuid().optional(),
  email: z.email().max(MAX_EMAIL),
  role: z.enum(['mentor', 'admin']),
  name,
  active: z.boolean(),
  cohortIds: z.array(z.uuid()),
});

/** Labs, cohorts and staff for the admin setup screen. */
export const adminSetup = z.object({
  labs: z.array(z.object({ id: z.uuid(), name: z.string() })),
  cohorts: z.array(z.object({ id: z.uuid(), name: z.string(), labId: z.uuid().nullable() })),
  staff: z.array(
    z.object({
      id: z.uuid(),
      email: z.string(),
      role: z.enum(['mentor', 'admin']),
      name: z.string(),
      active: z.boolean(),
      claimed: z.boolean(),
      cohortIds: z.array(z.uuid()),
    }),
  ),
  /** The all-students value of every feature switch. */
  switches: z.record(z.enum(FEATURE_KEYS), z.boolean()),
});
export type AdminSetup = z.infer<typeof adminSetup>;

const flag = z.enum(['true', 'false']).transform((v) => v === 'true');
export const studentsQuery = z.strictObject({
  q: z.string().max(MAX_NAME).optional(),
  cohortId: z.uuid().optional(),
  mentorId: z.uuid().optional(),
  active: flag.optional(),
  attention: flag.optional(),
  after: z.string().max(MAX_CURSOR).optional(),
});

export const studentsPage = z.object({
  students: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      cohortId: z.uuid().nullable(),
      deactivated: z.boolean(),
      lastSyncedAt: z.string().nullable(),
      summary: summary.nullable(),
      attention: z.array(z.enum(['inactive', 'stuck', 'low_scores'])),
    }),
  ),
  next: z.string().nullable(),
});
export type StudentsPage = z.infer<typeof studentsPage>;

export const studentEditRequest = z.strictObject({
  learnerId: z.uuid(),
  name: name.optional(),
  cohortId: z.uuid().nullable().optional(),
});
export const deactivateRequest = z.strictObject({ learnerId: z.uuid(), active: z.boolean() });
export const deleteRequest = z.strictObject({ learnerId: z.uuid() });
export const switchRequest = z.strictObject({
  key: z.enum(FEATURE_KEYS),
  enabledForAll: z.boolean(),
});
export const overrideRequest = z.strictObject({
  learnerId: z.uuid(),
  key: z.enum(FEATURE_KEYS),
  enabled: z.boolean().nullable(),
});
export const brandingVersion = z.object({ version: z.number().int() });
