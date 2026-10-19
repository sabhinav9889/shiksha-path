import type { Localized } from '@shiksha/content/schema';

export const meStrings = {
  'nav.me': { hi: 'मैं', en: 'Me' },
  'me.language': { hi: 'भाषा', en: 'Language' },
  'me.langHiEnSub': { hi: 'हिंदी में समझाना', en: 'Explained in Hindi' },
  'me.langEnSub': { hi: 'सब कुछ English में', en: 'Everything in English' },
  'me.sync': { hi: 'सिंक', en: 'Sync' },
  'me.syncAll': { hi: 'सब अपलोड हो गया', en: 'All uploaded' },
  'me.syncPending': {
    hi: '{count} बदलाव अपलोड होने बाकी',
    en: '{count} changes waiting to upload',
  },
  'me.lastSynced': { hi: 'आखिरी sync: {time}', en: 'Last synced: {time}' },
  'me.never': { hi: 'अभी तक sync नहीं हुआ', en: 'Not synced yet' },
  'me.syncNow': { hi: 'अभी sync करें', en: 'Sync now' },
  'me.syncDone': { hi: 'पाठ अपडेट हो गए', en: 'Lessons are up to date' },
  'me.storage': { hi: 'फ़ोन में डाउनलोड', en: 'Downloaded on this phone' },
  'me.used': { hi: '{used} MB इस्तेमाल', en: '{used} MB used' },
  'me.usedFree': {
    hi: '{used} MB इस्तेमाल · {free} MB खाली',
    en: '{used} MB used · {free} MB free',
  },
  'me.size': { hi: '{size} MB', en: '{size} MB' },
  'me.removed': { hi: 'हटाया गया', en: 'Removed' },
  'me.notDownloaded': { hi: 'डाउनलोड नहीं', en: 'Not downloaded' },
  'me.recordings': { hi: '{count} रिकॉर्डिंग · {size} MB', en: '{count} recordings · {size} MB' },
  'me.install': { hi: 'फ़ोन पर इंस्टॉल करें', en: 'Install on this phone' },
  'me.switch': { hi: 'प्रोफ़ाइल बदलें', en: 'Switch profile' },
  'me.signOut': { hi: 'साइन आउट', en: 'Sign out' },
  'me.signOutNote': {
    hi: 'आपकी प्रोग्रेस इस फ़ोन में बची रहेगी।',
    en: 'Your progress stays on this phone.',
  },
} satisfies Record<string, Localized>;
