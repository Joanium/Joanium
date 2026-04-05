export const type = 'rss_feed';
export const meta = { label: 'RSS Feed', group: 'Web' };
export async function collect(ds) {
  if (!ds.url) return 'No RSS feed URL specified.';
  try {
    const xml = await fetch(ds.url, { headers: { 'User-Agent': 'joanium-agent/1.0' } }).then((r) =>
      r.text(),
    );
    const items = [];
    const max = ds.maxResults ?? 10;
    const extractTag = (str, tag) => {
      const m = new RegExp(
        `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
        'i',
      ).exec(str);
      return m ? m[1].replace(/<[^>]+>/g, '').trim() : '';
    };
    const regex = xml.includes('<item')
      ? /<item[^>]*>([\s\S]*?)<\/item>/gi
      : /<entry[^>]*>([\s\S]*?)<\/entry>/gi;
    let match;
    while ((match = regex.exec(xml)) !== null && items.length < max) {
      const title = extractTag(match[1], 'title');
      if (title) items.push(`${items.length + 1}. ${title}`);
    }
    return items.length ? `RSS Feed:\n\n${items.join('\n')}` : 'EMPTY: RSS feed returned no items.';
  } catch (err) {
    return `RSS fetch failed: ${err.message}`;
  }
}
