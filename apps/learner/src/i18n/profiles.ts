import type { Localized } from '@shiksha/content/schema';

export const profilesStrings = {
  'profiles.title': { hi: 'कौन पढ़ रहा है?', en: 'Who is learning?' },
  'profiles.count': {
    hi: 'इस फ़ोन पर {count} लोग पढ़ते हैं',
    en: '{count} people learn on this phone',
  },
  'profiles.add': { hi: 'नया जोड़ें', en: 'Add new' },
  'profiles.generalError': {
    hi: 'कुछ गड़बड़ हुई। फिर से कोशिश करें।',
    en: 'Something went wrong. Please try again.',
  },
  'pin.prompt': {
    hi: '{name}, अपना 4 अंकों का PIN डालें',
    en: '{name}, enter your 4-digit PIN',
  },
  'pin.note': {
    hi: 'PIN सिर्फ़ इस फ़ोन पर है – भाई-बहन एक-दूसरे की प्रोग्रेस नहीं बदल सकते',
    en: "The PIN stays on this phone and keeps each person's progress separate",
  },
  'pin.delete': { hi: 'मिटाएँ', en: 'Delete' },
  'pin.dots': { hi: 'PIN: {entered} / 4', en: 'PIN: {entered} / 4' },
  'create.title': { hi: 'नया प्रोफ़ाइल', en: 'New profile' },
  'create.name': { hi: 'आपका नाम', en: 'Your name' },
  'create.pinNew': { hi: 'अपना 4 अंकों का PIN चुनें', en: 'Choose a 4-digit PIN' },
  'create.pinConfirm': { hi: 'PIN फिर से डालें', en: 'Enter the PIN again' },
  'create.pinMismatch': {
    hi: 'दोनों PIN एक जैसे नहीं हैं। फिर से डालें।',
    en: 'The two PINs do not match. Enter it again.',
  },
  'create.language': { hi: 'आप किस तरह पढ़ना चाहेंगे?', en: 'How would you like to learn?' },
  'create.langHiEn': { hi: 'हिंदी + English', en: 'Hindi + English' },
  'create.langEn': { hi: 'सिर्फ़ English', en: 'English only' },
  'create.saving': { hi: 'सेव हो रहा है…', en: 'Saving…' },
  'create.cancel': { hi: 'वापस जाएँ', en: 'Go back' },
} satisfies Record<string, Localized>;
