const HANDLED = new Set(['github_load_repo_context', 'github_search_code']);

// File extensions we consider "source" (worth loading)
const SOURCE_EXTS = new Set([
  'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'cpp', 'h', 'hpp', 'cs',
  'vue', 'svelte', 'astro',
  'css', 'scss', 'less',
  'html', 'ejs', 'hbs',
  'json', 'yaml', 'yml', 'toml',
  'sh', 'bash', 'zsh',
  'md', 'mdx',
  'sql', 'graphql', 'gql',
  'env', 'Dockerfile', 'Makefile',
]);

// Files that are always interesting regardless of extension
const ALWAYS_LOAD = new Set([
  'package.json', 'package-lock.json', 'yarn.lock',
  'README.md', 'readme.md',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.env.example', 'Makefile', 'Justfile',
  'pyproject.toml', 'setup.py', 'requirements.txt',
  'Cargo.toml', 'go.mod',
  'tsconfig.json', 'jsconfig.json', 'vite.config.js', 'vite.config.ts',
  'webpack.config.js', 'rollup.config.js',
  '.eslintrc.js', '.prettierrc',
]);

// Directories to skip (noise)
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.pytest_cache', 'venv', '.venv', 'env',
  'coverage', '.nyc_output', '.cache', 'tmp', 'temp',
  'vendor', 'target', 'bin', 'obj', '.gradle',
]);

const MAX_FILE_CHARS = 8_000;  // per file
const MAX_TOTAL_CHARS = 80_000; // total context budget

export function handles(toolName) { return HANDLED.has(toolName); }

/** Score a file path — higher = more important to load */
function scoreFile(filePath) {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  const ext = filename.split('.').pop()?.toLowerCase() ?? '';

  // Skip dirs
  if (parts.some(p => SKIP_DIRS.has(p))) return -1;

  let score = 0;

  // Always-load files get a big boost
  if (ALWAYS_LOAD.has(filename)) score += 100;

  // Source files score by extension
  if (SOURCE_EXTS.has(ext)) score += 30;
  else return -1; // skip non-source

  // Penalise deeply nested files
  score -= Math.max(0, parts.length - 4) * 2;

  // Penalise test files slightly (still useful, but lower priority)
  if (/\.(test|spec)\.|__tests__|\/tests?\//.test(filePath)) score -= 10;

  // Boost index/entry files
  if (/^(index|main|app|server|entry)\.\w+$/.test(filename)) score += 20;

  // Boost config files
  if (/config|setup|bootstrap|init/.test(filename.toLowerCase())) score += 10;

  return score;
}

export async function execute(toolName, params, onStage = () => { }) {
  switch (toolName) {

    case 'github_load_repo_context': {
      const { owner, repo, focus_paths, max_files = 20 } = params;
      if (!owner || !repo) throw new Error('Missing required params: owner, repo');

      const limit = Math.min(Number(max_files) || 20, 40);
      const focusList = focus_paths
        ? focus_paths.split(',').map(p => p.trim()).filter(Boolean)
        : [];

      onStage(`[GITHUB] Loading file tree for ${owner}/${repo}…`);

      // 1. Get full file tree
      const treeResult = await window.electronAPI?.githubGetTree?.(owner, repo);
      if (!treeResult?.ok) throw new Error(treeResult?.error ?? 'GitHub not connected');

      const allFiles = (treeResult.tree ?? []).filter(f => f.type === 'blob');
      onStage(`[GITHUB] Found ${allFiles.length} files — selecting most important…`);

      // 2. Score and sort files
      let candidates;
      if (focusList.length > 0) {
        candidates = allFiles.filter(f => focusList.some(prefix => f.path.startsWith(prefix)));
        if (candidates.length === 0) {
          candidates = allFiles; // fall back to all if no matches
        }
      } else {
        candidates = allFiles;
      }

      const scored = candidates
        .map(f => ({ path: f.path, score: scoreFile(f.path), size: f.size ?? 0 }))
        .filter(f => f.score >= 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);

      onStage(`[GITHUB] Loading ${scored.length} files…`);

      // 3. Load file contents in parallel (batches of 6 to avoid rate limits)
      const BATCH = 6;
      const loaded = [];
      let totalChars = 0;

      for (let i = 0; i < scored.length; i += BATCH) {
        const batch = scored.slice(i, i + BATCH);
        const results = await Promise.allSettled(
          batch.map(f => window.electronAPI?.githubGetFile?.(owner, repo, f.path))
        );

        for (let j = 0; j < results.length; j++) {
          const r = results[j];
          const fileMeta = batch[j];

          if (r.status === 'fulfilled' && r.value?.ok) {
            let content = r.value.content ?? '';
            if (content.length > MAX_FILE_CHARS) {
              content = content.slice(0, MAX_FILE_CHARS) + `\n…(truncated)`;
            }
            if (totalChars + content.length > MAX_TOTAL_CHARS) break;
            loaded.push({ path: fileMeta.path, content });
            totalChars += content.length;
          }
        }
        if (totalChars >= MAX_TOTAL_CHARS) break;
      }

      // 4. Build structured context
      const treeLines = allFiles
        .filter(f => !SKIP_DIRS.has(f.path.split('/')[0]))
        .map(f => f.path)
        .slice(0, 300);

      const sections = [
        `# Repository: ${owner}/${repo}`,
        '',
        `## File Tree (${allFiles.length} total files, showing up to 300)`,
        '```',
        treeLines.join('\n'),
        '```',
        '',
        `## Loaded Files (${loaded.length} of ${allFiles.length} total)`,
        '',
        ...loaded.map(f => [
          `### ${f.path}`,
          '```',
          f.content,
          '```',
          '',
        ].join('\n')),
      ];

      return sections.join('\n');
    }

    case 'github_search_code': {
      const { owner, repo, query } = params;
      if (!owner || !repo || !query) throw new Error('Missing required params: owner, repo, query');

      onStage(`[GITHUB] Searching "${query}" in ${owner}/${repo}…`);

      const result = await window.electronAPI?.githubSearchCode?.(owner, repo, query);
      if (!result?.ok) throw new Error(result?.error ?? 'GitHub not connected');

      const items = result.items ?? [];
      if (!items.length) return `No results for "${query}" in ${owner}/${repo}.`;

      const lines = items.slice(0, 20).map((item, i) => {
        const snippets = (item.text_matches ?? [])
          .slice(0, 2)
          .map(m => `  > ${m.fragment?.replace(/\n/g, ' ').slice(0, 120)}`)
          .join('\n');
        return [`${i + 1}. **${item.path}**`, snippets].filter(Boolean).join('\n');
      });

      return [
        `Search results for "${query}" in ${owner}/${repo}:`,
        `Found ${result.total_count ?? items.length} match${items.length !== 1 ? 'es' : ''}`,
        '',
        ...lines,
      ].join('\n');
    }

    default:
      throw new Error(`RepoExecutor: unknown tool "${toolName}"`);
  }
}
