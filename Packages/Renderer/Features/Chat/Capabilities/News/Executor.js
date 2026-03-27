const HANDLED = new Set(['get_news', 'search_news']);

// Free RSS feeds by category — no API key required
const CATEGORY_FEEDS = {
  technology: [
    'https://feeds.feedburner.com/TechCrunch',
    'https://www.wired.com/feed/rss',
    'https://www.theverge.com/rss/index.xml',
  ],
  business: [
    'https://feeds.bloomberg.com/markets/news.rss',
    'https://www.cnbc.com/id/100003114/device/rss/rss.html',
    'https://feeds.reuters.com/reuters/businessNews',
  ],
  science: [
    'https://www.sciencedaily.com/rss/all.xml',
    'https://feeds.nature.com/nature/rss/current',
    'https://rss.sciencemag.org/rss/news_current.xml',
  ],
  health: [
    'https://feeds.reuters.com/reuters/healthNews',
    'https://rss.medicalnewstoday.com/featurednews.xml',
  ],
  sports: [
    'https://www.espn.com/espn/rss/news',
    'https://api.foxsports.com/v1/rss?partnerKey=zBaFxRyqKx9jegsfCB8oieFW',
  ],
  entertainment: [
    'https://variety.com/feed/',
    'https://www.rollingstone.com/feed/',
  ],
  world: [
    'https://feeds.reuters.com/Reuters/worldNews',
    'https://rss.nytimes.com/services/xml/rss/nyt/World.xml',
    'https://www.aljazeera.com/xml/rss/all.xml',
  ],
};

// Google News RSS for search queries
function googleNewsUrl(query) {
  return `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
}

function decodeEntities(str) {
  return String(str ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&apos;/g, "'");
}

function extractTag(xml, tag) {
  const m = new RegExp(`<${tag}[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/${tag}>`, 'i').exec(xml);
  return m ? decodeEntities(m[1].replace(/<[^>]+>/g, '').trim()) : '';
}

function extractLink(xml) {
  // Try <link> tag first, then <guid>
  const linkMatch = /<link[^>]*>([^<]+)<\/link>/i.exec(xml)
    || /<link[^>]*href="([^"]+)"/i.exec(xml)
    || /<guid[^>]*>([^<]+)<\/guid>/i.exec(xml);
  return linkMatch ? decodeEntities(linkMatch[1].trim()) : '';
}

async function fetchFeedItems(url, maxCount) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Evelina-NewsReader/1.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return [];
    const xml = await res.text();
    const items = [];
    const itemRe = /<item[^>]*>([\s\S]*?)<\/item>/gi;
    let match;
    while ((match = itemRe.exec(xml)) !== null && items.length < maxCount) {
      const block = match[1];
      const title = extractTag(block, 'title');
      const desc = extractTag(block, 'description')
        || extractTag(block, 'summary')
        || '';
      const link = extractLink(block);
      const pub = extractTag(block, 'pubDate') || extractTag(block, 'published') || '';
      if (title) items.push({ title, description: desc.slice(0, 160), link, published: pub });
    }
    return items;
  } catch {
    return [];
  }
}

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => {}) {
  const count = Math.min(Math.max(1, Number(params.count) || 8), 15);

  if (toolName === 'get_news') {
    const category = (params.category ?? 'technology').toLowerCase();
    const feeds = CATEGORY_FEEDS[category] ?? CATEGORY_FEEDS.technology;
    const categoryLabel = category.charAt(0).toUpperCase() + category.slice(1);

    onStage(`📰 Loading ${categoryLabel} news…`);

    const results = await Promise.allSettled(
      feeds.map(url => fetchFeedItems(url, count))
    );

    const all = results
      .flatMap(r => r.status === 'fulfilled' ? r.value : [])
      .slice(0, count);

    if (!all.length) {
      return `Could not fetch ${categoryLabel} news right now. Try again shortly.`;
    }

    const lines = [`📰 ${categoryLabel} News`, ''];
    all.forEach((item, i) => {
      lines.push(`${i + 1}. **${item.title}**`);
      if (item.description) lines.push(`   ${item.description}`);
      if (item.link) lines.push(`   🔗 ${item.link}`);
      if (item.published) lines.push(`   📅 ${item.published}`);
      lines.push('');
    });
    lines.push(`Source: RSS feeds`);
    return lines.join('\n');
  }

  if (toolName === 'search_news') {
    const { query } = params;
    if (!query?.trim()) throw new Error('Missing required param: query');

    onStage(`📰 Searching news for "${query}"…`);

    const items = await fetchFeedItems(googleNewsUrl(query), count);

    if (!items.length) {
      return `No news found for "${query}". Try different search terms.`;
    }

    const lines = [`📰 News: "${query}"`, ''];
    items.slice(0, count).forEach((item, i) => {
      lines.push(`${i + 1}. **${item.title}**`);
      if (item.description) lines.push(`   ${item.description}`);
      if (item.link) lines.push(`   🔗 ${item.link}`);
      if (item.published) lines.push(`   📅 ${item.published}`);
      lines.push('');
    });
    lines.push(`Source: Google News RSS`);
    return lines.join('\n');
  }

  throw new Error(`NewsExecutor: unknown tool "${toolName}"`);
}
