import { z } from 'zod';
import { practiceItem } from './items.js';
import { reviewStatus, type Lesson } from './lesson.js';
import { contentId, localized } from './localized.js';

const DEFAULT_PASS_MARK = 0.8;
const ratio = z.number().min(0).max(1);

export const track = z.strictObject({
  id: contentId,
  title: localized,
  order: z.number().int().min(1),
});
export type Track = z.infer<typeof track>;
export const tracksFile = z.array(track).min(1);

export const moduleMeta = z.strictObject({
  id: contentId,
  track: contentId,
  title: localized,
  order: z.number().int().min(1),
  hi_ratio: ratio,
});
export type ModuleMeta = z.infer<typeof moduleMeta>;

export const testOut = z.strictObject({
  review: reviewStatus,
  pass_mark: ratio.default(DEFAULT_PASS_MARK),
  items: z.array(practiceItem).min(1),
});
export type TestOut = z.infer<typeof testOut>;

const startRule = z.strictObject({ min_score: ratio, start_lesson: contentId });

export const placementSection = z.strictObject({
  track: contentId,
  items: z.array(practiceItem).min(1),
  start_rules: z.array(startRule).min(1),
  suggest_english_only_at: ratio.optional(),
});
export type PlacementSection = z.infer<typeof placementSection>;

export const placement = z.strictObject({
  review: reviewStatus,
  sections: z.array(placementSection).min(1),
});
export type Placement = z.infer<typeof placement>;

export interface LoadedModule {
  /** Absolute path of the module folder. */
  dir: string;
  meta: ModuleMeta;
  /** Sorted by `meta.order`. */
  lessons: Lesson[];
  testOut: TestOut | null;
}

export interface Content {
  root: string;
  tracks: Track[];
  modules: LoadedModule[];
  placement: Placement | null;
  /** Absolute path of `placement/` (placement audio is relative to it). */
  placementDir: string;
}
