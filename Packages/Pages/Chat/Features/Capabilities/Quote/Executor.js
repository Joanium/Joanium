import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'QuoteExecutor',
  tools: toolsList,
  handlers: {
    get_quote: async (params, onStage) => {
      const { tag: tag } = params;
      onStage(`💬 Finding a quote${tag ? ` about "${tag}"` : ''}…`);
      try {
        const data = await safeJson('https://zenquotes.io/API/random');
        if (Array.isArray(data) && data[0]?.q) {
          const q = data[0];
          return [
            '💬 Quote',
            '',
            `"${q.q}"`,
            '',
            `— ${q.a}`,
            '',
            'Source: ZenQuotes (zenquotes.io)',
          ].join('\n');
        }
      } catch {}
      try {
        const tagParam = tag ? `&tags=${encodeURIComponent(tag)}` : '',
          data = await safeJson(`https://api.quotable.io/quotes/random?limit=1${tagParam}`);
        if (Array.isArray(data) && data[0]) {
          const q = data[0];
          return [
            '💬 Quote' + (q.tags?.length ? ` (${q.tags.join(', ')})` : ''),
            '',
            `"${q.content}"`,
            '',
            `— ${q.author}`,
            '',
            'Source: Quotable (quotable.io)',
          ].join('\n');
        }
      } catch {}
      return 'Could not fetch a quote right now. Try again in a moment!';
    },
  },
});
