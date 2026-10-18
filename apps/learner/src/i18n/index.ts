import type { ErrorCode, Lang, LanguagePreference } from '@shiksha/learner-core';
import { commonStrings } from './common.js';
import { errorStrings } from './errors.js';
import { profilesStrings } from './profiles.js';
import { shellStrings } from './shell.js';

export type { Lang } from '@shiksha/learner-core';

/** Each screen adds its own strings file and spreads it here. */
export const STRINGS = { ...commonStrings, ...shellStrings, ...profilesStrings };

export type StringKey = keyof typeof STRINGS;

type Params = Record<string, string | number>;

function fill(text: string, params: Params | undefined): string {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  );
}

export function t(key: StringKey, lang: Lang, params?: Params): string {
  return fill(STRINGS[key][lang], params);
}

export function errorMessage(
  code: ErrorCode,
  lang: Lang,
  details?: Record<string, unknown>,
): string {
  const params = Object.fromEntries(
    Object.entries(details ?? {}).filter(([, v]) => typeof v === 'string' || typeof v === 'number'),
  ) as Params;
  return fill(errorStrings[code][lang], params);
}

/** English-only learners get an English interface; everyone else a Hindi one. */
export function uiLang(pref: LanguagePreference): Lang {
  return pref === 'en_only' ? 'en' : 'hi';
}
