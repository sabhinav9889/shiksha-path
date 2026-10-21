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

// Responses are `z.object` (extra fields dropped), so an old phone keeps working when a newer
// server adds fields. Requests stay strict.
// Switches are any key: a phone ignores ones it does not know (see the app's `loadSwitches`).
export const meResponse = z.object({
  learner: z.object({ id: z.uuid(), name: z.string() }),
  switches: z.record(z.string(), z.boolean()),
});
export type MeResponse = z.infer<typeof meResponse>;
