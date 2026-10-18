import { z } from 'zod';
import type { LanguagePreference } from './language.js';
import type { Clock, Ids } from './ports.js';
import type { ItemSource } from './quiz.js';
import type { Outcome } from './scoring.js';

const nonEmpty = z.string().min(1);
const ratio = z.number().min(0).max(1);
const count = z.number().int().min(0);

const itemSource = z.discriminatedUnion('kind', [
  z.looseObject({ kind: z.literal('lesson'), lessonId: nonEmpty }),
  z.looseObject({ kind: z.literal('review'), lessonId: nonEmpty }),
  z.looseObject({ kind: z.literal('test_out'), moduleId: nonEmpty }),
  z.looseObject({ kind: z.literal('placement'), track: nonEmpty }),
]);

/** Loose objects: a newer app version may add fields, and an older reader must keep the event. */
const DATA = {
  lesson_started: z.looseObject({ lessonId: nonEmpty, moduleVersion: nonEmpty }),
  item_answered: z.looseObject({
    source: itemSource,
    itemId: nonEmpty,
    outcome: z.enum(['correct', 'wrong', 'unscored']),
  }),
  lesson_completed: z.looseObject({ lessonId: nonEmpty, correct: count, scored: count }),
  test_out_completed: z.looseObject({ moduleId: nonEmpty, score: ratio, passed: z.boolean() }),
  placement_completed: z.looseObject({
    sections: z.array(z.looseObject({ track: nonEmpty, score: ratio, startLesson: nonEmpty })),
    englishOnlySuggested: z.boolean(),
  }),
  placement_skipped: z.looseObject({}),
  language_changed: z.looseObject({ preference: z.enum(['hi_en', 'en_only']) }),
} as const;

export type EventType = keyof typeof DATA;

export interface EventData {
  lesson_started: { lessonId: string; moduleVersion: string };
  item_answered: { source: ItemSource; itemId: string; outcome: Outcome };
  lesson_completed: { lessonId: string; correct: number; scored: number };
  test_out_completed: { moduleId: string; score: number; passed: boolean };
  placement_completed: {
    sections: { track: string; score: number; startLesson: string }[];
    englishOnlySuggested: boolean;
  };
  placement_skipped: Record<string, never>;
  language_changed: { preference: LanguagePreference };
}

export type LearnerEvent = {
  [T in EventType]: { id: string; learnerId: string; type: T; at: string; data: EventData[T] };
}[EventType];

const envelope = <T extends EventType>(type: T): z.ZodType =>
  z.looseObject({
    id: z.uuid(),
    learnerId: nonEmpty,
    type: z.literal(type),
    at: z.iso.datetime(),
    data: DATA[type],
  });

const EVENT_TYPES = Object.keys(DATA) as EventType[];

/** One schema per event type, so each type's `data` is checked against its own shape. */
export const learnerEventSchema = z.union(
  EVENT_TYPES.map(envelope) as unknown as [z.ZodType, z.ZodType],
) as z.ZodType<LearnerEvent>;

export function createEvent<T extends EventType>(
  deps: { clock: Clock; ids: Ids },
  learnerId: string,
  type: T,
  data: EventData[T],
): LearnerEvent {
  const event = { id: deps.ids.uuid(), learnerId, type, at: deps.clock.now().toISOString(), data };
  return event as LearnerEvent;
}

/** Keep what is valid and count the rest (unknown types, bad shapes), so replay never breaks. */
export function parseEvents(raw: readonly unknown[]): { events: LearnerEvent[]; ignored: number } {
  const events: LearnerEvent[] = [];
  let ignored = 0;
  for (const candidate of raw) {
    const parsed = learnerEventSchema.safeParse(candidate);
    if (parsed.success) events.push(parsed.data);
    else ignored += 1;
  }
  return { events, ignored };
}
