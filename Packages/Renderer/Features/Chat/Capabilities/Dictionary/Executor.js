import { safeJson } from '../Shared/Utils.js';

const HANDLED = new Set(['get_definition']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => {}) {
  if (toolName !== 'get_definition') throw new Error(`DictionaryExecutor: unknown tool "${toolName}"`);

  const { word } = params;
  if (!word?.trim()) throw new Error('Missing required param: word');

  const clean = word.trim().toLowerCase();
  onStage(`📖 Looking up "${clean}"…`);

  // Free Dictionary API — no key, no rate limit
  let data;
  try {
    data = await safeJson(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(clean)}`);
  } catch {
    return `No dictionary entry found for "${clean}". Check the spelling or try a different form of the word.`;
  }

  if (!Array.isArray(data) || !data.length) {
    return `No entry found for "${clean}".`;
  }

  const entry = data[0];
  const lines = [];

  // Word + phonetic
  const phonetic = entry.phonetic
    || entry.phonetics?.find(p => p.text)?.text
    || '';
  lines.push(`📖 **${entry.word}** ${phonetic ? `  /${phonetic}/` : ''}`);
  lines.push('');

  // Meanings
  for (const meaning of (entry.meanings ?? []).slice(0, 4)) {
    lines.push(`**${meaning.partOfSpeech}**`);

    meaning.definitions?.slice(0, 3).forEach((def, i) => {
      lines.push(`  ${i + 1}. ${def.definition}`);
      if (def.example) lines.push(`     *"${def.example}"*`);
    });

    if (meaning.synonyms?.length) {
      lines.push(`  Synonyms: ${meaning.synonyms.slice(0, 6).join(', ')}`);
    }
    if (meaning.antonyms?.length) {
      lines.push(`  Antonyms: ${meaning.antonyms.slice(0, 6).join(', ')}`);
    }

    lines.push('');
  }

  // Etymology
  if (entry.origin) {
    lines.push(`**Origin:** ${entry.origin}`);
    lines.push('');
  }

  lines.push(`Source: Free Dictionary API (dictionaryapi.dev)`);
  return lines.join('\n');
}
