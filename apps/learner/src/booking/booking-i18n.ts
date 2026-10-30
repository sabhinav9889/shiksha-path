// The Talk to a mentor page's words (kept in its own lazy chunk, not the first load).
import type { Lang } from '../i18n/index.js';

const STRINGS = {
  title: { hi: 'मेंटर से बात करें', en: 'Talk to a mentor' },
  intro: {
    hi: 'अपने मेंटर के साथ 1-से-1 समय चुनें। बुक करने के लिए इंटरनेट चाहिए।',
    en: 'Pick a one-to-one time with your mentor. You need internet to book.',
  },
  mine: { hi: 'मेरी बुकिंग', en: 'My bookings' },
  noneMine: { hi: 'अभी कोई बुकिंग नहीं', en: 'No bookings yet' },
  open: { hi: 'खाली समय', en: 'Open times' },
  noneOpen: {
    hi: 'अभी कोई खाली समय नहीं। मेंटर नए समय जोड़ेंगे।',
    en: 'No open times right now. Your mentors will add more.',
  },
  withMentor: { hi: '{name} के साथ', en: 'With {name}' },
  minutes: { hi: '{minutes} मिनट', en: '{minutes} min' },
  book: { hi: 'बुक करें', en: 'Book' },
  topic: { hi: 'किस बारे में', en: 'What about' },
  note: { hi: 'छोटा नोट (ज़रूरी नहीं)', en: 'A short note (optional)' },
  confirm: { hi: 'बुक पक्का करें', en: 'Confirm booking' },
  cancelBooking: { hi: 'रद्द करें', en: 'Cancel booking' },
  sure: { hi: 'यह बुकिंग रद्द करें?', en: 'Cancel this booking?' },
  yes: { hi: 'हाँ', en: 'Yes' },
  no: { hi: 'नहीं', en: 'No' },
  join: { hi: 'जुड़ें', en: 'Join' },
  off: { hi: 'अभी यह सुविधा बंद है।', en: 'This is switched off right now.' },
  taken: { hi: 'यह स्लॉट अभी किसी और ने ले लिया।', en: 'Someone else just booked this slot.' },
  limit: {
    hi: 'आपकी दो बुकिंग पहले से हैं। एक रद्द करके फिर बुक करें।',
    en: 'You already have two bookings. Cancel one to book another.',
  },
  tooSoon: {
    hi: 'यह समय अब बुक नहीं हो सकता।',
    en: 'This time can no longer be booked.',
  },
  tooLate: {
    hi: 'शुरू होने से 2 घंटे से कम बचे हैं, इसलिए रद्द नहीं हो सकता।',
    en: 'Less than 2 hours are left, so it cannot be cancelled.',
  },
  failed: {
    hi: 'अभी नहीं हो पाया। इंटरनेट देखकर फिर कोशिश करें।',
    en: 'That did not work. Check the internet and try again.',
  },
  loading: { hi: 'लोड हो रहा है…', en: 'Loading…' },
} satisfies Record<string, Record<Lang, string>>;

export type BookingKey = keyof typeof STRINGS;

export function bs(
  key: BookingKey,
  lang: Lang,
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    STRINGS[key][lang],
  );
}
