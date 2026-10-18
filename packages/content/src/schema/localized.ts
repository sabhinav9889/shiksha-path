import { z } from 'zod';

const text = z.string().trim().min(1, 'must not be empty');

/** Learner-facing text: always both Hindi and English (spec §6.7). */
export const localized = z.strictObject({ hi: text, en: text });
export type Localized = z.infer<typeof localized>;

/** Lowercase kebab-case identifier used for lessons, modules, tracks and items. */
export const contentId = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase kebab-case (a-z, 0-9, -)');
