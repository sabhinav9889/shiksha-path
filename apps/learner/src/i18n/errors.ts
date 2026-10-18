import type { Localized } from '@shiksha/content/schema';
import type { ErrorCode } from '@shiksha/learner-core';

/** Plain-language messages for every core error code; students never see the code itself. */
export const errorStrings: Record<ErrorCode, Localized> = {
  LOW_STORAGE: {
    hi: 'फ़ोन में जगह कम है। कुछ पूरे हो चुके पाठ हटाकर फिर कोशिश करें।',
    en: 'Not enough space on this phone. Remove finished lessons and try again.',
  },
  DOWNLOAD_FAILED: {
    hi: 'डाउनलोड पूरा नहीं हुआ। इंटरनेट मिलने पर फिर कोशिश करें – जितना हुआ है वह बचा है।',
    en: 'The download did not finish. Try again with internet; progress is kept.',
  },
  BUNDLE_CORRUPT: {
    hi: 'यह पाठ ठीक से डाउनलोड नहीं हुआ। फिर से डाउनलोड करें।',
    en: 'This lesson did not download correctly. Download it again.',
  },
  BUNDLE_TOO_LARGE: {
    hi: 'यह फ़ाइल उम्मीद से बड़ी है, इसलिए रोक दी गई। फिर कोशिश करें।',
    en: 'This file is larger than expected, so it was stopped. Try again.',
  },
  MANIFEST_UNAVAILABLE: {
    hi: 'पाठों की सूची अभी नहीं मिली। इंटरनेट से जुड़कर फिर कोशिश करें।',
    en: 'Could not get the lesson list. Connect to the internet and try again.',
  },
  MODULE_NOT_READY: {
    hi: 'यह पाठ अभी इस फ़ोन में नहीं है। पहले डाउनलोड करें।',
    en: 'This lesson is not on this phone yet. Download it first.',
  },
  PIN_INVALID: {
    hi: 'PIN में ठीक 4 अंक होने चाहिए।',
    en: 'The PIN must be exactly 4 digits.',
  },
  PIN_WRONG: {
    hi: 'PIN गलत है। {attemptsLeft} कोशिशें बाकी हैं।',
    en: 'Wrong PIN. {attemptsLeft} tries left.',
  },
  PIN_LOCKED: {
    hi: 'बहुत बार गलत PIN डाला। {retryAfterSec} सेकंड बाद फिर कोशिश करें।',
    en: 'Too many wrong PINs. Try again in {retryAfterSec} seconds.',
  },
  NAME_INVALID: {
    hi: 'नाम 1 से 40 अक्षरों का होना चाहिए।',
    en: 'The name must be 1 to 40 characters.',
  },
  PROFILE_NOT_FOUND: {
    hi: 'यह प्रोफ़ाइल इस फ़ोन में नहीं मिली।',
    en: 'This profile was not found on this phone.',
  },
};
