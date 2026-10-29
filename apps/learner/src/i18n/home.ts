import type { Localized } from '@shiksha/content/schema';

export const homeStrings = {
  'home.greeting': { hi: 'नमस्ते, {name}', en: 'Hello, {name}' },
  'home.streak': { hi: 'Streak', en: 'Streak' },
  'home.days': { hi: '{count} दिन', en: '{count} days' },
  'home.progress': { hi: '{done} / {total}', en: '{done} / {total}' },
  'home.today': { hi: 'आज का पाठ', en: "Today's lesson" },
  'home.questions': { hi: '{count} सवाल', en: '{count} questions' },
  'home.review': { hi: 'दोहराने के लिए {count} सवाल', en: '{count} questions to review' },
  'home.reviewSub': { hi: 'पिछली गलतियाँ', en: 'Earlier mistakes' },
  'home.downloadTitle': { hi: 'पाठ डाउनलोड करें', en: 'Download your lessons' },
  'home.downloadBody': {
    hi: 'पहली बार इंटरनेट चाहिए। उसके बाद बिना इंटरनेट भी चलेगा।',
    en: 'You need internet once. After that it works offline.',
  },
  'home.downloading': { hi: 'डाउनलोड हो रहा है…', en: 'Downloading…' },
  'home.allDone': { hi: 'सब पाठ पूरे!', en: 'All lessons done!' },
  'home.allDoneBody': {
    hi: 'बहुत बढ़िया। दोहराने वाले सवाल यहाँ दिखेंगे।',
    en: 'Great work. Review questions will show up here.',
  },
  'home.community': { hi: 'समुदाय', en: 'Community' },
  'home.communitySub': {
    hi: 'मेंटर की पोस्ट और सेशन',
    en: 'Posts and sessions from your mentors',
  },
  'home.reviewNothing': {
    hi: 'अभी दोहराने के लिए कुछ नहीं है।',
    en: 'There is nothing to review right now.',
  },
} satisfies Record<string, Localized>;
