import type { Localized } from '@shiksha/content/schema';

export const placementStrings = {
  'placement.card': { hi: 'शुरुआती टेस्ट दें', en: 'Take the starting test' },
  'placement.cardBody': {
    hi: 'करीब 10 मिनट · इससे पता चलता है कि आप कहाँ से शुरू करें',
    en: 'About 10 minutes · it shows where you should start',
  },
  'placement.title': { hi: 'शुरुआती टेस्ट · {track}', en: 'Starting test · {track}' },
  'placement.note': {
    hi: 'यह परीक्षा नहीं है – इससे पता चलता है कि आप कहाँ से शुरू करें।',
    en: 'This is not an exam – it shows where you should start.',
  },
  'placement.skip': { hi: 'छोड़ें, शुरू से पढ़ूँगा', en: 'Skip, I will start from the beginning' },
  'placement.skipConfirm': {
    hi: 'टेस्ट छोड़ें? आप पहले पाठ से शुरू करेंगे।',
    en: 'Skip the test? You will start from the first lesson.',
  },
  'placement.skipYes': { hi: 'हाँ, छोड़ें', en: 'Yes, skip' },
  'placement.skipNo': { hi: 'टेस्ट दूँगा', en: 'I will take it' },
  'placementResult.title': { hi: 'आपका नतीजा', en: 'Your result' },
  'placementResult.score': { hi: '{track}: {percent}%', en: '{track}: {percent}%' },
  'placementResult.start': {
    hi: 'आप "{lesson}" से शुरू करेंगे',
    en: 'You will start at "{lesson}"',
  },
  'placementResult.suggest': {
    hi: 'आपकी English अच्छी है। क्या सब कुछ English में पढ़ना चाहेंगे?',
    en: 'Your English is good. Would you like everything in English?',
  },
  'placementResult.yes': { hi: 'हाँ, सिर्फ़ English', en: 'Yes, English only' },
  'placementResult.no': { hi: 'नहीं, हिंदी + English', en: 'No, Hindi + English' },
} satisfies Record<string, Localized>;
