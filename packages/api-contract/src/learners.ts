import { z } from 'zod';

export const NAME_MAX_CHARACTERS = 40;

/** Link the signed-in Google account to the phone's profile (or get its existing learner back). */
export const linkRequest = z.strictObject({
  profileId: z.uuid(),
  name: z.string().trim().min(1).max(NAME_MAX_CHARACTERS),
});
export type LinkRequest = z.infer<typeof linkRequest>;

export const linkResponse = z.strictObject({
  learnerId: z.uuid(),
  name: z.string(),
  created: z.boolean(),
});
export type LinkResponse = z.infer<typeof linkResponse>;
