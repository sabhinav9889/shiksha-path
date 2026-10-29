// The student community screen's words (kept in its own lazy chunk, not the first load).
import type { Lang } from '../i18n/index.js';

const STRINGS = {
  title: { hi: 'समुदाय', en: 'Community' },
  empty: { hi: 'अभी कोई पोस्ट नहीं', en: 'No posts yet' },
  offline: {
    hi: 'इंटरनेट नहीं है। पिछली बार की पोस्ट दिख रही हैं।',
    en: 'No internet. Showing the posts from last time.',
  },
  off: { hi: 'अभी यह सुविधा बंद है।', en: 'This is switched off right now.' },
  loading: { hi: 'लोड हो रहा है…', en: 'Loading…' },
  forCohort: { hi: 'आपके समूह के लिए', en: 'For your cohort' },
  by: { hi: 'द्वारा', en: 'by' },
  edited: { hi: 'बदली गई', en: 'edited' },
  session: { hi: 'सेशन', en: 'Session' },
  minutes: { hi: '{minutes} मिनट', en: '{minutes} min' },
  live: { hi: 'अभी चल रहा है', en: 'On now' },
  over: { hi: 'हो चुका', en: 'Over' },
  upcoming: { hi: 'आने वाला', en: 'Coming up' },
  join: { hi: 'जुड़ें', en: 'Join' },
} satisfies Record<string, Record<Lang, string>>;

export type CommunityKey = keyof typeof STRINGS;

export function cs(
  key: CommunityKey,
  lang: Lang,
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    STRINGS[key][lang],
  );
}
