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
  { code: 'sv', label: 'Swedish', native: 'Svenska (Swedish)' },
  { code: 'ru', label: 'Russian', native: 'Русский (Russian)' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ் (Tamil)' },
  { code: 'fr', label: 'French', native: 'Français (French)' },
  { code: 'hi', label: 'Hindi', native: 'हिन्दी (Hindi)' },
  { code: 'nl', label: 'Dutch', native: 'Nederlands (Dutch)' },
  { code: 'es', label: 'Spanish', native: 'Español (Spanish)' },
  { code: 'th', label: 'Thai', native: 'ภาษาไทย (Thai)' },
  { code: 'ar', label: 'Arabic', native: 'العربية (Arabic)' },
  { code: 'pt', label: 'Portuguese', native: 'Português (Portuguese)' },
  { code: 'it', label: 'Italian', native: 'Italiano (Italian)' },
  { code: 'mr', label: 'Marathi', native: 'मराठी (Marathi)' },
  { code: 'ko', label: 'Korean', native: '한국어 (Korean)' },
];

/** Map of code → language entry for O(1) lookups */
export const LANGUAGES_BY_CODE = Object.fromEntries(SUPPORTED_LANGUAGES.map((l) => [l.code, l]));
