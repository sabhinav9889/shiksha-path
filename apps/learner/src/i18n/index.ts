import type { ErrorCode, Lang, LanguagePreference } from '@shiksha/learner-core';
import { commonStrings } from './common.js';
import { errorStrings } from './errors.js';
import { finishStrings } from './finish.js';
import { homeStrings } from './home.js';
import { learnStrings } from './learn.js';
import { lessonsStrings } from './lessons.js';
import { practiceStrings } from './practice.js';
import { profilesStrings } from './profiles.js';
import { shellStrings } from './shell.js';

export type { Lang } from '@shiksha/learner-core';

/** Each screen adds its own strings file and spreads it here. */
export const STRINGS = {
  ...commonStrings,
  ...shellStrings,
  ...profilesStrings,
  ...homeStrings,
  ...lessonsStrings,
  ...learnStrings,
  ...practiceStrings,
  ...finishStrings,
};

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

const BYTES_PER_MB = 1_048_576;
const megabytes = (bytes: number): string => (bytes / BYTES_PER_MB).toFixed(1);

/** The plain message for a failure; "not enough space" also says how much is needed and free. */
export function failureMessage(
  code: ErrorCode,
  lang: Lang,
  details?: Record<string, unknown>,
): string {
  const base = errorMessage(code, lang, details);
  const needed = details?.neededBytes;
  const free = details?.freeBytes;
  if (code !== 'LOW_STORAGE' || typeof needed !== 'number' || typeof free !== 'number') return base;
  return `${base} ${t('lessons.space', lang, { needed: megabytes(needed), free: megabytes(free) })}`;
}
