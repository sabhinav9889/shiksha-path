import type { Lang } from '../i18n/index.js';

const KEY = 'shiksha.staff-lang';

function stored(): Lang {
  try {
    return localStorage.getItem(KEY) === 'en' ? 'en' : 'hi';
  } catch {
    return 'hi'; // storage can be refused (private window): Hindi-first, the spec's default
  }
}

/** The staff section's language: its own choice, apart from any learner profile's (spec §6.7). */
export const staffLang = $state<{ lang: Lang }>({ lang: stored() });

export function setStaffLang(lang: Lang): void {
  staffLang.lang = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // the choice then lasts until the page is closed
  }
}
