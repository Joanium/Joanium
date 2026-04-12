import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'DictionaryExecutor',
  tools: toolsList,
  handlers: {
    get_definition: async (params, onStage) => {
      const { word: word } = params;
      if (!word?.trim()) throw new Error('Missing required param: word');
      const clean = word.trim().toLowerCase();
      let data;
      onStage(`📖 Looking up "${clean}"…`);
      try {
        data = await safeJson(
          `https://api.dictionaryapi.dev/API/v2/entries/en/${encodeURIComponent(clean)}`,
        );
      } catch {
        return `No dictionary entry found for "${clean}". Check the spelling or try a different form of the word.`;
      }
      if (!Array.isArray(data) || !data.length) return `No entry found for "${clean}".`;
      const entry = data[0],
        lines = [],
        phonetic = entry.phonetic || entry.phonetics?.find((p) => p.text)?.text || '';
      (lines.push(`📖 **${entry.word}** ${phonetic ? `  /${phonetic}/` : ''}`), lines.push(''));
      for (const meaning of (entry.meanings ?? []).slice(0, 4))
        (lines.push(`**${meaning.partOfSpeech}**`),
          meaning.definitions?.slice(0, 3).forEach((def, i) => {
            (lines.push(`  ${i + 1}. ${def.definition}`),
              def.example && lines.push(`     *"${def.example}"*`));
          }),
          meaning.synonyms?.length &&
            lines.push(`  Synonyms: ${meaning.synonyms.slice(0, 6).join(', ')}`),
          meaning.antonyms?.length &&
            lines.push(`  Antonyms: ${meaning.antonyms.slice(0, 6).join(', ')}`),
          lines.push(''));
      return (
        entry.origin && (lines.push(`**Origin:** ${entry.origin}`), lines.push('')),
        lines.push('Source: Free Dictionary API (dictionaryapi.dev)'),
        lines.join('\n')
      );
    },
  },
});
