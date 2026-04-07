import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'WikiExecutor',
  tools: toolsList,
  handlers: {
    search_wikipedia: async (params, onStage) => {
      const { query } = params;
      if (!query) throw new Error('Missing required param: query');
      onStage(`📚 Searching Wikipedia for "${query}"…`);

      // Use Wikipedia REST API — no key required
      const encoded = encodeURIComponent(query);
      let data;
      try {
        data = await safeJson(
          `https://en.wikipedia.org/API/rest_v1/page/summary/${encoded}?redirect=true`,
        );
      } catch {
        // If direct lookup fails, try search endpoint
        onStage(`🔍 Trying Wikipedia search…`);
        const searchData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json`,
        );
        const title = searchData?.[1]?.[0];
        if (!title) {
          return `No Wikipedia article found for "${query}". Try a more specific or common term.`;
        }
        data = await safeJson(
          `https://en.wikipedia.org/API/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
        );
      }

      if (data.type === 'disambiguation') {
        return [
          `📚 "${data.title}" — Disambiguation Page`,
          ``,
          data.extract ?? 'Multiple topics match this term.',
          ``,
          `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`}`,
          ``,
          `Try being more specific (e.g. "${query} (film)" or "${query} (science)").`,
          `Source: Wikipedia`,
        ].join('\n');
      }

      if (!data.extract) {
        return `No Wikipedia article found for "${query}". Try a different search term.`;
      }

      const lines = [`📚 ${data.title}`, ``];

      if (data.description) {
        lines.push(`*${data.description}*`, ``);
      }

      lines.push(
        data.extract,
        ``,
        `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`}`,
        `Source: Wikipedia`,
      );

      return lines.join('\n');
    },
  },
});
