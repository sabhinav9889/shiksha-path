import { z } from 'zod';

/** Who the signed-in staff member is, and the cohorts they work with (all of them for an admin). */
export const staffMe = z.object({
  role: z.enum(['mentor', 'admin']),
  name: z.string(),
  cohorts: z.array(z.object({ id: z.uuid(), name: z.string() })),
});
export type StaffMe = z.infer<typeof staffMe>;

/** Claiming an invite takes no input: the email comes from the verified Google sign-in. */
export const staffClaim = z.strictObject({});

const AUDIT_PAGE = 50;
const AUDIT_MAX = 100;

export const auditQuery = z.strictObject({
  before: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(AUDIT_MAX).default(AUDIT_PAGE),
});

export const auditPage = z.object({
  entries: z.array(
    z.object({
      id: z.number().int(),
      staffId: z.uuid().nullable(),
      action: z.string(),
      learnerId: z.uuid().nullable(),
      details: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
      at: z.string(),
    }),
  ),
  next: z.number().int().nullable(),
});
export type AuditPage = z.infer<typeof auditPage>;
