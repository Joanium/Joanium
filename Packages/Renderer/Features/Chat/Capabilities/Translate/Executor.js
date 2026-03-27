import { safeJson } from '../Shared/Utils.js';

const HANDLED = new Set(['translate_text']);

const LANGUAGE_NAMES = {
  en: 'English', es: 'Spanish', fr: 'French', de: 'German', it: 'Italian',
  pt: 'Portuguese', ru: 'Russian', ja: 'Japanese', zh: 'Chinese', ko: 'Korean',
  ar: 'Arabic', hi: 'Hindi', nl: 'Dutch', pl: 'Polish', tr: 'Turkish',
  sv: 'Swedish', da: 'Danish', no: 'Norwegian', fi: 'Finnish', cs: 'Czech',
  ro: 'Romanian', hu: 'Hungarian', uk: 'Ukrainian', el: 'Greek', he: 'Hebrew',
  th: 'Thai', vi: 'Vietnamese', id: 'Indonesian', ms: 'Malay', fa: 'Persian',
  bn: 'Bengali', ta: 'Tamil', ur: 'Urdu', sw: 'Swahili', tl: 'Filipino',
};

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => {}) {
  if (toolName !== 'translate_text') throw new Error(`TranslateExecutor: unknown tool "${toolName}"`);

  const { text, to, from = 'en' } = params;
  if (!text?.trim()) throw new Error('Missing required param: text');
  if (!to?.trim()) throw new Error('Missing required param: to (target language code)');

  const sourceLang = from === 'auto' ? 'autodetect' : from.trim().toLowerCase();
  const targetLang = to.trim().toLowerCase();
  const sourceName = LANGUAGE_NAMES[sourceLang] ?? sourceLang.toUpperCase();
  const targetName = LANGUAGE_NAMES[targetLang] ?? targetLang.toUpperCase();

  onStage(`🌐 Translating to ${targetName}…`);

  const langPair = sourceLang === 'autodetect'
    ? `autodetect|${targetLang}`
    : `${sourceLang}|${targetLang}`;

  // MyMemory — free, no key, 500 words/day per IP (5000 with email)
  const data = await safeJson(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.trim())}&langpair=${encodeURIComponent(langPair)}`
  );

  if (data.responseStatus !== 200 && data.responseStatus !== '200') {
    const err = data.responseDetails ?? 'Translation failed';
    return `Translation error: ${err}. Check the language code and try again.\n\nCommon codes: en, es, fr, de, ja, zh, ar, hi, pt, ru, ko, it, nl`;
  }

  const translated = data.responseData?.translatedText;
  if (!translated || translated === text) {
    return `Could not translate the text. The languages may not be supported or the text is already in the target language.`;
  }

  const confidence = data.responseData?.match;
  const confidenceLabel = confidence != null ? ` (${Math.round(confidence * 100)}% confidence)` : '';

  const lines = [
    `🌐 Translation${confidenceLabel}`,
    '',
    `**From (${sourceName}):**`,
    text.trim(),
    '',
    `**To (${targetName}):**`,
    translated,
    '',
    `Source: MyMemory Translation (mymemory.translated.net)`,
  ];

  return lines.join('\n');
}
