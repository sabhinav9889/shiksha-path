import type { Localized } from '@shiksha/content/schema';

export const lessonsStrings = {
  'lessons.title': { hi: 'पाठ', en: 'Lessons' },
  'lessons.testOut': { hi: 'Test-out quiz', en: 'Test-out quiz' },
  'lessons.testOutSub': { hi: 'पास करें तो module पूरा', en: 'Pass it to finish the module' },
  'lessons.testedOut': { hi: 'पास हो चुका', en: 'Passed' },
  'lessons.remove': { hi: 'जगह खाली करें', en: 'Free up space' },
  'lessons.removeConfirm': {
    hi: 'ये पाठ फ़ोन से हट जाएँगे, आपकी प्रोग्रेस नहीं। बाद में फिर डाउनलोड कर सकते हैं।',
    en: 'These lessons leave the phone, but your progress stays. You can download them again.',
  },
  'lessons.removeYes': { hi: 'हटाएँ', en: 'Remove' },
  'lessons.removeNo': { hi: 'रहने दें', en: 'Keep' },
  'lessons.restore': { hi: 'फिर से डाउनलोड करें', en: 'Download again' },
  'lessons.removedNote': { hi: 'जगह खाली करने के लिए हटाया गया', en: 'Removed to free up space' },
  'lessons.audio': { hi: 'ऑडियो डाउनलोड करें', en: 'Download audio' },
  'lessons.space': {
    hi: '{needed} MB चाहिए, {free} MB खाली हैं',
    en: 'Needs {needed} MB, {free} MB free',
  },
  'lessons.audioFailed': {
    hi: 'ऑडियो डाउनलोड नहीं हुआ। इंटरनेट मिलने पर फिर कोशिश करें।',
    en: 'The audio did not download. Try again when there is internet.',
  },
} satisfies Record<string, Localized>;
