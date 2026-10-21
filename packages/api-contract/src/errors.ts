import { z } from 'zod';

/** Every error the API can answer, as `{ "error": "<CODE>" }`. Nothing else reaches a client. */
export const API_ERRORS = [
  'UNAUTHENTICATED',
  'NOT_LINKED',
  'FORBIDDEN',
  'INVALID_REQUEST',
  'PROFILE_TAKEN',
  'TOO_LARGE',
  'INTERNAL',
] as const;
export type ApiError = (typeof API_ERRORS)[number];

export const errorBody = z.strictObject({ error: z.enum(API_ERRORS) });

/** Largest request body the API reads. */
export const MAX_BODY_BYTES = 262_144;
