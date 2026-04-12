import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'PhotoExecutor',
  tools: toolsList,
  handlers: {
    search_photos: async (params, onStage) => {
      const { query: query, count: count = 10, orientation: orientation } = params;
      if (!query) throw new Error('Missing required param: query');
      let apiKey = '';
      try {
        const config = await window.electronAPI?.invoke?.('get-free-connector-config', 'unsplash');
        apiKey = config?.credentials?.apiKey?.trim() ?? '';
      } catch {}
      if (!apiKey)
        return [
          'Unsplash photo search requires an API key.',
          '',
          'To set up:',
          '1. Go to unsplash.com/developers',
          '2. Create a free account and register an app',
          '3. Copy your Access Key',
          '4. In Joanium: Settings → Connectors → Unsplash → Add key',
          '',
          'The free tier allows 50 requests/hour.',
        ].join('\n');
      onStage(`📷 Searching Unsplash for "${query}"…`);
      const perPage = Math.min(Math.max(Number(count) || 10, 1), 30),
        orientParam = orientation ? `&orientation=${orientation}` : '',
        data = await safeJson(
          `https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=${perPage}${orientParam}`,
          { headers: { Authorization: `Client-ID ${apiKey}` } },
        );
      if (!data.results?.length)
        return `No photos found for "${query}" on Unsplash. Try different keywords.`;
      const photos = data.results.map((p) => ({
        id: p.id,
        description: p.description || p.alt_description || 'Photo',
        thumb: p.urls?.thumb,
        small: p.urls?.small,
        regular: p.urls?.regular,
        full: p.urls?.full,
        pageUrl: p.links?.html,
        photographer: p.user?.name ?? 'Unknown',
        photographerUsername: p.user?.username ?? '',
        photographerUrl: p.user?.links?.html ?? `https://unsplash.com/@${p.user?.username ?? ''}`,
        likes: p.likes ?? 0,
        width: p.width,
        height: p.height,
      }));
      return `[PHOTO_RESULT]${JSON.stringify({ query: query, total: data.total ?? photos.length, photos: photos })}`;
    },
  },
});
