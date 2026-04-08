import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';

import { toolsList } from './ToolsList.js';

export const { handles, execute } = createExecutor({
  name: 'SearchExecutor',
  tools: toolsList,
  handlers: {
    // DuckDuckGo
    search_web: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`🔍 Searching the web for "${query}"…`);

      const data = await safeJson(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1&skip_disambig=0`,
      );

      const lines = [`🔍 Web Search: "${query}"`, ''];

      if (data.AbstractText) {
        lines.push(`**Answer:**`);
        lines.push(data.AbstractText);
        if (data.AbstractSource)
          lines.push(`Source: ${data.AbstractSource} — ${data.AbstractURL || ''}`);
        lines.push('');
      }

      if (data.Answer && data.Answer !== data.AbstractText) {
        lines.push(`**Instant Answer:** ${data.Answer}`);
        lines.push('');
      }

      if (data.Definition) {
        lines.push(`**Definition:** ${data.Definition}`);
        if (data.DefinitionSource) lines.push(`Source: ${data.DefinitionSource}`);
        lines.push('');
      }

      const infobox = data.Infobox?.content ?? [];
      if (infobox.length > 0) {
        lines.push('**Key Facts:**');
        infobox.slice(0, 8).forEach((item) => {
          if (item.label && item.value) lines.push(`  • ${item.label}: ${item.value}`);
        });
        lines.push('');
      }

      const related = (data.RelatedTopics ?? []).filter((t) => t.Text && t.FirstURL);
      if (related.length > 0) {
        lines.push('**Related Topics:**');
        related.slice(0, 6).forEach((t, i) => {
          const text = t.Text.slice(0, 120) + (t.Text.length > 120 ? '…' : '');
          lines.push(`  ${i + 1}. ${text}`);
          lines.push(`     🔗 ${t.FirstURL}`);
        });
        lines.push('');
      }

      const results = (data.Results ?? []).filter((r) => r.Text && r.FirstURL);
      if (results.length > 0) {
        lines.push('**Top Results:**');
        results.slice(0, 4).forEach((r, i) => {
          lines.push(`  ${i + 1}. ${r.Text.slice(0, 100)}`);
          lines.push(`     🔗 ${r.FirstURL}`);
        });
        lines.push('');
      }

      if (lines.length <= 2) {
        lines.push(
          `No instant answer found for "${query}".`,
          '',
          `Try searching directly at: https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
        );
      } else {
        lines.push(`Source: DuckDuckGo Instant Answers (duckduckgo.com)`);
      }

      return lines.join('\n');
    },

    // npm

    search_npm: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`📦 Searching npm for "${query}"…`);

      const data = await safeJson(
        `https://registry.npmjs.org/-/v1/search?text=${encodeURIComponent(query)}&size=5`,
      );

      const lines = [`📦 npm Search: "${query}"`, ''];

      const objects = data.objects ?? [];
      if (objects.length === 0) {
        lines.push(`No npm packages found for "${query}".`);
        lines.push(`🔗 https://www.npmjs.com/search?q=${encodeURIComponent(query)}`);
        return lines.join('\n');
      }

      objects.forEach((obj, i) => {
        const p = obj.package;
        lines.push(`**${i + 1}. ${p.name}** — v${p.version}`);
        if (p.description) lines.push(`   ${p.description}`);

        const downloads = obj.downloads?.monthly;
        if (downloads != null) lines.push(`   📥 ${downloads.toLocaleString()} downloads/month`);

        const author = p.author?.name ?? p.publisher?.username;
        if (author) lines.push(`   👤 ${author}`);

        const keywords = (p.keywords ?? []).slice(0, 5).join(', ');
        if (keywords) lines.push(`   🏷  ${keywords}`);

        lines.push(`   🔗 https://www.npmjs.com/package/${p.name}`);
        lines.push('');
      });

      lines.push(`Source: npmjs.org`);
      return lines.join('\n');
    },

    // PyPI

    search_pypi: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`🐍 Searching PyPI for "${query}"…`);

      // PyPI has no public search API — use the JSON API for exact name hits
      // and fall back to a simple search page scrape hint
      const data = await safeJson(`https://pypi.org/pypi/${encodeURIComponent(query)}/json`).catch(
        () => null,
      );

      const lines = [`🐍 PyPI Search: "${query}"`, ''];

      if (!data) {
        // Not an exact name match — guide to search page
        lines.push(`No exact PyPI match for "${query}".`);
        lines.push(`🔗 Try: https://pypi.org/search/?q=${encodeURIComponent(query)}`);
        return lines.join('\n');
      }

      const info = data.info;
      lines.push(`**${info.name}** — v${info.version}`);
      if (info.summary) lines.push(`${info.summary}`);
      lines.push('');

      if (info.author) lines.push(`👤 **Author:** ${info.author}`);
      if (info.license) lines.push(`📄 **License:** ${info.license}`);
      if (info.requires_python) lines.push(`🐍 **Requires Python:** ${info.requires_python}`);

      const keywords = info.keywords
        ?.split(/[,\s]+/)
        .filter(Boolean)
        .slice(0, 6)
        .join(', ');
      if (keywords) lines.push(`🏷  **Keywords:** ${keywords}`);

      lines.push('');
      lines.push(`🔗 **PyPI:** ${info.package_url}`);
      if (info.home_page) lines.push(`🏠 **Homepage:** ${info.home_page}`);
      if (info.docs_url) lines.push(`📚 **Docs:** ${info.docs_url}`);

      lines.push('');
      lines.push(`Source: pypi.org`);
      return lines.join('\n');
    },

    // Crates.io

    search_crates: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`🦀 Searching crates.io for "${query}"…`);

      const data = await safeJson(
        `https://crates.io/api/v1/crates?q=${encodeURIComponent(query)}&per_page=5`,
        { headers: { 'User-Agent': 'search-tool/1.0' } },
      );

      const lines = [`🦀 Crates.io Search: "${query}"`, ''];

      const crates = data.crates ?? [];
      if (crates.length === 0) {
        lines.push(`No crates found for "${query}".`);
        lines.push(`🔗 https://crates.io/search?q=${encodeURIComponent(query)}`);
        return lines.join('\n');
      }

      crates.forEach((c, i) => {
        lines.push(`**${i + 1}. ${c.name}** — v${c.newest_version}`);
        if (c.description) lines.push(`   ${c.description}`);
        lines.push(`   📥 ${Number(c.downloads).toLocaleString()} total downloads`);

        const updated = c.updated_at ? new Date(c.updated_at).toLocaleDateString() : null;
        if (updated) lines.push(`   🕒 Updated: ${updated}`);

        lines.push(`   🔗 https://crates.io/crates/${c.name}`);
        lines.push(`   📚 https://docs.rs/${c.name}`);
        lines.push('');
      });

      lines.push(`Source: crates.io`);
      return lines.join('\n');
    },

    // Docker Hub

    search_docker: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`🐳 Searching Docker Hub for "${query}"…`);

      const data = await safeJson(
        `https://hub.docker.com/v2/search/repositories/?query=${encodeURIComponent(query)}&page_size=5`,
      );

      const lines = [`🐳 Docker Hub Search: "${query}"`, ''];

      const results = data.results ?? [];
      if (results.length === 0) {
        lines.push(`No Docker images found for "${query}".`);
        lines.push(`🔗 https://hub.docker.com/search?q=${encodeURIComponent(query)}`);
        return lines.join('\n');
      }

      results.forEach((r, i) => {
        const name = r.repo_name ?? r.name;
        const official = r.is_official ? ' ✅ Official' : '';
        lines.push(`**${i + 1}. ${name}**${official}`);
        if (r.short_description) lines.push(`   ${r.short_description}`);
        lines.push(
          `   ⭐ ${Number(r.star_count ?? 0).toLocaleString()} stars  📥 ${Number(r.pull_count ?? 0).toLocaleString()} pulls`,
        );
        lines.push(`   🔗 https://hub.docker.com/r/${name}`);
        lines.push('');
      });

      lines.push(`Source: hub.docker.com`);
      return lines.join('\n');
    },

    // arXiv

    search_arxiv: async (params, onStage) => {
      const { query, max_results = 5 } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      const limit = Math.min(Number(max_results) || 5, 10);
      onStage(`📄 Searching arXiv for "${query}"…`);

      const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=${limit}`;
      const xml = await fetch(url).then((r) => r.text());

      const lines = [`📄 arXiv Search: "${query}"`, ''];

      // Parse entries from Atom XML without a DOM parser
      const entries = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)];

      if (entries.length === 0) {
        lines.push(`No arXiv papers found for "${query}".`);
        lines.push(
          `🔗 https://arxiv.org/search/?searchtype=all&query=${encodeURIComponent(query)}`,
        );
        return lines.join('\n');
      }

      entries.forEach((match, i) => {
        const entry = match[1];

        const title = (entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        const summary = (entry.match(/<summary>([\s\S]*?)<\/summary>/)?.[1] ?? '')
          .replace(/\s+/g, ' ')
          .trim();
        const id = (entry.match(/<id>(.*?)<\/id>/)?.[1] ?? '').trim();
        const arxivId = id
          .replace('http://arxiv.org/abs/', '')
          .replace('https://arxiv.org/abs/', '');
        const published = entry.match(/<published>(.*?)<\/published>/)?.[1]?.slice(0, 10) ?? '';

        const authors = [...entry.matchAll(/<name>(.*?)<\/name>/g)]
          .map((m) => m[1].trim())
          .slice(0, 3)
          .join(', ');

        lines.push(`**${i + 1}. ${title}**`);
        if (authors) lines.push(`   👤 ${authors}${entries.length > 3 ? ' et al.' : ''}`);
        if (published) lines.push(`   📅 ${published}`);
        if (summary) lines.push(`   ${summary.slice(0, 200)}${summary.length > 200 ? '…' : ''}`);
        if (arxivId) {
          lines.push(`   🔗 https://arxiv.org/abs/${arxivId}`);
          lines.push(`   📥 https://arxiv.org/pdf/${arxivId}.pdf`);
        }
        lines.push('');
      });

      lines.push(`Source: arxiv.org`);
      return lines.join('\n');
    },

    // Open Library (Books)

    search_books: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`📚 Searching Open Library for "${query}"…`);

      const data = await safeJson(
        `https://openlibrary.org/search.json?q=${encodeURIComponent(query)}&limit=5&fields=key,title,author_name,first_publish_year,edition_count,subject,isbn`,
      );

      const lines = [`📚 Books Search: "${query}"`, ''];

      const docs = data.docs ?? [];
      if (docs.length === 0) {
        lines.push(`No books found for "${query}".`);
        lines.push(`🔗 https://openlibrary.org/search?q=${encodeURIComponent(query)}`);
        return lines.join('\n');
      }

      docs.forEach((book, i) => {
        lines.push(`**${i + 1}. ${book.title}**`);

        const authors = (book.author_name ?? []).slice(0, 3).join(', ');
        if (authors) lines.push(`   👤 ${authors}`);

        if (book.first_publish_year)
          lines.push(`   📅 First published: ${book.first_publish_year}`);
        if (book.edition_count) lines.push(`   📖 ${book.edition_count} editions`);

        const subjects = (book.subject ?? []).slice(0, 4).join(', ');
        if (subjects) lines.push(`   🏷  ${subjects}`);

        if (book.key) lines.push(`   🔗 https://openlibrary.org${book.key}`);
        lines.push('');
      });

      lines.push(`Source: openlibrary.org`);
      return lines.join('\n');
    },

    // Movies (OMDB)

    search_movies: async (params, onStage) => {
      const { query, type } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`🎬 Searching for "${query}"…`);

      // OMDB free tier — uses API key "trilogy" (public demo key, limited)
      // For production replace with a real key via env var
      const apiKey = process.env.OMDB_API_KEY ?? 'trilogy';
      const typeParam = type ? `&type=${encodeURIComponent(type)}` : '';

      // Search endpoint for multiple results
      const searchData = await safeJson(
        `https://www.omdbapi.com/?s=${encodeURIComponent(query)}&apikey=${apiKey}${typeParam}`,
      );

      const lines = [`🎬 Movie/Show Search: "${query}"`, ''];

      if (searchData.Response === 'False') {
        lines.push(`No results found: ${searchData.Error ?? 'Unknown error'}`);
        return lines.join('\n');
      }

      const results = (searchData.Search ?? []).slice(0, 5);

      // Fetch full details for the top result
      const top = results[0];
      if (top?.imdbID) {
        const detail = await safeJson(
          `https://www.omdbapi.com/?i=${top.imdbID}&apikey=${apiKey}&plot=short`,
        );

        if (detail.Response !== 'False') {
          lines.push(`**${detail.Title}** (${detail.Year})`);
          lines.push(`   🎭 ${detail.Type}  •  ⭐ IMDb: ${detail.imdbRating}  •  ${detail.Rated}`);
          if (detail.Genre) lines.push(`   🏷  ${detail.Genre}`);
          if (detail.Director && detail.Director !== 'N/A')
            lines.push(`   🎬 Director: ${detail.Director}`);
          if (detail.Actors && detail.Actors !== 'N/A') lines.push(`   👤 Cast: ${detail.Actors}`);
          if (detail.Plot && detail.Plot !== 'N/A') lines.push(`   📝 ${detail.Plot}`);
          if (detail.Runtime && detail.Runtime !== 'N/A') lines.push(`   ⏱  ${detail.Runtime}`);
          lines.push(`   🔗 https://www.imdb.com/title/${detail.imdbID}/`);
          lines.push('');
        }
      }

      // List remaining results
      if (results.length > 1) {
        lines.push('**Also found:**');
        results.slice(1).forEach((r, i) => {
          lines.push(
            `  ${i + 2}. ${r.Title} (${r.Year}) — ${r.Type}  🔗 https://www.imdb.com/title/${r.imdbID}/`,
          );
        });
        lines.push('');
      }

      lines.push(`Source: omdbapi.com`);
      return lines.join('\n');
    },

    // Product Hunt

    search_producthunt: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`🚀 Searching Product Hunt for "${query}"…`);

      // Product Hunt's GraphQL API requires an auth token for most queries.
      // Use the public DuckDuckGo search scoped to producthunt.com as a fallback.
      const data = await safeJson(
        `https://api.duckduckgo.com/?q=${encodeURIComponent(query + ' site:producthunt.com')}&format=json&no_redirect=1&no_html=1`,
      );

      const lines = [`🚀 Product Hunt Search: "${query}"`, ''];

      const related = (data.RelatedTopics ?? []).filter(
        (t) => t.Text && t.FirstURL && t.FirstURL.includes('producthunt.com'),
      );

      if (related.length === 0) {
        lines.push(`No Product Hunt results found for "${query}".`);
        lines.push(`🔗 https://www.producthunt.com/search?q=${encodeURIComponent(query)}`);
        return lines.join('\n');
      }

      related.slice(0, 6).forEach((t, i) => {
        lines.push(`**${i + 1}.** ${t.Text.slice(0, 140)}${t.Text.length > 140 ? '…' : ''}`);
        lines.push(`   🔗 ${t.FirstURL}`);
        lines.push('');
      });

      lines.push(`Source: producthunt.com`);
      return lines.join('\n');
    },

    // CVE Security Advisories

    search_cve: async (params, onStage) => {
      const { query } = params;
      if (!query?.trim()) throw new Error('Missing required param: query');

      onStage(`🔒 Searching CVE database for "${query}"…`);

      const lines = [`🔒 CVE Search: "${query}"`, ''];

      // Detect direct CVE ID lookup vs keyword search
      const isCveId = /^CVE-\d{4}-\d+$/i.test(query.trim());

      if (isCveId) {
        // Direct CVE lookup via NIST NVD API (no key required for basic use)
        const cveId = query.trim().toUpperCase();
        const data = await safeJson(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?cveId=${encodeURIComponent(cveId)}`,
        );

        const vuln = data.vulnerabilities?.[0]?.cve;
        if (!vuln) {
          lines.push(`CVE "${cveId}" not found.`);
          return lines.join('\n');
        }

        const desc = vuln.descriptions?.find((d) => d.lang === 'en')?.value ?? 'No description';
        const cvssV3 =
          vuln.metrics?.cvssMetricV31?.[0]?.cvssData ?? vuln.metrics?.cvssMetricV30?.[0]?.cvssData;
        const published = vuln.published?.slice(0, 10);
        const modified = vuln.lastModified?.slice(0, 10);

        lines.push(`**${cveId}**`);
        if (published) lines.push(`📅 Published: ${published}  •  Modified: ${modified}`);

        if (cvssV3) {
          const severity = cvssV3.baseSeverity ?? '';
          const score = cvssV3.baseScore ?? '';
          const vector = cvssV3.vectorString ?? '';
          lines.push(`⚠️  CVSS v3: ${score} (${severity})  •  ${vector}`);
        }

        lines.push('');
        lines.push(`📝 ${desc}`);
        lines.push('');

        const refs = (vuln.references ?? []).slice(0, 3);
        if (refs.length > 0) {
          lines.push('**References:**');
          refs.forEach((r) => lines.push(`  🔗 ${r.url}`));
        }

        lines.push('');
        lines.push(`🔗 https://nvd.nist.gov/vuln/detail/${cveId}`);
      } else {
        // Keyword search via NIST NVD
        const data = await safeJson(
          `https://services.nvd.nist.gov/rest/json/cves/2.0?keywordSearch=${encodeURIComponent(query)}&resultsPerPage=5`,
        ).catch(() => null);

        const vulns = data?.vulnerabilities ?? [];
        if (vulns.length === 0) {
          lines.push(`No CVEs found for "${query}".`);
          lines.push(
            `🔗 https://nvd.nist.gov/vuln/search/results?query=${encodeURIComponent(query)}`,
          );
          return lines.join('\n');
        }

        lines.push(
          `Found ${data.totalResults?.toLocaleString() ?? vulns.length} total CVEs — showing top ${vulns.length}:`,
        );
        lines.push('');

        vulns.forEach((v, i) => {
          const cve = v.cve;
          const id = cve.id;
          const desc = (cve.descriptions?.find((d) => d.lang === 'en')?.value ?? '').slice(0, 180);
          const cvss =
            cve.metrics?.cvssMetricV31?.[0]?.cvssData ?? cve.metrics?.cvssMetricV30?.[0]?.cvssData;
          const date = cve.published?.slice(0, 10);

          lines.push(`**${i + 1}. ${id}**${date ? `  (${date})` : ''}`);
          if (cvss) lines.push(`   ⚠️  CVSS: ${cvss.baseScore} ${cvss.baseSeverity}`);
          if (desc) lines.push(`   ${desc}${desc.length >= 180 ? '…' : ''}`);
          lines.push(`   🔗 https://nvd.nist.gov/vuln/detail/${id}`);
          lines.push('');
        });
      }

      lines.push(`Source: nvd.nist.gov`);
      return lines.join('\n');
    },

    // Wayback Machine

    search_wayback: async (params, onStage) => {
      const { url, timestamp } = params;
      if (!url?.trim()) throw new Error('Missing required param: url');

      onStage(`🕰️ Checking Wayback Machine for "${url}"…`);

      const tsParam = timestamp ? `&timestamp=${timestamp}` : '';
      const data = await safeJson(
        `https://archive.org/wayback/available?url=${encodeURIComponent(url)}${tsParam}`,
      );

      const lines = [`🕰️ Wayback Machine: "${url}"`, ''];

      const snapshot = data.archived_snapshots?.closest;

      if (!snapshot?.available) {
        lines.push(`No archived snapshots found for this URL.`);
        lines.push(`🔗 Try searching manually: https://web.archive.org/web/*/${url}`);
        return lines.join('\n');
      }

      const ts = snapshot.timestamp ?? '';
      const year = ts.slice(0, 4);
      const month = ts.slice(4, 6);
      const day = ts.slice(6, 8);
      const hour = ts.slice(8, 10);
      const min = ts.slice(10, 12);
      const sec = ts.slice(12, 14);

      const humanDate = ts ? `${year}-${month}-${day} ${hour}:${min}:${sec} UTC` : 'Unknown';

      const statusEmoji =
        snapshot.status === '200'
          ? '✅'
          : snapshot.status === '301' || snapshot.status === '302'
            ? '↪️'
            : '⚠️';

      lines.push(`✅ Snapshot found!`);
      lines.push(`📅 **Archived on:** ${humanDate}`);
      lines.push(`${statusEmoji} **HTTP Status:** ${snapshot.status}`);
      lines.push('');
      lines.push(`🔗 **View archived page:**`);
      lines.push(`   ${snapshot.url}`);
      lines.push('');
      lines.push(`📂 **All snapshots for this URL:**`);
      lines.push(`   https://web.archive.org/web/*/${url}`);
      lines.push('');
      lines.push(`Source: archive.org / Wayback Machine`);

      return lines.join('\n');
    },
  },
});
