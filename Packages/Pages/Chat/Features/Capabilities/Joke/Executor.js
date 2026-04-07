import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'JokeExecutor',
  tools: toolsList,
  handlers: {
    get_joke: async (params, onStage) => {
      const { category } = params;
      onStage(`😂 Getting a joke…`);

      const validCats = ['programming', 'misc', 'dark', 'pun', 'spooky', 'christmas'];
      const cat =
        category && validCats.includes(category.toLowerCase()) ? category.toLowerCase() : 'Any';

      // JokeAPI v2 — free, no key
      const data = await safeJson(
        `https://v2.jokeapi.dev/joke/${cat}?blacklistFlags=nsfw,racist,sexist&type=single,twopart`,
      );

      if (data.error) {
        return `Couldn't fetch a joke: ${data.message ?? 'Unknown error'}. Try again!`;
      }

      if (data.type === 'single') {
        return [
          `😂 Joke${data.category ? ` (${data.category})` : ''}`,
          ``,
          data.joke,
          ``,
          `Source: JokeAPI (v2.jokeapi.dev)`,
        ].join('\n');
      }

      // Two-part joke
      return [
        `😂 Joke${data.category ? ` (${data.category})` : ''}`,
        ``,
        data.setup,
        ``,
        `> ${data.delivery}`,
        ``,
        `Source: JokeAPI (v2.jokeapi.dev)`,
      ].join('\n');
    },
  },
});
