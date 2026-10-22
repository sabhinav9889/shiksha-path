// The admin screens' words, Hindi and English: forms, feature names and audit actions.
import type { FeatureKey } from '@shiksha/api-contract';
import type { Lang } from '../i18n/index.js';

type Words = Record<Lang, string>;

const STRINGS = {
  labs: { hi: 'लैब', en: 'Labs' },
  newLab: { hi: 'नई लैब का नाम', en: 'New lab name' },
  addLab: { hi: 'लैब जोड़ें', en: 'Add lab' },
  lab: { hi: 'लैब', en: 'Lab' },
  noLab: { hi: 'कोई लैब नहीं', en: 'No lab' },
  cohorts: { hi: 'समूह', en: 'Cohorts' },
  newCohort: { hi: 'नए समूह का नाम', en: 'New cohort name' },
  addCohort: { hi: 'समूह जोड़ें', en: 'Add cohort' },
  staff: { hi: 'स्टाफ़', en: 'Staff' },
  staffName: { hi: 'मेंटर का नाम', en: 'Name' },
  email: { hi: 'ईमेल', en: 'Email' },
  role: { hi: 'भूमिका', en: 'Role' },
  invite: { hi: 'बुलाएँ', en: 'Invite' },
  waitingClaim: { hi: 'अभी साइन इन नहीं किया', en: 'Not signed in yet' },
  search: { hi: 'नाम से खोजें', en: 'Search by name' },
  find: { hi: 'खोजें', en: 'Search' },
  cohort: { hi: 'समूह', en: 'Cohort' },
  allCohorts: { hi: 'सब समूह', en: 'All cohorts' },
  needsAttention: { hi: 'सिर्फ़ जिन्हें ध्यान चाहिए', en: 'Only those needing attention' },
  more: { hi: 'और दिखाएँ', en: 'Show more' },
  none: { hi: 'कोई छात्र नहीं मिला', en: 'No students found' },
  moveTo: { hi: 'नया समूह', en: 'New cohort' },
  move: { hi: 'समूह बदलें', en: 'Move' },
  deactivate: { hi: 'बंद करें', en: 'Pause' },
  confirmDeactivate: {
    hi: 'पक्का? छात्र तब तक sync नहीं कर पाएगा जब तक फिर चालू न हो।',
    en: 'Sure? The student cannot sync until resumed.',
  },
  yesDeactivate: { hi: 'हाँ, बंद करें', en: 'Yes, pause' },
  reactivate: { hi: 'फिर से चालू करें', en: 'Resume' },
  remove: { hi: 'हटाएँ', en: 'Delete' },
  removeForever: { hi: 'हमेशा के लिए हटाएँ?', en: 'Delete for ever?' },
  yes: { hi: 'हाँ', en: 'Yes' },
  typeName: {
    hi: 'पक्का करने के लिए छात्र का नाम लिखें',
    en: 'Type the student’s name to confirm',
  },
  removeNow: { hi: 'हमेशा के लिए हटाएँ', en: 'Delete for ever' },
  sameAsAll: { hi: 'सबके जैसा', en: 'Same as everyone' },
  on: { hi: 'चालू', en: 'On' },
  off: { hi: 'बंद', en: 'Off' },
  forEveryone: { hi: 'सब छात्रों के लिए', en: 'For all students' },
  nameHi: { hi: 'नाम (हिंदी)', en: 'Name (Hindi)' },
  nameEn: { hi: 'नाम (English)', en: 'Name (English)' },
  primary: { hi: 'मुख्य रंग', en: 'Main colour' },
  accent: { hi: 'दूसरा रंग', en: 'Second colour' },
  contrast: { hi: 'सफ़ेद पर {white} · पेज पर {page}', en: 'On white {white} · on the page {page}' },
  hardToRead: { hi: 'यह रंग पढ़ने में मुश्किल है', en: 'This colour is hard to read' },
  saveBranding: { hi: 'ब्रांडिंग सेव करें', en: 'Save branding' },
  brandingSaved: {
    hi: 'सेव हो गया — फ़ोन अगली बार इंटरनेट मिलने पर नया रूप लेंगे',
    en: 'Saved — phones update next time they are online',
  },
  deletedStudent: { hi: 'हटाया गया छात्र', en: 'Deleted student' },
  seeStudent: { hi: 'छात्र देखें', en: 'See student' },
  someone: { hi: 'कोई स्टाफ़', en: 'A staff member' },
  noEntries: { hi: 'अभी कुछ नहीं', en: 'Nothing yet' },
} satisfies Record<string, Words>;

export type AdminKey = keyof typeof STRINGS;

export function at(
  key: AdminKey,
  lang: Lang,
  params: Record<string, string | number> = {},
): string {
  return Object.entries(params).reduce(
    (text, [name, value]) => text.replaceAll(`{${name}}`, String(value)),
    STRINGS[key][lang],
  );
}

export const FEATURE_NAMES: Record<FeatureKey, Words> = {
  ai_doubts: { hi: 'AI से सवाल', en: 'AI doubts' },
  speaking_practice: { hi: 'बोलने का अभ्यास', en: 'Speaking practice' },
  placement_test: { hi: 'शुरुआती टेस्ट', en: 'Starting test' },
  english_only_option: { hi: 'सिर्फ़ अंग्रेज़ी का विकल्प', en: 'English-only option' },
  mentor_booking: { hi: 'मेंटर से मिलना', en: 'Mentor booking' },
  community_feed: { hi: 'समुदाय', en: 'Community' },
};

const ACTIONS: Record<string, Words> = {
  code_issued: { hi: 'कोड बनाया', en: 'Made a code' },
  code_reset: { hi: 'कोड बदला', en: 'Reset a code' },
  level_set: { hi: 'स्तर बदला', en: 'Changed a level' },
  attendance_marked: { hi: 'हाज़िरी लगाई', en: 'Marked attendance' },
  recording_reviewed: { hi: 'रिकॉर्डिंग सुनी', en: 'Reviewed a recording' },
  student_edited: { hi: 'छात्र का नाम बदला', en: 'Renamed a student' },
  student_moved: { hi: 'छात्र का समूह बदला', en: 'Moved a student' },
  student_deactivated: { hi: 'छात्र बंद किया', en: 'Paused a student' },
  student_reactivated: { hi: 'छात्र फिर चालू किया', en: 'Resumed a student' },
  student_deleted: { hi: 'छात्र हटाया', en: 'Deleted a student' },
  switch_changed: { hi: 'फ़ीचर बदला', en: 'Changed a feature' },
  override_changed: { hi: 'एक छात्र का फ़ीचर बदला', en: 'Changed a student’s feature' },
  branding_changed: { hi: 'ब्रांडिंग बदली', en: 'Changed branding' },
  cohort_saved: { hi: 'समूह सेव किया', en: 'Saved a cohort' },
  lab_saved: { hi: 'लैब सेव की', en: 'Saved a lab' },
  staff_invited: { hi: 'स्टाफ़ बुलाया', en: 'Invited staff' },
  staff_changed: { hi: 'स्टाफ़ बदला', en: 'Changed staff' },
};

/** An audit action in words; an unknown one (a newer server) shows as it is. */
export function actionWords(action: string, lang: Lang): string {
  return ACTIONS[action]?.[lang] ?? action;
}
