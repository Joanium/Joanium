import { createExecutor } from '../Shared/createExecutor.js';
import { safeJson } from '../Shared/Utils.js';
import { toolsList } from './ToolsList.js';

const NPM_REGISTRY = 'https://registry.npmjs.org';
const NPM_DOWNLOADS = 'https://api.npmjs.org/downloads/point';

function fmtDownloads(n) {
  if (n == null) return 'N/A';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtDate(iso) {
  if (!iso) return 'N/A';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

async function fetchLatest(name) {
  return safeJson(`${NPM_REGISTRY}/${encodeURIComponent(name).replace(/%40/g, '@')}/latest`);
}

async function fetchPackument(name) {
  // Abbreviated packument — much smaller than full registry doc
  const res = await fetch(`${NPM_REGISTRY}/${encodeURIComponent(name).replace(/%40/g, '@')}`, {
    headers: { Accept: 'application/vnd.npm.install-v1+json' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} — package "${name}" not found on npm`);
  return res.json();
}

async function fetchDownloads(name, period = 'last-week') {
  return safeJson(`${NPM_DOWNLOADS}/${period}/${encodeURIComponent(name).replace(/%40/g, '@')}`);
}

export const { handles, execute } = createExecutor({
  name: 'NpmExecutor',
  tools: toolsList,
  handlers: {
    npm_search: async (params, onStage) => {
      const query = String(params.query ?? '').trim();
      const size = Math.min(Math.max(Number(params.size) || 5, 1), 10);
      if (!query) return '❌ Please provide a search query.';

      onStage(`📦 Searching npm for "${query}"…`);
      const data = await safeJson(
        `${NPM_REGISTRY}/-/v1/search?text=${encodeURIComponent(query)}&size=${size}`,
      );

      const objects = data?.objects ?? [];
      if (!objects.length) return `No npm packages found for "${query}".`;

      const lines = objects.map((obj, i) => {
        const pkg = obj.package;
        const desc = pkg.description ? `\n   ${pkg.description}` : '';
        const link = pkg.links?.npm ?? `https://www.npmjs.com/package/${pkg.name}`;
        return `${i + 1}. **${pkg.name}** @ ${pkg.version}${desc}\n   🔗 ${link}`;
      });

      return [
        `📦 npm Search — "${query}" (${data.total?.toLocaleString() ?? '?'} total results)`,
        '',
        ...lines,
      ].join('\n');
    },

    npm_package_info: async (params, onStage) => {
      const name = String(params.name ?? '').trim();
      if (!name) return '❌ Please provide a package name.';

      onStage(`📦 Fetching npm info for "${name}"…`);
      const pkg = await fetchLatest(name);

      const deps = Object.keys(pkg.dependencies ?? {}).length;
      const devDeps = Object.keys(pkg.devDependencies ?? {}).length;
      const peerDeps = Object.keys(pkg.peerDependencies ?? {}).length;
      const repo =
        typeof pkg.repository === 'string' ? pkg.repository : (pkg.repository?.url ?? null);
      const repoClean = repo
        ? repo
            .replace(/^git\+/, '')
            .replace(/\.git$/, '')
            .replace(/^git:\/\//, 'https://')
        : null;
      const author = typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name ?? null);
      const engines = pkg.engines
        ? Object.entries(pkg.engines)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ')
        : null;

      const lines = [
        `📦 **${pkg.name}** @ ${pkg.version}`,
        '',
        pkg.description ? `📝 ${pkg.description}` : null,
        `🪪 License: ${pkg.license ?? 'N/A'}`,
        author ? `👤 Author: ${author}` : null,
        pkg.homepage ? `🌐 Homepage: ${pkg.homepage}` : null,
        repoClean ? `📂 Repository: ${repoClean}` : null,
        engines ? `⚙️ Engines: ${engines}` : null,
        '',
        `📦 Dependencies: ${deps} prod · ${devDeps} dev · ${peerDeps} peer`,
        `🔗 npm: https://www.npmjs.com/package/${pkg.name}`,
      ].filter(Boolean);

      return lines.join('\n');
    },

    npm_package_versions: async (params, onStage) => {
      const name = String(params.name ?? '').trim();
      const limit = Math.min(Math.max(Number(params.limit) || 15, 1), 30);
      if (!name) return '❌ Please provide a package name.';

      onStage(`📦 Fetching versions for "${name}"…`);
      const packument = await fetchPackument(name);
      const time = packument?.time ?? {};
      const latestTag = packument?.['dist-tags']?.latest ?? null;

      const versions = Object.entries(time)
        .filter(([v]) => v !== 'created' && v !== 'modified')
        .sort(([, a], [, b]) => new Date(b) - new Date(a))
        .slice(0, limit);

      if (!versions.length) return `No version history found for "${name}".`;

      const lines = versions.map(([version, date]) => {
        const tag = version === latestTag ? ' ← latest' : '';
        return `• **${version}**${tag}  —  ${fmtDate(date)}`;
      });

      return [
        `📦 **${name}** — ${versions.length} most recent version${versions.length !== 1 ? 's' : ''}`,
        `   First published: ${fmtDate(time.created)}`,
        '',
        ...lines,
      ].join('\n');
    },

    npm_package_downloads: async (params, onStage) => {
      const name = String(params.name ?? '').trim();
      const period = ['last-week', 'last-month', 'last-year'].includes(params.period)
        ? params.period
        : 'last-week';
      if (!name) return '❌ Please provide a package name.';

      onStage(`📦 Fetching download stats for "${name}"…`);

      // Fetch all three periods in parallel so we can show context
      const [week, month, year] = await Promise.all([
        fetchDownloads(name, 'last-week').catch(() => null),
        fetchDownloads(name, 'last-month').catch(() => null),
        fetchDownloads(name, 'last-year').catch(() => null),
      ]);

      if (!week && !month && !year) {
        return `Could not fetch download stats for "${name}". The package may not exist or the npm API is unavailable.`;
      }

      const lines = [
        `📦 **${name}** — Download Statistics`,
        '',
        week
          ? `📅 Last week:  ${fmtDownloads(week.downloads)} (${week.start} → ${week.end})`
          : null,
        month
          ? `📅 Last month: ${fmtDownloads(month.downloads)} (${month.start} → ${month.end})`
          : null,
        year
          ? `📅 Last year:  ${fmtDownloads(year.downloads)} (${year.start} → ${year.end})`
          : null,
        '',
        `🔗 https://www.npmjs.com/package/${name}`,
      ].filter(Boolean);

      return lines.join('\n');
    },

    npm_compare_packages: async (params, onStage) => {
      const a = String(params.package_a ?? '').trim();
      const b = String(params.package_b ?? '').trim();
      if (!a || !b) return '❌ Please provide two package names to compare.';

      onStage(`📦 Comparing "${a}" vs "${b}"…`);

      const [pkgA, pkgB, dlA, dlB] = await Promise.all([
        fetchLatest(a).catch(() => null),
        fetchLatest(b).catch(() => null),
        fetchDownloads(a, 'last-week').catch(() => null),
        fetchDownloads(b, 'last-week').catch(() => null),
      ]);

      if (!pkgA && !pkgB) return `❌ Neither "${a}" nor "${b}" could be found on npm.`;
      if (!pkgA) return `❌ Package "${a}" not found on npm.`;
      if (!pkgB) return `❌ Package "${b}" not found on npm.`;

      function col(pkg, dl) {
        const deps = Object.keys(pkg.dependencies ?? {}).length;
        const author = typeof pkg.author === 'string' ? pkg.author : (pkg.author?.name ?? '—');
        return [
          `**${pkg.name}**`,
          `Version:      ${pkg.version}`,
          `License:      ${pkg.license ?? 'N/A'}`,
          `Author:       ${author}`,
          `Dependencies: ${deps}`,
          `Weekly DLs:   ${dl ? fmtDownloads(dl.downloads) : 'N/A'}`,
          `Homepage:     ${pkg.homepage ?? '—'}`,
          `npm:          https://www.npmjs.com/package/${pkg.name}`,
        ];
      }

      const colA = col(pkgA, dlA);
      const colB = col(pkgB, dlB);
      const maxLen = Math.max(...colA.map((l) => l.length));

      const rows = colA.map((lineA, i) => `${lineA.padEnd(maxLen + 2)}  ${colB[i]}`);

      return [`📦 npm Comparison`, '─'.repeat(60), ...rows, '─'.repeat(60)].join('\n');
    },
  },
});
