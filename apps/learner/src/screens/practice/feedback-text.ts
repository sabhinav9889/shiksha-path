import type { PracticeItem } from '@shiksha/content/schema';
import type { CorrectAnswer } from '@shiksha/learner-core';
import type { Lang } from '../../i18n/index.js';

/** The correct answer as text: the option's words, the typed text, or the right word order. */
export function correctAnswerText(
  correct: CorrectAnswer,
  item: PracticeItem | undefined,
  lang: Lang,
): string {
  if (correct.kind === 'text') return correct.value;
  if (correct.kind === 'order') return correct.words.join(' ');
  const options = item && 'options' in item ? item.options : [];
  return options.find((o) => o.id === correct.optionId)?.text[lang] ?? '';
}
