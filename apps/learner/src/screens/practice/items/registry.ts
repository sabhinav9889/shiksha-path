import type { PracticeItem } from '@shiksha/content/schema';
import type { Component } from 'svelte';
import ChoiceView from './ChoiceView.svelte';
import FillBlankView from './FillBlankView.svelte';
import SpeakView from './SpeakView.svelte';
import type { ItemOf, ViewProps } from './types.js';
import WordOrderView from './WordOrderView.svelte';

type Registry = { [K in PracticeItem['type']]: Component<ViewProps<ItemOf<K>>> };

/** One view per item type; a new item type without a view fails to compile (spec §14). */
export const ITEM_VIEWS: Registry = {
  mcq_meaning: ChoiceView,
  listen_choose: ChoiceView,
  aptitude: ChoiceView,
  fill_blank: FillBlankView,
  word_order: WordOrderView,
  speak_compare: SpeakView,
};
