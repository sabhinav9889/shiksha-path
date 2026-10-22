// The staff section's words, Hindi and English (kept in the staff chunk, not the learner app's).
import type { Lang } from '../i18n/index.js';

const STRINGS = {
  signIn: { hi: 'Google से साइन इन करें', en: 'Sign in with Google' },
  signInWhy: {
    hi: 'मेंटर और एडमिन अपने NGO Google खाते से साइन इन करें।',
    en: 'Mentors and admins sign in with their NGO Google account.',
  },
  notStaff: { hi: 'यह खाता स्टाफ़ के लिए नहीं है', en: 'This account is not a staff account' },
  failed: {
    hi: 'अभी नहीं हो पाया। इंटरनेट देखकर फिर कोशिश करें।',
    en: 'That did not work. Check the internet and try again.',
  },
  signOut: { hi: 'साइन आउट', en: 'Sign out' },
  mentor: { hi: 'मेंटर', en: 'Mentor' },
  admin: { hi: 'एडमिन', en: 'Admin' },
  cohorts: { hi: 'समूह', en: 'Cohorts' },
  recordings: { hi: 'रिकॉर्डिंग', en: 'Recordings' },
  adminSetup: { hi: 'सेटअप', en: 'Setup' },
  adminStudents: { hi: 'छात्र', en: 'Students' },
  adminSwitches: { hi: 'फ़ीचर', en: 'Features' },
  adminBranding: { hi: 'ब्रांडिंग', en: 'Branding' },
  adminAudit: { hi: 'लॉग', en: 'Log' },
  loading: { hi: 'लोड हो रहा है…', en: 'Loading…' },
  backToApp: { hi: 'छात्र ऐप पर वापस', en: 'Back to the student app' },
} satisfies Record<string, Record<Lang, string>>;

export type StaffKey = keyof typeof STRINGS;

export function st(
  key: StaffKey,
  lang: Lang,
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    STRINGS[key][lang],
  );
}
