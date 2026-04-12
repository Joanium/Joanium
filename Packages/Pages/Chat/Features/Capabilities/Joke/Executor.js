import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'JokeExecutor',
  tools: toolsList,
  handlers: {
    get_joke: async (params, onStage) => {
      const { category: category } = params;
      onStage('😂 Getting a joke…');
      const cat =
          category &&
          ['programming', 'misc', 'dark', 'pun', 'spooky', 'christmas'].includes(
            category.toLowerCase(),
          )
            ? category.toLowerCase()
            : 'Any',
        data = await safeJson(
          `https://v2.jokeapi.dev/joke/${cat}?blacklistFlags=nsfw,racist,sexist&type=single,twopart`,
        );
      return data.error
        ? `Couldn't fetch a joke: ${data.message ?? 'Unknown error'}. Try again!`
        : 'single' === data.type
          ? [
              '😂 Joke' + (data.category ? ` (${data.category})` : ''),
              '',
              data.joke,
              '',
              'Source: JokeAPI (v2.jokeapi.dev)',
            ].join('\n')
          : [
              '😂 Joke' + (data.category ? ` (${data.category})` : ''),
              '',
              data.setup,
              '',
              `> ${data.delivery}`,
              '',
              'Source: JokeAPI (v2.jokeapi.dev)',
            ].join('\n');
    },
  },
});
