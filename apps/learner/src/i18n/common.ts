import type { Localized } from '@shiksha/content/schema';

export const commonStrings = {
  'app.name': { hi: 'शिक्षा पथ', en: 'Shiksha Path' },
  'action.next': { hi: 'आगे', en: 'Next' },
  'action.back': { hi: 'वापस', en: 'Back' },
  'action.start': { hi: 'शुरू करें', en: 'Start' },
  'action.download': { hi: 'डाउनलोड करें', en: 'Download' },
  'status.saved': { hi: 'सब सेव है · {minutes} मिनट पहले', en: 'All saved · {minutes} min ago' },
  'status.savedLater': {
    hi: 'फ़ोन में सेव · इंटरनेट मिलते ही अपलोड',
    en: 'Saved on phone · uploads when internet is back',
  },
} satisfies Record<string, Localized>;
