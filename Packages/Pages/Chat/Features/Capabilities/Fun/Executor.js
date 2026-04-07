import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'FunExecutor',
  tools: toolsList,
  handlers: {
    get_random_fact: async (params, onStage) => {
      onStage(`🎲 Getting a random fact…`);

      const data = await safeJson('https://uselessfacts.jsph.pl/API/v2/facts/random?language=en');

      if (!data?.text) {
        return 'Could not fetch a random fact right now. Try again in a moment!';
      }

      return [
        `🎲 Random Fun Fact`,
        ``,
        data.text,
        ``,
        data.source_url ? `🔗 ${data.source_url}` : '',
        `Source: Useless Facts API`,
      ]
        .filter(Boolean)
        .join('\n');
    },

    get_number_fact: async (params, onStage) => {
      const { number, type = 'trivia' } = params;
      if (!number)
        throw new Error('Missing required param: number (e.g. "42", "1969", "3/14" for a date)');

      const validTypes = ['trivia', 'math', 'year', 'date'];
      const factType = validTypes.includes(type) ? type : 'trivia';

      onStage(`🔢 Looking up ${factType} fact for ${number}…`);

      // numbersapi.com — free, no key
      const encoded = encodeURIComponent(number);
      const url = `http://numbersapi.com/${encoded}/${factType}?json`;

      const data = await safeJson(url);

      if (!data?.text) {
        return `No ${factType} fact found for "${number}". Try a different number or type.`;
      }

      const typeIcon =
        {
          trivia: '🎯',
          math: '🔬',
          year: '📅',
          date: '🗓️',
        }[factType] ?? '🔢';

      return [
        `${typeIcon} ${factType.charAt(0).toUpperCase() + factType.slice(1)} Fact — ${data.number ?? number}`,
        ``,
        data.text,
        ``,
        data.found === false ? '⚠️ This is a default fact — try a more common number.' : '',
        `Source: Numbers API (numbersapi.com)`,
      ]
        .filter(Boolean)
        .join('\n');
    },
  },
});
