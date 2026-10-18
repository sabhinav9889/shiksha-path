import type { Localized } from '@shiksha/content/schema';

export const learnStrings = {
  'learn.viewEn': { hi: 'English में देखें', en: 'View in English' },
  'learn.viewHi': { hi: 'हिंदी में देखें', en: 'View in Hindi' },
  'learn.listen': { hi: 'पाठ सुनें', en: 'Listen to the lesson' },
  'learn.practice': { hi: 'अभ्यास करें', en: 'Practice' },
} satisfies Record<string, Localized>;
