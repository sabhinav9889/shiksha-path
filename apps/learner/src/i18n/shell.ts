import type { Localized } from '@shiksha/content/schema';

export const shellStrings = {
  'nav.label': { hi: 'मुख्य मेनू', en: 'Main menu' },
  'nav.home': { hi: 'होम', en: 'Home' },
  'nav.lessons': { hi: 'पाठ', en: 'Lessons' },
} satisfies Record<string, Localized>;
