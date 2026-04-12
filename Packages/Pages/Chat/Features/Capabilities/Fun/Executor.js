import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'FunExecutor',
  tools: toolsList,
  handlers: {
    get_random_fact: async (params, onStage) => {
      onStage('🎲 Getting a random fact…');
      const data = await safeJson('https://uselessfacts.jsph.pl/API/v2/facts/random?language=en');
      return data?.text
        ? [
            '🎲 Random Fun Fact',
            '',
            data.text,
            '',
            data.source_url ? `🔗 ${data.source_url}` : '',
            'Source: Useless Facts API',
          ]
            .filter(Boolean)
            .join('\n')
        : 'Could not fetch a random fact right now. Try again in a moment!';
    },
    get_number_fact: async (params, onStage) => {
      const { number: number, type: type = 'trivia' } = params;
      if (!number)
        throw new Error('Missing required param: number (e.g. "42", "1969", "3/14" for a date)');
      const factType = ['trivia', 'math', 'year', 'date'].includes(type) ? type : 'trivia';
      onStage(`🔢 Looking up ${factType} fact for ${number}…`);
      const url = `http://numbersapi.com/${encodeURIComponent(number)}/${factType}?json`,
        data = await safeJson(url);
      return data?.text
        ? [
            `${{ trivia: '🎯', math: '🔬', year: '📅', date: '🗓️' }[factType] ?? '🔢'} ${factType.charAt(0).toUpperCase() + factType.slice(1)} Fact — ${data.number ?? number}`,
            '',
            data.text,
            '',
            !1 === data.found ? '⚠️ This is a default fact — try a more common number.' : '',
            'Source: Numbers API (numbersapi.com)',
          ]
            .filter(Boolean)
            .join('\n')
        : `No ${factType} fact found for "${number}". Try a different number or type.`;
    },
  },
});
