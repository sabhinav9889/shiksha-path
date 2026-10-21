import { z } from 'zod';

const MAX_CODE_INPUT = 32;

/** A backup login code as typed (spaces, dashes and case are ignored on the server). */
export const codeSignIn = z.strictObject({ code: z.string().min(1).max(MAX_CODE_INPUT) });
export type CodeSignIn = z.infer<typeof codeSignIn>;

/** A sign-in session; `expiresAt` is in Unix seconds. */
export const session = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
  expiresAt: z.number().int(),
});
export type Session = z.infer<typeof session>;
