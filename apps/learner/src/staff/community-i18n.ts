// The posts screen's words, Hindi and English (kept in the staff chunk).
import type { Lang } from '../i18n/index.js';

const STRINGS = {
  newPost: { hi: 'नई पोस्ट', en: 'New post' },
  editPost: { hi: 'पोस्ट बदलें', en: 'Edit post' },
  warning: {
    hi: 'छात्रों के नाम और फ़ोटो पोस्ट न करें।',
    en: 'Do not post students’ names or photos.',
  },
  postTitle: { hi: 'शीर्षक', en: 'Title' },
  postBody: { hi: 'संदेश', en: 'Message' },
  audience: { hi: 'किसके लिए', en: 'Who sees it' },
  everyone: { hi: 'सभी छात्र', en: 'All students' },
  isSession: { hi: 'यह एक सेशन है', en: 'This is a session' },
  startsAt: { hi: 'शुरू होने का समय', en: 'Starts at' },
  minutes: { hi: 'कितने मिनट', en: 'Minutes' },
  joinLink: { hi: 'जुड़ने का लिंक (https://)', en: 'Link to join (https://)' },
  publish: { hi: 'पोस्ट करें', en: 'Post' },
  saveChanges: { hi: 'बदलाव सेव करें', en: 'Save changes' },
  noPosts: { hi: 'अभी कोई पोस्ट नहीं', en: 'No posts yet' },
  toEveryone: { hi: 'सभी छात्र', en: 'All students' },
  edited: { hi: 'बदली गई', en: 'edited' },
  by: { hi: 'द्वारा', en: 'by' },
  sessionAt: { hi: 'सेशन: {when} · {minutes} मिनट', en: 'Session: {when} · {minutes} min' },
} satisfies Record<string, Record<Lang, string>>;

export type CommunityKey = keyof typeof STRINGS;

export function ct(
  key: CommunityKey,
  lang: Lang,
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    STRINGS[key][lang],
  );
}
