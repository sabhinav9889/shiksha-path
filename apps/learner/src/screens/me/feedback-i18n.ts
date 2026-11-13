// The My speaking practice card's words (kept with the card, which loads on its own).
import type { Lang } from '../../i18n/index.js';

const STRINGS = {
  title: { hi: 'मेरी बोलने की प्रैक्टिस', en: 'My speaking practice' },
  waiting: { hi: 'मेंटर के देखने का इंतज़ार', en: 'Waiting for a mentor' },
  reviewed: { hi: 'मेंटर ने देखा', en: 'Seen by a mentor' },
  comment: { hi: 'मेंटर की टिप्पणी', en: 'Mentor’s comment' },
  play: { hi: 'सुनें', en: 'Listen' },
  seconds: { hi: 'सेकंड', en: 'sec' },
  needsNet: { hi: 'सुनने के लिए इंटरनेट चाहिए', en: 'You need internet to listen' },
  playFailed: {
    hi: 'अभी नहीं चल सका। थोड़ी देर बाद कोशिश करें।',
    en: 'Could not play it just now. Try again in a bit.',
  },
  offline: { hi: 'पिछली बार की जानकारी', en: 'As of the last time online' },
  retention: {
    hi: 'मेंटर के देखने के 30 दिन बाद रिकॉर्डिंग हट जाती है।',
    en: 'A recording is removed 30 days after a mentor sees it.',
  },
} satisfies Record<string, Record<Lang, string>>;

export type FeedbackKey = keyof typeof STRINGS;

export const fb = (key: FeedbackKey, lang: Lang): string => STRINGS[key][lang];
