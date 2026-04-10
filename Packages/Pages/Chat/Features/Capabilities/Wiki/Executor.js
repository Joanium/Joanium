import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
import { resolveTitle, fmt } from './Utils.js';

export const { handles, execute } = createExecutor({
  name: 'WikiExecutor',
  tools: toolsList,
  handlers: {
    search_wikipedia: async (params, onStage) => {
      const { query } = params;
      if (!query) throw new Error('Missing required param: query');
      onStage(`📚 Searching Wikipedia for "${query}"…`);

      const encoded = encodeURIComponent(query);
      let data;
      try {
        data = await safeJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`,
        );
      } catch {
        onStage(`🔍 Trying Wikipedia search…`);
        const searchData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json&origin=*`,
        );
        const title = searchData?.[1]?.[0];
        if (!title) {
          return `No Wikipedia article found for "${query}". Try a more specific or common term.`;
        }
        data = await safeJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
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
      if (data.description) lines.push(`*${data.description}*`, ``);
      lines.push(
        data.extract,
        ``,
        `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`}`,
        `Source: Wikipedia`,
      );
      return lines.join('\n');
    },

    get_wikipedia_sections: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📑 Fetching sections for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=sections&format=json&origin=*`,
      );

      const sections = data?.parse?.sections;
      if (!sections || sections.length === 0) {
        return `No sections found for "${resolved}". The article may be very short or missing.`;
      }

      const lines = [`📑 Sections of "${data.parse.title}"`, ``];
      sections.forEach((s) => {
        const indent = '  '.repeat(Math.max(0, parseInt(s.toclevel, 10) - 1));
        lines.push(`${indent}${s.number}. ${s.line.replace(/<[^>]+>/g, '')}`);
      });
      lines.push(``, `🔗 https://en.wikipedia.org/wiki/${encoded}`, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_section_content: async (params, onStage) => {
      const { title, section } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!section) throw new Error('Missing required param: section');
      onStage(`📖 Fetching section "${section}" from "${title}"…`);

      const resolved = await resolveTitle(title);
      const encodedTitle = encodeURIComponent(resolved);

      const parseData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=sections&format=json&origin=*`,
      );
      const sections = parseData?.parse?.sections ?? [];
      const match = sections.find(
        (s) => s.line.replace(/<[^>]+>/g, '').toLowerCase() === section.toLowerCase(),
      );

      if (!match) {
        const available = sections.map((s) => s.line.replace(/<[^>]+>/g, '')).join(', ');
        return `Section "${section}" not found in "${resolved}".\n\nAvailable sections: ${available || 'none'}`;
      }

      const contentData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=wikitext&section=${match.index}&format=json&origin=*`,
      );

      let text = contentData?.parse?.wikitext?.['*'] ?? '';
      text = text
        .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
        .replace(/\{\{[^}]+\}\}/g, '')
        .replace(/'{2,3}/g, '')
        .replace(/==+[^=]+=+/g, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (!text) return `The section "${section}" in "${resolved}" appears to be empty.`;

      return [
        `📖 ${resolved} — ${section}`,
        ``,
        text,
        ``,
        `🔗 https://en.wikipedia.org/wiki/${encodedTitle}#${encodeURIComponent(match.anchor)}`,
        `Source: Wikipedia`,
      ].join('\n');
    },

    get_wikipedia_search_results: async (params, onStage) => {
      const { query, limit = 5 } = params;
      if (!query) throw new Error('Missing required param: query');
      onStage(`🔍 Searching Wikipedia for "${query}"…`);

      const cap = Math.min(Number(limit) || 5, 10);
      const encoded = encodeURIComponent(query);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=${cap}&srprop=snippet|titlesnippet&format=json&origin=*`,
      );

      const results = data?.query?.search ?? [];
      if (results.length === 0) return `No Wikipedia results found for "${query}".`;

      const lines = [`🔍 Wikipedia search results for "${query}"`, ``];
      results.forEach((r, i) => {
        const snippet = r.snippet.replace(/<[^>]+>/g, '').trim();
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`;
        lines.push(`${i + 1}. **${r.title}**`);
        lines.push(`   ${snippet}`);
        lines.push(`   🔗 ${url}`);
        lines.push(``);
      });
      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_full_article: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📄 Fetching full article for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extracts&explaintext=true&exsectionformat=plain&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      if (!page || page.missing !== undefined) {
        return `No Wikipedia article found for "${title}".`;
      }

      const text = (page.extract ?? '').trim();
      if (!text) return `The article "${resolved}" has no extractable text.`;

      const url = `https://en.wikipedia.org/wiki/${encoded}`;
      return [`📄 ${page.title}`, ``, text, ``, `🔗 ${url}`, `Source: Wikipedia`].join('\n');
    },

    get_wikipedia_categories: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🏷️ Fetching categories for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=categories&cllimit=50&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const cats = (page?.categories ?? [])
        .map((c) => c.title.replace(/^Category:/, ''))
        .filter(
          (c) => !c.startsWith('Articles ') && !c.startsWith('CS1') && !c.startsWith('Webarchive'),
        );

      if (cats.length === 0) return `No categories found for "${resolved}".`;

      const lines = [`🏷️ Categories for "${page.title || resolved}"`, ``];
      cats.forEach((c) => lines.push(`• ${c}`));
      lines.push(``, `🔗 https://en.wikipedia.org/wiki/${encoded}`, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_languages: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🌐 Fetching available languages for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=langlinks&lllimit=500&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const langs = page?.langlinks ?? [];

      if (langs.length === 0) return `No other language versions found for "${resolved}".`;

      const lines = [`🌐 "${resolved}" is available in ${langs.length} languages`, ``];
      langs.forEach((l) => lines.push(`• [${l.lang}] ${l['*']}`));
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_article_in_language: async (params, onStage) => {
      const { title, lang } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!lang) throw new Error('Missing required param: lang');
      onStage(`🌍 Fetching "${title}" in language "${lang}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const linkData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=langlinks&lllang=${lang}&format=json&origin=*`,
      );
      const pages = linkData?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const localTitle = page?.langlinks?.[0]?.['*'] ?? resolved;
      const localEncoded = encodeURIComponent(localTitle);

      const data = await safeJson(
        `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${localEncoded}?redirect=true`,
      );

      if (!data?.extract) {
        return `No "${lang}" Wikipedia article found for "${title}". The article may not exist in that language.`;
      }

      return [
        `🌍 ${data.title} [${lang.toUpperCase()}]`,
        ``,
        data.description ? `*${data.description}*\n` : '',
        data.extract,
        ``,
        `🔗 ${data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${localEncoded}`}`,
        `Source: Wikipedia (${lang})`,
      ].join('\n');
    },

    get_wikipedia_images: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🖼️ Fetching images for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=images&imlimit=20&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const images = (page?.images ?? []).filter((img) =>
        /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(img.title),
      );

      if (images.length === 0) return `No images found for "${resolved}".`;

      const imgTitles = images.map((i) => i.title).join('|');
      const infoData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(imgTitles)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`,
      );

      const infoPages = Object.values(infoData?.query?.pages ?? {});
      const lines = [`🖼️ Images in "${resolved}"`, ``];

      infoPages.forEach((p) => {
        const info = p.imageinfo?.[0];
        if (!info?.url) return;
        const caption = info.extmetadata?.ImageDescription?.value?.replace(/<[^>]+>/g, '').trim();
        const name = p.title.replace(/^File:/, '');
        lines.push(`• ${name}`);
        if (caption) lines.push(`  Caption: ${caption}`);
        lines.push(`  🔗 ${info.url}`);
        lines.push(``);
      });

      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_linked_articles: async (params, onStage) => {
      const { title, limit = 20 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔗 Fetching links in "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);
      const cap = Math.min(Number(limit) || 20, 50);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=links&pllimit=${cap}&plnamespace=0&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const links = page?.links ?? [];

      if (links.length === 0) return `No linked articles found in "${resolved}".`;

      const lines = [`🔗 Articles linked from "${resolved}" (showing up to ${cap})`, ``];
      links.forEach((l) => {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(l.title.replace(/ /g, '_'))}`;
        lines.push(`• ${l.title} — ${url}`);
      });
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_random_article: async (_params, onStage) => {
      onStage(`🎲 Fetching a random Wikipedia article…`);

      const data = await safeJson(`https://en.wikipedia.org/api/rest_v1/page/random/summary`);

      if (!data?.extract) return `Couldn't retrieve a random article right now. Please try again.`;

      const lines = [`🎲 Random Article: ${data.title}`, ``];
      if (data.description) lines.push(`*${data.description}*`, ``);
      lines.push(data.extract, ``, `🔗 ${data.content_urls?.desktop?.page}`, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_featured_article: async (_params, onStage) => {
      onStage(`⭐ Fetching today's Wikipedia featured article…`);

      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');

      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
      );

      const tfa = data?.tfa;
      if (!tfa) return `No featured article found for today (${y}-${m}-${d}).`;

      const lines = [`⭐ Today's Featured Article: ${tfa.title}`, ``];
      if (tfa.description) lines.push(`*${tfa.description}*`, ``);
      if (tfa.extract) lines.push(tfa.extract, ``);
      lines.push(
        `🔗 ${tfa.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(tfa.title)}`}`,
        `Source: Wikipedia`,
      );
      return lines.join('\n');
    },

    get_wikipedia_on_this_day: async (params, onStage) => {
      const { month, day, type = 'all' } = params;
      if (!month) throw new Error('Missing required param: month');
      if (!day) throw new Error('Missing required param: day');
      onStage(`📅 Fetching "On This Day" for ${month}/${day}…`);

      const m = String(month).padStart(2, '0');
      const d = String(day).padStart(2, '0');

      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${m}/${d}`,
      );

      const lines = [`📅 On This Day — ${m}/${d}`, ``];
      const addSection = (label, emoji, items) => {
        if (!items || items.length === 0) return;
        lines.push(`${emoji} **${label}**`, ``);
        items.slice(0, 5).forEach((item) => {
          const year = item.year != null ? `${item.year}: ` : '';
          lines.push(`• ${year}${item.text}`);
        });
        lines.push(``);
      };

      if (type === 'all' || type === 'events') addSection('Events', '🏛️', data?.events);
      if (type === 'all' || type === 'births') addSection('Births', '🎂', data?.births);
      if (type === 'all' || type === 'deaths') addSection('Deaths', '✝️', data?.deaths);

      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_most_read: async (params, onStage) => {
      const { limit = 10 } = params;
      let { date } = params;
      onStage(`📈 Fetching most-read Wikipedia articles…`);

      if (!date) {
        const yesterday = new Date();
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        date = yesterday.toISOString().slice(0, 10);
      }

      const [y, m, d] = date.split('-');
      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
      );

      const articles = data?.mostread?.articles ?? [];
      if (articles.length === 0) return `No most-read data found for ${date}.`;

      const cap = Math.min(Number(limit) || 10, articles.length);
      const lines = [`📈 Most-Read Wikipedia Articles on ${date}`, ``];

      articles.slice(0, cap).forEach((a, i) => {
        const views = fmt(a.views ?? 0);
        const url =
          a.content_urls?.desktop?.page ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(a.title)}`;
        lines.push(`${i + 1}. **${a.title}** — ${views} views`);
        if (a.description) lines.push(`   *${a.description}*`);
        lines.push(`   🔗 ${url}`, ``);
      });

      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_page_views: async (params, onStage) => {
      const { title, start, end } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!start) throw new Error('Missing required param: start');
      if (!end) throw new Error('Missing required param: end');
      onStage(`📊 Fetching page views for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved.replace(/ /g, '_'));

      const data = await safeJson(
        `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encoded}/daily/${start}/${end}`,
      );

      const items = data?.items ?? [];
      if (items.length === 0)
        return `No page view data found for "${resolved}" between ${start} and ${end}.`;

      const total = items.reduce((sum, i) => sum + (i.views ?? 0), 0);
      const peak = items.reduce((best, i) => (i.views > best.views ? i : best), items[0]);

      const lines = [
        `📊 Page Views for "${resolved}"`,
        `Period: ${start} → ${end}`,
        ``,
        `Total views: ${fmt(total)}`,
        `Daily average: ${fmt(Math.round(total / items.length))}`,
        `Peak day: ${peak.timestamp?.slice(0, 8)} with ${fmt(peak.views)} views`,
        ``,
        `Daily breakdown:`,
      ];
      items.forEach((i) => {
        const dateStr = i.timestamp?.slice(0, 8) ?? '?';
        lines.push(`  ${dateStr}: ${fmt(i.views)}`);
      });
      lines.push(``, `Source: Wikimedia Analytics`);
      return lines.join('\n');
    },

    get_wikipedia_did_you_know: async (_params, onStage) => {
      onStage(`💡 Fetching "Did You Know" facts from Wikipedia…`);

      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');

      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
      );

      const dyks = data?.dyk ?? null;

      if (dyks && dyks.length > 0) {
        const lines = [`💡 Did You Know — Wikipedia`, ``];
        dyks.slice(0, 5).forEach((item) => {
          lines.push(`• ${item.text ?? item}`);
        });
        lines.push(``, `Source: Wikipedia`);
        return lines.join('\n');
      }

      const mpData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=Template:Did_you_know/Queue/1&prop=revisions&rvprop=content&format=json&origin=*`,
      );
      const pages = Object.values(mpData?.query?.pages ?? {});
      let wikitext = pages[0]?.revisions?.[0]?.['*'] ?? '';
      const hooks = [...wikitext.matchAll(/\.\.\.(that [^?]+\?)/gi)].map((m) =>
        m[1]
          .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
          .replace(/'{2,3}/g, '')
          .trim(),
      );

      if (hooks.length === 0) {
        return `💡 Could not retrieve "Did You Know" facts at this time. Visit https://en.wikipedia.org for the latest.`;
      }

      const lines = [`💡 Did You Know — Wikipedia`, ``];
      hooks.slice(0, 5).forEach((h) => lines.push(`• …${h}`));
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_nearby_articles: async (params, onStage) => {
      const { lat, lon, limit = 10 } = params;
      if (lat == null) throw new Error('Missing required param: lat');
      if (lon == null) throw new Error('Missing required param: lon');
      onStage(`📍 Finding Wikipedia articles near (${lat}, ${lon})…`);

      const cap = Math.min(Number(limit) || 10, 20);
      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=${cap}&format=json&origin=*`,
      );

      const results = data?.query?.geosearch ?? [];
      if (results.length === 0) {
        return `No Wikipedia articles found within 10 km of (${lat}, ${lon}).`;
      }

      const lines = [`📍 Wikipedia Articles Near (${lat}, ${lon})`, ``];
      results.forEach((r) => {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`;
        const dist = r.dist != null ? ` — ${Math.round(r.dist)} m away` : '';
        lines.push(`• **${r.title}**${dist}`);
        lines.push(`  🔗 ${url}`);
        lines.push(``);
      });
      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_revision_history: async (params, onStage) => {
      const { title, limit = 10 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🕓 Fetching revision history for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);
      const cap = Math.min(Number(limit) || 10, 20);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=timestamp|user|comment|size&rvlimit=${cap}&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const revisions = page?.revisions ?? [];

      if (revisions.length === 0) return `No revision history found for "${resolved}".`;

      const lines = [
        `🕓 Recent Revisions for "${page.title || resolved}" (latest ${revisions.length})`,
        ``,
      ];

      revisions.forEach((r, i) => {
        const ts = new Date(r.timestamp).toUTCString();
        const comment = r.comment ? `"${r.comment}"` : '(no summary)';
        const size = r.size != null ? ` | ${fmt(r.size)} bytes` : '';
        lines.push(`${i + 1}. ${ts}`);
        lines.push(`   Editor: ${r.user || 'anonymous'}${size}`);
        lines.push(`   Summary: ${comment}`);
        lines.push(``);
      });

      lines.push(
        `🔗 https://en.wikipedia.org/w/index.php?title=${encoded}&action=history`,
        `Source: Wikipedia`,
      );
      return lines.join('\n');
    },

    get_wikipedia_disambiguation: async (params, onStage) => {
      const { term } = params;
      if (!term) throw new Error('Missing required param: term');
      onStage(`🔀 Fetching disambiguation options for "${term}"…`);

      const encoded = encodeURIComponent(term);
      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}_(disambiguation)?redirect=false`,
      ).catch(() => null);

      if (data?.type === 'disambiguation' || data?.extract) {
        const linkData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(data.title)}&prop=links&pllimit=30&plnamespace=0&format=json&origin=*`,
        );
        const pages = Object.values(linkData?.query?.pages ?? {});
        const links = pages[0]?.links ?? [];

        const lines = [`🔀 Disambiguation: "${term}"`, ``, data.extract ?? '', ``];
        if (links.length > 0) {
          lines.push(`Possible meanings:`, ``);
          links.forEach((l) => {
            const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(l.title.replace(/ /g, '_'))}`;
            lines.push(`• ${l.title} — ${url}`);
          });
        }
        lines.push(``, `Source: Wikipedia`);
        return lines.join('\n');
      }

      const searchData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=8&format=json&origin=*`,
      );
      const titles = searchData?.[1] ?? [];
      const urls = searchData?.[3] ?? [];

      if (titles.length === 0) return `No disambiguation results found for "${term}".`;

      const lines = [`🔀 Wikipedia results for "${term}"`, ``];
      titles.forEach((t, i) => lines.push(`• ${t} — ${urls[i] ?? ''}`));
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    compare_wikipedia_articles: async (params, onStage) => {
      const { topic_a, topic_b } = params;
      if (!topic_a) throw new Error('Missing required param: topic_a');
      if (!topic_b) throw new Error('Missing required param: topic_b');
      onStage(`⚖️ Fetching summaries for "${topic_a}" and "${topic_b}"…`);

      const fetchSummary = async (query) => {
        const encoded = encodeURIComponent(query);
        try {
          return await safeJson(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`,
          );
        } catch {
          const search = await safeJson(
            `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json&origin=*`,
          );
          const title = search?.[1]?.[0];
          if (!title) return null;
          return safeJson(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
          );
        }
      };

      const [dataA, dataB] = await Promise.all([fetchSummary(topic_a), fetchSummary(topic_b)]);

      const lines = [`⚖️ Wikipedia Comparison`, ``];

      const addEntry = (label, data) => {
        if (!data || !data.extract) {
          lines.push(`### ❌ ${label}`, `No article found.`, ``);
          return;
        }
        lines.push(`### 📚 ${data.title}`);
        if (data.description) lines.push(`*${data.description}*`);
        lines.push(``, data.extract, ``);
        lines.push(`🔗 ${data.content_urls?.desktop?.page}`, ``);
      };

      addEntry(topic_a, dataA);
      lines.push(`${'─'.repeat(60)}`, ``);
      addEntry(topic_b, dataB);
      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_references: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📎 Fetching references for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=externallinks&format=json&origin=*`,
      );

      const links = data?.parse?.externallinks ?? [];
      const refs = links.filter(
        (l) => !l.includes('wikimedia.org') && !l.includes('wikipedia.org'),
      );

      if (refs.length === 0) return `No external references found for "${resolved}".`;

      const lines = [
        `📎 References in "${data.parse.title || resolved}" (${refs.length} found)`,
        ``,
      ];
      refs.slice(0, 30).forEach((r, i) => lines.push(`${i + 1}. ${r}`));
      if (refs.length > 30) lines.push(``, `…and ${refs.length - 30} more.`);
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_backlinks: async (params, onStage) => {
      const { title, limit = 20 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔙 Fetching backlinks to "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);
      const cap = Math.min(Number(limit) || 20, 50);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=backlinks&bltitle=${encoded}&bllimit=${cap}&blnamespace=0&format=json&origin=*`,
      );

      const links = data?.query?.backlinks ?? [];
      if (links.length === 0) return `No backlinks found for "${resolved}".`;

      const lines = [`🔙 Articles linking to "${resolved}" (showing up to ${cap})`, ``];
      links.forEach((l) => {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(l.title.replace(/ /g, '_'))}`;
        lines.push(`• ${l.title} — ${url}`);
      });
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_contributors: async (params, onStage) => {
      const { title, limit = 15 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`👥 Fetching top contributors for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);
      const cap = Math.min(Number(limit) || 15, 50);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=contributors&pclimit=${cap}&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const contributors = page?.contributors ?? [];
      const anonCount = page?.anoncontributors ?? 0;

      if (contributors.length === 0) return `No contributor data found for "${resolved}".`;

      const lines = [
        `👥 Top Contributors to "${page.title || resolved}"`,
        `(${fmt(contributors.length)} named + ${fmt(anonCount)} anonymous contributors shown)`,
        ``,
      ];
      contributors.forEach((c, i) => {
        const profile = `https://en.wikipedia.org/wiki/User:${encodeURIComponent(c.name)}`;
        lines.push(`${i + 1}. ${c.name} — ${profile}`);
      });
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_external_links: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🌐 Fetching external links in "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extlinks&ellimit=50&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const links = page?.extlinks ?? [];

      if (links.length === 0) return `No external links found in "${resolved}".`;

      const lines = [`🌐 External Links in "${page.title || resolved}"`, ``];
      links.forEach((l, i) => lines.push(`${i + 1}. ${l['*']}`));
      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_infobox: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📋 Extracting infobox from "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&origin=*`,
      );

      const wikitext = data?.parse?.wikitext?.['*'] ?? '';
      const infoboxMatch = wikitext.match(/\{\{[Ii]nfobox[\s\S]*?(?=\n\}\})/);
      if (!infoboxMatch) {
        return `No infobox found in "${resolved}". This article may not have one.`;
      }

      const raw = infoboxMatch[0];
      const rows = raw.split('\n').filter((l) => l.startsWith('|') && l.includes('='));
      const lines = [`📋 Infobox — "${data.parse.title || resolved}"`, ``];

      rows.forEach((row) => {
        const eqIdx = row.indexOf('=');
        if (eqIdx === -1) return;
        const key = row.slice(1, eqIdx).trim();
        const val = row
          .slice(eqIdx + 1)
          .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
          .replace(/\{\{[^}]+\}\}/g, '')
          .replace(/<[^>]+>/g, '')
          .replace(/'{2,3}/g, '')
          .trim();
        if (key && val) lines.push(`• ${key}: ${val}`);
      });

      lines.push(``, `🔗 https://en.wikipedia.org/wiki/${encoded}`, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_article_stats: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📊 Computing stats for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=size|timestamp&rvlimit=1&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      if (!page || page.missing !== undefined) return `No article found for "${title}".`;

      const bytes = page?.revisions?.[0]?.size ?? 0;
      const approxWords = Math.round(bytes / 6);
      const readingMins = Math.max(1, Math.round(approxWords / 200));
      const lastEdit = page?.revisions?.[0]?.timestamp
        ? new Date(page.revisions[0].timestamp).toUTCString()
        : 'Unknown';

      const lines = [
        `📊 Article Stats — "${page.title || resolved}"`,
        ``,
        `• Size: ${fmt(bytes)} bytes`,
        `• Estimated words: ~${fmt(approxWords)}`,
        `• Estimated reading time: ~${readingMins} min`,
        `• Last edited: ${lastEdit}`,
        ``,
        `🔗 https://en.wikipedia.org/wiki/${encoded}`,
        `Source: Wikipedia`,
      ];
      return lines.join('\n');
    },

    get_wikipedia_article_created: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🗓️ Fetching creation info for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=timestamp|user|comment&rvlimit=1&rvdir=newer&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const rev = page?.revisions?.[0];

      if (!rev) return `Could not retrieve creation data for "${resolved}".`;

      const created = new Date(rev.timestamp).toUTCString();
      const lines = [
        `🗓️ Article Creation — "${page.title || resolved}"`,
        ``,
        `• Created: ${created}`,
        `• First editor: ${rev.user || 'anonymous'}`,
        `• Initial edit summary: ${rev.comment || '(none)'}`,
        ``,
        `🔗 https://en.wikipedia.org/wiki/${encoded}`,
        `Source: Wikipedia`,
      ];
      return lines.join('\n');
    },

    get_wikipedia_picture_of_day: async (_params, onStage) => {
      onStage(`🖼️ Fetching Wikipedia's Picture of the Day…`);

      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');

      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
      );

      const img = data?.image;
      if (!img) return `No Picture of the Day found for ${y}-${m}-${d}.`;

      const title = img.title ?? 'Unknown';
      const desc =
        img.description?.text ??
        img.description?.html?.replace(/<[^>]+>/g, '') ??
        'No description available.';
      const url = img.image?.source ?? img.thumbnail?.source ?? '';
      const credit = img.artist?.text?.replace(/<[^>]+>/g, '') ?? '';

      const lines = [
        `🖼️ Wikipedia Picture of the Day — ${y}-${m}-${d}`,
        ``,
        `Title: ${title}`,
        ``,
        desc,
        ``,
        credit ? `Credit: ${credit}` : '',
        url ? `🔗 ${url}` : '',
        `Source: Wikipedia`,
      ].filter((l) => l !== '');
      return lines.join('\n');
    },

    get_wikipedia_current_events: async (_params, onStage) => {
      onStage(`📰 Fetching Wikipedia current events…`);

      const now = new Date();
      const y = now.getUTCFullYear();
      const m = String(now.getUTCMonth() + 1).padStart(2, '0');
      const d = String(now.getUTCDate()).padStart(2, '0');

      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`,
      );

      const news = data?.news ?? [];
      if (news.length === 0) {
        return `No current events found in the Wikipedia feed for today. Try visiting https://en.wikipedia.org/wiki/Portal:Current_events`;
      }

      const lines = [`📰 Wikipedia Current Events — ${y}-${m}-${d}`, ``];
      news.slice(0, 8).forEach((item, i) => {
        const story = item.story?.replace(/<[^>]+>/g, '').trim() ?? '';
        lines.push(`${i + 1}. ${story}`);
        (item.links ?? []).slice(0, 2).forEach((l) => {
          const url =
            l.content_urls?.desktop?.page ??
            `https://en.wikipedia.org/wiki/${encodeURIComponent((l.title ?? '').replace(/ /g, '_'))}`;
          lines.push(`   🔗 ${l.title} — ${url}`);
        });
        lines.push(``);
      });
      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_coordinates: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📍 Fetching coordinates for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=coordinates&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const coords = page?.coordinates?.[0];

      if (!coords) {
        return `No geographic coordinates found for "${resolved}". This article may not represent a physical place.`;
      }

      const { lat, lon, region, globe } = coords;
      const mapsUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=12`;

      const lines = [
        `📍 Coordinates — "${page.title || resolved}"`,
        ``,
        `• Latitude: ${lat}`,
        `• Longitude: ${lon}`,
        region ? `• Region: ${region}` : '',
        globe && globe !== 'earth' ? `• Globe: ${globe}` : '',
        ``,
        `🗺️ OpenStreetMap: ${mapsUrl}`,
        `🔗 https://en.wikipedia.org/wiki/${encoded}`,
        `Source: Wikipedia`,
      ].filter((l) => l !== '');
      return lines.join('\n');
    },

    get_wikipedia_sister_projects: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔗 Fetching sister project links for "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=iwlinks&iwprefix=wikidata|commons|wikiquote|wiktionary|wikisource|wikinews|wikispecies&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const iwlinks = page?.iwlinks ?? [];

      const lines = [`🔗 Sister Project Links — "${page.title || resolved}"`, ``];

      const projectMap = {
        wikidata: 'Wikidata',
        commons: 'Wikimedia Commons',
        wikiquote: 'Wikiquote',
        wiktionary: 'Wiktionary',
        wikisource: 'Wikisource',
        wikinews: 'Wikinews',
        wikispecies: 'Wikispecies',
      };

      const projectURLs = {
        wikidata: (t) => `https://www.wikidata.org/wiki/${encodeURIComponent(t)}`,
        commons: (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t)}`,
        wikiquote: (t) => `https://en.wikiquote.org/wiki/${encodeURIComponent(t)}`,
        wiktionary: (t) => `https://en.wiktionary.org/wiki/${encodeURIComponent(t)}`,
        wikisource: (t) => `https://en.wikisource.org/wiki/${encodeURIComponent(t)}`,
        wikinews: (t) => `https://en.wikinews.org/wiki/${encodeURIComponent(t)}`,
        wikispecies: (t) => `https://species.wikimedia.org/wiki/${encodeURIComponent(t)}`,
      };

      if (iwlinks.length === 0) {
        // Fallback: Wikidata item lookup via page props
        const wdData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageprops&ppprop=wikibase_item&format=json&origin=*`,
        ).catch(() => null);
        const wdPages = wdData?.query?.pages ?? {};
        const wdPage = Object.values(wdPages)[0];
        const qid = wdPage?.pageprops?.wikibase_item;
        if (qid) {
          lines.push(`• Wikidata — https://www.wikidata.org/wiki/${qid}`);
        } else {
          lines.push(`No sister project links found for "${resolved}".`);
        }
      } else {
        iwlinks.forEach((l) => {
          const prefix = l.prefix;
          const target = l['*'];
          const name = projectMap[prefix] ?? prefix;
          const url = projectURLs[prefix]
            ? projectURLs[prefix](target)
            : `https://${prefix}.org/wiki/${encodeURIComponent(target)}`;
          lines.push(`• ${name}: ${target} — ${url}`);
        });
      }

      lines.push(``, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_category_members: async (params, onStage) => {
      const { category, limit = 20 } = params;
      if (!category) throw new Error('Missing required param: category');
      onStage(`📂 Fetching members of category "${category}"…`);

      const cap = Math.min(Number(limit) || 20, 50);
      const catTitle = category.startsWith('Category:') ? category : `Category:${category}`;
      const encoded = encodeURIComponent(catTitle);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encoded}&cmlimit=${cap}&cmtype=page&format=json&origin=*`,
      );

      const members = data?.query?.categorymembers ?? [];
      if (members.length === 0)
        return `No articles found in category "${category}". Check the category name.`;

      const lines = [`📂 Category: "${category}" — ${members.length} articles shown`, ``];
      members.forEach((m) => {
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(m.title.replace(/ /g, '_'))}`;
        lines.push(`• ${m.title} — ${url}`);
      });
      lines.push(``, `🔗 https://en.wikipedia.org/wiki/${encoded}`, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_article_diff: async (params, onStage) => {
      const { title, from_rev, to_rev } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!from_rev) throw new Error('Missing required param: from_rev');
      if (!to_rev) throw new Error('Missing required param: to_rev');
      onStage(`🔍 Fetching diff between revisions ${from_rev} and ${to_rev} of "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=compare&fromrev=${from_rev}&torev=${to_rev}&prop=diff|diffsize|ids|title|user|comment&format=json&origin=*`,
      );

      const compare = data?.compare;
      if (!compare)
        return `Could not fetch diff for "${resolved}" between revisions ${from_rev} and ${to_rev}.`;

      const diffText = (compare.body ?? '')
        .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/g, '[+$1]')
        .replace(/<del[^>]*>([\s\S]*?)<\/del>/g, '[-$1]')
        .replace(/<[^>]+>/g, '')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .trim();

      const lines = [
        `🔍 Diff — "${compare.totitle || resolved}"`,
        ``,
        `From rev ${from_rev} (${compare.fromuser ?? '?'}, ${compare.fromtimestamp ? new Date(compare.fromtimestamp).toUTCString() : '?'})`,
        `To   rev ${to_rev} (${compare.touser ?? '?'}, ${compare.totimestamp ? new Date(compare.totimestamp).toUTCString() : '?'})`,
        `Size change: ${compare.diffsize >= 0 ? '+' : ''}${fmt(compare.diffsize)} bytes`,
        ``,
        diffText || '(no textual changes detected)',
        ``,
        `🔗 https://en.wikipedia.org/w/index.php?title=${encoded}&diff=${to_rev}&oldid=${from_rev}`,
        `Source: Wikipedia`,
      ];
      return lines.join('\n');
    },

    get_wikipedia_protected_status: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔒 Checking protection status of "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=info&inprop=protection&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const protection = page?.protection ?? [];

      const lines = [`🔒 Protection Status — "${page.title || resolved}"`, ``];

      if (protection.length === 0) {
        lines.push(`This article is not protected — anyone can edit it.`);
      } else {
        protection.forEach((p) => {
          const expiry = p.expiry === 'infinity' ? 'indefinite' : p.expiry;
          lines.push(`• ${p.type}: level="${p.level}", expires=${expiry}`);
        });
      }

      lines.push(``, `🔗 https://en.wikipedia.org/wiki/${encoded}`, `Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_new_articles: async (params, onStage) => {
      const { limit = 10 } = params;
      onStage(`🆕 Fetching recently created Wikipedia articles…`);

      const cap = Math.min(Number(limit) || 10, 25);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&list=recentchanges&rctype=new&rcnamespace=0&rclimit=${cap}&rcprop=title|timestamp|user|size&format=json&origin=*`,
      );

      const changes = data?.query?.recentchanges ?? [];
      if (changes.length === 0) return `No recently created articles found.`;

      const lines = [`🆕 Recently Created Wikipedia Articles`, ``];
      changes.forEach((c, i) => {
        const ts = new Date(c.timestamp).toUTCString();
        const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}`;
        lines.push(`${i + 1}. **${c.title}**`);
        lines.push(`   Created: ${ts} by ${c.user || 'anonymous'} (${fmt(c.newlen ?? 0)} bytes)`);
        lines.push(`   🔗 ${url}`, ``);
      });
      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_trending: async (params, onStage) => {
      const { limit = 10 } = params;
      onStage(`🔥 Fetching trending Wikipedia articles…`);

      const now = new Date();
      const fmtDate = (d) => [
        String(d.getUTCFullYear()),
        String(d.getUTCMonth() + 1).padStart(2, '0'),
        String(d.getUTCDate()).padStart(2, '0'),
      ];

      const yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dayBefore = new Date(now);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);

      const [y1, m1, d1] = fmtDate(yesterday);
      const [y2, m2, d2] = fmtDate(dayBefore);

      const [todayData, prevData] = await Promise.all([
        safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y1}/${m1}/${d1}`),
        safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y2}/${m2}/${d2}`),
      ]);

      const todayArticles = todayData?.mostread?.articles ?? [];
      const prevMap = new Map(
        (prevData?.mostread?.articles ?? []).map((a) => [a.title, a.views ?? 0]),
      );

      const cap = Math.min(Number(limit) || 10, todayArticles.length);
      const withSpike = todayArticles
        .map((a) => ({
          ...a,
          spike: (a.views ?? 0) - (prevMap.get(a.title) ?? 0),
        }))
        .sort((a, b) => b.spike - a.spike)
        .slice(0, cap);

      const lines = [`🔥 Trending Wikipedia Articles (${y1}-${m1}-${d1})`, ``];
      withSpike.forEach((a, i) => {
        const url =
          a.content_urls?.desktop?.page ??
          `https://en.wikipedia.org/wiki/${encodeURIComponent(a.title)}`;
        const spikeStr = a.spike > 0 ? `+${fmt(a.spike)}` : fmt(a.spike);
        lines.push(`${i + 1}. **${a.title}**`);
        lines.push(`   ${fmt(a.views ?? 0)} views (${spikeStr} vs prev day)`);
        if (a.description) lines.push(`   *${a.description}*`);
        lines.push(`   🔗 ${url}`, ``);
      });
      lines.push(`Source: Wikipedia`);
      return lines.join('\n');
    },

    get_wikipedia_notable_deaths_by_year: async (params, onStage) => {
      const { year } = params;
      if (!year) throw new Error('Missing required param: year');
      onStage(`✝️ Fetching notable deaths in ${year}…`);

      const encoded = encodeURIComponent(`Deaths in ${year}`);
      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`,
      );

      if (!data?.extract) {
        return `No Wikipedia article found for deaths in ${year}.`;
      }

      const lines = [
        `✝️ Notable Deaths in ${year}`,
        ``,
        data.extract,
        ``,
        `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/Deaths_in_${year}`}`,
        `Source: Wikipedia`,
      ];
      return lines.join('\n');
    },

    get_wikipedia_article_quality: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`⭐ Checking article quality for "${title}"…`);

      const resolved = await resolveTitle(title);
      const talkTitle = `Talk:${resolved}`;
      const encoded = encodeURIComponent(talkTitle);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=content&rvsection=0&rvlimit=1&format=json&origin=*`,
      );

      const pages = data?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const content = page?.revisions?.[0]?.['*'] ?? '';

      const classMatch = content.match(/\|\s*class\s*=\s*([^\|\}\n]+)/i);
      const importanceMatch = content.match(/\|\s*importance\s*=\s*([^\|\}\n]+)/i);

      const qualityClass = classMatch?.[1]?.trim() ?? null;
      const importance = importanceMatch?.[1]?.trim() ?? null;

      const qualityScale = {
        FA: '⭐ Featured Article — highest quality',
        GA: '🟢 Good Article — high quality, peer-reviewed',
        B: '🔵 B-class — mostly complete with some issues',
        C: '🟡 C-class — substantial but needs work',
        Start: '🟠 Start-class — rudimentary, needs expansion',
        Stub: '🔴 Stub — very short, major expansion needed',
        FL: '⭐ Featured List',
        List: '📋 List article',
      };

      const lines = [`⭐ Article Quality — "${resolved}"`, ``];

      if (qualityClass) {
        const desc = qualityScale[qualityClass] ?? qualityClass;
        lines.push(`• Quality class: ${desc}`);
      } else {
        lines.push(`• Quality class: Not assessed or not found`);
      }

      if (importance) lines.push(`• Importance: ${importance}`);

      if (!qualityClass && !importance) {
        lines.push(``, `This article may not have a WikiProject quality assessment yet.`);
      }

      lines.push(
        ``,
        `🔗 https://en.wikipedia.org/wiki/${encodeURIComponent(`Talk:${resolved}`)}`,
        `Source: Wikipedia`,
      );
      return lines.join('\n');
    },

    get_wikipedia_hatnotes: async (params, onStage) => {
      const { title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📌 Fetching hatnotes from "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&rvsection=0&format=json&origin=*`,
      );

      const wikitext = data?.parse?.wikitext?.['*'] ?? '';

      const hatnotes = [];
      const pattern =
        /\{\{(Main|See also|For|About|Redirect|Distinguish|Other uses|Further|Details)\|([^}]+)\}\}/gi;
      let match;
      while ((match = pattern.exec(wikitext)) !== null) {
        const type = match[1];
        const args = match[2]
          .split('|')
          .map((a) => a.trim())
          .filter(Boolean)
          .join(', ');
        hatnotes.push(`• ${type}: ${args}`);
      }

      if (hatnotes.length === 0) {
        return `No hatnotes found on "${resolved}". The article has no disambiguation or "see also" notices at the top.`;
      }

      const lines = [
        `📌 Hatnotes on "${data.parse.title || resolved}"`,
        ``,
        ...hatnotes,
        ``,
        `🔗 https://en.wikipedia.org/wiki/${encoded}`,
        `Source: Wikipedia`,
      ];
      return lines.join('\n');
    },

    get_wikipedia_table: async (params, onStage) => {
      const { title, table_index = 0 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📊 Extracting table ${table_index} from "${title}"…`);

      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const data = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&origin=*`,
      );

      const wikitext = data?.parse?.wikitext?.['*'] ?? '';
      const tableMatches = [...wikitext.matchAll(/\{\|[^\n]*wikitable[\s\S]*?\|\}/g)];

      if (tableMatches.length === 0) return `No tables found in "${resolved}".`;

      const idx = Math.min(Number(table_index) || 0, tableMatches.length - 1);
      const tableRaw = tableMatches[idx][0];

      const rows = tableRaw
        .split(/\n\|-/)
        .slice(1)
        .map((row) => {
          const cells = row
            .split(/\n[!|]/)
            .slice(1)
            .map((cell) =>
              cell
                .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
                .replace(/\{\{[^}]+\}\}/g, '')
                .replace(/<[^>]+>/g, '')
                .replace(/'{2,3}/g, '')
                .split('||')
                .map((c) => c.trim())
                .filter(Boolean),
            )
            .flat();
          return cells;
        })
        .filter((r) => r.length > 0);

      if (rows.length === 0) return `Table ${idx} in "${resolved}" could not be parsed.`;

      const lines = [
        `📊 Table ${idx} from "${data.parse.title || resolved}" (${tableMatches.length} table${tableMatches.length !== 1 ? 's' : ''} total)`,
        ``,
      ];
      rows.forEach((row) => lines.push(row.join(' | ')));
      lines.push(``, `🔗 https://en.wikipedia.org/wiki/${encoded}`, `Source: Wikipedia`);
      return lines.join('\n');
    },
  },
});
