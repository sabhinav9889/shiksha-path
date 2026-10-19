import type { PracticeItem } from '@shiksha/content/schema';
import type { Answer, BundleStorage } from '@shiksha/learner-core';
import type { Lang } from '../../../i18n/index.js';

export type ItemOf<K extends PracticeItem['type']> = Extract<PracticeItem, { type: K }>;

/** What every item view receives; `locked` disables input once an answer has been given. */
export interface ViewProps<I> {
  item: I;
  lang: Lang;
  storage: BundleStorage;
  seed: string;
  locked: boolean;
  onanswer: (answer: Answer) => void;
}
