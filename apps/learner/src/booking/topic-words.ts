import type { BookingTopic } from '@shiksha/api-contract';
import type { Lang } from '../i18n/index.js';

const TOPICS: Record<BookingTopic, Record<Lang, string>> = {
  doubt: { hi: 'डाउट / सवाल', en: 'Doubt' },
  progress: { hi: 'प्रगति पर बात', en: 'Progress review' },
  career: { hi: 'करियर सलाह', en: 'Career advice' },
  resume: { hi: 'रिज़्यूमे बनाना', en: 'Resume building' },
};

/** What a booking is about, in words. */
export const topicWords = (topic: BookingTopic, lang: Lang): string => TOPICS[topic][lang];
