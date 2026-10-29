// The My details card's words (kept with the card, which loads on its own).
import type { Lang } from '../../i18n/index.js';

const STRINGS = {
  title: { hi: 'मेरी जानकारी', en: 'My details' },
  email: { hi: 'ईमेल', en: 'Email' },
  cohort: { hi: 'समूह', en: 'Cohort' },
  noCohort: { hi: 'अभी कोई समूह नहीं', en: 'No cohort yet' },
  mentors: { hi: 'मेंटर', en: 'Mentors' },
  noMentors: { hi: 'अभी कोई मेंटर नहीं', en: 'No mentor yet' },
  offline: { hi: 'पिछली बार की जानकारी', en: 'As of the last time online' },
} satisfies Record<string, Record<Lang, string>>;

export type ProfileKey = keyof typeof STRINGS;

export const pc = (key: ProfileKey, lang: Lang): string => STRINGS[key][lang];
