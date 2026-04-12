export const type = 'reddit_posts';
export const meta = { label: 'Reddit', group: 'Web' };
export async function collect(ds) {
  if (!ds.subreddit?.trim()) return 'No subreddit specified.';
  try {
    const data = await fetch(
        `https://www.reddit.com/r/${ds.subreddit}/${ds.sort ?? 'hot'}.json?limit=${Math.min(ds.maxResults ?? 10, 25)}`,
        { headers: { 'User-Agent': 'joanium-agent/1.0' } },
      ).then((r) => r.json()),
      posts = data.data?.children ?? [];
    return posts.length
      ? `r/${ds.subreddit}:\n\n` + posts.map((p, i) => `${i + 1}. ${p.data.title}`).join('\n\n')
      : `EMPTY: r/${ds.subreddit} has no posts.`;
  } catch (err) {
    return `Reddit fetch failed: ${err.message}`;
  }
}
