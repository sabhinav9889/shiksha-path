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
