import type { PracticeItem } from '@shiksha/content/schema';
import type { Answer, BundleStorage } from '@shiksha/learner-core';
import type { Recorder, RecordingResult } from '../../../audio/recorder.js';
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
  /** Speaking items only: the microphone, and where a finished recording is saved. */
  recorder?: Recorder | undefined;
  onrecord?: ((recording: RecordingResult) => Promise<void>) | undefined;
}
