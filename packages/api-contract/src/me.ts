import { z } from 'zod';

/** The switchable features (spec §8.1). */
export const FEATURE_KEYS = [
  'ai_doubts',
  'speaking_practice',
  'placement_test',
  'english_only_option',
  'mentor_booking',
  'community_feed',
] as const;
export type FeatureKey = (typeof FEATURE_KEYS)[number];

export const meResponse = z.strictObject({
  learner: z.strictObject({ id: z.uuid(), name: z.string() }),
  switches: z.record(z.enum(FEATURE_KEYS), z.boolean()),
});
export type MeResponse = z.infer<typeof meResponse>;
