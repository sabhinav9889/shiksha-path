import { z } from 'zod';

const MIN_PEPPER = 32;
export const PEPPER_NEEDED = 'CODE_PEPPER must be at least 32 characters';
export const adminEnv = z.object({
  SUPABASE_DB_URL: z
    .string({ error: 'SUPABASE_DB_URL is not set' })
    .min(1, 'SUPABASE_DB_URL is empty'),
  SUPABASE_URL: z.string({ error: 'SUPABASE_URL is not set' }).min(1, 'SUPABASE_URL is empty'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string({ error: 'SUPABASE_SERVICE_ROLE_KEY is not set' })
    .min(1, 'SUPABASE_SERVICE_ROLE_KEY is empty'),
  // Only the code commands use it, so retention and branding run without it (Plan 3b M6).
  CODE_PEPPER: z.string().min(MIN_PEPPER, PEPPER_NEEDED).optional(),
});
