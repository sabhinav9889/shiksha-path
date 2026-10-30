// The meeting slots screen's words, Hindi and English (kept in the staff chunk).
import type { Lang } from '../i18n/index.js';

const STRINGS = {
  newSlot: { hi: 'नया स्लॉट', en: 'New slot' },
  hint: {
    hi: 'समय भारतीय समय (IST) में है। छात्र 24 घंटे से 14 दिन पहले तक बुक कर सकते हैं।',
    en: 'Times are India time (IST). Students can book from 24 hours to 14 days ahead.',
  },
  startsAt: { hi: 'शुरू होने का समय', en: 'Starts at' },
  minutes: { hi: 'कितने मिनट', en: 'Minutes' },
  joinLink: { hi: 'जुड़ने का लिंक (https://)', en: 'Link to join (https://)' },
  addSlot: { hi: 'स्लॉट जोड़ें', en: 'Add slot' },
  noSlots: { hi: 'अभी कोई स्लॉट नहीं', en: 'No slots yet' },
  open: { hi: 'खाली', en: 'Open' },
  mentor: { hi: 'मेंटर: {name}', en: 'Mentor: {name}' },
  booked: { hi: 'बुक: {name} · {topic}', en: 'Booked: {name} · {topic}' },
  duration: { hi: '{minutes} मिनट', en: '{minutes} min' },
} satisfies Record<string, Record<Lang, string>>;

export type BookingKey = keyof typeof STRINGS;

export function bt(
  key: BookingKey,
  lang: Lang,
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    STRINGS[key][lang],
  );
}
