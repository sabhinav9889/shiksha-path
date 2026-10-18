import type { Localized } from '@shiksha/content/schema';

export const practiceStrings = {
  'practice.listen': { hi: 'सुनें', en: 'Listen' },
  'practice.check': { hi: 'जाँचें', en: 'Check' },
  'practice.yourAnswer': { hi: 'आपका जवाब', en: 'Your answer' },
  'practice.tray': { hi: 'आपका वाक्य', en: 'Your sentence' },
  'practice.bank': { hi: 'शब्द', en: 'Words' },
  'practice.speakNote': { hi: 'सुनें और खुद बोलकर देखें', en: 'Listen, then say it yourself' },
} satisfies Record<string, Localized>;
