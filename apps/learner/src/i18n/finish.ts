import type { Localized } from '@shiksha/content/schema';

export const finishStrings = {
  'finish.lesson': { hi: '{title} पूरा!', en: '{title} complete!' },
  'finish.review': { hi: 'दोहराना पूरा!', en: 'Review complete!' },
  'finish.testPassed': { hi: 'पास हुए – module पूरा!', en: 'You passed – module complete!' },
  'finish.testFailed': {
    hi: 'अभी पास नहीं हुए – पाठ जारी रखें',
    en: 'Not passed yet – keep learning',
  },
  'finish.summary': {
    hi: '{scored} में से {correct} सही · {days} दिन की streak',
    en: '{correct} of {scored} correct · {days} day streak',
  },
  'finish.testScore': { hi: 'आपका स्कोर: {percent}%', en: 'Your score: {percent}%' },
  'finish.tileCorrect': { hi: 'सही', en: 'Correct' },
  'finish.tileWrong': { hi: 'गलत', en: 'Wrong' },
  'finish.tileStreak': { hi: 'streak', en: 'Streak' },
  'finish.mistakes': {
    hi: '{count} गलतियाँ अगले कुछ दिनों में दोहराने में आएँगी',
    en: '{count} mistakes will come back for review in the next few days',
  },
  'finish.home': { hi: 'होम पर जाएँ', en: 'Go home' },
} satisfies Record<string, Localized>;
