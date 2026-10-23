// Plain words for staff screens: when, and what a student did (never raw event names).
import { daysBetween, istDay, type LearnerEvent } from '@shiksha/learner-core';
import type { Lang } from '../i18n/index.js';
import { st } from './i18n.js';

export function whenWords(at: string | null, lang: Lang): string {
  if (!at) return st('never', lang);
  const days = daysBetween(istDay(at), istDay(new Date()));
  if (days <= 0) return st('today', lang);
  return days === 1 ? st('yesterday', lang) : st('daysAgo', lang, { n: days });
}

/** One line per meaningful event; answers to single items are left out (too many). */
export function activityLine(event: LearnerEvent, lang: Lang): string | null {
  switch (event.type) {
    case 'lesson_started':
      return st('started', lang, { lesson: event.data.lessonId });
    case 'lesson_completed':
      return st('completed', lang, {
        lesson: event.data.lessonId,
        correct: event.data.correct,
        scored: event.data.scored,
      });
    case 'test_out_completed':
      return st('testedOut', lang, { module: event.data.moduleId });
    case 'placement_completed':
      return st('placed', lang);
    case 'placement_skipped':
      return st('skippedPlacement', lang);
    case 'level_set':
      return st('levelSet', lang, { track: event.data.track, lesson: event.data.startLesson });
    case 'language_changed':
      return st('languageChanged', lang);
    default:
      return null;
  }
}
