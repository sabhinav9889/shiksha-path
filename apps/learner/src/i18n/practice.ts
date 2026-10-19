import type { Localized } from '@shiksha/content/schema';

export const practiceStrings = {
  'practice.listen': { hi: 'सुनें', en: 'Listen' },
  'practice.check': { hi: 'जाँचें', en: 'Check' },
  'practice.yourAnswer': { hi: 'आपका जवाब', en: 'Your answer' },
  'practice.tray': { hi: 'आपका वाक्य', en: 'Your sentence' },
  'practice.bank': { hi: 'शब्द', en: 'Words' },
  'practice.speakNote': { hi: 'सुनें और खुद बोलकर देखें', en: 'Listen, then say it yourself' },
  'practice.correct': { hi: 'बहुत बढ़िया! सही जवाब', en: 'Great! Correct' },
  'practice.whyWrong': { hi: 'गलत क्यों है?', en: 'Why is it wrong?' },
  'practice.correctAnswer': { hi: 'सही जवाब: {answer}', en: 'Correct answer: {answer}' },
  'practice.explanation': { hi: 'समझें', en: 'Explanation' },
  'practice.close': { hi: 'बंद करें', en: 'Close' },
  'practice.leaveTitle': { hi: 'पाठ बीच में छोड़ें?', en: 'Leave the lesson now?' },
  'practice.leave': { hi: 'छोड़ें', en: 'Leave' },
  'practice.stay': { hi: 'जारी रखें', en: 'Keep going' },
  'practice.retry': { hi: 'फिर कोशिश करें', en: 'Try again' },
  'practice.count': { hi: '{current} / {total}', en: '{current} / {total}' },
} satisfies Record<string, Localized>;
