import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'HackerNewsExecutor',
  tools: toolsList,
  handlers: {
    get_hacker_news: async (params, onStage) => {
      const { count: count = 5, type: type = 'top' } = params,
        max = Math.min(Math.max(count, 1), 15),
        endpoint =
          { top: 'topstories', new: 'newstories', best: 'beststories', ask: 'askstories' }[type] ??
          'topstories';
      onStage(`🔶 Fetching ${type} Hacker News stories…`);
      const ids = await safeJson(`https://hacker-news.firebaseio.com/v0/${endpoint}.json`);
      if (!Array.isArray(ids) || !ids.length)
        return 'Could not fetch Hacker News stories right now. Try again later.';
      const topIds = ids.slice(0, max);
      onStage(`📖 Loading ${topIds.length} stories…`);
      const storyLines = (
        await Promise.all(
          topIds.map((id) =>
            safeJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`).catch(() => null),
          ),
        )
      )
        .filter(Boolean)
        .map((s, i) => {
          const points = s.score ? `⬆ ${s.score}` : '',
            comments = null != s.descendants ? `💬 ${s.descendants}` : '',
            by = s.by ? `by ${s.by}` : '',
            time = s.time ? new Date(1e3 * s.time).toLocaleDateString() : '',
            url = s.url || `https://news.ycombinator.com/item?id=${s.id}`,
            hnLink = `https://news.ycombinator.com/item?id=${s.id}`;
          return [
            `${i + 1}. **${s.title}**`,
            `   ${[points, comments, by, time].filter(Boolean).join(' · ')}`,
            `   🔗 ${url}`,
            s.url ? `   💬 ${hnLink}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n');
      return [
        `🔶 Hacker News — ${type.charAt(0).toUpperCase() + type.slice(1)} Stories`,
        '',
        storyLines,
        '',
        'Source: Hacker News (news.ycombinator.com)',
      ].join('\n');
    },
  },
});
