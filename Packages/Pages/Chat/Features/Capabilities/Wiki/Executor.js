import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';
import { resolveTitle, fmt } from './Utils.js';
export const { handles: handles, execute: execute } = createExecutor({
  name: 'WikiExecutor',
  tools: toolsList,
  handlers: {
    search_wikipedia: async (params, onStage) => {
      const { query: query } = params;
      if (!query) throw new Error('Missing required param: query');
      onStage(`📚 Searching Wikipedia for "${query}"…`);
      const encoded = encodeURIComponent(query);
      let data;
      try {
        data = await safeJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`,
        );
      } catch {
        onStage('🔍 Trying Wikipedia search…');
        const searchData = await safeJson(
            `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=1&format=json&origin=*`,
          ),
          title = searchData?.[1]?.[0];
        if (!title)
          return `No Wikipedia article found for "${query}". Try a more specific or common term.`;
        data = await safeJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
        );
      }
      if ('disambiguation' === data.type)
        return [
          `📚 "${data.title}" — Disambiguation Page`,
          '',
          data.extract ?? 'Multiple topics match this term.',
          '',
          `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`}`,
          '',
          `Try being more specific (e.g. "${query} (film)" or "${query} (science)").`,
          'Source: Wikipedia',
        ].join('\n');
      if (!data.extract)
        return `No Wikipedia article found for "${query}". Try a different search term.`;
      const lines = [`📚 ${data.title}`, ''];
      return (
        data.description && lines.push(`*${data.description}*`, ''),
        lines.push(
          data.extract,
          '',
          `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encoded}`}`,
          'Source: Wikipedia',
        ),
        lines.join('\n')
      );
    },
    get_wikipedia_sections: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📑 Fetching sections for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=sections&format=json&origin=*`,
        ),
        sections = data?.parse?.sections;
      if (!sections || 0 === sections.length)
        return `No sections found for "${resolved}". The article may be very short or missing.`;
      const lines = [`📑 Sections of "${data.parse.title}"`, ''];
      return (
        sections.forEach((s) => {
          const indent = '  '.repeat(Math.max(0, parseInt(s.toclevel, 10) - 1));
          lines.push(`${indent}${s.number}. ${s.line.replace(/[<>]/g, '')}`);
        }),
        lines.push('', `🔗 https://en.wikipedia.org/wiki/${encoded}`, 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_section_content: async (params, onStage) => {
      const { title: title, section: section } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!section) throw new Error('Missing required param: section');
      onStage(`📖 Fetching section "${section}" from "${title}"…`);
      const resolved = await resolveTitle(title),
        encodedTitle = encodeURIComponent(resolved),
        parseData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=sections&format=json&origin=*`,
        ),
        sections = parseData?.parse?.sections ?? [],
        match = sections.find(
          (s) => s.line.replace(/[<>]/g, '').toLowerCase() === section.toLowerCase(),
        );
      if (!match) {
        const available = sections.map((s) => s.line.replace(/[<>]/g, '')).join(', ');
        return `Section "${section}" not found in "${resolved}".\n\nAvailable sections: ${available || 'none'}`;
      }
      const contentData = await safeJson(
        `https://en.wikipedia.org/w/api.php?action=parse&page=${encodedTitle}&prop=wikitext&section=${match.index}&format=json&origin=*`,
      );
      let text = contentData?.parse?.wikitext?.['*'] ?? '';
      return (
        (text = text
          .replace(/\[\[([^\]|]+\|)?([^\]]+)\]\]/g, '$2')
          .replace(/\{\{[^}]+\}\}/g, '')
          .replace(/'{2,3}/g, '')
          .replace(/==+[^=]+=+/g, '')
          .replace(/[<>]/g, '')
          .replace(/\n{3,}/g, '\n\n')
          .trim()),
        text
          ? [
              `📖 ${resolved} — ${section}`,
              '',
              text,
              '',
              `🔗 https://en.wikipedia.org/wiki/${encodedTitle}#${encodeURIComponent(match.anchor)}`,
              'Source: Wikipedia',
            ].join('\n')
          : `The section "${section}" in "${resolved}" appears to be empty.`
      );
    },
    get_wikipedia_search_results: async (params, onStage) => {
      const { query: query, limit: limit = 5 } = params;
      if (!query) throw new Error('Missing required param: query');
      onStage(`🔍 Searching Wikipedia for "${query}"…`);
      const cap = Math.min(Number(limit) || 5, 10),
        encoded = encodeURIComponent(query),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=${cap}&srprop=snippet|titlesnippet&format=json&origin=*`,
        ),
        results = data?.query?.search ?? [];
      if (0 === results.length) return `No Wikipedia results found for "${query}".`;
      const lines = [`🔍 Wikipedia search results for "${query}"`, ''];
      return (
        results.forEach((r, i) => {
          const snippet = r.snippet.replace(/[<>]/g, '').trim(),
            url = `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`;
          (lines.push(`${i + 1}. **${r.title}**`),
            lines.push(`   ${snippet}`),
            lines.push(`   🔗 ${url}`),
            lines.push(''));
        }),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_full_article: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📄 Fetching full article for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extracts&explaintext=true&exsectionformat=plain&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0];
      if (!page || void 0 !== page.missing) return `No Wikipedia article found for "${title}".`;
      const text = (page.extract ?? '').trim();
      if (!text) return `The article "${resolved}" has no extractable text.`;
      const url = `https://en.wikipedia.org/wiki/${encoded}`;
      return [`📄 ${page.title}`, '', text, '', `🔗 ${url}`, 'Source: Wikipedia'].join('\n');
    },
    get_wikipedia_categories: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🏷️ Fetching categories for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=categories&cllimit=50&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        cats = (page?.categories ?? [])
          .map((c) => c.title.replace(/^Category:/, ''))
          .filter(
            (c) =>
              !c.startsWith('Articles ') && !c.startsWith('CS1') && !c.startsWith('Webarchive'),
          );
      if (0 === cats.length) return `No categories found for "${resolved}".`;
      const lines = [`🏷️ Categories for "${page.title || resolved}"`, ''];
      return (
        cats.forEach((c) => lines.push(`• ${c}`)),
        lines.push('', `🔗 https://en.wikipedia.org/wiki/${encoded}`, 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_languages: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🌐 Fetching available languages for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=langlinks&lllimit=500&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        langs = page?.langlinks ?? [];
      if (0 === langs.length) return `No other language versions found for "${resolved}".`;
      const lines = [`🌐 "${resolved}" is available in ${langs.length} languages`, ''];
      return (
        langs.forEach((l) => lines.push(`• [${l.lang}] ${l['*']}`)),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_article_in_language: async (params, onStage) => {
      const { title: title, lang: lang } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!lang) throw new Error('Missing required param: lang');
      onStage(`🌍 Fetching "${title}" in language "${lang}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        linkData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=langlinks&lllang=${lang}&format=json&origin=*`,
        ),
        pages = linkData?.query?.pages ?? {},
        page = Object.values(pages)[0],
        localEncoded = encodeURIComponent(page?.langlinks?.[0]?.['*'] ?? resolved),
        data = await safeJson(
          `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${localEncoded}?redirect=true`,
        );
      return data?.extract
        ? [
            `🌍 ${data.title} [${lang.toUpperCase()}]`,
            '',
            data.description ? `*${data.description}*\n` : '',
            data.extract,
            '',
            `🔗 ${data.content_urls?.desktop?.page ?? `https://${lang}.wikipedia.org/wiki/${localEncoded}`}`,
            `Source: Wikipedia (${lang})`,
          ].join('\n')
        : `No "${lang}" Wikipedia article found for "${title}". The article may not exist in that language.`;
    },
    get_wikipedia_images: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🖼️ Fetching images for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=images&imlimit=20&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        images = (page?.images ?? []).filter((img) =>
          /\.(jpg|jpeg|png|gif|svg|webp)$/i.test(img.title),
        );
      if (0 === images.length) return `No images found for "${resolved}".`;
      const imgTitles = images.map((i) => i.title).join('|'),
        infoData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(imgTitles)}&prop=imageinfo&iiprop=url|extmetadata&format=json&origin=*`,
        ),
        infoPages = Object.values(infoData?.query?.pages ?? {}),
        lines = [`🖼️ Images in "${resolved}"`, ''];
      return (
        infoPages.forEach((p) => {
          const info = p.imageinfo?.[0];
          if (!info?.url) return;
          const caption = info.extmetadata?.ImageDescription?.value?.replace(/[<>]/g, '').trim(),
            name = p.title.replace(/^File:/, '');
          (lines.push(`• ${name}`),
            caption && lines.push(`  Caption: ${caption}`),
            lines.push(`  🔗 ${info.url}`),
            lines.push(''));
        }),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_linked_articles: async (params, onStage) => {
      const { title: title, limit: limit = 20 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔗 Fetching links in "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        cap = Math.min(Number(limit) || 20, 50),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=links&pllimit=${cap}&plnamespace=0&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        links = page?.links ?? [];
      if (0 === links.length) return `No linked articles found in "${resolved}".`;
      const lines = [`🔗 Articles linked from "${resolved}" (showing up to ${cap})`, ''];
      return (
        links.forEach((l) => {
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(l.title.replace(/ /g, '_'))}`;
          lines.push(`• ${l.title} — ${url}`);
        }),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_random_article: async (_params, onStage) => {
      onStage('🎲 Fetching a random Wikipedia article…');
      const data = await safeJson('https://en.wikipedia.org/api/rest_v1/page/random/summary');
      if (!data?.extract) return "Couldn't retrieve a random article right now. Please try again.";
      const lines = [`🎲 Random Article: ${data.title}`, ''];
      return (
        data.description && lines.push(`*${data.description}*`, ''),
        lines.push(data.extract, '', `🔗 ${data.content_urls?.desktop?.page}`, 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_featured_article: async (_params, onStage) => {
      onStage("⭐ Fetching today's Wikipedia featured article…");
      const now = new Date(),
        y = now.getUTCFullYear(),
        m = String(now.getUTCMonth() + 1).padStart(2, '0'),
        d = String(now.getUTCDate()).padStart(2, '0'),
        data = await safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`),
        tfa = data?.tfa;
      if (!tfa) return `No featured article found for today (${y}-${m}-${d}).`;
      const lines = [`⭐ Today's Featured Article: ${tfa.title}`, ''];
      return (
        tfa.description && lines.push(`*${tfa.description}*`, ''),
        tfa.extract && lines.push(tfa.extract, ''),
        lines.push(
          `🔗 ${tfa.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/${encodeURIComponent(tfa.title)}`}`,
          'Source: Wikipedia',
        ),
        lines.join('\n')
      );
    },
    get_wikipedia_on_this_day: async (params, onStage) => {
      const { month: month, day: day, type: type = 'all' } = params;
      if (!month) throw new Error('Missing required param: month');
      if (!day) throw new Error('Missing required param: day');
      onStage(`📅 Fetching "On This Day" for ${month}/${day}…`);
      const m = String(month).padStart(2, '0'),
        d = String(day).padStart(2, '0'),
        data = await safeJson(`https://en.wikipedia.org/api/rest_v1/feed/onthisday/all/${m}/${d}`),
        lines = [`📅 On This Day — ${m}/${d}`, ''],
        addSection = (label, emoji, items) => {
          items &&
            0 !== items.length &&
            (lines.push(`${emoji} **${label}**`, ''),
            items.slice(0, 5).forEach((item) => {
              const year = null != item.year ? `${item.year}: ` : '';
              lines.push(`• ${year}${item.text}`);
            }),
            lines.push(''));
        };
      return (
        ('all' !== type && 'events' !== type) || addSection('Events', '🏛️', data?.events),
        ('all' !== type && 'births' !== type) || addSection('Births', '🎂', data?.births),
        ('all' !== type && 'deaths' !== type) || addSection('Deaths', '✝️', data?.deaths),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_most_read: async (params, onStage) => {
      const { limit: limit = 10 } = params;
      let { date: date } = params;
      if ((onStage('📈 Fetching most-read Wikipedia articles…'), !date)) {
        const yesterday = new Date();
        (yesterday.setUTCDate(yesterday.getUTCDate() - 1),
          (date = yesterday.toISOString().slice(0, 10)));
      }
      const [y, m, d] = date.split('-'),
        data = await safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`),
        articles = data?.mostread?.articles ?? [];
      if (0 === articles.length) return `No most-read data found for ${date}.`;
      const cap = Math.min(Number(limit) || 10, articles.length),
        lines = [`📈 Most-Read Wikipedia Articles on ${date}`, ''];
      return (
        articles.slice(0, cap).forEach((a, i) => {
          const views = fmt(a.views ?? 0),
            url =
              a.content_urls?.desktop?.page ??
              `https://en.wikipedia.org/wiki/${encodeURIComponent(a.title)}`;
          (lines.push(`${i + 1}. **${a.title}** — ${views} views`),
            a.description && lines.push(`   *${a.description}*`),
            lines.push(`   🔗 ${url}`, ''));
        }),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_page_views: async (params, onStage) => {
      const { title: title, start: start, end: end } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!start) throw new Error('Missing required param: start');
      if (!end) throw new Error('Missing required param: end');
      onStage(`📊 Fetching page views for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved.replace(/ /g, '_')),
        data = await safeJson(
          `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/en.wikipedia/all-access/all-agents/${encoded}/daily/${start}/${end}`,
        ),
        items = data?.items ?? [];
      if (0 === items.length)
        return `No page view data found for "${resolved}" between ${start} and ${end}.`;
      const total = items.reduce((sum, i) => sum + (i.views ?? 0), 0),
        peak = items.reduce((best, i) => (i.views > best.views ? i : best), items[0]),
        lines = [
          `📊 Page Views for "${resolved}"`,
          `Period: ${start} → ${end}`,
          '',
          `Total views: ${fmt(total)}`,
          `Daily average: ${fmt(Math.round(total / items.length))}`,
          `Peak day: ${peak.timestamp?.slice(0, 8)} with ${fmt(peak.views)} views`,
          '',
          'Daily breakdown:',
        ];
      return (
        items.forEach((i) => {
          const dateStr = i.timestamp?.slice(0, 8) ?? '?';
          lines.push(`  ${dateStr}: ${fmt(i.views)}`);
        }),
        lines.push('', 'Source: Wikimedia Analytics'),
        lines.join('\n')
      );
    },
    get_wikipedia_did_you_know: async (_params, onStage) => {
      onStage('💡 Fetching "Did You Know" facts from Wikipedia…');
      const now = new Date(),
        y = now.getUTCFullYear(),
        m = String(now.getUTCMonth() + 1).padStart(2, '0'),
        d = String(now.getUTCDate()).padStart(2, '0'),
        data = await safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`),
        dyks = data?.dyk ?? null;
      if (dyks && dyks.length > 0) {
        const lines = ['💡 Did You Know — Wikipedia', ''];
        return (
          dyks.slice(0, 5).forEach((item) => {
            lines.push(`• ${item.text ?? item}`);
          }),
          lines.push('', 'Source: Wikipedia'),
          lines.join('\n')
        );
      }
      const mpData = await safeJson(
          'https://en.wikipedia.org/w/api.php?action=query&titles=Template:Did_you_know/Queue/1&prop=revisions&rvprop=content&format=json&origin=*',
        ),
        pages = Object.values(mpData?.query?.pages ?? {}),
        hooks = [...(pages[0]?.revisions?.[0]?.['*'] ?? '').matchAll(/\.\.\.(that [^?]+\?)/gi)].map(
          (m) =>
            m[1]
              .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
              .replace(/'{2,3}/g, '')
              .trim(),
        );
      if (0 === hooks.length)
        return '💡 Could not retrieve "Did You Know" facts at this time. Visit https://en.wikipedia.org for the latest.';
      const lines = ['💡 Did You Know — Wikipedia', ''];
      return (
        hooks.slice(0, 5).forEach((h) => lines.push(`• …${h}`)),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_nearby_articles: async (params, onStage) => {
      const { lat: lat, lon: lon, limit: limit = 10 } = params;
      if (null == lat) throw new Error('Missing required param: lat');
      if (null == lon) throw new Error('Missing required param: lon');
      onStage(`📍 Finding Wikipedia articles near (${lat}, ${lon})…`);
      const cap = Math.min(Number(limit) || 10, 20),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&list=geosearch&gscoord=${lat}|${lon}&gsradius=10000&gslimit=${cap}&format=json&origin=*`,
        ),
        results = data?.query?.geosearch ?? [];
      if (0 === results.length)
        return `No Wikipedia articles found within 10 km of (${lat}, ${lon}).`;
      const lines = [`📍 Wikipedia Articles Near (${lat}, ${lon})`, ''];
      return (
        results.forEach((r) => {
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
            dist = null != r.dist ? ` — ${Math.round(r.dist)} m away` : '';
          (lines.push(`• **${r.title}**${dist}`), lines.push(`  🔗 ${url}`), lines.push(''));
        }),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_revision_history: async (params, onStage) => {
      const { title: title, limit: limit = 10 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🕓 Fetching revision history for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        cap = Math.min(Number(limit) || 10, 20),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=timestamp|user|comment|size&rvlimit=${cap}&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        revisions = page?.revisions ?? [];
      if (0 === revisions.length) return `No revision history found for "${resolved}".`;
      const lines = [
        `🕓 Recent Revisions for "${page.title || resolved}" (latest ${revisions.length})`,
        '',
      ];
      return (
        revisions.forEach((r, i) => {
          const ts = new Date(r.timestamp).toUTCString(),
            comment = r.comment ? `"${r.comment}"` : '(no summary)',
            size = null != r.size ? ` | ${fmt(r.size)} bytes` : '';
          (lines.push(`${i + 1}. ${ts}`),
            lines.push(`   Editor: ${r.user || 'anonymous'}${size}`),
            lines.push(`   Summary: ${comment}`),
            lines.push(''));
        }),
        lines.push(
          `🔗 https://en.wikipedia.org/w/index.php?title=${encoded}&action=history`,
          'Source: Wikipedia',
        ),
        lines.join('\n')
      );
    },
    get_wikipedia_disambiguation: async (params, onStage) => {
      const { term: term } = params;
      if (!term) throw new Error('Missing required param: term');
      onStage(`🔀 Fetching disambiguation options for "${term}"…`);
      const encoded = encodeURIComponent(term),
        data = await safeJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}_(disambiguation)?redirect=false`,
        ).catch(() => null);
      if ('disambiguation' === data?.type || data?.extract) {
        const linkData = await safeJson(
            `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(data.title)}&prop=links&pllimit=30&plnamespace=0&format=json&origin=*`,
          ),
          pages = Object.values(linkData?.query?.pages ?? {}),
          links = pages[0]?.links ?? [],
          lines = [`🔀 Disambiguation: "${term}"`, '', data.extract ?? '', ''];
        return (
          links.length > 0 &&
            (lines.push('Possible meanings:', ''),
            links.forEach((l) => {
              const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(l.title.replace(/ /g, '_'))}`;
              lines.push(`• ${l.title} — ${url}`);
            })),
          lines.push('', 'Source: Wikipedia'),
          lines.join('\n')
        );
      }
      const searchData = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encoded}&limit=8&format=json&origin=*`,
        ),
        titles = searchData?.[1] ?? [],
        urls = searchData?.[3] ?? [];
      if (0 === titles.length) return `No disambiguation results found for "${term}".`;
      const lines = [`🔀 Wikipedia results for "${term}"`, ''];
      return (
        titles.forEach((t, i) => lines.push(`• ${t} — ${urls[i] ?? ''}`)),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    compare_wikipedia_articles: async (params, onStage) => {
      const { topic_a: topic_a, topic_b: topic_b } = params;
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
              ),
              title = search?.[1]?.[0];
            return title
              ? safeJson(
                  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}?redirect=true`,
                )
              : null;
          }
        },
        [dataA, dataB] = await Promise.all([fetchSummary(topic_a), fetchSummary(topic_b)]),
        lines = ['⚖️ Wikipedia Comparison', ''],
        addEntry = (label, data) => {
          data && data.extract
            ? (lines.push(`### 📚 ${data.title}`),
              data.description && lines.push(`*${data.description}*`),
              lines.push('', data.extract, ''),
              lines.push(`🔗 ${data.content_urls?.desktop?.page}`, ''))
            : lines.push(`### ❌ ${label}`, 'No article found.', '');
        };
      return (
        addEntry(topic_a, dataA),
        lines.push(`${'─'.repeat(60)}`, ''),
        addEntry(topic_b, dataB),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_references: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📎 Fetching references for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=externallinks&format=json&origin=*`,
        ),
        refs = (data?.parse?.externallinks ?? []).filter((l) => {
          try {
            const host = new URL(l).hostname;
            return (
              host !== 'wikimedia.org' &&
              !host.endsWith('.wikimedia.org') &&
              host !== 'wikipedia.org' &&
              !host.endsWith('.wikipedia.org')
            );
          } catch {
            return false;
          }
        });
      if (0 === refs.length) return `No external references found for "${resolved}".`;
      const lines = [
        `📎 References in "${data.parse.title || resolved}" (${refs.length} found)`,
        '',
      ];
      return (
        refs.slice(0, 30).forEach((r, i) => lines.push(`${i + 1}. ${r}`)),
        refs.length > 30 && lines.push('', `…and ${refs.length - 30} more.`),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_backlinks: async (params, onStage) => {
      const { title: title, limit: limit = 20 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔙 Fetching backlinks to "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        cap = Math.min(Number(limit) || 20, 50),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&list=backlinks&bltitle=${encoded}&bllimit=${cap}&blnamespace=0&format=json&origin=*`,
        ),
        links = data?.query?.backlinks ?? [];
      if (0 === links.length) return `No backlinks found for "${resolved}".`;
      const lines = [`🔙 Articles linking to "${resolved}" (showing up to ${cap})`, ''];
      return (
        links.forEach((l) => {
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(l.title.replace(/ /g, '_'))}`;
          lines.push(`• ${l.title} — ${url}`);
        }),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_contributors: async (params, onStage) => {
      const { title: title, limit: limit = 15 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`👥 Fetching top contributors for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        cap = Math.min(Number(limit) || 15, 50),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=contributors&pclimit=${cap}&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        contributors = page?.contributors ?? [],
        anonCount = page?.anoncontributors ?? 0;
      if (0 === contributors.length) return `No contributor data found for "${resolved}".`;
      const lines = [
        `👥 Top Contributors to "${page.title || resolved}"`,
        `(${fmt(contributors.length)} named + ${fmt(anonCount)} anonymous contributors shown)`,
        '',
      ];
      return (
        contributors.forEach((c, i) => {
          const profile = `https://en.wikipedia.org/wiki/User:${encodeURIComponent(c.name)}`;
          lines.push(`${i + 1}. ${c.name} — ${profile}`);
        }),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_external_links: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🌐 Fetching external links in "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=extlinks&ellimit=50&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        links = page?.extlinks ?? [];
      if (0 === links.length) return `No external links found in "${resolved}".`;
      const lines = [`🌐 External Links in "${page.title || resolved}"`, ''];
      return (
        links.forEach((l, i) => lines.push(`${i + 1}. ${l['*']}`)),
        lines.push('', 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_infobox: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📋 Extracting infobox from "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&origin=*`,
        ),
        infoboxMatch = (data?.parse?.wikitext?.['*'] ?? '').match(
          /\{\{[Ii]nfobox[\s\S]*?(?=\n\}\})/,
        );
      if (!infoboxMatch) return `No infobox found in "${resolved}". This article may not have one.`;
      const rows = infoboxMatch[0].split('\n').filter((l) => l.startsWith('|') && l.includes('=')),
        lines = [`📋 Infobox — "${data.parse.title || resolved}"`, ''];
      return (
        rows.forEach((row) => {
          const eqIdx = row.indexOf('=');
          if (-1 === eqIdx) return;
          const key = row.slice(1, eqIdx).trim(),
            val = row
              .slice(eqIdx + 1)
              .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
              .replace(/\{\{[^}]+\}\}/g, '')
              .replace(/[<>]/g, '')
              .replace(/'{2,3}/g, '')
              .trim();
          key && val && lines.push(`• ${key}: ${val}`);
        }),
        lines.push('', `🔗 https://en.wikipedia.org/wiki/${encoded}`, 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_article_stats: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📊 Computing stats for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=size|timestamp&rvlimit=1&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0];
      if (!page || void 0 !== page.missing) return `No article found for "${title}".`;
      const bytes = page?.revisions?.[0]?.size ?? 0,
        approxWords = Math.round(bytes / 6),
        readingMins = Math.max(1, Math.round(approxWords / 200)),
        lastEdit = page?.revisions?.[0]?.timestamp
          ? new Date(page.revisions[0].timestamp).toUTCString()
          : 'Unknown';
      return [
        `📊 Article Stats — "${page.title || resolved}"`,
        '',
        `• Size: ${fmt(bytes)} bytes`,
        `• Estimated words: ~${fmt(approxWords)}`,
        `• Estimated reading time: ~${readingMins} min`,
        `• Last edited: ${lastEdit}`,
        '',
        `🔗 https://en.wikipedia.org/wiki/${encoded}`,
        'Source: Wikipedia',
      ].join('\n');
    },
    get_wikipedia_article_created: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🗓️ Fetching creation info for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=timestamp|user|comment&rvlimit=1&rvdir=newer&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        rev = page?.revisions?.[0];
      if (!rev) return `Could not retrieve creation data for "${resolved}".`;
      const created = new Date(rev.timestamp).toUTCString();
      return [
        `🗓️ Article Creation — "${page.title || resolved}"`,
        '',
        `• Created: ${created}`,
        `• First editor: ${rev.user || 'anonymous'}`,
        `• Initial edit summary: ${rev.comment || '(none)'}`,
        '',
        `🔗 https://en.wikipedia.org/wiki/${encoded}`,
        'Source: Wikipedia',
      ].join('\n');
    },
    get_wikipedia_picture_of_day: async (_params, onStage) => {
      onStage("🖼️ Fetching Wikipedia's Picture of the Day…");
      const now = new Date(),
        y = now.getUTCFullYear(),
        m = String(now.getUTCMonth() + 1).padStart(2, '0'),
        d = String(now.getUTCDate()).padStart(2, '0'),
        data = await safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`),
        img = data?.image;
      if (!img) return `No Picture of the Day found for ${y}-${m}-${d}.`;
      const title = img.title ?? 'Unknown',
        desc =
          img.description?.text ??
          img.description?.html?.replace(/[<>]/g, '') ??
          'No description available.',
        url = img.image?.source ?? img.thumbnail?.source ?? '',
        credit = img.artist?.text?.replace(/[<>]/g, '') ?? '';
      return [
        `🖼️ Wikipedia Picture of the Day — ${y}-${m}-${d}`,
        '',
        `Title: ${title}`,
        '',
        desc,
        '',
        credit ? `Credit: ${credit}` : '',
        url ? `🔗 ${url}` : '',
        'Source: Wikipedia',
      ]
        .filter((l) => '' !== l)
        .join('\n');
    },
    get_wikipedia_current_events: async (_params, onStage) => {
      onStage('📰 Fetching Wikipedia current events…');
      const now = new Date(),
        y = now.getUTCFullYear(),
        m = String(now.getUTCMonth() + 1).padStart(2, '0'),
        d = String(now.getUTCDate()).padStart(2, '0'),
        data = await safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y}/${m}/${d}`),
        news = data?.news ?? [];
      if (0 === news.length)
        return 'No current events found in the Wikipedia feed for today. Try visiting https://en.wikipedia.org/wiki/Portal:Current_events';
      const lines = [`📰 Wikipedia Current Events — ${y}-${m}-${d}`, ''];
      return (
        news.slice(0, 8).forEach((item, i) => {
          const story = item.story?.replace(/[<>]/g, '').trim() ?? '';
          (lines.push(`${i + 1}. ${story}`),
            (item.links ?? []).slice(0, 2).forEach((l) => {
              const url =
                l.content_urls?.desktop?.page ??
                `https://en.wikipedia.org/wiki/${encodeURIComponent((l.title ?? '').replace(/ /g, '_'))}`;
              lines.push(`   🔗 ${l.title} — ${url}`);
            }),
            lines.push(''));
        }),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_coordinates: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📍 Fetching coordinates for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=coordinates&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        coords = page?.coordinates?.[0];
      if (!coords)
        return `No geographic coordinates found for "${resolved}". This article may not represent a physical place.`;
      const { lat: lat, lon: lon, region: region, globe: globe } = coords,
        mapsUrl = `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}&zoom=12`;
      return [
        `📍 Coordinates — "${page.title || resolved}"`,
        '',
        `• Latitude: ${lat}`,
        `• Longitude: ${lon}`,
        region ? `• Region: ${region}` : '',
        globe && 'earth' !== globe ? `• Globe: ${globe}` : '',
        '',
        `🗺️ OpenStreetMap: ${mapsUrl}`,
        `🔗 https://en.wikipedia.org/wiki/${encoded}`,
        'Source: Wikipedia',
      ]
        .filter((l) => '' !== l)
        .join('\n');
    },
    get_wikipedia_sister_projects: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔗 Fetching sister project links for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=iwlinks&iwprefix=wikidata|commons|wikiquote|wiktionary|wikisource|wikinews|wikispecies&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        iwlinks = page?.iwlinks ?? [],
        lines = [`🔗 Sister Project Links — "${page.title || resolved}"`, ''],
        projectMap = {
          wikidata: 'Wikidata',
          commons: 'Wikimedia Commons',
          wikiquote: 'Wikiquote',
          wiktionary: 'Wiktionary',
          wikisource: 'Wikisource',
          wikinews: 'Wikinews',
          wikispecies: 'Wikispecies',
        },
        projectURLs = {
          wikidata: (t) => `https://www.wikidata.org/wiki/${encodeURIComponent(t)}`,
          commons: (t) => `https://commons.wikimedia.org/wiki/${encodeURIComponent(t)}`,
          wikiquote: (t) => `https://en.wikiquote.org/wiki/${encodeURIComponent(t)}`,
          wiktionary: (t) => `https://en.wiktionary.org/wiki/${encodeURIComponent(t)}`,
          wikisource: (t) => `https://en.wikisource.org/wiki/${encodeURIComponent(t)}`,
          wikinews: (t) => `https://en.wikinews.org/wiki/${encodeURIComponent(t)}`,
          wikispecies: (t) => `https://species.wikimedia.org/wiki/${encodeURIComponent(t)}`,
        };
      if (0 === iwlinks.length) {
        const wdData = await safeJson(
            `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=pageprops&ppprop=wikibase_item&format=json&origin=*`,
          ).catch(() => null),
          wdPages = wdData?.query?.pages ?? {},
          wdPage = Object.values(wdPages)[0],
          qid = wdPage?.pageprops?.wikibase_item;
        qid
          ? lines.push(`• Wikidata — https://www.wikidata.org/wiki/${qid}`)
          : lines.push(`No sister project links found for "${resolved}".`);
      } else
        iwlinks.forEach((l) => {
          const prefix = l.prefix,
            target = l['*'],
            name = projectMap[prefix] ?? prefix,
            url = projectURLs[prefix]
              ? projectURLs[prefix](target)
              : `https://${prefix}.org/wiki/${encodeURIComponent(target)}`;
          lines.push(`• ${name}: ${target} — ${url}`);
        });
      return (lines.push('', 'Source: Wikipedia'), lines.join('\n'));
    },
    get_wikipedia_category_members: async (params, onStage) => {
      const { category: category, limit: limit = 20 } = params;
      if (!category) throw new Error('Missing required param: category');
      onStage(`📂 Fetching members of category "${category}"…`);
      const cap = Math.min(Number(limit) || 20, 50),
        catTitle = category.startsWith('Category:') ? category : `Category:${category}`,
        encoded = encodeURIComponent(catTitle),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&list=categorymembers&cmtitle=${encoded}&cmlimit=${cap}&cmtype=page&format=json&origin=*`,
        ),
        members = data?.query?.categorymembers ?? [];
      if (0 === members.length)
        return `No articles found in category "${category}". Check the category name.`;
      const lines = [`📂 Category: "${category}" — ${members.length} articles shown`, ''];
      return (
        members.forEach((m) => {
          const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(m.title.replace(/ /g, '_'))}`;
          lines.push(`• ${m.title} — ${url}`);
        }),
        lines.push('', `🔗 https://en.wikipedia.org/wiki/${encoded}`, 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_article_diff: async (params, onStage) => {
      const { title: title, from_rev: from_rev, to_rev: to_rev } = params;
      if (!title) throw new Error('Missing required param: title');
      if (!from_rev) throw new Error('Missing required param: from_rev');
      if (!to_rev) throw new Error('Missing required param: to_rev');
      onStage(`🔍 Fetching diff between revisions ${from_rev} and ${to_rev} of "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=compare&fromrev=${from_rev}&torev=${to_rev}&prop=diff|diffsize|ids|title|user|comment&format=json&origin=*`,
        ),
        compare = data?.compare;
      if (!compare)
        return `Could not fetch diff for "${resolved}" between revisions ${from_rev} and ${to_rev}.`;
      const diffText = (compare.body ?? '')
        .replace(/<ins[^>]*>([\s\S]*?)<\/ins>/g, '[+$1]')
        .replace(/<del[^>]*>([\s\S]*?)<\/del>/g, '[-$1]')
        .replace(/[<>]/g, '')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .trim();
      return [
        `🔍 Diff — "${compare.totitle || resolved}"`,
        '',
        `From rev ${from_rev} (${compare.fromuser ?? '?'}, ${compare.fromtimestamp ? new Date(compare.fromtimestamp).toUTCString() : '?'})`,
        `To   rev ${to_rev} (${compare.touser ?? '?'}, ${compare.totimestamp ? new Date(compare.totimestamp).toUTCString() : '?'})`,
        `Size change: ${compare.diffsize >= 0 ? '+' : ''}${fmt(compare.diffsize)} bytes`,
        '',
        diffText || '(no textual changes detected)',
        '',
        `🔗 https://en.wikipedia.org/w/index.php?title=${encoded}&diff=${to_rev}&oldid=${from_rev}`,
        'Source: Wikipedia',
      ].join('\n');
    },
    get_wikipedia_protected_status: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`🔒 Checking protection status of "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=info&inprop=protection&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        protection = page?.protection ?? [],
        lines = [`🔒 Protection Status — "${page.title || resolved}"`, ''];
      return (
        0 === protection.length
          ? lines.push('This article is not protected — anyone can edit it.')
          : protection.forEach((p) => {
              const expiry = 'infinity' === p.expiry ? 'indefinite' : p.expiry;
              lines.push(`• ${p.type}: level="${p.level}", expires=${expiry}`);
            }),
        lines.push('', `🔗 https://en.wikipedia.org/wiki/${encoded}`, 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_new_articles: async (params, onStage) => {
      const { limit: limit = 10 } = params;
      onStage('🆕 Fetching recently created Wikipedia articles…');
      const cap = Math.min(Number(limit) || 10, 25),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&list=recentchanges&rctype=new&rcnamespace=0&rclimit=${cap}&rcprop=title|timestamp|user|size&format=json&origin=*`,
        ),
        changes = data?.query?.recentchanges ?? [];
      if (0 === changes.length) return 'No recently created articles found.';
      const lines = ['🆕 Recently Created Wikipedia Articles', ''];
      return (
        changes.forEach((c, i) => {
          const ts = new Date(c.timestamp).toUTCString(),
            url = `https://en.wikipedia.org/wiki/${encodeURIComponent(c.title.replace(/ /g, '_'))}`;
          (lines.push(`${i + 1}. **${c.title}**`),
            lines.push(
              `   Created: ${ts} by ${c.user || 'anonymous'} (${fmt(c.newlen ?? 0)} bytes)`,
            ),
            lines.push(`   🔗 ${url}`, ''));
        }),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_trending: async (params, onStage) => {
      const { limit: limit = 10 } = params;
      onStage('🔥 Fetching trending Wikipedia articles…');
      const now = new Date(),
        fmtDate = (d) => [
          String(d.getUTCFullYear()),
          String(d.getUTCMonth() + 1).padStart(2, '0'),
          String(d.getUTCDate()).padStart(2, '0'),
        ],
        yesterday = new Date(now);
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);
      const dayBefore = new Date(now);
      dayBefore.setUTCDate(dayBefore.getUTCDate() - 2);
      const [y1, m1, d1] = fmtDate(yesterday),
        [y2, m2, d2] = fmtDate(dayBefore),
        [todayData, prevData] = await Promise.all([
          safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y1}/${m1}/${d1}`),
          safeJson(`https://en.wikipedia.org/api/rest_v1/feed/featured/${y2}/${m2}/${d2}`),
        ]),
        todayArticles = todayData?.mostread?.articles ?? [],
        prevMap = new Map((prevData?.mostread?.articles ?? []).map((a) => [a.title, a.views ?? 0])),
        cap = Math.min(Number(limit) || 10, todayArticles.length),
        withSpike = todayArticles
          .map((a) => ({ ...a, spike: (a.views ?? 0) - (prevMap.get(a.title) ?? 0) }))
          .sort((a, b) => b.spike - a.spike)
          .slice(0, cap),
        lines = [`🔥 Trending Wikipedia Articles (${y1}-${m1}-${d1})`, ''];
      return (
        withSpike.forEach((a, i) => {
          const url =
              a.content_urls?.desktop?.page ??
              `https://en.wikipedia.org/wiki/${encodeURIComponent(a.title)}`,
            spikeStr = a.spike > 0 ? `+${fmt(a.spike)}` : fmt(a.spike);
          (lines.push(`${i + 1}. **${a.title}**`),
            lines.push(`   ${fmt(a.views ?? 0)} views (${spikeStr} vs prev day)`),
            a.description && lines.push(`   *${a.description}*`),
            lines.push(`   🔗 ${url}`, ''));
        }),
        lines.push('Source: Wikipedia'),
        lines.join('\n')
      );
    },
    get_wikipedia_notable_deaths_by_year: async (params, onStage) => {
      const { year: year } = params;
      if (!year) throw new Error('Missing required param: year');
      onStage(`✝️ Fetching notable deaths in ${year}…`);
      const encoded = encodeURIComponent(`Deaths in ${year}`),
        data = await safeJson(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}?redirect=true`,
        );
      return data?.extract
        ? [
            `✝️ Notable Deaths in ${year}`,
            '',
            data.extract,
            '',
            `🔗 ${data.content_urls?.desktop?.page ?? `https://en.wikipedia.org/wiki/Deaths_in_${year}`}`,
            'Source: Wikipedia',
          ].join('\n')
        : `No Wikipedia article found for deaths in ${year}.`;
    },
    get_wikipedia_article_quality: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`⭐ Checking article quality for "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(`Talk:${resolved}`),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&titles=${encoded}&prop=revisions&rvprop=content&rvsection=0&rvlimit=1&format=json&origin=*`,
        ),
        pages = data?.query?.pages ?? {},
        page = Object.values(pages)[0],
        content = page?.revisions?.[0]?.['*'] ?? '',
        classMatch = content.match(/\|\s*class\s*=\s*([^\|\}\n]+)/i),
        importanceMatch = content.match(/\|\s*importance\s*=\s*([^\|\}\n]+)/i),
        qualityClass = classMatch?.[1]?.trim() ?? null,
        importance = importanceMatch?.[1]?.trim() ?? null,
        lines = [`⭐ Article Quality — "${resolved}"`, ''];
      if (qualityClass) {
        const desc =
          {
            FA: '⭐ Featured Article — highest quality',
            GA: '🟢 Good Article — high quality, peer-reviewed',
            B: '🔵 B-class — mostly complete with some issues',
            C: '🟡 C-class — substantial but needs work',
            Start: '🟠 Start-class — rudimentary, needs expansion',
            Stub: '🔴 Stub — very short, major expansion needed',
            FL: '⭐ Featured List',
            List: '📋 List article',
          }[qualityClass] ?? qualityClass;
        lines.push(`• Quality class: ${desc}`);
      } else lines.push('• Quality class: Not assessed or not found');
      return (
        importance && lines.push(`• Importance: ${importance}`),
        qualityClass ||
          importance ||
          lines.push('', 'This article may not have a WikiProject quality assessment yet.'),
        lines.push(
          '',
          `🔗 https://en.wikipedia.org/wiki/${encodeURIComponent(`Talk:${resolved}`)}`,
          'Source: Wikipedia',
        ),
        lines.join('\n')
      );
    },
    get_wikipedia_hatnotes: async (params, onStage) => {
      const { title: title } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📌 Fetching hatnotes from "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&rvsection=0&format=json&origin=*`,
        ),
        wikitext = data?.parse?.wikitext?.['*'] ?? '',
        hatnotes = [],
        pattern =
          /\{\{(Main|See also|For|About|Redirect|Distinguish|Other uses|Further|Details)\|([^}]+)\}\}/gi;
      let match;
      for (; null !== (match = pattern.exec(wikitext)); ) {
        const type = match[1],
          args = match[2]
            .split('|')
            .map((a) => a.trim())
            .filter(Boolean)
            .join(', ');
        hatnotes.push(`• ${type}: ${args}`);
      }
      return 0 === hatnotes.length
        ? `No hatnotes found on "${resolved}". The article has no disambiguation or "see also" notices at the top.`
        : [
            `📌 Hatnotes on "${data.parse.title || resolved}"`,
            '',
            ...hatnotes,
            '',
            `🔗 https://en.wikipedia.org/wiki/${encoded}`,
            'Source: Wikipedia',
          ].join('\n');
    },
    get_wikipedia_table: async (params, onStage) => {
      const { title: title, table_index: table_index = 0 } = params;
      if (!title) throw new Error('Missing required param: title');
      onStage(`📊 Extracting table ${table_index} from "${title}"…`);
      const resolved = await resolveTitle(title),
        encoded = encodeURIComponent(resolved),
        data = await safeJson(
          `https://en.wikipedia.org/w/api.php?action=parse&page=${encoded}&prop=wikitext&format=json&origin=*`,
        ),
        tableMatches = [
          ...(data?.parse?.wikitext?.['*'] ?? '').matchAll(/\{\|[^\n]*wikitable[\s\S]*?\|\}/g),
        ];
      if (0 === tableMatches.length) return `No tables found in "${resolved}".`;
      const idx = Math.min(Number(table_index) || 0, tableMatches.length - 1),
        rows = tableMatches[idx][0]
          .split(/\n\|-/)
          .slice(1)
          .map((row) =>
            row
              .split(/\n[!|]/)
              .slice(1)
              .map((cell) =>
                cell
                  .replace(/\[\[([^\]|]*\|)?([^\]]+)\]\]/g, '$2')
                  .replace(/\{\{[^}]+\}\}/g, '')
                  .replace(/[<>]/g, '')
                  .replace(/'{2,3}/g, '')
                  .split('||')
                  .map((c) => c.trim())
                  .filter(Boolean),
              )
              .flat(),
          )
          .filter((r) => r.length > 0);
      if (0 === rows.length) return `Table ${idx} in "${resolved}" could not be parsed.`;
      const lines = [
        `📊 Table ${idx} from "${data.parse.title || resolved}" (${tableMatches.length} table${1 !== tableMatches.length ? 's' : ''} total)`,
        '',
      ];
      return (
        rows.forEach((row) => lines.push(row.join(' | '))),
        lines.push('', `🔗 https://en.wikipedia.org/wiki/${encoded}`, 'Source: Wikipedia'),
        lines.join('\n')
      );
    },
  },
});
