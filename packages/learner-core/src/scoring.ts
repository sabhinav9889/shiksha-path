import type { Localized, PracticeItem } from '@shiksha/content/schema';

export type Answer =
  | { kind: 'choice'; optionId: string }
  | { kind: 'text'; value: string }
  | { kind: 'order'; words: string[] }
  | { kind: 'spoken' };

export type Outcome = 'correct' | 'wrong' | 'unscored';

export type CorrectAnswer =
  | { kind: 'option'; optionId: string }
  | { kind: 'text'; value: string }
  | { kind: 'order'; words: string[] };

export interface ItemResult {
  itemId: string;
  outcome: Outcome;
  whyWrong: Localized | null;
  explanation: Localized | null;
  correctAnswer: CorrectAnswer | null;
}

/** Trim, collapse spaces, lower-case and compose (NFC) so typed answers compare fairly. */
export function normalizeAnswer(s: string): string {
  return s.normalize('NFC').trim().replace(/\s+/g, ' ').toLowerCase();
}

type ItemOf<T extends PracticeItem['type']> = Extract<PracticeItem, { type: T }>;
type ChoiceItem = ItemOf<'mcq_meaning' | 'listen_choose' | 'aptitude'>;

const result = (itemId: string, outcome: Outcome, rest: Partial<ItemResult> = {}): ItemResult => ({
  itemId,
  outcome,
  whyWrong: null,
  explanation: null,
  correctAnswer: null,
  ...rest,
});

function need<K extends Answer['kind']>(item: PracticeItem, answer: Answer, kind: K) {
  if (answer.kind !== kind) {
    throw new Error(`answer kind "${answer.kind}" does not fit item type "${item.type}"`);
  }
  return answer as Extract<Answer, { kind: K }>;
}

function scoreChoice(item: ChoiceItem, answer: Answer): ItemResult {
  const { optionId } = need(item, answer, 'choice');
  const chosen = item.options.find((o) => o.id === optionId);
  if (!chosen) throw new Error(`unknown option "${optionId}" for item "${item.id}"`);
  const explanation = item.type === 'aptitude' ? (item.explanation ?? null) : null;
  if (chosen.correct === true) return result(item.id, 'correct', { explanation });
  const right = item.options.find((o) => o.correct === true);
  return result(item.id, 'wrong', {
    explanation,
    whyWrong: chosen.why_wrong ?? null,
    correctAnswer: { kind: 'option', optionId: right?.id ?? '' },
  });
}

function scoreFill(item: ItemOf<'fill_blank'>, answer: Answer): ItemResult {
  const typed = normalizeAnswer(need(item, answer, 'text').value);
  if (typed !== '' && item.answers.some((a) => normalizeAnswer(a) === typed)) {
    return result(item.id, 'correct');
  }
  const known = item.common_wrong?.find((c) => normalizeAnswer(c.answer) === typed);
  return result(item.id, 'wrong', {
    whyWrong: known?.why_wrong ?? null,
    correctAnswer: { kind: 'text', value: item.answers[0] ?? '' },
  });
}

function scoreOrder(item: ItemOf<'word_order'>, answer: Answer): ItemResult {
  const { words } = need(item, answer, 'order');
  if (words.length === item.words.length && words.every((w, i) => w === item.words[i])) {
    return result(item.id, 'correct');
  }
  return result(item.id, 'wrong', {
    whyWrong: item.why_wrong ?? null,
    correctAnswer: { kind: 'order', words: [...item.words] },
  });
}

function scoreSpoken(item: ItemOf<'speak_compare'>, answer: Answer): ItemResult {
  need(item, answer, 'spoken');
  return result(item.id, 'unscored');
}

/** One scorer per item type; a new type without a scorer fails to compile (spec §14). */
const SCORERS: { [K in PracticeItem['type']]: (item: ItemOf<K>, answer: Answer) => ItemResult } = {
  mcq_meaning: scoreChoice,
  listen_choose: scoreChoice,
  aptitude: scoreChoice,
  fill_blank: scoreFill,
  word_order: scoreOrder,
  speak_compare: scoreSpoken,
};

export function scoreItem(item: PracticeItem, answer: Answer): ItemResult {
  const scorer = SCORERS[item.type] as (i: PracticeItem, a: Answer) => ItemResult;
  return scorer(item, answer);
}
