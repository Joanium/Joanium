import en from './en.js';
import de from './de.js';
import ja from './ja.js';
import ml from './ml.js';
import sv from './sv.js';
import ru from './ru.js';
import ta from './ta.js';
import fr from './fr.js';
import hi from './hi.js';
import nl from './nl.js';
import es from './es.js';
import th from './th.js';
import { LANGUAGES_BY_CODE } from '../Languages.js';

// NOTE: Static ESM imports above must be kept in sync with Languages.js manually.
// PACKS keys must match the codes defined in SUPPORTED_LANGUAGES.
const PACKS = { en, de, ja, ml, sv, ru, ta, fr, hi, nl, es, th };

// Sync, fast: start with cached value before async settings load
let _lang = localStorage.getItem('joanium-lang') || 'en';
if (!(_lang in LANGUAGES_BY_CODE)) _lang = 'en';

/**
 * Translate a dot-notation key with optional variable substitution.
 * Falls back to English pack, then to the raw key string.
 * @param {string} key  e.g. 'settings.saveChanges'
 * @param {Record<string,string>} [vars]  e.g. { name: 'Ollama' }
 */
export function t(key, vars = {}) {
  const resolve = (pack) => key.split('.').reduce((o, k) => o?.[k], pack);
  let str = resolve(PACKS[_lang]) ?? resolve(PACKS.en) ?? key;
  for (const [k, v] of Object.entries(vars)) {
    str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
  }
  return str;
}

export function getLanguage() {
  return _lang;
}

/**
 * Change the active language, persist to localStorage, and broadcast a DOM event.
 * @param {string} lang  'en' | 'de'
 */
export function setLanguage(lang) {
  const next = lang in LANGUAGES_BY_CODE ? lang : 'en';
  if (next === _lang) return;
  _lang = next;
  localStorage.setItem('joanium-lang', _lang);
  window.dispatchEvent(new CustomEvent('ow:language-changed', { detail: { lang: _lang } }));
}

/**
 * Walk the DOM under `root` and apply translations to elements that carry
 * data-i18n / data-i18n-placeholder / data-i18n-title / data-i18n-label attrs.
 * @param {Element} [root]
 */
export function applyI18n(root = document.body) {
  if (!root) return;
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-html]').forEach((el) => {
    // Use sparingly — only for elements that need innerHTML (e.g. entities).
    el.innerHTML = t(el.dataset.i18nHtml);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.placeholder = t(el.dataset.i18nPlaceholder);
  });
  root.querySelectorAll('[data-i18n-title]').forEach((el) => {
    el.title = t(el.dataset.i18nTitle);
  });
  root.querySelectorAll('[data-i18n-label]').forEach((el) => {
    el.setAttribute('aria-label', t(el.dataset.i18nLabel));
  });
}

/**
 * Called once at app boot. Syncs language from main process settings and
 * updates if it differs from the localStorage cache.
 */
export async function initI18n() {
  try {
    const settings = await window.electronAPI?.invoke('get-app-settings');
    if (settings?.app_language && settings.app_language in LANGUAGES_BY_CODE) {
      const serverLang = settings.app_language;
      if (serverLang !== _lang) {
        _lang = serverLang;
        localStorage.setItem('joanium-lang', _lang);
        // Don't fire ow:language-changed here — DOM isn't fully built yet.
        // Main.js calls applyI18n(document.body) after sidebar init.
      }
    }
  } catch {
    // Non-fatal — keep localStorage cached value
  }
}
