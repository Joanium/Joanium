import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';

// ── SearXNG multi-instance helper ────────────────────────────────────────────
// SearXNG is open-source meta-search: each instance aggregates results from
// Google, Bing, Brave, DuckDuckGo, and many others — no API key required.
// We try several public instances in order and return the first that responds.
const SEARX_INSTANCES = [
  'https://searx.be',
  'https://priv.au',
  'https://search.ononoki.org',
  'https://searxng.site',
  'https://search.mdosch.de',
  'https://searx.fmac.xyz',
];

async function fetchSearXNG(query) {
  for (const base of SEARX_INSTANCES) {
    try {
      const url = `${base}/search?q=${encodeURIComponent(query)}&format=json&categories=general&language=en-US`;
      const resp = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Joanium/1.0)' },
      });
      if (!resp.ok) continue;
      const data = await resp.json();
      if (data?.results?.length > 0) {
        data._instance = base.replace('https://', '');
        return data;
      }
    } catch {
      // instance unavailable — try the next one
    }
  }
  return null;
}

export const { handles: handles, execute: execute } = createExecutor({
  name: 'SearchExecutor',
  tools: toolsList,
  handlers: {
    search_web: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔍 Searching the web for "${query}"…`);

      // Fire all sources in parallel for maximum speed
      const [ddgResult, searxResult, wikiResult, hnResult] = await Promise.allSettled([
        // 1. DuckDuckGo Instant Answers – structured knowledge cards & infobox
        safeJson(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=0`,
        ),
        // 2. SearXNG – real ranked web results from Google, Bing, Brave & more
        fetchSearXNG(query),
        // 3. Wikipedia – free encyclopedia context
        safeJson(
          `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&srlimit=3&srprop=snippet`,
        ),
        // 4. HackerNews (via Algolia) – tech community discussions & links
        safeJson(
          `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=story&hitsPerPage=3`,
        ),
      ]);

      const ddg = ddgResult.status === 'fulfilled' ? ddgResult.value : null;
      const searx = searxResult.status === 'fulfilled' ? searxResult.value : null;
      const wiki = wikiResult.status === 'fulfilled' ? wikiResult.value : null;
      const hn = hnResult.status === 'fulfilled' ? hnResult.value : null;

      const lines = [`🔍 Web Search: "${query}"`, ''];
      const sources = new Set();

      // ── DuckDuckGo: Instant Answer / Abstract ─────────────────────────────
      if (ddg?.AbstractText) {
        lines.push('**Answer:**');
        lines.push(ddg.AbstractText);
        if (ddg.AbstractSource) {
          lines.push(`Source: ${ddg.AbstractSource} — ${ddg.AbstractURL || ''}`);
        }
        lines.push('');
        sources.add('DuckDuckGo');
      }
      if (ddg?.Answer && ddg.Answer !== ddg?.AbstractText) {
        lines.push(`**Instant Answer:** ${ddg.Answer}`);
        lines.push('');
        sources.add('DuckDuckGo');
      }
      if (ddg?.Definition) {
        lines.push(`**Definition:** ${ddg.Definition}`);
        ddg.DefinitionSource && lines.push(`Source: ${ddg.DefinitionSource}`);
        lines.push('');
        sources.add('DuckDuckGo');
      }

      // DuckDuckGo Infobox (structured key facts)
      const infobox = ddg?.Infobox?.content ?? [];
      if (infobox.length > 0) {
        lines.push('**Key Facts:**');
        infobox.slice(0, 8).forEach((item) => {
          item.label && item.value && lines.push(`  • ${item.label}: ${item.value}`);
        });
        lines.push('');
        sources.add('DuckDuckGo');
      }

      // ── SearXNG: Real Web Results ──────────────────────────────────────────
      const searxHits = searx?.results ?? [];
      if (searxHits.length > 0) {
        lines.push('**Web Results:**');
        searxHits.slice(0, 5).forEach((r, i) => {
          lines.push(`  ${i + 1}. **${r.title ?? 'Untitled'}**`);
          const snippet = (r.content ?? r.snippet ?? '').trim();
          if (snippet) {
            lines.push(`     ${snippet.slice(0, 160)}${snippet.length > 160 ? '…' : ''}`);
          }
          lines.push(`     🔗 ${r.url}`);
          lines.push('');
        });
        sources.add(`SearXNG (${searx._instance ?? 'public'})`);
      } else {
        // SearXNG unavailable – fall back to DuckDuckGo related topics & results
        const ddgResults = (ddg?.Results ?? []).filter((r) => r.Text && r.FirstURL);
        if (ddgResults.length > 0) {
          lines.push('**Top Results:**');
          ddgResults.slice(0, 4).forEach((r, i) => {
            lines.push(`  ${i + 1}. ${r.Text.slice(0, 100)}`);
            lines.push(`     🔗 ${r.FirstURL}`);
          });
          lines.push('');
          sources.add('DuckDuckGo');
        }
        const related = (ddg?.RelatedTopics ?? []).filter((t) => t.Text && t.FirstURL);
        if (related.length > 0) {
          lines.push('**Related Topics:**');
          related.slice(0, 6).forEach((t, i) => {
            const text = t.Text.slice(0, 120) + (t.Text.length > 120 ? '…' : '');
            lines.push(`  ${i + 1}. ${text}`);
            lines.push(`     🔗 ${t.FirstURL}`);
          });
          lines.push('');
          sources.add('DuckDuckGo');
        }
      }

      // ── Wikipedia ─────────────────────────────────────────────────────────
      const wikiHits = wiki?.query?.search ?? [];
      if (wikiHits.length > 0) {
        lines.push('**Wikipedia:**');
        wikiHits.slice(0, 2).forEach((r, i) => {
          const snippet = r.snippet.replace(/[<>]/g, '').trim();
          lines.push(
            `  ${i + 1}. **${r.title}** — ${snippet.slice(0, 130)}${snippet.length > 130 ? '…' : ''}`,
          );
          lines.push(
            `     🔗 https://en.wikipedia.org/wiki/${encodeURIComponent(r.title.replace(/ /g, '_'))}`,
          );
          lines.push('');
        });
        sources.add('Wikipedia');
      }

      // ── HackerNews ────────────────────────────────────────────────────────
      const hnHits = (hn?.hits ?? []).filter((h) => h.title && h.objectID);
      if (hnHits.length > 0) {
        lines.push('**HackerNews Discussions:**');
        hnHits.slice(0, 3).forEach((r, i) => {
          lines.push(`  ${i + 1}. **${r.title}**`);
          if (r.points) lines.push(`     ▲ ${r.points} pts  💬 ${r.num_comments ?? 0} comments`);
          lines.push(`     🔗 https://news.ycombinator.com/item?id=${r.objectID}`);
          if (r.url) lines.push(`     🌐 ${r.url}`);
          lines.push('');
        });
        sources.add('HackerNews');
      }

      if (lines.length <= 2) {
        lines.push(`No results found for "${query}".`);
        lines.push('');
        lines.push(
          `Try searching directly at: https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        );
      } else {
        lines.push(`Sources: ${[...sources].join(' · ')}`);
      }

      return lines.join('\n');
    },
    search_pypi: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐍 Searching PyPI for "${query}"…`);
      const data = await safeJson(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`).catch(
          () => null,
        ),
        lines = [`🐍 PyPI Search: "${query}"`, ''];
      if (!data)
        return (
          lines.push(`No exact PyPI match for "${query}".`),
          lines.push(`🔗 Try: https://pypi.org/search/?q=${encodeURIComponent(query)}`),
          lines.join('\n')
        );
      const info = data.info;
      (lines.push(`**${info.name}** — v${info.version}`),
        info.summary && lines.push(`${info.summary}`),
        lines.push(''),
        info.author && lines.push(`👤 **Author:** ${info.author}`),
        info.license && lines.push(`📄 **License:** ${info.license}`),
        info.requires_python && lines.push(`🐍 **Requires Python:** ${info.requires_python}`));
      const keywords = info.keywords
        ?.split(/[,\s]+/)
        .filter(Boolean)
        .slice(0, 6)
        .join(', ');
      return (
        keywords && lines.push(`🏷  **Keywords:** ${keywords}`),
        lines.push(''),
        lines.push(`🔗 **PyPI:** ${info.package_url}`),
        info.home_page && lines.push(`🏠 **Homepage:** ${info.home_page}`),
        info.docs_url && lines.push(`📚 **Docs:** ${info.docs_url}`),
        lines.push(''),
        lines.push('Source: pypi.org'),
        lines.join('\n')
      );
    },
    search_crates: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🦀 Searching crates.io for "${query}"…`);
      const data = await safeJson(
          `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=5`,
          { headers: { 'User-Agent': 'search-tool/1.0' } },
        ),
        lines = [`🦀 Crates.io Search: "${query}"`, ''],
        crates = data.crates ?? [];
      return 0 === crates.length
        ? (lines.push(`No crates found for "${query}".`),
          lines.push(`🔗 https://crates.io/search?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (crates.forEach((c, i) => {
            (lines.push(`**${i + 1}. ${c.name}** — v${c.newest_version}`),
              c.description && lines.push(`   ${c.description}`),
              lines.push(`   📥 ${Number(c.downloads).toLocaleString()} total downloads`));
            const updated = c.updated_at ? new Date(c.updated_at).toLocaleDateString() : null;
            (updated && lines.push(`   🕒 Updated: ${updated}`),
              lines.push(`   🔗 https://crates.io/crates/${c.name}`),
              lines.push(`   📚 https://docs.rs/${c.name}`),
              lines.push(''));
          }),
          lines.push('Source: crates.io'),
          lines.join('\n'));
    },
    search_docker: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐳 Searching Docker Hub for "${query}"…`);
      const data = await safeJson(
          `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(query)}&page_size=5`,
        ),
        lines = [`🐳 Docker Hub Search: "${query}"`, ''],
        results = data.results ?? [];
      return 0 === results.length
        ? (lines.push(`No Docker images found for "${query}".`),
          lines.push(`🔗 https://hub.docker.com/search?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (results.forEach((r, i) => {
            const name = r.repo_name ?? r.name,
              official = r.is_official ? ' ✅ Official' : '';
            (lines.push(`**${i + 1}. ${name}**${official}`),
              r.short_description && lines.push(`   ${r.short_description}`),
              lines.push(
                `   ⭐ ${Number(r.star_count ?? 0).toLocaleString()} stars  📥 ${Number(r.pull_count ?? 0).toLocaleString()} pulls`,
              ),
              lines.push(`   🔗 https://hub.docker.com/r/${name}`),
              lines.push(''));
          }),
          lines.push('Source: hub.docker.com'),
          lines.join('\n'));
    },
    search_arxiv: async (params, onStage) => {
      const { query: query, max_results: max_results = 5 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const limit = Math.min(Number(max_results) || 5, 10);
      onStage(`📄 Searching arXiv for "${query}"…`);
      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`,
        xml = await fetch(url).then((r) => r.text()),
        lines = [`📄 arXiv Search: "${query}"`, ''],
        entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];
      return 0 === entries.length
        ? (lines.push(`No arXiv papers found for "${query}".`),
          lines.push(
            `🔗 https://arxiv.org/search/?searchtype=all&query=${encodeURIComponent(query)}`,
          ),
          lines.join('\n'))
        : (entries.forEach((match, i) => {
            const entry = match[1],
              title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
                .replace(/\s+/g, ' ')
                .trim(),
              summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? '')
                .replace(/\s+/g, ' ')
                .trim(),
              arxivId = (entry.match(/<id>(.*?)<\/id>/)?.[1] ?? '')
                .trim()
                .replace('http://arxiv.org/abs/', '')
                .replace('https://arxiv.org/abs/', ''),
              published = entry.match(/<published>(.*?)<\/published>/)?.[1]?.slice(0, 10) ?? '',
              authors = [...entry.matchAll(/<n>(.*?)<\/name>/g)]
                .map((m) => m[1].trim())
                .slice(0, 3)
                .join(', ');
            (lines.push(`**${i + 1}. ${title}**`),
              authors && lines.push(`   👤 ${authors}${entries.length > 3 ? ' et al.' : ''}`),
              published && lines.push(`   📅 ${published}`),
              summary &&
                lines.push(`   ${summary.slice(0, 200)}${summary.length > 200 ? '…' : ''}`),
              arxivId &&
                (lines.push(`   🔗 https://arxiv.org/abs/${arxivId}`),
                lines.push(`   📥 https://arxiv.org/pdf/${arxivId}.pdf`)),
              lines.push(''));
          }),
          lines.push('Source: arxiv.org'),
          lines.join('\n'));
    },
    search_books: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`📚 Searching Open Library for "${query}"…`);
      const data = await safeJson(
          `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=key,title,author_name,first_publish_year,edition_count,subject,isbn`,
        ),
        lines = [`📚 Books Search: "${query}"`, ''],
        docs = data.docs ?? [];
      return 0 === docs.length
        ? (lines.push(`No books found for "${query}".`),
          lines.push(`🔗 https://openlibrary.org/search?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (docs.forEach((book, i) => {
            lines.push(`**${i + 1}. ${book.title}**`);
            const authors = (book.author_name ?? []).slice(0, 3).join(', ');
            (authors && lines.push(`   👤 ${authors}`),
              book.first_publish_year &&
                lines.push(`   📅 First published: ${book.first_publish_year}`),
              book.edition_count && lines.push(`   📖 ${book.edition_count} editions`));
            const subjects = (book.subject ?? []).slice(0, 4).join(', ');
            (subjects && lines.push(`   🏷  ${subjects}`),
              book.key && lines.push(`   🔗 https://openlibrary.org${book.key}`),
              lines.push(''));
          }),
          lines.push('Source: openlibrary.org'),
          lines.join('\n'));
    },
    search_movies: async (params, onStage) => {
      const { query: query, type: type } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🎬 Searching for "${query}"…`);
      const apiKey = process.env.OMDB_API_KEY ?? 'trilogy',
        typeParam = type ? `&type=${encodeURIComponent(type)}` : '',
        searchData = await safeJson(
          `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${apiKey}${typeParam}`,
        ),
        lines = [`🎬 Movie/Show Search: "${query}"`, ''];
      if ('False' === searchData.Response)
        return (
          lines.push(`No results found: ${searchData.Error ?? 'Unknown error'}`),
          lines.join('\n')
        );
      const results = (searchData.Search ?? []).slice(0, 5),
        top = results[0];
      if (top?.imdbID) {
        const detail = await safeJson(
          `https://www.omdbapi.com/?i=${top.imdbID}&apikey=${apiKey}&plot=short`,
        );
        'False' !== detail.Response &&
          (lines.push(`**${detail.Title}** (${detail.Year})`),
          lines.push(`   🎭 ${detail.Type}  •  ⭐ IMDb: ${detail.imdbRating}  •  ${detail.Rated}`),
          detail.Genre && lines.push(`   🏷  ${detail.Genre}`),
          detail.Director &&
            'N/A' !== detail.Director &&
            lines.push(`   🎬 Director: ${detail.Director}`),
          detail.Actors && 'N/A' !== detail.Actors && lines.push(`   👤 Cast: ${detail.Actors}`),
          detail.Plot && 'N/A' !== detail.Plot && lines.push(`   📝 ${detail.Plot}`),
          detail.Runtime && 'N/A' !== detail.Runtime && lines.push(`   ⏱  ${detail.Runtime}`),
          lines.push(`   🔗 https://www.imdb.com/title/${detail.imdbID}/`),
          lines.push(''));
      }
      return (
        results.length > 1 &&
          (lines.push('**Also found:**'),
          results.slice(1).forEach((r, i) => {
            lines.push(
              `  ${i + 2}. ${r.Title} (${r.Year}) — ${r.Type}  🔗 https://www.imdb.com/title/${r.imdbID}/`,
            );
          }),
          lines.push('')),
        lines.push('Source: omdbapi.com'),
        lines.join('\n')
      );
    },
    search_producthunt: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🚀 Searching Product Hunt for "${query}"…`);
      const data = await safeJson(
          `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:producthunt.com')}&format=json&no_redirect=1&no_html=1`,
        ),
        lines = [`🚀 Product Hunt Search: "${query}"`, ''],
        related = (data.RelatedTopics ?? []).filter((t) => {
          if (!t.Text || !t.FirstURL) return false;
          try {
            const h = new URL(t.FirstURL).hostname;
            return h === 'producthunt.com' || h.endsWith('.producthunt.com');
          } catch {
            return false;
          }
        });
      return 0 === related.length
        ? (lines.push(`No Product Hunt results found for "${query}".`),
          lines.push(`🔗 https://www.producthunt.com/search?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (related.slice(0, 6).forEach((t, i) => {
            (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}${t.Text.length > 140 ? '…' : ''}`),
              lines.push(`   🔗 ${t.FirstURL}`),
              lines.push(''));
          }),
          lines.push('Source: producthunt.com'),
          lines.join('\n'));
    },
    search_cve: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔒 Searching CVE database for "${query}"…`);
      const lines = [`🔒 CVE Search: "${query}"`, ''];
      if (/^CVE-\d{4}-\d+$/i.test(query.trim())) {
        const cveId = query.trim().toUpperCase(),
          data = await safeJson(
            `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`,
          ),
          vuln = data.vulnerabilities?.[0]?.cve;
        if (!vuln) return (lines.push(`CVE "${cveId}" not found.`), lines.join('\n'));
        const desc = vuln.descriptions?.find((d) => 'en' === d.lang)?.value ?? 'No description',
          cvssV3 =
            vuln.metrics?.cvssMetricV31?.[0]?.cvssData ??
            vuln.metrics?.cvssMetricV30?.[0]?.cvssData,
          published = vuln.published?.slice(0, 10),
          modified = vuln.lastModified?.slice(0, 10);
        if (
          (lines.push(`**${cveId}**`),
          published && lines.push(`📅 Published: ${published}  •  Modified: ${modified}`),
          cvssV3)
        ) {
          const severity = cvssV3.baseSeverity ?? '',
            score = cvssV3.baseScore ?? '',
            vector = cvssV3.vectorString ?? '';
          lines.push(`⚠️  CVSS v3: ${score} (${severity})  •  ${vector}`);
        }
        (lines.push(''), lines.push(`📝 ${desc}`), lines.push(''));
        const refs = (vuln.references ?? []).slice(0, 3);
        (refs.length > 0 &&
          (lines.push('**References:**'), refs.forEach((r) => lines.push(`  🔗 ${r.url}`))),
          lines.push(''),
          lines.push(`🔗 https://nvd.nist.gov/vuln/detail/${cveId}`));
      } else {
        const data = await safeJson(
            `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}&resultsPerPage=5`,
          ).catch(() => null),
          vulns = data?.vulnerabilities ?? [];
        if (0 === vulns.length)
          return (
            lines.push(`No CVEs found for "${query}".`),
            lines.push(
              `🔗 https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(query)}`,
            ),
            lines.join('\n')
          );
        (lines.push(
          `Found ${data.totalResults?.toLocaleString() ?? vulns.length} total CVEs — showing top ${vulns.length}:`,
        ),
          lines.push(''),
          vulns.forEach((v, i) => {
            const cve = v.cve,
              id = cve.id,
              desc = (cve.descriptions?.find((d) => 'en' === d.lang)?.value ?? '').slice(0, 180),
              cvss =
                cve.metrics?.cvssMetricV31?.[0]?.cvssData ??
                cve.metrics?.cvssMetricV30?.[0]?.cvssData,
              date = cve.published?.slice(0, 10);
            (lines.push(`**${i + 1}. ${id}**${date ? `  (${date})` : ''}`),
              cvss && lines.push(`   ⚠️  CVSS: ${cvss.baseScore} ${cvss.baseSeverity}`),
              desc && lines.push(`   ${desc}${desc.length >= 180 ? '…' : ''}`),
              lines.push(`   🔗 https://nvd.nist.gov/vuln/detail/${id}`),
              lines.push(''));
          }));
      }
      return (lines.push('Source: nvd.nist.gov'), lines.join('\n'));
    },
    search_wayback: async (params, onStage) => {
      const { url: url, timestamp: timestamp } = params;
      if (!url?.trim()) throw new Error('Missing required param: url');
      onStage(`🕰️ Checking Wayback Machine for "${url}"…`);
      const tsParam = timestamp ? `&timestamp=${timestamp}` : '',
        data = await safeJson(
          `https://archive.org/wayback/available?url=${encodeURIComponent(url)}${tsParam}`,
        ),
        lines = [`🕰️ Wayback Machine: "${url}"`, ''],
        snapshot = data.archived_snapshots?.closest;
      if (!snapshot?.available)
        return (
          lines.push('No archived snapshots found for this URL.'),
          lines.push(`🔗 Try searching manually: https://web.archive.org/web/*/${url}`),
          lines.join('\n')
        );
      const ts = snapshot.timestamp ?? '',
        year = ts.slice(0, 4),
        month = ts.slice(4, 6),
        day = ts.slice(6, 8),
        hour = ts.slice(8, 10),
        min = ts.slice(10, 12),
        sec = ts.slice(12, 14),
        humanDate = ts ? `${year}-${month}-${day} ${hour}:${min}:${sec} UTC` : 'Unknown',
        statusEmoji =
          '200' === snapshot.status
            ? '✅'
            : '301' === snapshot.status || '302' === snapshot.status
              ? '↪️'
              : '⚠️';
      return (
        lines.push('✅ Snapshot found!'),
        lines.push(`📅 **Archived on:** ${humanDate}`),
        lines.push(`${statusEmoji} **HTTP Status:** ${snapshot.status}`),
        lines.push(''),
        lines.push('🔗 **View archived page:**'),
        lines.push(`   ${snapshot.url}`),
        lines.push(''),
        lines.push('📂 **All snapshots for this URL:**'),
        lines.push(`   https://web.archive.org/web/*/${url}`),
        lines.push(''),
        lines.push('Source: archive.org / Wayback Machine'),
        lines.join('\n')
      );
    },
    search_maven: async (params, onStage) => {
      const { query: query, max_results: max_results = 5 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const limit = Math.min(Number(max_results) || 5, 10);
      onStage(`☕ Searching Maven Central for "${query}"…`);
      const data = await safeJson(
          `https://search.maven.org/solrsearch/select?q=${encodeURIComponent(query)}&rows=${limit}&wt=json`,
        ),
        lines = [`☕ Maven Central Search: "${query}"`, ''],
        docs = data.response?.docs ?? [];
      return 0 === docs.length
        ? (lines.push(`No Maven artifacts found for "${query}".`),
          lines.push(`🔗 https://search.maven.org/search?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (docs.forEach((doc, i) => {
            const coord = `${doc.g}:${doc.a}`;
            (lines.push(`**${i + 1}. ${coord}** — v${doc.latestVersion}`),
              doc.repositoryId && lines.push(`   🗄  Repository: ${doc.repositoryId}`),
              lines.push(`   📅 Last updated: ${new Date(doc.timestamp).toLocaleDateString()}`),
              lines.push(`   📦 Versions available: ${(doc.versionCount ?? 0).toLocaleString()}`),
              lines.push(''),
              lines.push('   **Maven (pom.xml):**'),
              lines.push('   ```xml'),
              lines.push('   <dependency>'),
              lines.push(`     <groupId>${doc.g}</groupId>`),
              lines.push(`     <artifactId>${doc.a}</artifactId>`),
              lines.push(`     <version>${doc.latestVersion}</version>`),
              lines.push('   </dependency>'),
              lines.push('   ```'),
              lines.push(`   **Gradle:** \`implementation '${coord}:${doc.latestVersion}'\``),
              lines.push(`   🔗 https://search.maven.org/artifact/${doc.g}/${doc.a}`),
              lines.push(''));
          }),
          lines.push('Source: search.maven.org'),
          lines.join('\n'));
    },
    search_nuget: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🟣 Searching NuGet for "${query}"…`);
      const data = await safeJson(
          `https://azuresearch-usnc.nuget.org/query?q=${encodeURIComponent(query)}&take=5&prerelease=false`,
        ),
        lines = [`🟣 NuGet Search: "${query}"`, ''],
        pkgs = data.data ?? [];
      return 0 === pkgs.length
        ? (lines.push(`No NuGet packages found for "${query}".`),
          lines.push(`🔗 https://www.nuget.org/packages?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (pkgs.forEach((p, i) => {
            (lines.push(`**${i + 1}. ${p.id}** — v${p.version}`),
              p.description &&
                lines.push(
                  `   ${p.description.slice(0, 150)}${p.description.length > 150 ? '…' : ''}`,
                ));
            const authors = Array.isArray(p.authors) ? p.authors.slice(0, 3).join(', ') : p.authors;
            (authors && lines.push(`   👤 ${authors}`),
              null != p.totalDownloads &&
                lines.push(`   📥 ${Number(p.totalDownloads).toLocaleString()} total downloads`));
            const tags = (p.tags ?? []).slice(0, 5).join(', ');
            (tags && lines.push(`   🏷  ${tags}`),
              lines.push(`   📋 **Install:** \`dotnet add package ${p.id}\``),
              lines.push(`   🔗 https://www.nuget.org/packages/${p.id}`),
              lines.push(''));
          }),
          lines.push('Source: nuget.org'),
          lines.join('\n'));
    },
    search_packagist: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐘 Searching Packagist for "${query}"…`);
      const data = await safeJson(
          `https://packagist.org/search.json?q=${encodeURIComponent(query)}&per_page=5`,
        ),
        lines = [`🐘 Packagist Search: "${query}"`, ''],
        results = data.results ?? [];
      return 0 === results.length
        ? (lines.push(`No Composer packages found for "${query}".`),
          lines.push(`🔗 https://packagist.org/?query=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (results.forEach((p, i) => {
            (lines.push(`**${i + 1}. ${p.name}**`),
              p.description &&
                lines.push(
                  `   ${p.description.slice(0, 150)}${p.description.length > 150 ? '…' : ''}`,
                ),
              null != p.downloads &&
                lines.push(`   📥 ${Number(p.downloads).toLocaleString()} total downloads`),
              null != p.favers && lines.push(`   ⭐ ${Number(p.favers).toLocaleString()} stars`),
              lines.push(`   📋 **Install:** \`composer require ${p.name}\``),
              lines.push(`   🔗 https://packagist.org/packages/${p.name}`),
              lines.push(''));
          }),
          lines.push('Source: packagist.org'),
          lines.join('\n'));
    },
    search_rubygems: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`💎 Searching RubyGems for "${query}"…`);
      const gems = await safeJson(
          `https://rubygems.org/api/v1/search.json?query=${encodeURIComponent(query)}&per_page=5`,
        ),
        lines = [`💎 RubyGems Search: "${query}"`, ''];
      return Array.isArray(gems) && 0 !== gems.length
        ? (gems.slice(0, 5).forEach((g, i) => {
            (lines.push(`**${i + 1}. ${g.name}** — v${g.version}`),
              g.info && lines.push(`   ${g.info.slice(0, 150)}${g.info.length > 150 ? '…' : ''}`));
            const authors = g.authors;
            (authors && lines.push(`   👤 ${authors}`),
              null != g.downloads &&
                lines.push(`   📥 ${Number(g.downloads).toLocaleString()} total downloads`),
              g.licenses?.length && lines.push(`   📄 License: ${g.licenses.join(', ')}`),
              lines.push(`   📋 **Install:** \`gem install ${g.name}\``),
              lines.push(`   📋 **Gemfile:** \`gem '${g.name}'\``),
              lines.push(`   🔗 https://rubygems.org/gems/${g.name}`),
              g.homepage_uri && lines.push(`   🏠 ${g.homepage_uri}`),
              lines.push(''));
          }),
          lines.push('Source: rubygems.org'),
          lines.join('\n'))
        : (lines.push(`No gems found for "${query}".`),
          lines.push(`🔗 https://rubygems.org/search?query=${encodeURIComponent(query)}`),
          lines.join('\n'));
    },
    search_pub: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🎯 Searching pub.dev for "${query}"…`);
      const data = await safeJson(
          `https://pub.dev/api/search?q=${encodeURIComponent(query)}&per_page=5`,
        ),
        lines = [`🎯 pub.dev Search: "${query}"`, ''],
        packages = data.packages ?? [];
      return 0 === packages.length
        ? (lines.push(`No Dart/Flutter packages found for "${query}".`),
          lines.push(`🔗 https://pub.dev/packages?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (await Promise.all(
            packages.slice(0, 5).map(async (p, i) => {
              const detail = await safeJson(`https://pub.dev/api/packages/${p.package}`).catch(
                  () => null,
                ),
                info = detail?.latest?.pubspec ?? {},
                score = detail?.score ?? {};
              (lines.push(`**${i + 1}. ${p.package}** — v${info.version ?? '?'}`),
                info.description && lines.push(`   ${info.description.slice(0, 150)}`),
                detail?.latest?.published &&
                  lines.push(`   📅 Published: ${detail.latest.published.slice(0, 10)}`),
                null != score.grantedPoints &&
                  lines.push(
                    `   🏆 Pub points: ${score.grantedPoints}/${score.maxPoints ?? 160}  •  Popularity: ${Math.round(100 * (score.popularityScore ?? 0))}%`,
                  ),
                lines.push(`   📋 **pubspec.yaml:** \`${p.package}: ^${info.version ?? ''}\``),
                lines.push(`   🔗 https://pub.dev/packages/${p.package}`),
                lines.push(''));
            }),
          ),
          lines.push('Source: pub.dev'),
          lines.join('\n'));
    },
    search_hex: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`💧 Searching Hex.pm for "${query}"…`);
      const data = await safeJson(
          `https://hex.pm/api/packages?search=${encodeURIComponent(query)}&sort=recent_downloads&page=1`,
          { headers: { 'User-Agent': 'search-tool/1.0' } },
        ),
        lines = [`💧 Hex.pm Search: "${query}"`, ''],
        pkgs = Array.isArray(data) ? data.slice(0, 5) : [];
      return 0 === pkgs.length
        ? (lines.push(`No Hex packages found for "${query}".`),
          lines.push(`🔗 https://hex.pm/packages?search=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (pkgs.forEach((p, i) => {
            const latest = p.releases?.[0] ?? {};
            (lines.push(`**${i + 1}. ${p.name}** — v${latest.version ?? '?'}`),
              p.meta?.description && lines.push(`   ${p.meta.description.slice(0, 150)}`),
              null != p.downloads?.all &&
                lines.push(`   📥 ${Number(p.downloads.all).toLocaleString()} total downloads`));
            const licenses = (p.meta?.licenses ?? []).join(', ');
            licenses && lines.push(`   📄 License: ${licenses}`);
            const links = p.meta?.links ?? {};
            (links.GitHub && lines.push(`   🐙 ${links.GitHub}`),
              lines.push(`   📋 **mix.exs:** \`{:${p.name}, "~> ${latest.version ?? ''}"}\``),
              lines.push(`   🔗 https://hex.pm/packages/${p.name}`),
              lines.push(`   📚 https://hexdocs.pm/${p.name}`),
              lines.push(''));
          }),
          lines.push('Source: hex.pm'),
          lines.join('\n'));
    },
    search_hackage: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`λ Searching Hackage for "${query}"…`);
      const lines = [`λ Hackage Search: "${query}"`, ''],
        exact = await safeJson(
          `https://hackage.haskell.org/package/${encodeURIComponent(query)}.json`,
        ).catch(() => null);
      if (exact) {
        const versions = Object.keys(exact).sort().reverse(),
          latest = versions[0];
        lines.push(`**${query}** — v${latest}`);
        const normalDeprecated = exact[latest]?.normal ?? exact[latest];
        (normalDeprecated?.synopsis && lines.push(`   ${normalDeprecated.synopsis}`),
          lines.push(`   📦 ${versions.length} versions available`),
          lines.push(`   📋 **cabal:** \`build-depends: ${query} >= ${latest}\``),
          lines.push(`   📋 **stack / package.yaml:** \`- ${query}\``),
          lines.push(`   🔗 https://hackage.haskell.org/package/${query}`),
          lines.push(`   📚 https://hackage.haskell.org/package/${query}/docs`));
      } else {
        const related = (
          (
            await safeJson(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:hackage.haskell.org')}&format=json&no_redirect=1&no_html=1`,
            )
          ).RelatedTopics ?? []
        ).filter((t) => {
          if (!t.Text || !t.FirstURL) return false;
          try {
            const h = new URL(t.FirstURL).hostname;
            return h === 'hackage.haskell.org' || h.endsWith('.hackage.haskell.org');
          } catch {
            return false;
          }
        });
        if (0 === related.length)
          return (
            lines.push(`No Hackage results for "${query}".`),
            lines.push(
              `🔗 https://hackage.haskell.org/packages/search?terms=${encodeURIComponent(query)}`,
            ),
            lines.join('\n')
          );
        related.slice(0, 5).forEach((t, i) => {
          (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}${t.Text.length > 140 ? '…' : ''}`),
            lines.push(`   🔗 ${t.FirstURL}`),
            lines.push(''));
        });
      }
      return (lines.push(''), lines.push('Source: hackage.haskell.org'), lines.join('\n'));
    },
    search_cpan: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐪 Searching CPAN for "${query}"…`);
      const data = await safeJson(
          `https://fastapi.metacpan.org/v1/search?q=${encodeURIComponent(query)}&size=5`,
        ).catch(() => null),
        lines = [`🐪 MetaCPAN Search: "${query}"`, ''],
        hits = data?.hits?.hits ?? [];
      return 0 === hits.length
        ? (lines.push(`No CPAN modules found for "${query}".`),
          lines.push(`🔗 https://metacpan.org/search?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (hits.forEach((hit, i) => {
            const src = hit._source ?? {},
              name = src.module?.[0]?.name ?? src.name ?? src.distribution ?? 'Unknown';
            (lines.push(`**${i + 1}. ${name}**`),
              src.abstract && lines.push(`   ${src.abstract.slice(0, 150)}`),
              src.author && lines.push(`   👤 ${src.author}`),
              src.version && lines.push(`   🏷  v${src.version}`),
              src.distribution &&
                (lines.push(
                  `   📋 **Install:** \`cpan ${src.distribution}\`  or  \`cpanm ${src.distribution}\``,
                ),
                lines.push(`   🔗 https://metacpan.org/dist/${src.distribution}`)),
              lines.push(''));
          }),
          lines.push('Source: metacpan.org'),
          lines.join('\n'));
    },
    search_conda: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐍🔬 Searching conda-forge for "${query}"…`);
      const data = await safeJson(
          `https://api.anaconda.org/search?name=${encodeURIComponent(query)}&type=conda&limit=5`,
        ).catch(() => null),
        lines = [`🔬 Conda Search: "${query}"`, ''],
        pkgs = Array.isArray(data) ? data.slice(0, 5) : [];
      return 0 === pkgs.length
        ? (lines.push(`No conda packages found for "${query}".`),
          lines.push(`🔗 https://anaconda.org/search?q=${encodeURIComponent(query)}`),
          lines.push('🔗 https://conda-forge.org/packages/ (conda-forge)'),
          lines.join('\n'))
        : (pkgs.forEach((p, i) => {
            const channel = p.channel ?? p.owner?.login ?? 'unknown';
            (lines.push(`**${i + 1}. ${p.name}** (${channel})`),
              p.summary && lines.push(`   ${p.summary.slice(0, 150)}`),
              p.latest_version && lines.push(`   🏷  Latest: v${p.latest_version}`),
              p.conda_platforms?.length &&
                lines.push(`   💻 Platforms: ${p.conda_platforms.slice(0, 4).join(', ')}`),
              lines.push(`   📋 **Install:** \`conda install -c ${channel} ${p.name}\``),
              'conda-forge' === channel &&
                lines.push(`   📋 **or:** \`conda install -c conda-forge ${p.name}\``),
              lines.push(`   🔗 https://anaconda.org/${channel}/${p.name}`),
              lines.push(''));
          }),
          lines.push('Source: anaconda.org'),
          lines.join('\n'));
    },
    search_swift: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🍎 Searching Swift Package Index for "${query}"…`);
      const data = await safeJson(
          `https://swiftpackageindex.com/api/search?query=${encodeURIComponent(query)}`,
        ).catch(() => null),
        lines = [`🍎 Swift Package Index: "${query}"`, ''],
        results = data?.results ?? data?.packages ?? [];
      return 0 === results.length
        ? (lines.push(`No Swift packages found for "${query}".`),
          lines.push(`🔗 https://swiftpackageindex.com/search?query=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (results.slice(0, 5).forEach((p, i) => {
            const name = p.packageName ?? p.name ?? p.repositoryName ?? 'Unknown',
              owner = p.repositoryOwner ?? p.owner ?? '';
            (lines.push(`**${i + 1}. ${name}**${owner ? ` by ${owner}` : ''}`),
              p.summary && lines.push(`   ${p.summary.slice(0, 150)}`),
              null != p.stars && lines.push(`   ⭐ ${Number(p.stars).toLocaleString()} stars`),
              p.lastActivityAt &&
                lines.push(`   📅 Last active: ${p.lastActivityAt.slice(0, 10)}`));
            const repo = p.repositoryUrl ?? (owner ? `https://github.com/${owner}/${name}` : null);
            repo &&
              (lines.push(`   📋 **Package.swift:** \`.package(url: "${repo}", from: "...")`),
              lines.push(`   🔗 ${repo}`));
            const spiUrl =
              p.url ?? (owner ? `https://swiftpackageindex.com/${owner}/${name}` : null);
            (spiUrl && lines.push(`   📚 ${spiUrl}`), lines.push(''));
          }),
          lines.push('Source: swiftpackageindex.com'),
          lines.join('\n'));
    },
    search_julia: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🟣 Searching Julia packages for "${query}"…`);
      const data = await safeJson('https://juliahub.com/app/packages/info').catch(() => null),
        lines = [`🟣 Julia Package Search: "${query}"`, ''];
      if (Array.isArray(data)) {
        const q = query.toLowerCase(),
          matches = data
            .filter(
              (p) => p.name?.toLowerCase().includes(q) || p.description?.toLowerCase().includes(q),
            )
            .slice(0, 5);
        if (matches.length > 0)
          return (
            matches.forEach((p, i) => {
              (lines.push(`**${i + 1}. ${p.name}**`),
                p.description && lines.push(`   ${p.description.slice(0, 150)}`),
                null != p.stars && lines.push(`   ⭐ ${Number(p.stars).toLocaleString()} stars`),
                p.version && lines.push(`   🏷  v${p.version}`),
                lines.push(`   📋 **Pkg.jl:** \`] add ${p.name}\``),
                p.url && lines.push(`   🔗 ${p.url}`),
                lines.push(`   📚 https://juliahub.com/ui/Packages/${p.name}`),
                lines.push(''));
            }),
            lines.push('Source: juliahub.com'),
            lines.join('\n')
          );
      }
      const related = (
        (
          await safeJson(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' julia package site:juliahub.com OR site:juliaobserver.com')}&format=json&no_redirect=1&no_html=1`,
          )
        ).RelatedTopics ?? []
      ).filter((t) => t.Text && t.FirstURL);
      return 0 === related.length
        ? (lines.push(`No Julia packages found for "${query}".`),
          lines.push(`🔗 https://juliahub.com/app/packages?q=${encodeURIComponent(query)}`),
          lines.push(`📋 **Install:** \`] add ${query}\``),
          lines.join('\n'))
        : (related.slice(0, 5).forEach((t, i) => {
            (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}${t.Text.length > 140 ? '…' : ''}`),
              lines.push(`   🔗 ${t.FirstURL}`),
              lines.push(''));
          }),
          lines.push('Source: juliahub.com'),
          lines.join('\n'));
    },
    search_gradle: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐘 Searching Gradle Plugin Portal for "${query}"…`);
      const data = await safeJson(
          `https://plugins.gradle.org/search?term=${encodeURIComponent(query)}&start=0&limit=5`,
        ).catch(() => null),
        lines = [`🐘 Gradle Plugin Search: "${query}"`, ''],
        plugins = data?.hits ?? [];
      if (0 === plugins.length) {
        const related = (
          (
            await safeJson(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:plugins.gradle.org')}&format=json&no_redirect=1&no_html=1`,
            )
          ).RelatedTopics ?? []
        ).filter((t) => {
          if (!t.Text || !t.FirstURL) return false;
          try {
            const h = new URL(t.FirstURL).hostname;
            return h === 'plugins.gradle.org' || h.endsWith('.plugins.gradle.org');
          } catch {
            return false;
          }
        });
        return 0 === related.length
          ? (lines.push(`No Gradle plugins found for "${query}".`),
            lines.push(`🔗 https://plugins.gradle.org/search?term=${encodeURIComponent(query)}`),
            lines.join('\n'))
          : (related.slice(0, 5).forEach((t, i) => {
              (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}${t.Text.length > 140 ? '…' : ''}`),
                lines.push(`   🔗 ${t.FirstURL}`),
                lines.push(''));
            }),
            lines.push('Source: plugins.gradle.org'),
            lines.join('\n'));
      }
      return (
        plugins.forEach((p, i) => {
          (lines.push(`**${i + 1}. ${p.id ?? p.pluginId}** — v${p.version ?? '?'}`),
            p.description && lines.push(`   ${p.description.slice(0, 150)}`),
            p.website && lines.push(`   🏠 ${p.website}`));
          const pluginId = p.id ?? p.pluginId,
            version = p.version ?? '';
          (lines.push(''),
            lines.push('   **Kotlin DSL (build.gradle.kts):**'),
            lines.push('   ```kotlin'),
            lines.push('   plugins {'),
            lines.push(`     id("${pluginId}") version "${version}"`),
            lines.push('   }'),
            lines.push('   ```'),
            lines.push(`   🔗 https://plugins.gradle.org/plugin/${pluginId}`),
            lines.push(''));
        }),
        lines.push('Source: plugins.gradle.org'),
        lines.join('\n')
      );
    },
    search_cocoapods: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🍫 Searching CocoaPods for "${query}"…`);
      const exact = await safeJson(
          `https://trunk.cocoapods.org/api/v1/pods/${encodeURIComponent(query)}`,
        ).catch(() => null),
        lines = [`🍫 CocoaPods Search: "${query}"`, ''];
      if (exact) {
        const latest = exact.versions?.sort((a, b) =>
          b.name?.localeCompare(a.name, void 0, { numeric: !0 }),
        )?.[0];
        if (
          (lines.push(`**${exact.name ?? query}** — v${latest?.name ?? '?'}`),
          exact.summary && lines.push(`   ${exact.summary}`),
          exact.description && lines.push(`   ${exact.description.slice(0, 200)}`),
          exact.authors)
        ) {
          const authNames =
            'object' == typeof exact.authors
              ? Object.keys(exact.authors).join(', ')
              : String(exact.authors);
          lines.push(`   👤 ${authNames}`);
        }
        if (
          (exact.license?.type && lines.push(`   📄 License: ${exact.license.type}`),
          exact.platforms)
        ) {
          const plats = Object.entries(exact.platforms)
            .map(([k, v]) => `${k} ${v}`)
            .join(', ');
          lines.push(`   📱 Platforms: ${plats}`);
        }
        (lines.push(''),
          lines.push('   **Podfile:**'),
          lines.push(`   \`pod '${exact.name ?? query}', '~> ${latest?.name ?? ''}'\``),
          lines.push(`   🔗 https://cocoapods.org/pods/${exact.name ?? query}`));
      } else {
        const related = (
          (
            await safeJson(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:cocoapods.org/pods')}&format=json&no_redirect=1&no_html=1`,
            )
          ).RelatedTopics ?? []
        ).filter((t) => {
          if (!t.Text || !t.FirstURL) return false;
          try {
            const h = new URL(t.FirstURL).hostname;
            return h === 'cocoapods.org' || h.endsWith('.cocoapods.org');
          } catch {
            return false;
          }
        });
        if (0 === related.length)
          return (
            lines.push(`No CocoaPods results for "${query}".`),
            lines.push(`🔗 https://cocoapods.org/pods?q=${encodeURIComponent(query)}`),
            lines.join('\n')
          );
        related.slice(0, 5).forEach((t, i) => {
          (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}${t.Text.length > 140 ? '…' : ''}`),
            lines.push(`   🔗 ${t.FirstURL}`),
            lines.push(''));
        });
      }
      return (lines.push(''), lines.push('Source: cocoapods.org'), lines.join('\n'));
    },
    search_homebrew: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🍺 Searching Homebrew for "${query}"…`);
      const lines = [`🍺 Homebrew Search: "${query}"`, ''],
        formula = await safeJson(
          `https://formulae.brew.sh/api/formula/${encodeURIComponent(query.toLowerCase())}.json`,
        ).catch(() => null);
      if (formula) {
        (lines.push(`**${formula.name}** — v${formula.versions?.stable ?? '?'}`),
          formula.desc && lines.push(`   ${formula.desc}`),
          formula.homepage && lines.push(`   🏠 ${formula.homepage}`),
          formula.license && lines.push(`   📄 License: ${formula.license}`));
        const deps = (formula.dependencies ?? []).slice(0, 6).join(', ');
        deps && lines.push(`   🔗 Dependencies: ${deps}`);
        const installCount = formula.analytics?.install?.['365d']?.formula?.[formula.name];
        (installCount &&
          lines.push(`   📥 ~${Number(installCount).toLocaleString()} installs (365d)`),
          lines.push(''),
          lines.push(`   📋 **Install:** \`brew install ${formula.name}\``),
          lines.push(`   🔗 https://formulae.brew.sh/formula/${formula.name}`));
      } else {
        const cask = await safeJson(
          `https://formulae.brew.sh/api/cask/${encodeURIComponent(query.toLowerCase())}.json`,
        ).catch(() => null);
        if (!cask)
          return (
            lines.push(`No exact Homebrew formula/cask found for "${query}".`),
            lines.push('🔗 https://formulae.brew.sh/'),
            lines.push(`💡 Tip: Run \`brew search ${query}\` locally for fuzzy results.`),
            lines.join('\n')
          );
        (lines.push(`**${cask.token}** (Cask) — v${cask.version ?? '?'}`),
          cask.desc && lines.push(`   ${cask.desc}`),
          cask.homepage && lines.push(`   🏠 ${cask.homepage}`),
          lines.push(''),
          lines.push(`   📋 **Install:** \`brew install --cask ${cask.token}\``),
          lines.push(`   🔗 https://formulae.brew.sh/cask/${cask.token}`));
      }
      return (lines.push(''), lines.push('Source: formulae.brew.sh'), lines.join('\n'));
    },
    search_vscode: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔵 Searching VS Code Marketplace for "${query}"…`);
      const body = {
          filters: [
            {
              criteria: [
                { filterType: 8, value: 'Microsoft.VisualStudio.Code' },
                { filterType: 10, value: query },
              ],
              pageSize: 5,
              pageNumber: 1,
              sortBy: 4,
              sortOrder: 0,
            },
          ],
          flags: 914,
        },
        resp = await fetch(
          'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Accept: 'application/json;api-version=3.0-preview.1',
            },
            body: JSON.stringify(body),
          },
        ),
        data = await resp.json(),
        lines = [`🔵 VS Code Marketplace: "${query}"`, ''],
        extensions = data.results?.[0]?.extensions ?? [];
      return 0 === extensions.length
        ? (lines.push(`No VS Code extensions found for "${query}".`),
          lines.push(
            `🔗 https://marketplace.visualstudio.com/search?target=VSCode&term=${encodeURIComponent(query)}`,
          ),
          lines.join('\n'))
        : (extensions.forEach((ext, i) => {
            const id = `${ext.publisher.publisherName}.${ext.extensionName}`,
              version = ext.versions?.[0]?.version ?? '?',
              stats = Object.fromEntries(
                (ext.statistics ?? []).map((s) => [s.statisticName, s.value]),
              );
            (lines.push(`**${i + 1}. ${ext.displayName}** — v${version}`),
              lines.push(`   🆔 \`${id}\``),
              ext.shortDescription && lines.push(`   ${ext.shortDescription.slice(0, 150)}`),
              lines.push(`   👤 ${ext.publisher.displayName}`),
              null != stats.install &&
                lines.push(`   📥 ${Number(stats.install).toLocaleString()} installs`),
              null != stats.averagerating &&
                lines.push(`   ⭐ ${Number(stats.averagerating).toFixed(1)} / 5`),
              lines.push(`   📋 **Install:** \`code --install-extension ${id}\``),
              lines.push(`   🔗 https://marketplace.visualstudio.com/items?itemName=${id}`),
              lines.push(''));
          }),
          lines.push('Source: marketplace.visualstudio.com'),
          lines.join('\n'));
    },
    search_terraform: async (params, onStage) => {
      const { query: query, type: type = 'providers' } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      const resourceType = 'modules' === type ? 'modules' : 'providers';
      onStage(`🏗️ Searching Terraform Registry for "${query}" ${resourceType}…`);
      const data = await safeJson(
          `https://registry.terraform.io/v2/${resourceType}?filter%5Bquery%5D=${encodeURIComponent(query)}&page%5Bsize%5D=5`,
        ).catch(() => null),
        lines = [`🏗️ Terraform Registry: "${query}" (${resourceType})`, ''],
        items = data?.data ?? [];
      return 0 === items.length
        ? (lines.push(`No Terraform ${resourceType} found for "${query}".`),
          lines.push(
            `🔗 https://registry.terraform.io/search/${resourceType}?q=${encodeURIComponent(query)}`,
          ),
          lines.join('\n'))
        : (items.forEach((item, i) => {
            const attr = item.attributes ?? {},
              name = attr['full-name'] ?? attr.name ?? item.id ?? 'Unknown';
            if (
              (lines.push(`**${i + 1}. ${name}**`),
              attr.description && lines.push(`   ${attr.description.slice(0, 150)}`),
              null != attr.downloads &&
                lines.push(`   📥 ${Number(attr.downloads).toLocaleString()} downloads`),
              attr.source && lines.push(`   🐙 ${attr.source}`),
              attr.tier && lines.push(`   🏷  Tier: ${attr.tier}`),
              'providers' === resourceType)
            ) {
              const ns = attr.namespace ?? name.split('/')[0],
                pname = attr.name ?? name.split('/')[1] ?? name;
              (lines.push(''),
                lines.push('   **terraform {}:**'),
                lines.push('   ```hcl'),
                lines.push('   required_providers {'),
                lines.push(`     ${pname} = {`),
                lines.push(`       source  = "${ns}/${pname}"`),
                lines.push(`       version = "~> ${attr['latest-version'] ?? '?'}"`),
                lines.push('     }'),
                lines.push('   }'),
                lines.push('   ```'));
            }
            (lines.push(`   🔗 https://registry.terraform.io/${resourceType}/${name}`),
              lines.push(''));
          }),
          lines.push('Source: registry.terraform.io'),
          lines.join('\n'));
    },
    search_ansible: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🅰️ Searching Ansible Galaxy for "${query}"…`);
      const data = await safeJson(
          `https://galaxy.ansible.com/api/v3/plugin/ansible/search/collection-versions/?keywords=${encodeURIComponent(query)}&limit=5&deprecated=false`,
        ).catch(() => null),
        lines = [`🅰️ Ansible Galaxy: "${query}"`, ''],
        results = data?.data ?? [];
      if (0 === results.length) {
        const rolesData = await safeJson(
            `https://galaxy.ansible.com/api/v1/search/roles/?keywords=${encodeURIComponent(query)}&page_size=5`,
          ).catch(() => null),
          roles = rolesData?.results ?? [];
        return 0 === roles.length
          ? (lines.push(`No Ansible Galaxy content found for "${query}".`),
            lines.push(
              `🔗 https://galaxy.ansible.com/search?keywords=${encodeURIComponent(query)}`,
            ),
            lines.join('\n'))
          : (lines.push('**Roles:**\n'),
            roles.forEach((r, i) => {
              (lines.push(
                `**${i + 1}. ${r.namespace}.${r.name}** — v${r.summary_fields?.versions?.[0]?.name ?? '?'}`,
              ),
                r.description && lines.push(`   ${r.description.slice(0, 150)}`),
                null != r.stargazers_count &&
                  lines.push(`   ⭐ ${Number(r.stargazers_count).toLocaleString()} stars`),
                null != r.download_count &&
                  lines.push(`   📥 ${Number(r.download_count).toLocaleString()} downloads`),
                lines.push(
                  `   📋 **Install:** \`ansible-galaxy role install ${r.namespace}.${r.name}\``,
                ),
                lines.push(`   🔗 https://galaxy.ansible.com/${r.namespace}/${r.name}`),
                lines.push(''));
            }),
            lines.push('Source: galaxy.ansible.com'),
            lines.join('\n'));
      }
      return (
        lines.push('**Collections:**\n'),
        results.forEach((item, i) => {
          const col = item.collection_version ?? item,
            ns = col.namespace ?? '',
            name = col.name ?? '',
            version = col.version ?? '?';
          (lines.push(`**${i + 1}. ${ns}.${name}** — v${version}`),
            col.description && lines.push(`   ${col.description.slice(0, 150)}`),
            null != col.download_count &&
              lines.push(`   📥 ${Number(col.download_count).toLocaleString()} downloads`),
            lines.push(`   📋 **Install:** \`ansible-galaxy collection install ${ns}.${name}\``),
            lines.push(`   🔗 https://galaxy.ansible.com/${ns}/${name}`),
            lines.push(''));
        }),
        lines.push('Source: galaxy.ansible.com'),
        lines.join('\n')
      );
    },
    search_wordpress_plugins: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔷 Searching WordPress plugins for "${query}"…`);
      const data = await safeJson(
          `https://api.wordpress.org/plugins/info/1.2/?action=query_plugins&request[search]=${encodeURIComponent(query)}&request[per_page]=5&request[fields][description]=true&request[fields][short_description]=true&request[fields][rating]=true&request[fields][num_ratings]=true&request[fields][active_installs]=true&request[fields][tested]=true&request[fields][requires]=true`,
        ),
        lines = [`🔷 WordPress Plugins: "${query}"`, ''],
        plugins = data.plugins ?? [];
      return 0 === plugins.length
        ? (lines.push(`No WordPress plugins found for "${query}".`),
          lines.push(`🔗 https://wordpress.org/plugins/search/${encodeURIComponent(query)}/`),
          lines.join('\n'))
        : (plugins.forEach((p, i) => {
            if (
              (lines.push(`**${i + 1}. ${p.name}** — v${p.version ?? '?'}`),
              p.short_description && lines.push(`   ${p.short_description.slice(0, 150)}`),
              lines.push(`   👤 ${p.author_profile ? p.author : (p.author ?? 'Unknown')}`),
              null != p.active_installs &&
                lines.push(`   📥 ${Number(p.active_installs).toLocaleString()}+ active installs`),
              null != p.rating)
            ) {
              const stars = Math.round((p.rating / 20) * 10) / 10;
              lines.push(`   ⭐ ${stars}/5 (${(p.num_ratings ?? 0).toLocaleString()} ratings)`);
            }
            (p.requires && lines.push(`   🔧 Requires WordPress: ${p.requires}+`),
              p.tested && lines.push(`   ✅ Tested up to: ${p.tested}`),
              p.requires_php && lines.push(`   🐍 Requires PHP: ${p.requires_php}+`),
              lines.push(`   🔗 https://wordpress.org/plugins/${p.slug}/`),
              lines.push(''));
          }),
          lines.push('Source: wordpress.org/plugins'),
          lines.join('\n'));
    },
    search_godot: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🎮 Searching Godot Asset Library for "${query}"…`);
      const data = await safeJson(
          `https://godotengine.org/asset-library/api/asset?filter=${encodeURIComponent(query)}&max_results=5&type=any`,
        ).catch(() => null),
        lines = [`🎮 Godot Asset Library: "${query}"`, ''],
        assets = data?.result ?? [];
      return 0 === assets.length
        ? (lines.push(`No Godot assets found for "${query}".`),
          lines.push(
            `🔗 https://godotengine.org/asset-library/asset?search=${encodeURIComponent(query)}`,
          ),
          lines.join('\n'))
        : (assets.forEach((a, i) => {
            (lines.push(`**${i + 1}. ${a.title}**`),
              a.category && lines.push(`   🏷  Category: ${a.category}`),
              a.author && lines.push(`   👤 ${a.author}`),
              a.godot_version && lines.push(`   🎮 Godot: ${a.godot_version}`),
              a.version_string && lines.push(`   🏷  v${a.version_string}`),
              null != a.rating && lines.push(`   ⭐ ${a.rating}`),
              a.description &&
                lines.push(
                  `   ${a.description.slice(0, 150)}${a.description.length > 150 ? '…' : ''}`,
                ),
              a.browse_url
                ? lines.push(`   🔗 ${a.browse_url}`)
                : a.asset_id &&
                  lines.push(`   🔗 https://godotengine.org/asset-library/asset/${a.asset_id}`),
              lines.push(''));
          }),
          null != data.total_items &&
            lines.push(`Showing ${assets.length} of ${data.total_items} results.`),
          lines.push('Source: godotengine.org/asset-library'),
          lines.join('\n'));
    },
    search_cran: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`📊 Searching CRAN for "${query}"…`);
      const lines = [`📊 CRAN Search: "${query}"`, ''],
        exact = await fetch(`https://crandb.r-pkg.org/${encodeURIComponent(query)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      return (
        exact
          ? (lines.push(`**${exact.Package}** — v${exact.Version}`),
            exact.Title && lines.push(`   ${exact.Title}`),
            exact.Description &&
              lines.push(`   ${exact.Description.replace(/\s+/g, ' ').slice(0, 200)}`),
            lines.push(''),
            exact.Author &&
              lines.push(`   👤 Author: ${exact.Author.replace(/\s+/g, ' ').slice(0, 100)}`),
            exact.Maintainer &&
              lines.push(`   🔧 Maintainer: ${exact.Maintainer.split('<')[0].trim()}`),
            exact.License && lines.push(`   📄 License: ${exact.License}`),
            exact.Depends && lines.push(`   🔗 Depends: ${exact.Depends}`),
            exact.Imports && lines.push(`   📦 Imports: ${String(exact.Imports).slice(0, 120)}`),
            exact.Published && lines.push(`   📅 Published: ${exact.Published}`),
            lines.push(''),
            lines.push(`   📋 **Install:** \`install.packages("${exact.Package}")\``),
            lines.push(`   🔗 https://cran.r-project.org/package=${exact.Package}`),
            lines.push(`   📚 https://rdrr.io/cran/${exact.Package}/`))
          : (lines.push(`No exact CRAN package named "${query}".`),
            lines.push(''),
            lines.push(
              `🔗 **CRAN search:** https://cran.r-project.org/search.html?query=${encodeURIComponent(query)}`,
            ),
            lines.push(
              `🔗 **R-Universe:**  https://r-universe.dev/search/#${encodeURIComponent(query)}`,
            ),
            lines.push('🔗 **CRAN Task Views:** https://cran.r-project.org/web/views/'),
            lines.push(''),
            lines.push(
              `💡 Tip: In R, run \`install.packages("${query}")\` to try a direct install.`,
            )),
        lines.push(''),
        lines.push('Source: crandb.r-pkg.org'),
        lines.join('\n')
      );
    },
    search_clojars: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🌀 Searching Clojars for "${query}"…`);
      const data = await fetch(
          `https://clojars.org/search?q=${encodeURIComponent(query)}&format=json`,
        ).then((r) => r.json()),
        lines = [`🌀 Clojars Search: "${query}"`, ''],
        results = (data.results ?? []).slice(0, 5);
      return 0 === results.length
        ? (lines.push(`No Clojars artifacts found for "${query}".`),
          lines.push(`🔗 https://clojars.org/search?q=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (null != data.count &&
            lines.push(
              `Found ${Number(data.count).toLocaleString()} results — top ${results.length}:\n`,
            ),
          results.forEach((r, i) => {
            const coord =
              r.group_name === r.jar_name ? r.jar_name : `${r.group_name}/${r.jar_name}`;
            (lines.push(`**${i + 1}. ${coord}** — v${r.version}`),
              r.description && lines.push(`   ${r.description.slice(0, 150)}`),
              null != r.created &&
                lines.push(`   📅 First created: ${new Date(r.created).toLocaleDateString()}`),
              lines.push(''),
              lines.push('   **deps.edn:**'),
              lines.push(`   \`{${coord} {:mvn/version "${r.version}"}}\``),
              lines.push('   **Leiningen:**'),
              lines.push(`   \`[${coord} "${r.version}"]\``),
              lines.push(`   🔗 https://clojars.org/${coord}`),
              lines.push(''));
          }),
          lines.push('Source: clojars.org'),
          lines.join('\n'));
    },
    search_opam: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐫 Searching OPAM for "${query}"…`);
      const lines = [`🐫 OPAM Search: "${query}"`, ''],
        exact = await fetch(`https://opam.ocaml.org/packages/${encodeURIComponent(query)}/`, {
          headers: { Accept: 'application/json, text/html' },
        })
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null);
      if (exact && !exact.includes('404') && exact.includes(query)) {
        (lines.push(`**${query}**`), lines.push('   ✅ Package found in the OPAM repository.'));
        const synopsisMatch = exact.match(/<meta name="description" content="([^"]+)"/i);
        (synopsisMatch && lines.push(`   ${synopsisMatch[1].slice(0, 200)}`),
          lines.push(''),
          lines.push('   📋 **Install:**'),
          lines.push(`   \`opam install ${query}\``),
          lines.push(`   🔗 https://opam.ocaml.org/packages/${query}/`));
      } else {
        const related = (
          (
            await fetch(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:opam.ocaml.org/packages')}&format=json&no_redirect=1&no_html=1`,
            ).then((r) => r.json())
          ).RelatedTopics ?? []
        ).filter((t) => {
          if (!t.Text || !t.FirstURL) return false;
          try {
            const h = new URL(t.FirstURL).hostname;
            return h === 'opam.ocaml.org' || h.endsWith('.opam.ocaml.org');
          } catch {
            return false;
          }
        });
        if (0 === related.length)
          return (
            lines.push(`No OPAM results found for "${query}".`),
            lines.push('🔗 https://opam.ocaml.org/packages/ (browse all packages)'),
            lines.push(`💡 Tip: Run \`opam search ${query}\` locally for fuzzy results.`),
            lines.join('\n')
          );
        related.slice(0, 5).forEach((t, i) => {
          const pkgName = t.FirstURL.split('/packages/')[1]?.split('/')[0] ?? '';
          (lines.push(`**${i + 1}. ${pkgName || t.Text.slice(0, 40)}**`),
            t.Text && lines.push(`   ${t.Text.slice(0, 150)}`),
            pkgName && lines.push(`   📋 \`opam install ${pkgName}\``),
            lines.push(`   🔗 ${t.FirstURL}`),
            lines.push(''));
        });
      }
      return (lines.push('Source: opam.ocaml.org'), lines.join('\n'));
    },
    search_elm: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🌳 Searching Elm packages for "${query}"…`);
      const results = await fetch(
          `https://package.elm-lang.org/search.json?q=${encodeURIComponent(query)}`,
        ).then((r) => r.json()),
        lines = [`🌳 Elm Packages: "${query}"`, ''];
      return Array.isArray(results) && 0 !== results.length
        ? (results.slice(0, 5).forEach((p, i) => {
            const latestVersion = (p.versions ?? [])[0] ?? '?';
            (lines.push(`**${i + 1}. ${p.name}** — v${latestVersion}`),
              p.summary && lines.push(`   ${p.summary}`),
              p.license && lines.push(`   📄 License: ${p.license}`),
              p.versions?.length > 1 && lines.push(`   📦 ${p.versions.length} versions available`),
              lines.push(''),
              lines.push('   📋 **elm.json:**'),
              lines.push(
                `   \`"${p.name}": "${latestVersion <= '?' ? '1.0.0' : latestVersion} <= v < ${(function (
                  ver,
                ) {
                  const parts = ver.split('.');
                  return parts.length < 1 || isNaN(Number(parts[0]))
                    ? '2.0.0'
                    : `${Number(parts[0]) + 1}.0.0`;
                })(latestVersion)}"\``,
              ),
              lines.push(`   📋 **Install:** \`elm install ${p.name}\``),
              lines.push(`   🔗 https://package.elm-lang.org/packages/${p.name}/latest/`),
              lines.push(''));
          }),
          lines.push('Source: package.elm-lang.org'),
          lines.join('\n'))
        : (lines.push(`No Elm packages found for "${query}".`),
          lines.push('🔗 https://package.elm-lang.org/'),
          lines.join('\n'));
    },
    search_dub: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔷 Searching DUB registry for "${query}"…`);
      const data = await fetch(
          `https://code.dlang.org/api/packages/search?q=${encodeURIComponent(query)}&limit=5`,
        ).then((r) => r.json()),
        lines = [`🔷 DUB Search: "${query}"`, ''],
        pkgs = Array.isArray(data) ? data : (data.packages ?? data.results ?? []);
      if (0 === pkgs.length)
        return (
          lines.push(`No DUB packages found for "${query}".`),
          lines.push(`🔗 https://code.dlang.org/?q=${encodeURIComponent(query)}`),
          lines.join('\n')
        );
      for (const p of pkgs.slice(0, 5)) {
        const detail =
            p.version && p.description
              ? null
              : await fetch(
                  `https://code.dlang.org/api/packages/${encodeURIComponent(p.name)}/latest/info`,
                )
                  .then((r) => (r.ok ? r.json() : null))
                  .catch(() => null),
          version = p.version ?? detail?.version ?? '?',
          desc = p.description ?? detail?.description ?? '',
          owner = p.owner ?? detail?.owner ?? '';
        (lines.push(`**${p.name}** — v${version}`),
          desc && lines.push(`   ${desc.slice(0, 150)}`),
          owner && lines.push(`   👤 ${owner}`),
          null != p.downloads &&
            lines.push(`   📥 ${Number(p.downloads).toLocaleString()} downloads`),
          null != p.score && lines.push(`   ⭐ Score: ${Number(p.score).toFixed(1)}`),
          lines.push(''),
          lines.push('   **dub.json:**'),
          lines.push(`   \`"${p.name}": "~>${version.split('.').slice(0, 2).join('.')}"\``),
          lines.push(`   📋 **Install:** \`dub add ${p.name}\``),
          lines.push(`   🔗 https://code.dlang.org/packages/${p.name}`),
          lines.push(''));
      }
      return (lines.push('Source: code.dlang.org'), lines.join('\n'));
    },
    search_nimble: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`👑 Searching Nimble packages for "${query}"…`);
      const raw = await fetch(
          'https://raw.githubusercontent.com/nim-lang/packages/master/packages.json',
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        lines = [`👑 Nimble Search: "${query}"`, ''];
      if (!Array.isArray(raw) || 0 === raw.length)
        return (
          lines.push('Could not reach the Nim package registry.'),
          lines.push(`🔗 https://nimble.directory/search?search=${encodeURIComponent(query)}`),
          lines.join('\n')
        );
      const q = query.toLowerCase(),
        matches = raw
          .filter(
            (p) =>
              p.name?.toLowerCase().includes(q) ||
              p.description?.toLowerCase().includes(q) ||
              (p.tags ?? []).some((t) => t.toLowerCase().includes(q)),
          )
          .slice(0, 6);
      return 0 === matches.length
        ? (lines.push(`No Nimble packages match "${query}".`),
          lines.push(`🔗 https://nimble.directory/search?search=${encodeURIComponent(query)}`),
          lines.push(`💡 Tip: Run \`nimble search ${query}\` locally.`),
          lines.join('\n'))
        : (lines.push(
            `Found ${matches.length} match${1 === matches.length ? '' : 'es'} in ${raw.length.toLocaleString()} registered packages:\n`,
          ),
          matches.forEach((p, i) => {
            (lines.push(`**${i + 1}. ${p.name}**`),
              p.description && lines.push(`   ${p.description.slice(0, 150)}`),
              p.method);
            const tags = (p.tags ?? []).slice(0, 5).join(', ');
            (tags && lines.push(`   🏷  ${tags}`),
              p.license && lines.push(`   📄 License: ${p.license}`),
              p.url && lines.push(`   🐙 ${p.url}`),
              lines.push(`   📋 **Install:** \`nimble install ${p.name}\``),
              lines.push(`   🔗 https://nimble.directory/pkg/${p.name}`),
              lines.push(''));
          }),
          lines.push('Source: github.com/nim-lang/packages'),
          lines.join('\n'));
    },
    search_luarocks: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🌙 Searching LuaRocks for "${query}"…`);
      const lines = [`🌙 LuaRocks Search: "${query}"`, ''],
        exact = await fetch('https://luarocks.org/manifests/luarocks/manifest-5.4')
          .then((r) => (r.ok ? r.text() : null))
          .catch(() => null);
      if (exact) {
        const q = query.toLowerCase(),
          moduleRegex = /^([^\s]+)\s*=/gm,
          allModules = [];
        let m;
        for (; null !== (m = moduleRegex.exec(exact)); )
          m[1].toLowerCase().includes(q) && allModules.push(m[1]);
        if (allModules.length > 0)
          return (
            lines.push(`Packages matching "${query}" on LuaRocks:\n`),
            allModules.slice(0, 6).forEach((name, i) => {
              (lines.push(`**${i + 1}. ${name}**`),
                lines.push(`   📋 **Install:** \`luarocks install ${name}\``),
                lines.push(
                  `   🔗 https://luarocks.org/modules/${name.toLowerCase().replace('.', '/')}`,
                ),
                lines.push(''));
            }),
            allModules.length > 6 && lines.push(`…and ${allModules.length - 6} more matches.`),
            lines.push('Source: luarocks.org'),
            lines.join('\n')
          );
      }
      const related = (
        (
          await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:luarocks.org/modules')}&format=json&no_redirect=1&no_html=1`,
          ).then((r) => r.json())
        ).RelatedTopics ?? []
      ).filter((t) => {
        if (!t.Text || !t.FirstURL) return false;
        try {
          const h = new URL(t.FirstURL).hostname;
          return h === 'luarocks.org' || h.endsWith('.luarocks.org');
        } catch {
          return false;
        }
      });
      return 0 === related.length
        ? (lines.push(`No LuaRocks results for "${query}".`),
          lines.push(`🔗 https://luarocks.org/search?q=${encodeURIComponent(query)}`),
          lines.push(`💡 Tip: Run \`luarocks search ${query}\` locally.`),
          lines.join('\n'))
        : (related.slice(0, 5).forEach((t, i) => {
            const name = t.FirstURL.split('/modules/')[1]?.split('/')[0] ?? '';
            (lines.push(`**${i + 1}. ${name || t.Text.slice(0, 40)}**`),
              t.Text && lines.push(`   ${t.Text.slice(0, 150)}`),
              name && lines.push(`   📋 \`luarocks install ${name}\``),
              lines.push(`   🔗 ${t.FirstURL}`),
              lines.push(''));
          }),
          lines.push('Source: luarocks.org'),
          lines.join('\n'));
    },
    search_crystal: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`💎 Searching Crystal shards for "${query}"…`);
      const lines = [`💎 Crystal Shards: "${query}"`, ''],
        data = await fetch(`https://shards.info/api/search?q=${encodeURIComponent(query)}`, {
          headers: { Accept: 'application/json' },
        })
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        results = data?.results ?? data?.shards ?? (Array.isArray(data) ? data : []);
      return 0 === results.length
        ? (lines.push(`No Crystal shards found for "${query}".`),
          lines.push(`🔗 https://shards.info/?query=${encodeURIComponent(query)}`),
          lines.push('🔗 https://crystal-lang.org/'),
          lines.join('\n'))
        : (results.slice(0, 5).forEach((s, i) => {
            const name = s.name ?? s.full_name ?? s.repository?.full_name ?? 'Unknown';
            (lines.push(`**${i + 1}. ${name}**`),
              s.description && lines.push(`   ${s.description.slice(0, 150)}`),
              null != s.stars && lines.push(`   ⭐ ${Number(s.stars).toLocaleString()} stars`),
              (s.version || s.latest_release) &&
                lines.push(`   🏷  v${s.version ?? s.latest_release}`));
            const owner = s.owner ?? name.split('/')[0],
              repo = s.repo ?? name.split('/')[1] ?? name;
            (lines.push(''),
              lines.push('   **shard.yml:**'),
              lines.push('   ```yaml'),
              lines.push('   dependencies:'),
              lines.push(`     ${repo}:`),
              lines.push(`       github: ${owner}/${repo}`),
              s.version && lines.push(`       version: ~> ${s.version}`),
              lines.push('   ```'),
              (s.url ?? s.html_url) && lines.push(`   🔗 ${s.url ?? s.html_url}`),
              lines.push(''));
          }),
          lines.push('Source: shards.info'),
          lines.join('\n'));
    },
    search_purescript: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔮 Searching Pursuit for "${query}"…`);
      const results = await fetch(
          `https://pursuit.purescript.org/search?q=${encodeURIComponent(query)}`,
          { headers: { Accept: 'application/json' } },
        )
          .then((r) => (r.ok ? r.json() : []))
          .catch(() => []),
        lines = [`🔮 PureScript Pursuit: "${query}"`, ''];
      if (!Array.isArray(results) || 0 === results.length)
        return (
          lines.push(`No PureScript packages found for "${query}".`),
          lines.push(`🔗 https://pursuit.purescript.org/search?q=${encodeURIComponent(query)}`),
          lines.join('\n')
        );
      const seen = new Set();
      return (
        results
          .filter((r) => {
            const pkg = r.package?.name ?? r.module?.package ?? r.type;
            return !seen.has(pkg) && (seen.add(pkg), !0);
          })
          .slice(0, 6)
          .forEach((r, i) => {
            const pkg = r.package?.name ?? r.module?.package ?? '?',
              ver = r.package?.version ?? '?',
              title = r.title ?? r.name ?? pkg,
              info = r.info ?? r.type ?? '';
            (lines.push(`**${i + 1}. ${title}** (${pkg} v${ver})`),
              info && lines.push(`   ${String(info).replace(/\s+/g, ' ').slice(0, 150)}`),
              r.module?.name && lines.push(`   📦 Module: ${r.module.name}`),
              lines.push(
                `   📋 **spago.dhall:** \`"${pkg}" = "v${ver}..v${(function (ver) {
                  const n = Number(ver.split('.')[0]);
                  return isNaN(n) ? '9.0.0' : `${n + 1}.0.0`;
                })(ver)}"\``,
              ),
              lines.push(`   🔗 https://pursuit.purescript.org/packages/${pkg}/${ver}`),
              lines.push(''));
          }),
        lines.push('Source: pursuit.purescript.org'),
        lines.join('\n')
      );
    },
    search_nix: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`❄️ Searching NixOS packages for "${query}"…`);
      const lines = [`❄️ NixOS Packages: "${query}"`, ''];
      try {
        const resp = await fetch(
            'https://search.nixos.org/backend/latest-42-nixos-unstable/_search',
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization:
                  'Basic aWVSYVdoSGxtQUJVUDo5N2UyNGQ2MC02YWViLTQ1MmMtOGIyYS1mYTM0ZmU5MzhhYmU=',
              },
              body: JSON.stringify({
                from: 0,
                size: 5,
                query: {
                  bool: {
                    must: [
                      {
                        multi_match: {
                          query: query,
                          fields: [
                            'package_attr_name^9',
                            'package_pname^6',
                            'package_attr_set^4',
                            'package_description^1',
                            'package_longDescription^0.25',
                          ],
                          type: 'best_fields',
                          analyzer: 'whitespace',
                        },
                      },
                    ],
                  },
                },
                sort: [{ _score: 'desc' }, { 'package_attr_name.raw': 'asc' }],
              }),
            },
          ),
          data = await resp.json(),
          hits = data.hits?.hits ?? [];
        if (0 === hits.length) throw new Error('no results');
        const total = data.hits?.total?.value ?? hits.length;
        (lines.push(`Found ~${Number(total).toLocaleString()} packages — top ${hits.length}:\n`),
          hits.forEach((hit, i) => {
            const s = hit._source ?? {},
              attrName = s.package_attr_name ?? '?',
              version = s.package_version ?? '?',
              pname = s.package_pname ?? attrName;
            (lines.push(`**${i + 1}. ${attrName}** — v${version}`),
              s.package_description && lines.push(`   ${s.package_description.slice(0, 150)}`),
              s.package_homepage?.[0] && lines.push(`   🏠 ${s.package_homepage[0]}`),
              s.package_license_set?.length &&
                lines.push(
                  `   📄 License: ${s.package_license_set
                    .slice(0, 3)
                    .map((l) => l.fullName ?? l)
                    .join(', ')}`,
                ),
              lines.push(''),
              lines.push(`   📋 **shell.nix / nix-shell:** \`nix-shell -p ${pname}\``),
              lines.push(`   📋 **flake (pkgs):** \`pkgs.${attrName}\``),
              lines.push(
                `   🔗 https://search.nixos.org/packages?query=${encodeURIComponent(attrName)}`,
              ),
              lines.push(''));
          }));
      } catch {
        const related = (
          (
            await fetch(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:search.nixos.org/packages')}&format=json&no_redirect=1&no_html=1`,
            ).then((r) => r.json())
          ).RelatedTopics ?? []
        ).filter((t) => {
          if (!t.Text || !t.FirstURL) return false;
          try {
            const h = new URL(t.FirstURL).hostname;
            return h === 'nixos.org' || h.endsWith('.nixos.org');
          } catch {
            return false;
          }
        });
        related.length > 0
          ? related.slice(0, 5).forEach((t, i) => {
              (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}`),
                lines.push(`   🔗 ${t.FirstURL}`),
                lines.push(''));
            })
          : (lines.push(`Could not fetch NixOS search results for "${query}".`),
            lines.push(`🔗 https://search.nixos.org/packages?query=${encodeURIComponent(query)}`),
            lines.push(`💡 Tip: Run \`nix search nixpkgs ${query}\` locally.`));
      }
      return (lines.push('Source: search.nixos.org'), lines.join('\n'));
    },
    search_go: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🐹 Searching Go modules for "${query}"…`);
      const lines = [`🐹 Go Modules: "${query}"`, ''],
        ghData = await fetch(
          `https://api.github.com/search/repositories?q=${encodeURIComponent(query)}+language:Go&sort=stars&order=desc&per_page=5`,
          { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'search-tool/1.0' } },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        items = ghData?.items ?? [];
      return (
        items.length > 0
          ? (lines.push(`Top Go repositories on GitHub matching "${query}":\n`),
            items.forEach((repo, i) => {
              (lines.push(`**${i + 1}. ${repo.full_name}**`),
                repo.description && lines.push(`   ${repo.description.slice(0, 150)}`),
                lines.push(
                  `   ⭐ ${Number(repo.stargazers_count).toLocaleString()} stars  🍴 ${Number(repo.forks_count).toLocaleString()} forks`,
                ),
                repo.updated_at && lines.push(`   🕒 Updated: ${repo.updated_at.slice(0, 10)}`),
                lines.push(''),
                lines.push(
                  `   📋 **go.mod:** \`require github.com/${repo.full_name} v0.0.0-latest\``,
                ),
                lines.push(`   📋 **go get:** \`go get github.com/${repo.full_name}\``),
                lines.push(`   🔗 https://pkg.go.dev/github.com/${repo.full_name}`),
                lines.push(`   🐙 ${repo.html_url}`),
                lines.push(''));
            }))
          : lines.push(`No results via GitHub search for "${query}".`),
        lines.push(
          `🔗 **Official module search:** https://pkg.go.dev/search?q=${encodeURIComponent(query)}`,
        ),
        lines.push(''),
        lines.push('Source: pkg.go.dev / github.com'),
        lines.join('\n')
      );
    },
    search_conan: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🍫 Searching ConanCenter for "${query}"…`);
      const data = await fetch(
          `https://conan.io/center/api/ui/packages?q=${encodeURIComponent(query)}&page_size=5`,
          { headers: { Accept: 'application/json', 'User-Agent': 'search-tool/1.0' } },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        lines = [`🍫 ConanCenter Search: "${query}"`, ''],
        pkgs = data?.results ?? data?.packages ?? data?.data ?? [];
      if (0 === pkgs.length) {
        const related = (
          (
            await fetch(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:conan.io/center')}&format=json&no_redirect=1&no_html=1`,
            ).then((r) => r.json())
          ).RelatedTopics ?? []
        ).filter((t) => t.Text && t.FirstURL?.includes('conan.io'));
        return 0 === related.length
          ? (lines.push(`No Conan packages found for "${query}".`),
            lines.push(`🔗 https://conan.io/center/recipes?q=${encodeURIComponent(query)}`),
            lines.push(`💡 Tip: Run \`conan search ${query} -r conancenter\` locally.`),
            lines.join('\n'))
          : (related.slice(0, 5).forEach((t, i) => {
              (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}`),
                lines.push(`   🔗 ${t.FirstURL}`),
                lines.push(''));
            }),
            lines.push('Source: conan.io/center'),
            lines.join('\n'));
      }
      return (
        pkgs.forEach((p, i) => {
          const name = p.name ?? p.id ?? p.package_name ?? 'Unknown',
            version = p.version ?? p.latest_version ?? '?';
          (lines.push(`**${i + 1}. ${name}** — v${version}`),
            p.description && lines.push(`   ${p.description.slice(0, 150)}`),
            p.license && lines.push(`   📄 License: ${p.license}`),
            null != p.downloads &&
              lines.push(`   📥 ${Number(p.downloads).toLocaleString()} downloads`),
            lines.push(''),
            lines.push('   **conanfile.txt:**'),
            lines.push(`   \`[requires]\\n${name}/${version}\``),
            lines.push(`   📋 **CLI:** \`conan install --requires="${name}/${version}"\``),
            lines.push(`   🔗 https://conan.io/center/recipes/${name}`),
            lines.push(''));
        }),
        lines.push('Source: conan.io/center'),
        lines.join('\n')
      );
    },
    search_vcpkg: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`📦 Searching vcpkg ports for "${query}"…`);
      const lines = [`📦 vcpkg Search: "${query}"`, ''],
        exactManifest = await fetch(
          `https://raw.githubusercontent.com/microsoft/vcpkg/master/ports/${encodeURIComponent(query.toLowerCase())}/vcpkg.json`,
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      if (exactManifest) {
        if (
          (lines.push(
            `**${exactManifest.name ?? query}** — v${exactManifest.version ?? exactManifest['version-semver'] ?? exactManifest['version-date'] ?? '?'}`,
          ),
          exactManifest.description)
        ) {
          const desc = Array.isArray(exactManifest.description)
            ? exactManifest.description.join(' ')
            : exactManifest.description;
          lines.push(`   ${desc.slice(0, 200)}`);
        }
        exactManifest.homepage && lines.push(`   🏠 ${exactManifest.homepage}`);
        const deps = (exactManifest.dependencies ?? [])
          .map((d) => ('string' == typeof d ? d : d.name))
          .filter(Boolean)
          .slice(0, 8)
          .join(', ');
        deps && lines.push(`   🔗 Dependencies: ${deps}`);
        const features = Object.keys(exactManifest.features ?? {})
          .slice(0, 6)
          .join(', ');
        (features && lines.push(`   ✨ Features: ${features}`),
          lines.push(''),
          lines.push(
            `   📋 **Install (classic):** \`vcpkg install ${exactManifest.name ?? query}\``,
          ),
          lines.push('   📋 **Install (manifest):** Add to `vcpkg.json`:'),
          lines.push(
            `   \`{ "name": "${exactManifest.name ?? query}", "version>=": "${exactManifest.version ?? ''}" }\``,
          ),
          lines.push(`   🔗 https://vcpkg.io/en/package/${exactManifest.name ?? query}`),
          lines.push(
            `   🐙 https://github.com/microsoft/vcpkg/tree/master/ports/${exactManifest.name ?? query}`,
          ));
      } else {
        const ghSearch = await fetch(
            `https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:microsoft/vcpkg+path:ports+filename:vcpkg.json&per_page=6`,
            { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'search-tool/1.0' } },
          )
            .then((r) => (r.ok ? r.json() : null))
            .catch(() => null),
          items = ghSearch?.items ?? [];
        if (0 === items.length)
          return (
            lines.push(`No vcpkg ports found for "${query}".`),
            lines.push('🔗 https://vcpkg.io/en/packages.html'),
            lines.push(`💡 Run \`vcpkg search ${query}\` locally.`),
            lines.join('\n')
          );
        (lines.push('Matching vcpkg ports:\n'),
          items.forEach((item, i) => {
            const portName = item.path?.split('/')[1] ?? item.name;
            (lines.push(`**${i + 1}. ${portName}**`),
              lines.push(`   📋 \`vcpkg install ${portName}\``),
              lines.push(`   🔗 https://vcpkg.io/en/package/${portName}`),
              lines.push(''));
          }));
      }
      return (lines.push('Source: github.com/microsoft/vcpkg'), lines.join('\n'));
    },
    search_haxelib: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`⚡ Searching Haxelib for "${query}"…`);
      const lines = [`⚡ Haxelib Search: "${query}"`, ''],
        exact = await fetch(`https://lib.haxe.org/p/${encodeURIComponent(query)}.json`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      if (exact) {
        const latest =
          exact.curversion ?? exact.current_version ?? (exact.versions ?? []).slice(-1)[0] ?? '?';
        (lines.push(`**${exact.name ?? query}** — v${latest}`),
          exact.desc && lines.push(`   ${exact.desc.slice(0, 200)}`),
          exact.website && lines.push(`   🏠 ${exact.website}`),
          exact.owner && lines.push(`   👤 ${exact.owner}`),
          exact.license && lines.push(`   📄 License: ${exact.license}`),
          exact.tags?.length && lines.push(`   🏷  ${exact.tags.slice(0, 6).join(', ')}`),
          exact.versions?.length && lines.push(`   📦 ${exact.versions.length} versions available`),
          lines.push(''),
          lines.push('   **haxelib.json:**'),
          lines.push(`   \`"dependencies": { "${exact.name ?? query}": "${latest}" }\``),
          lines.push(`   📋 **Install:** \`haxelib install ${exact.name ?? query}\``),
          lines.push(`   🔗 https://lib.haxe.org/p/${exact.name ?? query}`));
      } else {
        const related = (
          (
            await fetch(
              `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:lib.haxe.org/p')}&format=json&no_redirect=1&no_html=1`,
            ).then((r) => r.json())
          ).RelatedTopics ?? []
        ).filter((t) => t.Text && t.FirstURL?.includes('lib.haxe.org'));
        if (0 === related.length)
          return (
            lines.push(`No Haxelib results for "${query}".`),
            lines.push(`🔗 https://lib.haxe.org/search/?v=${encodeURIComponent(query)}`),
            lines.push(`💡 Run \`haxelib search ${query}\` locally.`),
            lines.join('\n')
          );
        related.slice(0, 5).forEach((t, i) => {
          const name = t.FirstURL.split('/p/')[1]?.split('/')[0] ?? '';
          (lines.push(`**${i + 1}. ${name || t.Text.slice(0, 40)}**`),
            t.Text && lines.push(`   ${t.Text.slice(0, 150)}`),
            name && lines.push(`   📋 \`haxelib install ${name}\``),
            lines.push(`   🔗 ${t.FirstURL}`),
            lines.push(''));
        });
      }
      return (lines.push('Source: lib.haxe.org'), lines.join('\n'));
    },
    search_racket: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🎭 Searching Racket packages for "${query}"…`);
      const allPkgs = await fetch('https://pkgs.racket-lang.org/pkgs-all.json')
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
        lines = [`🎭 Racket Packages: "${query}"`, ''];
      if (0 === Object.keys(allPkgs).length)
        return (
          lines.push('Could not reach the Racket package catalog.'),
          lines.push('🔗 https://pkgs.racket-lang.org/'),
          lines.join('\n')
        );
      const q = query.toLowerCase(),
        matches = Object.entries(allPkgs)
          .filter(([name, info]) => {
            const desc = (info.description ?? '').toLowerCase(),
              tags = (info.tags ?? []).join(' ').toLowerCase();
            return name.toLowerCase().includes(q) || desc.includes(q) || tags.includes(q);
          })
          .slice(0, 6);
      return 0 === matches.length
        ? (lines.push(
            `No Racket packages match "${query}" in ${Object.keys(allPkgs).length.toLocaleString()} packages.`,
          ),
          lines.push(`🔗 https://pkgs.racket-lang.org/?search=${encodeURIComponent(query)}`),
          lines.join('\n'))
        : (lines.push(
            `Found ${matches.length} match${1 === matches.length ? '' : 'es'} in ${Object.keys(allPkgs).length.toLocaleString()} packages:\n`,
          ),
          matches.forEach(([name, info], i) => {
            (lines.push(`**${i + 1}. ${name}**`),
              info.description && lines.push(`   ${info.description.slice(0, 150)}`));
            const author = info.authors?.[0] ?? info.author;
            author && lines.push(`   👤 ${author}`);
            const tags = (info.tags ?? []).slice(0, 5).join(', ');
            (tags && lines.push(`   🏷  ${tags}`),
              info.last_updated && lines.push(`   📅 Updated: ${info.last_updated.slice(0, 10)}`),
              lines.push(`   📋 **Install:** \`raco pkg install ${name}\``),
              lines.push(`   📋 **require:** \`(require ${name})\``),
              lines.push(`   🔗 https://pkgs.racket-lang.org/package/${name}`),
              lines.push(''));
          }),
          lines.push('Source: pkgs.racket-lang.org'),
          lines.join('\n'));
    },
    search_spack: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔬 Searching Spack packages for "${query}"…`);
      const lines = [`🔬 Spack Packages: "${query}"`, ''],
        ghContents = await fetch(
          'https://api.github.com/repos/spack/spack/contents/var/spack/repos/builtin/packages',
          { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'search-tool/1.0' } },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      if (Array.isArray(ghContents)) {
        const q = query.toLowerCase(),
          matches = ghContents
            .filter((entry) => 'dir' === entry.type && entry.name.toLowerCase().includes(q))
            .slice(0, 6);
        if (matches.length > 0)
          return (
            lines.push(`Spack packages matching "${query}":\n`),
            await Promise.all(
              matches.map(async (pkg, i) => {
                const raw = await fetch(
                    `https://raw.githubusercontent.com/spack/spack/develop/var/spack/repos/builtin/packages/${pkg.name}/package.py`,
                  )
                    .then((r) => (r.ok ? r.text() : ''))
                    .catch(() => ''),
                  descMatch = raw.match(/description\s*=\s*["'](.*?)["']/s),
                  urlMatch = raw.match(/homepage\s*=\s*["'](.*?)["']/),
                  verMatch = raw.match(/version\(\s*["']([^"']+)["']/);
                (lines.push(`**${i + 1}. ${pkg.name}**`),
                  descMatch && lines.push(`   ${descMatch[1].replace(/\s+/g, ' ').slice(0, 150)}`),
                  verMatch && lines.push(`   🏷  Latest in package.py: ${verMatch[1]}`),
                  urlMatch && lines.push(`   🏠 ${urlMatch[1]}`),
                  lines.push(`   📋 **Install:** \`spack install ${pkg.name}\``),
                  lines.push(`   🔗 https://packages.spack.io/package.html?name=${pkg.name}`),
                  lines.push(''));
              }),
            ),
            lines.push('Source: github.com/spack/spack'),
            lines.join('\n')
          );
      }
      const related = (
        (
          await fetch(
            `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:packages.spack.io')}&format=json&no_redirect=1&no_html=1`,
          ).then((r) => r.json())
        ).RelatedTopics ?? []
      ).filter((t) => t.Text && t.FirstURL?.includes('spack'));
      return 0 === related.length
        ? (lines.push(`No Spack packages found for "${query}".`),
          lines.push(`🔗 https://packages.spack.io/?search=${encodeURIComponent(query)}`),
          lines.push(`💡 Run \`spack list ${query}\` locally.`),
          lines.join('\n'))
        : (related.slice(0, 5).forEach((t, i) => {
            (lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}`),
              lines.push(`   🔗 ${t.FirstURL}`),
              lines.push(''));
          }),
          lines.push('Source: packages.spack.io'),
          lines.join('\n'));
    },
    search_meson_wrap: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔧 Searching Meson WrapDB for "${query}"…`);
      const data = await fetch('https://wrapdb.mesonbuild.com/v2/releases.json')
          .then((r) => (r.ok ? r.json() : {}))
          .catch(() => ({})),
        lines = [`🔧 Meson WrapDB: "${query}"`, ''];
      if (0 === Object.keys(data).length)
        return (
          lines.push('Could not reach WrapDB.'),
          lines.push('🔗 https://wrapdb.mesonbuild.com/'),
          lines.join('\n')
        );
      const q = query.toLowerCase(),
        matches = Object.entries(data)
          .filter(([name]) => name.toLowerCase().includes(q))
          .slice(0, 6);
      return 0 === matches.length
        ? (lines.push(`No WrapDB wraps match "${query}".`),
          lines.push('🔗 https://wrapdb.mesonbuild.com/'),
          lines.push(`💡 Run \`meson wrap search ${query}\` locally.`),
          lines.join('\n'))
        : (lines.push(
            `Wraps matching "${query}" (${Object.keys(data).length.toLocaleString()} total):\n`,
          ),
          matches.forEach(([name, info], i) => {
            const versions = info.versions ?? [],
              latest = versions[0] ?? '?';
            (lines.push(`**${i + 1}. ${name}** — ${latest}`),
              versions.length > 1 &&
                lines.push(
                  `   📦 ${versions.length} wrap versions (${versions.slice(0, 4).join(', ')}${versions.length > 4 ? '…' : ''})`,
                ),
              info.dependency_names?.length &&
                lines.push(`   🔗 Provides: ${info.dependency_names.slice(0, 4).join(', ')}`),
              lines.push(`   📋 **Install:** \`meson wrap install ${name}\``),
              lines.push(
                `   📋 **or (subprojects/packagefiles):** \`meson wrap update-db && meson wrap install ${name}\``,
              ),
              lines.push(`   🔗 https://wrapdb.mesonbuild.com/v2/${name}/${latest}/wrap`),
              lines.push(''));
          }),
          lines.push('Source: wrapdb.mesonbuild.com'),
          lines.join('\n'));
    },
    search_scoop: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🥄 Searching Scoop buckets for "${query}"…`);
      const lines = [`🥄 Scoop Search: "${query}"`, ''],
        appsData = await fetch('https://scoopinstaller.github.io/assets/apps.json')
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
      if (Array.isArray(appsData) && appsData.length > 0) {
        const q = query.toLowerCase(),
          matches = appsData
            .filter(
              (app) =>
                app.Name?.toLowerCase().includes(q) || app.Description?.toLowerCase().includes(q),
            )
            .slice(0, 6);
        if (matches.length > 0)
          return (
            lines.push(
              `Scoop apps matching "${query}" (${appsData.length.toLocaleString()} total):\n`,
            ),
            matches.forEach((app, i) => {
              (lines.push(`**${i + 1}. ${app.Name}**`),
                app.Description && lines.push(`   ${app.Description.slice(0, 150)}`),
                app.Version && lines.push(`   🏷  v${app.Version}`),
                app.Bucket && lines.push(`   🪣 Bucket: ${app.Bucket}`),
                app.Homepage && lines.push(`   🏠 ${app.Homepage}`),
                lines.push(`   📋 **Install:** \`scoop install ${app.Name.toLowerCase()}\``),
                lines.push(''));
            }),
            lines.push('Source: scoopinstaller.github.io'),
            lines.join('\n')
          );
      }
      const exactManifest = await fetch(
        `https://raw.githubusercontent.com/ScoopInstaller/Main/master/bucket/${encodeURIComponent(query.toLowerCase())}.json`,
      )
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      return (
        exactManifest
          ? (lines.push(`**${query}** — v${exactManifest.version ?? '?'}`),
            exactManifest.description && lines.push(`   ${exactManifest.description}`),
            exactManifest.homepage && lines.push(`   🏠 ${exactManifest.homepage}`),
            exactManifest.license && lines.push(`   📄 License: ${exactManifest.license}`),
            lines.push(`   📋 **Install:** \`scoop install ${query.toLowerCase()}\``),
            lines.push(`   🔗 https://scoop.sh/#/apps?q=${encodeURIComponent(query)}`))
          : (lines.push(`No exact Scoop manifest found for "${query}".`),
            lines.push(`🔗 https://scoop.sh/#/apps?q=${encodeURIComponent(query)}`),
            lines.push(`💡 Run \`scoop search ${query}\` locally (searches all added buckets).`)),
        lines.push(''),
        lines.push('Source: scoopinstaller.github.io / github.com/ScoopInstaller'),
        lines.join('\n')
      );
    },
    search_winget: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`🪟 Searching winget packages for "${query}"…`);
      const data = await fetch(
          `https://winget.run/api/v2/packages?query=${encodeURIComponent(query)}`,
          { headers: { Accept: 'application/json', 'User-Agent': 'search-tool/1.0' } },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        lines = [`🪟 winget Search: "${query}"`, ''],
        pkgs = data?.Packages ?? data?.packages ?? data?.results ?? [];
      if (pkgs.length > 0)
        return (
          pkgs.slice(0, 5).forEach((p, i) => {
            const id = p.Identifier ?? p.id ?? p.PackageIdentifier ?? '?',
              name = p.Name ?? p.name ?? p.PackageName ?? id,
              publisher = p.Publisher ?? p.publisher ?? '',
              version = p.Version ?? p.version ?? p.LatestVersion ?? '?',
              desc = p.Description ?? p.description ?? '';
            (lines.push(`**${i + 1}. ${name}** — v${version}`),
              lines.push(`   🆔 \`${id}\``),
              publisher && lines.push(`   🏢 ${publisher}`),
              desc && lines.push(`   ${desc.slice(0, 150)}`),
              lines.push(`   📋 **Install:** \`winget install --id ${id} -e\``),
              lines.push(`   🔗 https://winget.run/pkg/${id.replace('.', '/')}`),
              lines.push(''));
          }),
          lines.push('Source: winget.run (mirrors microsoft/winget-pkgs)'),
          lines.join('\n')
        );
      const ghSearch = await fetch(
          `https://api.github.com/search/code?q=${encodeURIComponent(query)}+repo:microsoft/winget-pkgs+path:manifests+filename:installer.yaml&per_page=5`,
          { headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'search-tool/1.0' } },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        items = ghSearch?.items ?? [];
      return 0 === items.length
        ? (lines.push(`No winget packages found for "${query}".`),
          lines.push(`🔗 https://winget.run/?query=${encodeURIComponent(query)}`),
          lines.push(`💡 Run \`winget search "${query}"\` on Windows.`),
          lines.join('\n'))
        : (items.forEach((item, i) => {
            const parts = item.path?.split('/') ?? [],
              id = parts.length >= 4 ? `${parts[2]}.${parts[3]}` : item.name;
            (lines.push(`**${i + 1}. ${id}**`),
              lines.push(`   📋 \`winget install --id ${id} -e\``),
              lines.push(`   🔗 https://winget.run/pkg/${id.replace('.', '/')}`),
              lines.push(''));
          }),
          lines.push('Source: github.com/microsoft/winget-pkgs'),
          lines.join('\n'));
    },
    search_ctan: async (params, onStage) => {
      const { query: query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');
      onStage(`📐 Searching CTAN for "${query}"…`);
      const lines = [`📐 CTAN Search: "${query}"`, ''],
        searchData = await fetch(
          `https://ctan.org/json/2.0/search?phrase=${encodeURIComponent(query)}&max=5`,
          { headers: { Accept: 'application/json' } },
        )
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        results = searchData?.result ?? searchData?.results ?? [];
      if (0 === results.length) {
        const exact = await fetch(`https://ctan.org/json/2.0/pkg/${encodeURIComponent(query)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        if (!exact)
          return (
            lines.push(`No CTAN packages found for "${query}".`),
            lines.push(`🔗 https://ctan.org/search?phrase=${encodeURIComponent(query)}`),
            lines.join('\n')
          );
        results.push({ id: exact.id, name: exact.name, caption: exact.caption, _exact: exact });
      }
      return (
        await Promise.all(
          results.slice(0, 5).map(async (r, i) => {
            const pkgId = r.id ?? r.pkg ?? r.key;
            let detail = r._exact;
            !detail &&
              pkgId &&
              (detail = await fetch(`https://ctan.org/json/2.0/pkg/${pkgId}`)
                .then((res) => (res.ok ? res.json() : null))
                .catch(() => null));
            const name = detail?.name ?? r.name?.text ?? r.name ?? pkgId ?? 'Unknown',
              caption = detail?.caption ?? r.caption ?? '',
              version = detail?.version?.number ?? detail?.version ?? '',
              desc = detail?.description ?? '',
              authors = (detail?.authors ?? [])
                .map((a) => a.givenname + ' ' + a.familyname)
                .slice(0, 3)
                .join(', '),
              license = (detail?.licenses ?? [])
                .map((l) => l.text ?? l.id)
                .slice(0, 2)
                .join(', '),
              docs = detail?.documentation?.[0]?.href,
              ctan = `https://ctan.org/pkg/${pkgId}`,
              texlive = detail?.['tex-archive'];
            (lines.push(`**${i + 1}. ${name}**${version ? ` — v${version}` : ''}`),
              caption && lines.push(`   ${caption}`),
              desc &&
                lines.push(
                  `   ${desc
                    .replace(/<[^>]+>/g, '')
                    .replace(/\s+/g, ' ')
                    .slice(0, 200)}`,
                ),
              authors && lines.push(`   👤 ${authors}`),
              license && lines.push(`   📄 License: ${license}`),
              lines.push(''),
              lines.push('   **LaTeX usage:**'),
              lines.push(`   \`\\usepackage{${pkgId ?? name}}\``),
              texlive && lines.push(`   📋 **tlmgr:** \`tlmgr install ${pkgId ?? name}\``),
              lines.push(`   🔗 ${ctan}`),
              docs && lines.push(`   📚 Docs: https://ctan.org${docs}`),
              lines.push(''));
          }),
        ),
        lines.push('Source: ctan.org'),
        lines.join('\n')
      );
    },
  },
});
