import type { Localized } from '@shiksha/content/schema';

export const accountStrings = {
  'account.link': { hi: 'Google से जुड़ें', en: 'Connect Google' },
  'account.later': { hi: 'बाद में', en: 'Later' },
  'account.linkWhy': {
    hi: 'अपनी प्रोग्रेस सुरक्षित रखने के लिए Google से जुड़ें',
    en: 'Connect Google to keep your progress safe',
  },
  'account.nudge': {
    hi: 'प्रोग्रेस सिर्फ़ इस फ़ोन पर है। Google से जुड़ें ताकि फ़ोन बदलने पर भी न खोए।',
    en: 'Your progress is only on this phone. Connect Google so it is not lost if you change phones.',
  },
  'account.linked': { hi: 'Google से जुड़ गया', en: 'Connected to Google' },
  'account.linkedRow': { hi: 'Google खाता: जुड़ा है', en: 'Google account: connected' },
  'account.adopted': {
    hi: 'Google से जुड़ गया – आपकी पुरानी प्रोग्रेस इस फ़ोन पर आ गई',
    en: 'Connected to Google – your earlier progress is now on this phone',
  },
  'account.elsewhere': {
    hi: 'यह Google खाता दूसरी प्रोफ़ाइल से जुड़ा है',
    en: 'This Google account belongs to another profile',
  },
  'account.failed': {
    hi: 'अभी Google से नहीं जुड़ पाए। इंटरनेट मिलने पर फिर कोशिश करें।',
    en: 'Could not connect Google now. Try again when there is internet.',
  },
  'account.working': { hi: 'Google से जुड़ रहे हैं…', en: 'Connecting Google…' },
  'account.restore': { hi: 'पुरानी प्रोफ़ाइल वापस लाएँ', en: 'Bring back my profile' },
  'account.restorePin': {
    hi: 'इस फ़ोन के लिए नया 4 अंकों का PIN चुनें',
    en: 'Choose a new 4-digit PIN for this phone',
  },
  'account.restored': {
    hi: 'आपकी प्रोफ़ाइल और प्रोग्रेस वापस आ गई',
    en: 'Your profile and progress are back',
  },
  'account.notFound': {
    hi: 'इस Google खाते की कोई प्रोफ़ाइल नहीं मिली',
    en: 'No profile was found for this Google account',
  },
  'account.continue': { hi: 'आगे', en: 'Continue' },
} satisfies Record<string, Localized>;
