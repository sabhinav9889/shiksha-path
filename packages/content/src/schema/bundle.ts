import { z } from 'zod';
import { practiceItem, type PracticeItem } from './items.js';
import { contentId, localized } from './localized.js';
import { placementSection, track } from './structure.js';

/**
 * The shape of the built lesson packs (manifest, module and placement bundles). The content
 * builder produces them and the learner app consumes them, so both use these schemas. This file
 * must stay browser-safe: zod and sibling schema files only (checked by a test).
 */
export const SCHEMA_VERSION = 1;

const AUDIO_PATH = /^audio\/[0-9a-f]{16}\.(mp3|m4a|ogg|opus|webm)$/;
const VERSION = /^[0-9a-f]{12}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const MODULE_FILE = /^modules\/[a-z0-9]+(-[a-z0-9]+)*\.[0-9a-f]{12}\.json$/;
const PLACEMENT_FILE = /^placement\.[0-9a-f]{12}\.json$/;

const audioPath = z.string().regex(AUDIO_PATH);
const sha256 = z.string().regex(SHA256);
const version = z.string().regex(VERSION);
const ratio = z.number().min(0).max(1);
const count = z.number().int().min(0);
const position = z.number().int().min(1);
const schemaVersion = z.literal(SCHEMA_VERSION);

export const audioEntrySchema = z.strictObject({ path: audioPath, sha256, bytes: count });
export type AudioEntry = z.infer<typeof audioEntrySchema>;

export const bundleLessonSchema = z.strictObject({
  id: contentId,
  order: position,
  topic: z.string().trim().min(1),
  level: position,
  hi_ratio: ratio,
  title: localized,
  html: z.strictObject({ hi: z.string().min(1), en: z.string().min(1) }),
  audio: z.strictObject({ hi: audioPath.optional(), en: audioPath.optional() }).nullable(),
  items: z.array(practiceItem).min(1),
});
export type BundleLesson = z.infer<typeof bundleLessonSchema>;

interface AudioRef {
  path: (string | number)[];
  ref: string;
}

function itemRefs(items: readonly PracticeItem[], base: (string | number)[]): AudioRef[] {
  return items.flatMap((item, i) => {
    if (item.type === 'listen_choose') return [{ path: [...base, i, 'audio'], ref: item.audio }];
    if (item.type === 'speak_compare') {
      return [{ path: [...base, i, 'model_audio'], ref: item.model_audio }];
    }
    return [];
  });
}

/** Every audio reference must be a published audio path that the bundle's audio list contains. */
function checkRefs(refs: AudioRef[], listed: ReadonlySet<string>, ctx: z.RefinementCtx): void {
  for (const { path, ref } of refs) {
    if (!AUDIO_PATH.test(ref)) {
      const message = `audio reference "${ref}" must look like audio/<16 hex>.<ext>`;
      ctx.addIssue({ code: 'custom', path, message });
    } else if (!listed.has(ref)) {
      ctx.addIssue({
        code: 'custom',
        path,
        message: `audio reference "${ref}" is not listed in audio[]`,
      });
    }
  }
}

export const moduleBundleSchema = z
  .strictObject({
    schema_version: schemaVersion,
    id: contentId,
    version,
    track: contentId,
    title: localized,
    hi_ratio: ratio,
    lessons: z.array(bundleLessonSchema).min(1),
    test_out: z.strictObject({ pass_mark: ratio, items: z.array(practiceItem).min(1) }).nullable(),
    audio: z.array(audioEntrySchema),
  })
  .superRefine((bundle, ctx) => {
    const refs: AudioRef[] = [];
    bundle.lessons.forEach((lesson, i) => {
      for (const lang of ['hi', 'en'] as const) {
        const ref = lesson.audio?.[lang];
        if (ref !== undefined) refs.push({ path: ['lessons', i, 'audio', lang], ref });
      }
      refs.push(...itemRefs(lesson.items, ['lessons', i, 'items']));
    });
    if (bundle.test_out) refs.push(...itemRefs(bundle.test_out.items, ['test_out', 'items']));
    checkRefs(refs, new Set(bundle.audio.map((a) => a.path)), ctx);
  });
export type ModuleBundle = z.infer<typeof moduleBundleSchema>;

export const placementBundleSchema = z
  .strictObject({
    schema_version: schemaVersion,
    version,
    sections: z.array(placementSection).min(1),
    audio: z.array(audioEntrySchema),
  })
  .superRefine((bundle, ctx) => {
    const refs = bundle.sections.flatMap((s, i) => itemRefs(s.items, ['sections', i, 'items']));
    checkRefs(refs, new Set(bundle.audio.map((a) => a.path)), ctx);
  });
export type PlacementBundle = z.infer<typeof placementBundleSchema>;

export const manifestModuleSchema = z.strictObject({
  id: contentId,
  track: contentId,
  title: localized,
  order: position,
  version,
  file: z.string().regex(MODULE_FILE),
  sha256,
  bytes: count,
  audio_bytes: count,
  lessons: z.array(z.strictObject({ id: contentId, order: position, title: localized })),
});
export type ManifestModule = z.infer<typeof manifestModuleSchema>;

export const manifestPlacementSchema = z.strictObject({
  file: z.string().regex(PLACEMENT_FILE),
  version,
  sha256,
  bytes: count,
  audio_bytes: count,
});
export type ManifestPlacement = z.infer<typeof manifestPlacementSchema>;

export const manifestSchema = z.strictObject({
  schema_version: schemaVersion,
  built_at: z.iso.datetime(),
  preview: z.boolean(),
  tracks: z.array(track).min(1),
  modules: z.array(manifestModuleSchema),
  placement: manifestPlacementSchema.nullable(),
});
export type Manifest = z.infer<typeof manifestSchema>;
