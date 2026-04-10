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

      // Get list of sections to find the index
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
      // Strip basic wikitext markup for readability
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

      // First find the localized title via langlinks
      const resolved = await resolveTitle(title);
      const encoded = encodeURIComponent(resolved);

      const linkData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=langlinks&lllang=${lang}&format=json&origin=*`,
      );
      const pages = linkData?.query?.pages ?? {};
      const page = Object.values(pages)[0];
      const localTitle = page?.langlinks?.[0]?.['*'] ?? resolved;
      const localEncoded = encodeURIComponent(localTitle);

      // Fetch summary in target language
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

      // Resolve image URLs via imageinfo
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

      const dyk = data?.onthisday ?? data?.news ?? [];
      // The feed's "dyk" field is under different keys depending on the day
      const dyks = data?.dyk ?? null;

      if (dyks && dyks.length > 0) {
        const lines = [`💡 Did You Know — Wikipedia`, ``];
        dyks.slice(0, 5).forEach((item) => {
          lines.push(`• ${item.text ?? item}`);
        });
        lines.push(``, `Source: Wikipedia`);
        return lines.join('\n');
      }

      // Fallback: parse DYK from the main page HTML via the API
      const mpData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=query&titles=Template:Did_you_know/Queue/1&prop=revisions&rvprop=content&format=json&origin=*`,
      );
      const pages = Object.values(mpData?.query?.pages ?? {});
      let wikitext = pages[0]?.revisions?.[0]?.['*'] ?? '';
      // Extract hook lines starting with "...that"
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
      // Try the disambiguation page directly
      const data = await safeJson(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}_(disambiguation)?redirect=false`,
      ).catch(() => null);

      if (data?.type === 'disambiguation' || data?.extract) {
        // Parse links from the disambiguation extract via the API
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

      // Fallback: use search to show multiple results
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
  },
});
