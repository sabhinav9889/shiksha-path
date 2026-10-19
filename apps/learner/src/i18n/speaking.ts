import type { Localized } from '@shiksha/content/schema';

export const speakingStrings = {
  'speak.record': { hi: 'रिकॉर्ड करें', en: 'Record' },
  'speak.stop': { hi: 'रोकें', en: 'Stop' },
  'speak.secondsLeft': { hi: '{seconds} सेकंड बाकी', en: '{seconds} seconds left' },
  'speak.saving': { hi: 'सेव हो रहा है…', en: 'Saving…' },
  'speak.saved': { hi: 'रिकॉर्डिंग सेव हो गई', en: 'Recording saved' },
  'speak.playMine': { hi: 'मेरी रिकॉर्डिंग सुनें', en: 'Hear my recording' },
  'speak.again': { hi: 'फिर से रिकॉर्ड करें', en: 'Record again' },
  'speak.denied': {
    hi: 'माइक्रोफ़ोन की अनुमति नहीं मिली। आप इसे छोड़कर आगे बढ़ सकते हैं।',
    en: 'Microphone permission was not given. You can skip this and carry on.',
  },
  'speak.unsupported': {
    hi: 'इस फ़ोन पर रिकॉर्डिंग नहीं चल सकती। आगे बढ़ें।',
    en: 'Recording does not work on this phone. Carry on.',
  },
  'speak.failed': {
    hi: 'रिकॉर्डिंग नहीं हो पाई। फिर कोशिश करें या आगे बढ़ें।',
    en: 'The recording did not work. Try again or carry on.',
  },
  'speak.privacy': {
    hi: 'आपकी रिकॉर्डिंग सिर्फ़ आपको और आपके मेंटर को सुनाई देगी।',
    en: 'Only you and your mentors can hear your recording.',
  },
} satisfies Record<string, Localized>;
