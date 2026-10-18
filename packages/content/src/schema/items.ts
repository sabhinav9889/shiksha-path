import { z } from 'zod';
import { contentId, localized } from './localized.js';

export const ITEM_TYPES = [
  'mcq_meaning',
  'fill_blank',
  'word_order',
  'listen_choose',
  'speak_compare',
  'aptitude',
] as const;

const MAX_OPTIONS = 6;
const BLANK = '___';

const choiceOption = z.strictObject({
  id: z.string().min(1),
  text: localized,
  correct: z.boolean().optional(),
  why_wrong: localized.optional(),
});
export type ChoiceOption = z.infer<typeof choiceOption>;

const options = z.array(choiceOption).min(2).max(MAX_OPTIONS);

/** Exactly one correct option, unique ids, and a why_wrong for every wrong option (spec §9.2). */
function checkChoices(item: { options: ChoiceOption[] }, ctx: z.RefinementCtx): void {
  const correct = item.options.filter((o) => o.correct === true).length;
  if (correct !== 1) {
    ctx.addIssue({
      code: 'custom',
      path: ['options'],
      message: 'needs exactly one correct option',
    });
  }
  const ids = item.options.map((o) => o.id);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({ code: 'custom', path: ['options'], message: 'option ids must be unique' });
  }
  item.options.forEach((o, i) => {
    if (o.correct !== true && o.why_wrong === undefined) {
      const message = `why_wrong missing for wrong option ${o.id}`;
      ctx.addIssue({ code: 'custom', path: ['options', i, 'why_wrong'], message });
    }
  });
}

const base = { id: contentId, prompt: localized };

const mcqMeaning = z
  .strictObject({ ...base, type: z.literal('mcq_meaning'), options })
  .superRefine(checkChoices);

const listenChoose = z
  .strictObject({ ...base, type: z.literal('listen_choose'), audio: z.string().min(1), options })
  .superRefine(checkChoices);

const aptitude = z
  .strictObject({
    ...base,
    type: z.literal('aptitude'),
    options,
    explanation: localized.optional(),
  })
  .superRefine(checkChoices);

const fillBlank = z.strictObject({
  ...base,
  type: z.literal('fill_blank'),
  sentence: z
    .string()
    .refine((s) => s.split(BLANK).length === 2, `sentence must contain ${BLANK} exactly once`),
  answers: z.array(z.string().trim().min(1)).min(1),
  common_wrong: z.array(z.strictObject({ answer: z.string(), why_wrong: localized })).optional(),
});

const wordOrder = z.strictObject({
  ...base,
  type: z.literal('word_order'),
  words: z.array(z.string().trim().min(1)).min(2),
  why_wrong: localized.optional(),
});

const speakCompare = z.strictObject({
  ...base,
  type: z.literal('speak_compare'),
  text: z.string().trim().min(1),
  model_audio: z.string().min(1),
});

/** One schema per item type; add new types here (spec §14: extensible list). */
export const practiceItem = z.discriminatedUnion('type', [
  mcqMeaning,
  fillBlank,
  wordOrder,
  listenChoose,
  speakCompare,
  aptitude,
]);
export type PracticeItem = z.infer<typeof practiceItem>;
