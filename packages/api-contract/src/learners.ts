import { z } from 'zod';

export const NAME_MAX_CHARACTERS = 40;

/** Link the signed-in Google account to the phone's profile (or get its existing learner back). */
export const linkRequest = z.strictObject({
  profileId: z.uuid(),
  name: z.string().trim().min(1).max(NAME_MAX_CHARACTERS),
});
export type LinkRequest = z.infer<typeof linkRequest>;

// Responses are `z.object` (extra fields dropped), so an old phone keeps working when a newer
// server adds fields. Requests stay strict.
export const linkResponse = z.object({
  learnerId: z.uuid(),
  name: z.string(),
  created: z.boolean(),
});
export type LinkResponse = z.infer<typeof linkResponse>;

const MAX_DELETED_CHECK = 20;

/** Which of these learners were deleted on request? Public; a phone asks about its own profiles. */
export const deletedCheck = z.strictObject({
  learnerIds: z.array(z.uuid()).min(1).max(MAX_DELETED_CHECK),
});
export type DeletedCheck = z.infer<typeof deletedCheck>;

export const deletedCheckResponse = z.object({ deleted: z.array(z.uuid()) });
export type DeletedCheckResponse = z.infer<typeof deletedCheckResponse>;
