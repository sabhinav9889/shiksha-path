import type { Localized } from '@shiksha/content/schema';

export type LanguagePreference = 'hi_en' | 'en_only';
export type Lang = 'hi' | 'en';

export interface LanguageView {
  primary: Lang;
  /** The other language the learner may switch to, or null when English-only. */
  toggle: Lang | null;
}

const HINDI_PRIMARY_ABOVE = 0.5;

/** A mostly-Hindi module shows Hindi first; English-only learners never see Hindi. */
export function languageView(hiRatio: number, pref: LanguagePreference): LanguageView {
  if (pref === 'en_only') return { primary: 'en', toggle: null };
  return hiRatio > HINDI_PRIMARY_ABOVE
    ? { primary: 'hi', toggle: 'en' }
    : { primary: 'en', toggle: 'hi' };
}

export function pickText(text: Localized, lang: Lang): string {
  return text[lang];
}
