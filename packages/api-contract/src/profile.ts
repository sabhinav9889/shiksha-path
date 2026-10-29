import { z } from 'zod';

/** What a student sees about themselves: their own sign-in email, cohort and mentors. */
export const profileResponse = z.object({
  /** The Google email they signed in with; null for a backup-code student. */
  email: z.string().nullable(),
  cohort: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  /** The active mentors of that cohort: name and work email. */
  mentors: z.array(z.object({ name: z.string(), email: z.string() })),
});
export type ProfileResponse = z.infer<typeof profileResponse>;
