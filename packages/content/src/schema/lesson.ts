import { z } from 'zod';
import { practiceItem } from './items.js';
import { contentId, localized } from './localized.js';

export const reviewStatus = z.enum(['pending', 'approved']);

const audioRefs = z.strictObject({
  hi: z.string().min(1).optional(),
  en: z.string().min(1).optional(),
});

export const lessonMeta = z
  .strictObject({
    id: contentId,
    track: contentId,
    module: contentId,
    topic: z.string().trim().min(1),
    level: z.number().int().min(1),
    order: z.number().int().min(1),
    hi_ratio: z.number().min(0).max(1).optional(),
    review: reviewStatus,
    title: localized,
    audio: audioRefs.optional(),
    items: z.array(practiceItem).min(1),
  })
  .superRefine((meta, ctx) => {
    const seen = new Set<string>();
    meta.items.forEach((item, i) => {
      if (seen.has(item.id)) {
        const message = `item id ${item.id} is used more than once in this lesson`;
        ctx.addIssue({ code: 'custom', path: ['items', i, 'id'], message });
      }
      seen.add(item.id);
    });
  });
export type LessonMeta = z.infer<typeof lessonMeta>;

export interface Lesson {
  file: string;
  meta: LessonMeta;
  /** Markdown per language. */
  body: { hi: string; en: string };
}
