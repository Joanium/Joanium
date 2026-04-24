/**
 * Single source of truth for supported app languages.
 * Used by AppSettingsService (main) and SettingsModal (renderer).
 * Add a new language here and it propagates everywhere automatically.
 */

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'de', label: 'German', native: 'Deutsch (German)' },
  { code: 'ja', label: 'Japanese', native: '日本語 (Japanese)' },
  { code: 'ml', label: 'Malayalam', native: 'മലയാളം (Malayalam)' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ் (Tamil)' },
];

/** Map of code → language entry for O(1) lookups */
export const LANGUAGES_BY_CODE = Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l.code, l]));
