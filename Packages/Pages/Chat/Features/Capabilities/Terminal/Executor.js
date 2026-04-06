import { createExecutor } from '../Shared/createExecutor.js';
import { state } from '../../../../../System/State.js';

function resolveWorkingDirectory(explicitPath) {
  return explicitPath?.trim() || state.workspacePath || '';
}

function formatRisk(risk) {
  if (!risk || !risk.level || risk.level === 'low') return '';
  const reasons = (risk.reasons ?? []).map((reason) => `- ${reason}`).join('\n');
  return [`Risk: **${risk.level}**`, reasons || '- No specific reason was returned.'].join('\n');
}

function formatWorkspaceSummary(summary) {
  const lines = [
    `Workspace: ${summary.path}`,
    `Languages: ${(summary.languages ?? []).join(', ') || 'unknown'}`,
    `Frameworks: ${(summary.frameworks ?? []).join(', ') || 'none detected'}`,
    `Testing: ${(summary.testing ?? []).join(', ') || 'none detected'}`,
    `Infra: ${(summary.infra ?? []).join(', ') || 'none detected'}`,
    `Package manager: ${summary.packageManager || 'unknown'}`,
  ];

  if (summary.ciWorkflows?.length) {
    lines.push(`CI workflows: ${summary.ciWorkflows.join(', ')}`);
  }
  if (summary.dockerFiles?.length) {
    lines.push(`Docker files: ${summary.dockerFiles.join(', ')}`);
  }
  if (summary.envFiles?.length) {
    lines.push(`Env files: ${summary.envFiles.join(', ')}`);
  }
  if (summary.packageScripts && Object.keys(summary.packageScripts).length) {
    const scriptPreview = Object.entries(summary.packageScripts)
      .slice(0, 12)
      .map(([name, value]) => `- ${name}: ${value}`)
      .join('\n');
    lines.push('', 'Scripts:', scriptPreview);
  }
  if (summary.notes?.length) {
    lines.push('', 'Notes:', ...summary.notes.map((note) => `- ${note}`));
  }
  if (summary.topEntries?.length) {
    lines.push(
      '',
      'Top-level entries:',
      ...summary.topEntries
        .slice(0, 40)
        .map((entry) => `- ${entry.name}${entry.type === 'dir' ? '/' : ''}`),
    );
  }

  return lines.join('\n');
}

function formatProjectChecks(result) {
  const lines = [];
  if (result.summary) {
    lines.push(formatWorkspaceSummary(result.summary), '');
  }

  if (!result.commands?.length) {
    lines.push(result.error || 'No project checks ran.');
    return lines.join('\n');
  }

  lines.push(`Overall status: **${result.ok ? 'passed' : 'needs attention'}**`, '');
  for (const command of result.commands) {
    lines.push(`### ${command.label.toUpperCase()}`);
    lines.push(`Command: \`${command.command}\``);
    lines.push(`Exit code: ${command.exitCode}${command.timedOut ? ' (timed out)' : ''}`);
    if (command.stdout?.trim()) {
      lines.push('STDOUT:', '```', command.stdout.trim(), '```');
    }
    if (command.stderr?.trim()) {
      lines.push('STDERR:', '```', command.stderr.trim(), '```');
    }
    if (!command.stdout?.trim() && !command.stderr?.trim()) {
      lines.push('(no output)');
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatMultipleFileReads(result) {
  return [
    `Read ${result.files.length} file${result.files.length !== 1 ? 's' : ''}:`,
    '',
    ...result.files.map((file) => {
      if (!file.ok) {
        return [`### ${file.path}`, `Error: ${file.error}`].join('\n');
      }

      return [
        `### ${file.path}`,
        `Size: ${(file.sizeBytes / 1024).toFixed(1)} KB | Lines: ${file.totalLines}`,
        '```',
        file.content,
        '```',
      ].join('\n');
    }),
  ].join('\n');
}

function formatDirectoryTree(result) {
  return [
    `Directory tree for ${result.path}:`,
    `Entries shown: ${result.count}${result.truncated ? ' (truncated)' : ''} | Depth: ${result.maxDepth}`,
    '```',
    result.lines.join('\n'),
    '```',
  ].join('\n');
}

function formatDocumentExtraction(result, filePath) {
  return [
    `Extracted text from ${filePath}:`,
    `Type: ${result.kind} | Summary: ${result.summary}${result.truncated ? ' | Truncated for context' : ''}`,
    ...(result.warnings?.length
      ? ['', 'Warnings:', ...result.warnings.map((warning) => `- ${warning}`)]
      : []),
    '',
    '```',
    result.text,
    '```',
  ].join('\n');
}

// ─── SHARED HELPERS FOR NEW TOOLS ─────────────────────────────────────────────

/**
 * Read a file's full content as a string via existing IPC.
 * Requests a very high maxLines so we get the whole file.
 */
async function ipcReadFile(filePath) {
  const result = await window.electronAPI?.invoke?.('read-local-file', {
    filePath,
    maxLines: 500000,
  });
  if (!result?.ok) throw new Error(result?.error ?? `Could not read file: ${filePath}`);
  return { content: result.content, totalLines: result.totalLines, sizeBytes: result.sizeBytes };
}

/**
 * Write content back to a file via existing IPC.
 */
async function ipcWriteFile(filePath, content) {
  const result = await window.electronAPI?.invoke?.('write-ai-file', {
    filePath,
    content,
    append: false,
  });
  if (!result?.ok) throw new Error(result?.error ?? `Could not write file: ${filePath}`);
  return result;
}

/**
 * Split content into lines, preserving original line endings awareness.
 * Returns an array of line strings (without trailing \n).
 */
function splitLines(content) {
  return content.split('\n');
}

/**
 * Join lines back into a file string, ensuring single trailing newline.
 */
function joinLines(lines) {
  return lines.join('\n');
}

/**
 * Clamp a 1-based line number to valid array indices.
 */
function clampLine(oneBased, length) {
  return Math.max(1, Math.min(oneBased, length));
}

/**
 * Build a timestamp string: YYYYMMDD_HHMMSS
 */
function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
  );
}

/**
 * Detect language from file extension for structure parsing.
 */
function detectLang(filePath) {
  const ext = filePath.split('.').pop().toLowerCase();
  const map = {
    js: 'js',
    jsx: 'js',
    ts: 'ts',
    tsx: 'ts',
    py: 'python',
    java: 'java',
    cs: 'csharp',
    go: 'go',
    rb: 'ruby',
    php: 'php',
    rs: 'rust',
    cpp: 'cpp',
    c: 'c',
    h: 'c',
    swift: 'swift',
    kt: 'kotlin',
  };
  return map[ext] || 'unknown';
}

/**
 * Produce a unified diff between two arrays of lines.
 * Returns diff lines (with +/- prefixes and @@ headers).
 */
function unifiedDiff(linesA, linesB, nameA, nameB, contextLines = 3) {
  const output = [`--- ${nameA}`, `+++ ${nameB}`];

  // Hunt algorithm: find changed regions
  const n = linesA.length;
  const m = linesB.length;

  // Build an LCS-based change list via Myers-lite (simple O(nm) DP)
  // For large files we fall back to a chunk-based approach
  const MAX_SIMPLE = 2000;
  if (n > MAX_SIMPLE || m > MAX_SIMPLE) {
    output.push('(diff truncated — files too large for inline diff; use git diff instead)');
    return output.join('\n');
  }

  // dp[i][j] = LCS length of linesA[0..i-1], linesB[0..j-1]
  const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      dp[i][j] =
        linesA[i - 1] === linesB[j - 1]
          ? dp[i - 1][j - 1] + 1
          : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  // Backtrack to build edit script
  const edits = []; // { type: 'eq'|'del'|'ins', lineA, lineB, text }
  let i = n,
    j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      edits.push({ type: 'eq', lineA: i, lineB: j, text: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      edits.push({ type: 'ins', lineA: i, lineB: j, text: linesB[j - 1] });
      j--;
    } else {
      edits.push({ type: 'del', lineA: i, lineB: j, text: linesA[i - 1] });
      i--;
    }
  }
  edits.reverse();

  // Group into hunks
  const changed = edits.map((e, idx) => ({ ...e, idx })).filter((e) => e.type !== 'eq');
  if (!changed.length) return ['(files are identical)'].join('\n');

  const hunks = [];
  let hunk = null;
  for (const ch of changed) {
    if (!hunk || ch.idx - hunk.end > contextLines * 2) {
      if (hunk) hunks.push(hunk);
      hunk = { start: ch.idx, end: ch.idx, changes: [ch] };
    } else {
      hunk.end = ch.idx;
      hunk.changes.push(ch);
    }
  }
  if (hunk) hunks.push(hunk);

  for (const h of hunks) {
    const from = Math.max(0, h.start - contextLines);
    const to = Math.min(edits.length - 1, h.end + contextLines);
    const slice = edits.slice(from, to + 1);

    const aStart = slice.find((e) => e.type !== 'ins')?.lineA ?? 1;
    const bStart = slice.find((e) => e.type !== 'del')?.lineB ?? 1;
    const aCount = slice.filter((e) => e.type !== 'ins').length;
    const bCount = slice.filter((e) => e.type !== 'del').length;

    output.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
    for (const e of slice) {
      if (e.type === 'eq') output.push(` ${e.text}`);
      else if (e.type === 'del') output.push(`-${e.text}`);
      else output.push(`+${e.text}`);
    }
  }

  return output.join('\n');
}

// ── COMMENT STYLE MAP (used by comment_out_lines & uncomment_lines) ───────────
const COMMENT_STYLES = {
  js: { single: '//', block: null },
  jsx: { single: '//', block: null },
  ts: { single: '//', block: null },
  tsx: { single: '//', block: null },
  java: { single: '//', block: null },
  c: { single: '//', block: null },
  cpp: { single: '//', block: null },
  cs: { single: '//', block: null },
  go: { single: '//', block: null },
  kt: { single: '//', block: null },
  rs: { single: '//', block: null },
  swift: { single: '//', block: null },
  php: { single: '//', block: null },
  py: { single: '#', block: null },
  rb: { single: '#', block: null },
  sh: { single: '#', block: null },
  bash: { single: '#', block: null },
  yml: { single: '#', block: null },
  yaml: { single: '#', block: null },
  r: { single: '#', block: null },
  sql: { single: '--', block: null },
  lua: { single: '--', block: null },
  html: { single: null, block: ['<!--', '-->'] },
  xml: { single: null, block: ['<!--', '-->'] },
  svg: { single: null, block: ['<!--', '-->'] },
  css: { single: null, block: ['/*', '*/'] },
  scss: { single: '//', block: ['/*', '*/'] },
  less: { single: '//', block: ['/*', '*/'] },
};

function getCommentStyle(filePath, override) {
  if (override) {
    const map = {
      '//': { single: '//', block: null },
      '#': { single: '#', block: null },
      '--': { single: '--', block: null },
      '/* */': { single: null, block: ['/*', '*/'] },
      '<!-- -->': { single: null, block: ['<!--', '-->'] },
    };
    return map[override] || { single: override, block: null };
  }
  const ext = filePath.split('.').pop().toLowerCase();
  return COMMENT_STYLES[ext] || { single: '//', block: null };
}

export const { handles, execute } = createExecutor({
  name: 'TerminalExecutor',
  tools: [
    'inspect_workspace',
    'search_workspace',
    'find_file_by_name',
    'run_shell_command',
    'assess_shell_command',
    'read_local_file',
    'extract_file_text',
    'read_file_chunk',
    'read_multiple_local_files',
    'list_directory',
    'list_directory_tree',
    'write_file',
    'apply_file_patch',
    'replace_lines_in_file',
    'insert_into_file',
    'create_folder',
    'copy_item',
    'move_item',
    'git_status',
    'git_diff',
    'git_create_branch',
    'run_project_checks',
    'open_folder',
    'start_local_server',
    'delete_item',
    'get_file_metadata',
    'search_in_file',
    'read_file_around_line',
    'count_occurrences',
    'get_file_structure',
    'diff_two_files',
    'delete_lines',
    'move_lines',
    'duplicate_lines',
    'sort_lines_in_range',
    'indent_lines',
    'wrap_lines',
    'find_replace_regex',
    'batch_replace',
    'insert_at_marker',
    'backup_file',
    'extract_lines_to_file',
    'merge_files',
    'trim_file_whitespace',
    'normalize_file',
  ],
  handlers: {
    inspect_workspace: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');

      onStage(`📂 Inspecting workspace ${rootPath}`);
      const result = await window.electronAPI?.invoke?.('inspect-workspace', { rootPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace inspection failed');
      return formatWorkspaceSummary(result.summary);
    },

    search_workspace: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');
      if (!params.query?.trim()) throw new Error('Missing required param: query');

      onStage(`🔎 Searching workspace for "${params.query}"`);
      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath,
        query: params.query,
        maxResults: params.max_results,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace search failed');
      if (!result.matches?.length) return `No matches for "${params.query}" in ${rootPath}.`;

      return [
        `Matches for "${params.query}" in ${result.root}:`,
        '',
        ...result.matches.map((match) => `- ${match.path}:${match.lineNumber} — ${match.line}`),
      ].join('\n');
    },

    find_file_by_name: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');
      if (!params.name?.trim()) throw new Error('Missing required param: name');

      onStage(`🔎 Finding file "${params.name}"`);
      const result = await window.electronAPI?.invoke?.('find-file-by-name', {
        rootPath,
        name: params.name,
        maxResults: params.max_results,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Find file failed');
      if (!result.matches?.length)
        return `No files matching "${params.name}" found in ${rootPath}.`;

      return [
        `Files matching "${params.name}" in ${result.root}:`,
        '',
        ...result.matches.map((match) => `- ${match.path}`),
      ].join('\n');
    },

    assess_shell_command: async (params, onStage) => {
      if (!params.command?.trim()) throw new Error('Missing required param: command');
      onStage('🛡️ Assessing shell command risk');
      const result = await window.electronAPI?.invoke?.('assess-command-risk', {
        command: params.command,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Risk assessment failed');
      return formatRisk(result.risk) || 'Risk: **low**';
    },

    run_shell_command: async (params, onStage) => {
      const { command, timeout_seconds = 30, allow_risky = false } = params;
      if (!command?.trim()) throw new Error('Missing required param: command');

      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      onStage(`💻 Running: \`${command.slice(0, 80)}${command.length > 80 ? '…' : ''}\``);

      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command,
        cwd: workingDirectory,
        timeout: timeout_seconds * 1000,
        allowRisky: allow_risky,
      });

      if (!result) return '⚠️ Shell command execution is not available in this environment.';
      if (!result.ok && result.error) {
        return [result.error, formatRisk(result.risk)].filter(Boolean).join('\n\n');
      }

      const parts = [];
      if (result.cwd) parts.push(`Working directory: ${result.cwd}`);
      if (result.risk) {
        const riskText = formatRisk(result.risk);
        if (riskText) parts.push(riskText);
      }
      if (result.timedOut) parts.push(`⏰ Command timed out after ${timeout_seconds}s`);
      if (result.stdout?.trim()) parts.push(`STDOUT:\n\`\`\`\n${result.stdout.trim()}\n\`\`\``);
      if (result.stderr?.trim()) parts.push(`STDERR:\n\`\`\`\n${result.stderr.trim()}\n\`\`\``);
      if (result.exitCode !== 0) parts.push(`Exit code: ${result.exitCode}`);
      if (!result.stdout?.trim() && !result.stderr?.trim()) parts.push('(no output)');
      return parts.join('\n\n');
    },

    read_local_file: async (params, onStage) => {
      const { path: filePath, max_lines } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`📄 Reading ${filePath}`);
      const result = await window.electronAPI?.invoke?.('read-local-file', {
        filePath,
        maxLines: max_lines,
      });

      if (!result?.ok) throw new Error(result?.error ?? 'File reading failed');
      return [
        `File: ${result.path}`,
        `Size: ${(result.sizeBytes / 1024).toFixed(1)} KB | Lines: ${result.totalLines}`,
        '```',
        result.content,
        '```',
      ].join('\n');
    },

    extract_file_text: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`Extracting text from ${filePath}`);
      const result = await window.electronAPI?.invoke?.('extract-document-text', { filePath });
      if (!result?.ok) throw new Error(result?.error ?? 'Document extraction failed');
      return formatDocumentExtraction(result, filePath);
    },

    read_file_chunk: async (params, onStage) => {
      const { path: filePath, start_line, line_count } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_line) throw new Error('Missing required param: start_line');

      onStage(`📄 Reading lines around ${filePath}:${start_line}`);
      const result = await window.electronAPI?.invoke?.('read-file-chunk', {
        filePath,
        startLine: start_line,
        lineCount: line_count,
      });

      if (!result?.ok) throw new Error(result?.error ?? 'Chunked file read failed');
      return [
        `File: ${result.path}`,
        `Lines ${result.startLine}-${result.endLine} of ${result.totalLines}`,
        '```',
        result.content,
        '```',
      ].join('\n');
    },

    read_multiple_local_files: async (params, onStage) => {
      if (!params.paths?.trim()) throw new Error('Missing required param: paths');

      onStage(`Reading multiple files`);
      const result = await window.electronAPI?.invoke?.('read-multiple-local-files', {
        paths: params.paths,
        maxLinesPerFile: params.max_lines_per_file,
      });

      if (!result?.ok) throw new Error(result?.error ?? 'Multi-file read failed');
      return formatMultipleFileReads(result);
    },

    list_directory: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`📁 Listing ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('list-directory', { dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Directory listing failed');

      const lines = result.entries.map((entry) => {
        const icon = entry.type === 'dir' ? '📁' : '📄';
        const size =
          entry.size != null
            ? ` (${entry.size < 1024 ? `${entry.size} B` : `${(entry.size / 1024).toFixed(1)} KB`})`
            : '';
        return `${icon} ${entry.name}${entry.type === 'dir' ? '/' : ''}${size}`;
      });

      return [
        `Directory: ${result.path}`,
        `${result.count} item${result.count !== 1 ? 's' : ''}:`,
        '',
        ...lines,
      ].join('\n');
    },

    list_directory_tree: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`Listing tree for ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('list-directory-tree', {
        dirPath,
        maxDepth: params.max_depth,
        maxEntries: params.max_entries,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Directory tree failed');
      return formatDirectoryTree(result);
    },

    write_file: async (params, onStage) => {
      const { path: filePath, content } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (content == null) throw new Error('Missing required param: content');

      const append = params.append === true || params.append === 'true';
      onStage(`✍️ ${append ? 'Appending to' : 'Writing'} ${filePath}`);
      const result = await window.electronAPI?.invoke?.('write-ai-file', {
        filePath,
        content,
        append,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'File write failed');
      return `✅ File ${append ? 'appended' : 'written'}: ${result.path} (${result.bytes} bytes)`;
    },

    apply_file_patch: async (params, onStage) => {
      const { path: filePath, search, replace, replace_all } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (typeof search !== 'string' || !search.length)
        throw new Error('Missing required param: search');
      if (typeof replace !== 'string') throw new Error('Missing required param: replace');

      onStage(`🩹 Patching ${filePath}`);
      const result = await window.electronAPI?.invoke?.('apply-file-patch', {
        filePath,
        search,
        replace,
        replaceAll: replace_all,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'File patch failed');
      return `✅ Patched ${result.path} (${result.replacements} replacement${result.replacements !== 1 ? 's' : ''})`;
    },

    replace_lines_in_file: async (params, onStage) => {
      const { path: filePath, start_line, end_line, replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (typeof replacement !== 'string') throw new Error('Missing required param: replacement');

      onStage(`Replacing lines ${start_line}-${end_line} in ${filePath}`);
      const result = await window.electronAPI?.invoke?.('replace-lines-in-file', {
        filePath,
        startLine: start_line,
        endLine: end_line,
        replacement,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Line replacement failed');
      return `✅ Replaced lines ${result.startLine}-${result.endLine} in ${result.path}`;
    },

    insert_into_file: async (params, onStage) => {
      const { path: filePath, content } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (typeof content !== 'string') throw new Error('Missing required param: content');

      onStage(`Inserting text into ${filePath}`);
      const result = await window.electronAPI?.invoke?.('insert-into-file', {
        filePath,
        content,
        position: params.position,
        lineNumber: params.line_number,
        anchor: params.anchor,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Insert failed');
      return `✅ Inserted text into ${result.path} using ${result.mode} targeting (${result.position})`;
    },

    create_folder: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`📁 Creating folder ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('create-directory', { dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Folder creation failed');
      return `✅ Folder created: ${result.path}`;
    },

    copy_item: async (params, onStage) => {
      const { source_path, destination_path } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!destination_path?.trim()) throw new Error('Missing required param: destination_path');

      onStage(`Copying ${source_path}`);
      const result = await window.electronAPI?.invoke?.('copy-item', {
        sourcePath: source_path,
        destinationPath: destination_path,
        overwrite: params.overwrite,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Copy failed');
      return `✅ Copied ${result.source} -> ${result.destination}`;
    },

    move_item: async (params, onStage) => {
      const { source_path, destination_path } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!destination_path?.trim()) throw new Error('Missing required param: destination_path');

      onStage(`Moving ${source_path}`);
      const result = await window.electronAPI?.invoke?.('move-item', {
        sourcePath: source_path,
        destinationPath: destination_path,
        overwrite: params.overwrite,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Move failed');
      return `✅ Moved ${result.source} -> ${result.destination}`;
    },

    git_status: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      onStage(`🌿 Reading git status in ${workingDirectory}`);
      const result = await window.electronAPI?.invoke?.('git-status', {
        workingDir: workingDirectory,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'git status failed');
      return [
        `Git status for ${workingDirectory}:`,
        '```',
        (result.stdout || result.stderr || '(no output)').trim(),
        '```',
      ].join('\n');
    },

    git_diff: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      onStage(`🌿 Reading git diff in ${workingDirectory}`);
      const result = await window.electronAPI?.invoke?.('git-diff', {
        workingDir: workingDirectory,
        staged: params.staged,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'git diff failed');
      return [
        `Git diff for ${workingDirectory}${params.staged ? ' (staged)' : ''}:`,
        '```diff',
        (result.stdout || result.stderr || '(no diff)').trim(),
        '```',
      ].join('\n');
    },

    git_create_branch: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');
      if (!params.branch_name?.trim()) throw new Error('Missing required param: branch_name');

      onStage(`🌿 Creating branch ${params.branch_name}`);
      const result = await window.electronAPI?.invoke?.('git-create-branch', {
        workingDir: workingDirectory,
        branchName: params.branch_name,
        checkout: params.checkout ?? true,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'git branch creation failed');
      return [
        `Branch command complete for ${result.branchName}:`,
        '```',
        (result.stdout || result.stderr || '(no output)').trim(),
        '```',
      ].join('\n');
    },

    run_project_checks: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      onStage(`🧪 Running project checks in ${workingDirectory}`);
      const result = await window.electronAPI?.invoke?.('run-project-checks', {
        working_directory: workingDirectory,
        include_lint: params.include_lint,
        include_test: params.include_test,
        include_build: params.include_build,
      });
      if (!result) return '⚠️ Project checks are not available in this environment.';
      if (!result.ok && !result.commands?.length)
        throw new Error(result.error ?? 'Project checks failed');
      return formatProjectChecks(result);
    },

    open_folder: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`📂 Opening folder in OS ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('open-folder-os', { dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Opening folder failed');
      return `✅ Opened folder in system file explorer: ${dirPath}`;
    },

    delete_item: async (params, onStage) => {
      const { path: itemPath } = params;
      if (!itemPath?.trim()) throw new Error('Missing required param: path');

      onStage(`🗑️ Deleting ${itemPath}`);
      const result = await window.electronAPI?.invoke?.('delete-item', { itemPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Delete failed');
      return `✅ Successfully deleted: ${itemPath}`;
    },

    start_local_server: async (params, onStage) => {
      const { command } = params;
      if (!command?.trim()) throw new Error('Missing required param: command');

      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      onStage(`🚀 Starting server: ${command}`);
      const invokePayload = { command, cwd: workingDirectory };
      if (params.settle_ms != null && params.settle_ms !== '') {
        invokePayload.settleMs = Number(params.settle_ms);
      }
      const result = await window.electronAPI?.invoke?.('pty-spawn', invokePayload);

      if (!result?.ok) {
        const parts = [result.error ?? 'Background process failed to start'];
        if (result.exitCode != null) parts.push(`Exit code: ${result.exitCode}`);
        if (result.outputSnippet?.trim()) {
          parts.push('', 'Captured output:', '```', result.outputSnippet.trim(), '```');
        }
        throw new Error(parts.join('\n'));
      }

      return `[TERMINAL:${result.pid}]\n\nBackground command is running. Output appears in the terminal above.`;
    },

    get_file_metadata: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`🔍 Reading metadata for ${filePath}`);
      const { content, totalLines, sizeBytes } = await ipcReadFile(filePath);

      const words = content.trim() ? content.trim().split(/\s+/).length : 0;
      const chars = content.length;
      const ext = filePath.split('.').pop().toLowerCase();
      const lang = detectLang(filePath);
      const blankLines = content.split('\n').filter((l) => !l.trim()).length;
      const avgLineLen = totalLines > 0 ? Math.round(chars / totalLines) : 0;

      const lines = [
        `File: ${filePath}`,
        `Extension: .${ext} | Language: ${lang}`,
        `Size: ${sizeBytes < 1024 ? `${sizeBytes} B` : `${(sizeBytes / 1024).toFixed(2)} KB`}`,
        `Lines: ${totalLines} total (${blankLines} blank, ${totalLines - blankLines} non-blank)`,
        `Words: ${words.toLocaleString()}`,
        `Characters: ${chars.toLocaleString()}`,
        `Avg line length: ${avgLineLen} chars`,
        `Has CRLF line endings: ${content.includes('\r\n') ? 'Yes' : 'No'}`,
        `Has BOM: ${content.charCodeAt(0) === 0xfeff ? 'Yes' : 'No'}`,
        `Trailing newline: ${content.endsWith('\n') ? 'Yes' : 'No'}`,
      ];

      return lines.join('\n');
    },

    search_in_file: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const contextLines = params.context_lines ?? 2;
      const maxMatches = params.max_matches ?? 50;
      const caseSensitive = params.case_sensitive === true;
      const useRegex = params.regex === true;

      onStage(`🔎 Searching in ${filePath} for "${pattern}"`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? 'g' : 'gi')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
      } catch (e) {
        throw new Error(`Invalid regex pattern: ${e.message}`);
      }

      const matchedIndices = [];
      for (let i = 0; i < fileLines.length; i++) {
        regex.lastIndex = 0;
        if (regex.test(fileLines[i])) {
          matchedIndices.push(i);
          if (matchedIndices.length >= maxMatches) break;
        }
      }

      if (!matchedIndices.length) {
        return `No matches for "${pattern}" in ${filePath} (${totalLines} lines searched).`;
      }

      const output = [
        `Found ${matchedIndices.length}${matchedIndices.length >= maxMatches ? '+' : ''} match${matchedIndices.length !== 1 ? 'es' : ''} for "${pattern}" in ${filePath}:`,
        '',
      ];

      // Merge nearby match indices into blocks
      const blocks = [];
      let block = null;
      for (const idx of matchedIndices) {
        const from = Math.max(0, idx - contextLines);
        const to = Math.min(fileLines.length - 1, idx + contextLines);
        if (!block || from > block.to + 1) {
          if (block) blocks.push(block);
          block = { from, to, matches: [idx] };
        } else {
          block.to = Math.max(block.to, to);
          block.matches.push(idx);
        }
      }
      if (block) blocks.push(block);

      for (const b of blocks) {
        output.push(`--- lines ${b.from + 1}–${b.to + 1} ---`);
        for (let i = b.from; i <= b.to; i++) {
          const lineNum = String(i + 1).padStart(5, ' ');
          const marker = b.matches.includes(i) ? '▶' : ' ';
          output.push(`${lineNum}${marker} ${fileLines[i]}`);
        }
        output.push('');
      }

      return output.join('\n');
    },

    read_file_around_line: async (params, onStage) => {
      const { path: filePath, line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!line) throw new Error('Missing required param: line');

      const radius = params.radius ?? 15;
      onStage(`📄 Reading context around line ${line} in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);

      const center = clampLine(line, fileLines.length) - 1;
      const from = Math.max(0, center - radius);
      const to = Math.min(fileLines.length - 1, center + radius);

      const output = [
        `File: ${filePath} | Total lines: ${totalLines}`,
        `Showing lines ${from + 1}–${to + 1} (centered on line ${line}):`,
        '',
      ];

      for (let i = from; i <= to; i++) {
        const lineNum = String(i + 1).padStart(5, ' ');
        const marker = i === center ? '▶' : ' ';
        output.push(`${lineNum}${marker} ${fileLines[i]}`);
      }

      return output.join('\n');
    },

    count_occurrences: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const caseSensitive = params.case_sensitive === true;
      const useRegex = params.regex === true;

      onStage(`🔢 Counting occurrences of "${pattern}" in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? 'g' : 'gi')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? 'g' : 'gi');
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      let totalCount = 0;
      const hitLines = [];

      for (let i = 0; i < fileLines.length; i++) {
        regex.lastIndex = 0;
        const lineMatches = fileLines[i].match(regex);
        if (lineMatches) {
          totalCount += lineMatches.length;
          hitLines.push({ line: i + 1, count: lineMatches.length, text: fileLines[i].trim() });
        }
      }

      if (!totalCount) {
        return `No occurrences of "${pattern}" in ${filePath} (${totalLines} lines searched).`;
      }

      const output = [
        `"${pattern}" in ${filePath}:`,
        `Total occurrences: ${totalCount} across ${hitLines.length} line${hitLines.length !== 1 ? 's' : ''} (of ${totalLines} total)`,
        '',
        'Lines with matches:',
        ...hitLines
          .slice(0, 100)
          .map(
            (h) =>
              `  Line ${h.line}${h.count > 1 ? ` (×${h.count})` : ''}: ${h.text.slice(0, 120)}`,
          ),
        ...(hitLines.length > 100 ? [`  … and ${hitLines.length - 100} more lines`] : []),
      ];

      return output.join('\n');
    },

    get_file_structure: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`🗂️ Extracting structure from ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);
      const lang = detectLang(filePath);

      // Pattern sets per language family
      const patterns = {
        js: [
          { label: 'import', re: /^import\s+.+from\s+['"](.+)['"]/, group: 1 },
          {
            label: 'export',
            re: /^export\s+(default\s+)?(function|class|const|let|var)\s+(\w+)/,
            group: 3,
          },
          { label: 'class', re: /^(export\s+)?(default\s+)?class\s+(\w+)/, group: 3 },
          { label: 'function', re: /^(export\s+)?(async\s+)?function\s+(\w+)/, group: 3 },
          { label: 'const fn', re: /^(export\s+)?const\s+(\w+)\s*=\s*(async\s*)?\(/, group: 2 },
          {
            label: 'arrow',
            re: /^(export\s+)?const\s+(\w+)\s*=\s*(async\s+)?\(.*\)\s*=>/,
            group: 2,
          },
          { label: 'TODO', re: /\/\/\s*(TODO|FIXME|HACK|NOTE|XXX):?\s*(.+)/, group: 2 },
        ],
        python: [
          { label: 'import', re: /^(import|from)\s+(\S+)/, group: 2 },
          { label: 'class', re: /^class\s+(\w+)/, group: 1 },
          { label: 'def', re: /^(async\s+)?def\s+(\w+)/, group: 2 },
          { label: 'TODO', re: /#\s*(TODO|FIXME|HACK|NOTE):?\s*(.+)/, group: 2 },
        ],
        java: [
          { label: 'import', re: /^import\s+([\w.]+);/, group: 1 },
          {
            label: 'class',
            re: /(public|private|protected)?\s*(abstract\s+)?class\s+(\w+)/,
            group: 3,
          },
          {
            label: 'method',
            re: /(public|private|protected|static|\s)+[\w<>\[\]]+\s+(\w+)\s*\(/,
            group: 2,
          },
          { label: 'TODO', re: /\/\/\s*(TODO|FIXME):?\s*(.+)/, group: 2 },
        ],
        unknown: [
          { label: 'function', re: /function\s+(\w+)\s*\(/, group: 1 },
          { label: 'class', re: /class\s+(\w+)/, group: 1 },
          { label: 'TODO', re: /(\/\/|#)\s*(TODO|FIXME):?\s*(.+)/, group: 3 },
        ],
      };

      const activePats =
        patterns[lang] || patterns[lang === 'ts' ? 'js' : 'unknown'] || patterns.unknown;

      const entries = [];
      for (let i = 0; i < fileLines.length; i++) {
        const trimmed = fileLines[i].trim();
        if (!trimmed) continue;
        for (const pat of activePats) {
          const m = trimmed.match(pat.re);
          if (m) {
            const name = m[pat.group]?.trim() ?? trimmed.slice(0, 60);
            entries.push({ lineNum: i + 1, label: pat.label, name });
            break;
          }
        }
      }

      if (!entries.length) {
        return `No recognizable structure found in ${filePath} (${totalLines} lines, detected: ${lang}).`;
      }

      // Group by label for summary
      const grouped = {};
      for (const e of entries) {
        (grouped[e.label] = grouped[e.label] || []).push(e);
      }

      const output = [`Structure of ${filePath} (${totalLines} lines, ${lang}):`, ''];

      const order = [
        'import',
        'export',
        'class',
        'function',
        'def',
        'method',
        'const fn',
        'arrow',
        'TODO',
      ];
      for (const lbl of [...order, ...Object.keys(grouped).filter((k) => !order.includes(k))]) {
        if (!grouped[lbl]) continue;
        output.push(`### ${lbl.toUpperCase()} (${grouped[lbl].length})`);
        for (const e of grouped[lbl].slice(0, 40)) {
          output.push(`  Line ${e.lineNum}: ${e.name}`);
        }
        if (grouped[lbl].length > 40) output.push(`  … +${grouped[lbl].length - 40} more`);
        output.push('');
      }

      return output.join('\n');
    },

    diff_two_files: async (params, onStage) => {
      const { path_a, path_b } = params;
      if (!path_a?.trim()) throw new Error('Missing required param: path_a');
      if (!path_b?.trim()) throw new Error('Missing required param: path_b');

      const contextLines = params.context_lines ?? 3;

      onStage(`📊 Diffing ${path_a} vs ${path_b}`);
      const [fileA, fileB] = await Promise.all([ipcReadFile(path_a), ipcReadFile(path_b)]);

      const linesA = splitLines(fileA.content);
      const linesB = splitLines(fileB.content);

      const nameA = path_a.split('/').pop();
      const nameB = path_b.split('/').pop();

      const diff = unifiedDiff(linesA, linesB, nameA, nameB, contextLines);

      return [
        `Diff: ${path_a} → ${path_b}`,
        `Lines: ${linesA.length} → ${linesB.length}`,
        '',
        '```diff',
        diff,
        '```',
      ].join('\n');
    },

    // ─── NEW HANDLERS: SURGICAL LINE EDITING ──────────────────────────────────

    delete_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      onStage(`🗑️ Deleting lines ${start_line}–${end_line} from ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = clampLine(start_line, lines.length) - 1;
      const e = clampLine(end_line, lines.length);

      if (s >= e)
        throw new Error(`start_line (${start_line}) must be less than end_line (${end_line})`);

      const deleted = e - s;
      lines.splice(s, deleted);
      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Deleted ${deleted} line${deleted !== 1 ? 's' : ''} (${start_line}–${end_line}) from ${filePath}\nFile now has ${lines.length} lines (was ${totalLines}).`;
    },

    move_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line, target_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (target_line == null) throw new Error('Missing required param: target_line');

      onStage(
        `↕️ Moving lines ${start_line}–${end_line} to before line ${target_line} in ${filePath}`,
      );
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = clampLine(start_line, lines.length) - 1;
      const e = clampLine(end_line, lines.length);
      const t = clampLine(target_line, lines.length) - 1;

      if (t >= s && t <= e) {
        throw new Error(
          `target_line (${target_line}) is inside the source range (${start_line}–${end_line})`,
        );
      }

      const block = lines.splice(s, e - s);
      // After splice, target index needs adjustment if target was after the removed range
      const insertAt = t > e ? t - block.length : t;
      lines.splice(insertAt, 0, ...block);

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Moved ${block.length} line${block.length !== 1 ? 's' : ''} (${start_line}–${end_line}) to position ${target_line} in ${filePath}`;
    },

    duplicate_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      onStage(`📋 Duplicating lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = clampLine(start_line, lines.length) - 1;
      const e = clampLine(end_line, lines.length);
      const block = lines.slice(s, e);

      lines.splice(e, 0, ...block);
      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Duplicated ${block.length} line${block.length !== 1 ? 's' : ''} (${start_line}–${end_line}) — copy inserted at line ${e + 1} in ${filePath}`;
    },

    sort_lines_in_range: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const descending = params.descending === true;
      const trimBeforeSort = params.trim_before_sort === true;

      onStage(`🔤 Sorting lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = clampLine(start_line, lines.length) - 1;
      const e = clampLine(end_line, lines.length);

      const block = lines.slice(s, e);
      const sorted = [...block].sort((a, b) => {
        const ca = trimBeforeSort ? a.trimStart() : a;
        const cb = trimBeforeSort ? b.trimStart() : b;
        return descending ? cb.localeCompare(ca) : ca.localeCompare(cb);
      });

      lines.splice(s, block.length, ...sorted);
      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Sorted ${block.length} line${block.length !== 1 ? 's' : ''} (${start_line}–${end_line}) in ${descending ? 'descending' : 'ascending'} order in ${filePath}`;
    },

    indent_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const amount = params.amount ?? 2;
      const useTabs = params.use_tabs === true;
      const unit = useTabs ? '\t' : ' '.repeat(Math.abs(amount));
      const adding = amount > 0;

      onStage(
        `${adding ? '→' : '←'} ${adding ? 'Indenting' : 'Dedenting'} lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = clampLine(start_line, lines.length) - 1;
      const e = clampLine(end_line, lines.length);

      let changed = 0;
      for (let i = s; i < e; i++) {
        if (adding) {
          lines[i] = unit + lines[i];
          changed++;
        } else {
          // Remove up to |amount| spaces (or one tab)
          const stripped = useTabs
            ? lines[i].replace(/^\t/, '')
            : lines[i].replace(new RegExp(`^ {1,${Math.abs(amount)}}`), '');
          if (stripped !== lines[i]) {
            lines[i] = stripped;
            changed++;
          }
        }
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ ${adding ? 'Indented' : 'Dedented'} ${changed} line${changed !== 1 ? 's' : ''} by ${useTabs ? '1 tab' : `${Math.abs(amount)} space${Math.abs(amount) !== 1 ? 's' : ''}`} in ${filePath}`;
    },

    wrap_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const prefix = params.prefix ?? '';
      const suffix = params.suffix ?? '';
      const skipEmpty = params.skip_empty_lines === true;

      if (!prefix && !suffix) throw new Error('At least one of prefix or suffix is required.');

      onStage(`🎁 Wrapping lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = clampLine(start_line, lines.length) - 1;
      const e = clampLine(end_line, lines.length);

      let changed = 0;
      for (let i = s; i < e; i++) {
        if (skipEmpty && !lines[i].trim()) continue;
        lines[i] = `${prefix}${lines[i]}${suffix}`;
        changed++;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Wrapped ${changed} line${changed !== 1 ? 's' : ''} with prefix="${prefix}" suffix="${suffix}" in ${filePath}`;
    },

    // ─── NEW HANDLERS: REGEX & BATCH EDITING ──────────────────────────────────

    find_replace_regex: async (params, onStage) => {
      const { path: filePath, pattern, replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (replacement == null) throw new Error('Missing required param: replacement');

      const flags = params.flags ?? 'gm';

      onStage(`🔁 Regex replace in ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      const matches = content.match(regex);
      const count = matches ? matches.length : 0;

      if (!count) return `No matches for /${pattern}/${flags} in ${filePath} — file unchanged.`;

      const updated = content.replace(regex, replacement);
      await ipcWriteFile(filePath, updated);

      return `✅ Replaced ${count} match${count !== 1 ? 'es' : ''} of /${pattern}/${flags} in ${filePath}`;
    },

    batch_replace: async (params, onStage) => {
      const { path: filePath, replacements: raw } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!raw?.trim()) throw new Error('Missing required param: replacements');

      let pairs;
      try {
        pairs = JSON.parse(raw);
        if (!Array.isArray(pairs)) throw new Error('Not an array');
      } catch (e) {
        throw new Error(
          `replacements must be a JSON array of {search, replace} objects: ${e.message}`,
        );
      }

      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;

      onStage(`🔁 Applying ${pairs.length} replacements in ${filePath}`);
      let { content } = await ipcReadFile(filePath);

      const results = [];
      for (const pair of pairs) {
        if (!pair.search) continue;
        let regex;
        try {
          const flags = caseSensitive ? 'g' : 'gi';
          regex = useRegex
            ? new RegExp(pair.search, flags)
            : new RegExp(pair.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
        } catch (e) {
          results.push(`  ⚠️ Skipped "${pair.search}": invalid regex — ${e.message}`);
          continue;
        }

        const matches = content.match(regex);
        const count = matches ? matches.length : 0;
        if (count) content = content.replace(regex, pair.replace ?? '');
        results.push(
          `  ${count > 0 ? '✓' : '·'} "${pair.search}" → "${pair.replace ?? ''}" (${count} replacement${count !== 1 ? 's' : ''})`,
        );
      }

      await ipcWriteFile(filePath, content);

      return [`✅ Batch replace complete in ${filePath}:`, ...results].join('\n');
    },

    insert_at_marker: async (params, onStage) => {
      const { path: filePath, marker, content: insertContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!marker?.trim()) throw new Error('Missing required param: marker');
      if (insertContent == null) throw new Error('Missing required param: content');

      const position = (params.position ?? 'after').toLowerCase();
      const allOccurrences = params.all_occurrences === true;

      onStage(`📍 Inserting at marker "${marker}" in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const markerIndices = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(marker)) markerIndices.push(i);
      }

      if (!markerIndices.length) {
        return `Marker "${marker}" not found in ${filePath} — file unchanged.`;
      }

      const targets = allOccurrences ? markerIndices : [markerIndices[0]];
      const insertLines = splitLines(insertContent);

      // Insert in reverse order so indices stay valid
      for (let k = targets.length - 1; k >= 0; k--) {
        const idx = targets[k];
        const insertAt = position === 'before' ? idx : idx + 1;
        lines.splice(insertAt, 0, ...insertLines);
      }

      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Inserted ${insertLines.length} line${insertLines.length !== 1 ? 's' : ''} ${position} ${targets.length} marker${targets.length !== 1 ? 's' : ''} ("${marker}") in ${filePath}`;
    },

    // ─── NEW HANDLERS: FILE MANAGEMENT & TRANSFORM ────────────────────────────

    backup_file: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`💾 Backing up ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      // Derive backup path
      const ts = timestamp();
      const parts = filePath.split('/');
      const filename = parts.pop();
      const dir = params.backup_dir?.trim() || parts.join('/');
      const backupPath = `${dir}/${filename}.${ts}.bak`;

      await ipcWriteFile(backupPath, content);

      return `✅ Backup created: ${backupPath}`;
    },

    extract_lines_to_file: async (params, onStage) => {
      const { source_path, output_path, start_line, end_line } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!output_path?.trim()) throw new Error('Missing required param: output_path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      onStage(`✂️ Extracting lines ${start_line}–${end_line} from ${source_path}`);
      const { content, totalLines } = await ipcReadFile(source_path);
      const lines = splitLines(content);

      const s = clampLine(start_line, lines.length) - 1;
      const e = clampLine(end_line, lines.length);
      const extracted = lines.slice(s, e);

      await ipcWriteFile(output_path, joinLines(extracted));

      return `✅ Extracted ${extracted.length} line${extracted.length !== 1 ? 's' : ''} (${start_line}–${end_line} of ${totalLines}) from ${source_path} → ${output_path}`;
    },

    merge_files: async (params, onStage) => {
      const { source_paths: rawPaths, output_path } = params;
      if (!rawPaths?.trim()) throw new Error('Missing required param: source_paths');
      if (!output_path?.trim()) throw new Error('Missing required param: output_path');

      const paths = rawPaths
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (paths.length < 2)
        throw new Error('source_paths must contain at least 2 comma-separated paths');

      // Unescape \n in separator
      const separator = (params.separator ?? '\n').replace(/\\n/g, '\n');

      onStage(`🔗 Merging ${paths.length} files into ${output_path}`);

      const chunks = [];
      let totalLines = 0;
      for (const p of paths) {
        const { content, totalLines: tl } = await ipcReadFile(p);
        chunks.push(content);
        totalLines += tl;
      }

      const merged = chunks.join(separator);
      await ipcWriteFile(output_path, merged);

      return `✅ Merged ${paths.length} files (${totalLines} total lines) → ${output_path}\nSources: ${paths.join(', ')}`;
    },

    trim_file_whitespace: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`✂️ Trimming trailing whitespace in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let changed = 0;
      const trimmed = lines.map((l) => {
        const t = l.trimEnd();
        if (t !== l) changed++;
        return t;
      });

      // Ensure single trailing newline
      while (trimmed.length > 1 && trimmed[trimmed.length - 1] === '') trimmed.pop();
      trimmed.push('');

      await ipcWriteFile(filePath, trimmed.join('\n'));

      return `✅ Trimmed trailing whitespace on ${changed} of ${totalLines} lines in ${filePath}`;
    },

    normalize_file: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`🧹 Normalizing ${filePath}`);
      let { content } = await ipcReadFile(filePath);

      const changes = [];

      // Strip UTF-8 BOM
      if (content.charCodeAt(0) === 0xfeff) {
        content = content.slice(1);
        changes.push('stripped BOM');
      }

      // Convert CRLF → LF
      const hasCRLF = content.includes('\r\n');
      if (hasCRLF) {
        content = content.replace(/\r\n/g, '\n');
        changes.push('converted CRLF → LF');
      }

      // Remaining stray \r
      if (content.includes('\r')) {
        content = content.replace(/\r/g, '');
        changes.push('removed stray CR');
      }

      // Trim trailing whitespace per line
      const lines = content.split('\n');
      let trailingFixed = 0;
      const cleaned = lines.map((l) => {
        const t = l.trimEnd();
        if (t !== l) trailingFixed++;
        return t;
      });
      if (trailingFixed) changes.push(`trimmed trailing whitespace on ${trailingFixed} lines`);

      // Ensure single trailing newline
      while (cleaned.length > 1 && cleaned[cleaned.length - 1] === '') cleaned.pop();
      cleaned.push('');

      const normalized = cleaned.join('\n');
      await ipcWriteFile(filePath, normalized);

      if (!changes.length) return `✅ ${filePath} was already normalized — no changes made.`;
      return `✅ Normalized ${filePath}:\n${changes.map((c) => `  • ${c}`).join('\n')}`;
    },

    find_files_by_content: async (params, onStage) => {
      const { directory, pattern } = params;
      if (!directory?.trim()) throw new Error('Missing required param: directory');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const maxResults = params.max_results ?? 30;
      const caseSensitive = params.case_sensitive === true;
      const useRegex = params.regex === true;
      const allowedExts = params.file_glob
        ? params.file_glob.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
        : null;

      onStage(`🔍 Scanning files in ${directory} for "${pattern}"`);

      // Use existing workspace search IPC — it already does recursive content search
      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: directory,
        query: pattern,
        maxResults: maxResults * 5, // over-fetch, then group by file
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Content search failed');
      if (!result.matches?.length) return `No files containing "${pattern}" found in ${directory}.`;

      // Group by file, filter by extension if requested
      const byFile = {};
      for (const m of result.matches) {
        const ext = m.path.split('.').pop().toLowerCase();
        if (allowedExts && !allowedExts.includes(ext)) continue;
        (byFile[m.path] = byFile[m.path] || []).push(m);
      }

      const files = Object.entries(byFile).slice(0, maxResults);
      if (!files.length)
        return `No matching files found (extension filter may have excluded results).`;

      const output = [
        `Files containing "${pattern}" in ${directory}:`,
        `Found in ${files.length} file${files.length !== 1 ? 's' : ''}${Object.keys(byFile).length > maxResults ? ` (showing first ${maxResults})` : ''}:`,
        '',
      ];

      for (const [filePath, matches] of files) {
        output.push(`📄 ${filePath} (${matches.length} match${matches.length !== 1 ? 'es' : ''})`);
        for (const m of matches.slice(0, 5)) {
          output.push(`   Line ${m.lineNumber}: ${m.line.trim().slice(0, 120)}`);
        }
        if (matches.length > 5) output.push(`   … +${matches.length - 5} more matches`);
        output.push('');
      }

      return output.join('\n');
    },

    find_between_markers: async (params, onStage) => {
      const { path: filePath, start_marker, end_marker } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');

      const inclusive = params.inclusive !== false;
      const occurrence = Math.max(1, params.occurrence ?? 1);

      onStage(`🔖 Finding content between markers in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let found = 0;
      let startIdx = -1;
      let endIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (startIdx === -1 && lines[i].includes(start_marker)) {
          found++;
          if (found === occurrence) {
            startIdx = i;
            continue;
          }
        }
        if (startIdx !== -1 && endIdx === -1 && lines[i].includes(end_marker)) {
          endIdx = i;
          break;
        }
      }

      if (startIdx === -1) return `Start marker "${start_marker}" not found in ${filePath}.`;
      if (endIdx === -1)
        return `Start marker found at line ${startIdx + 1} but end marker "${end_marker}" was not found after it.`;

      const from = inclusive ? startIdx : startIdx + 1;
      const to = inclusive ? endIdx + 1 : endIdx;
      const block = lines.slice(from, to);

      return [
        `Content between "${start_marker}" and "${end_marker}" (occurrence ${occurrence}) in ${filePath}:`,
        `Lines ${from + 1}–${to} | ${block.length} line${block.length !== 1 ? 's' : ''}`,
        '',
        '```',
        block.join('\n'),
        '```',
      ].join('\n');
    },

    find_duplicate_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const ignoreBlank = params.ignore_blank !== false;
      const trimCompare = params.trim_before_compare !== false;

      onStage(`🔍 Scanning for duplicate lines in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const start = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      const end = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;
      const slice = lines.slice(start, end);

      const seen = new Map(); // normalised → [lineNumbers]
      for (let i = 0; i < slice.length; i++) {
        const raw = slice[i];
        if (ignoreBlank && !raw.trim()) continue;
        const key = trimCompare ? raw.trim() : raw;
        if (!seen.has(key)) seen.set(key, []);
        seen.get(key).push(start + i + 1);
      }

      const dupes = [...seen.entries()].filter(([, nums]) => nums.length > 1);
      if (!dupes.length)
        return `No duplicate lines found in ${filePath} (${totalLines} lines scanned).`;

      const output = [
        `Duplicate lines in ${filePath} (${dupes.length} unique value${dupes.length !== 1 ? 's' : ''} duplicated):`,
        '',
      ];

      for (const [text, nums] of dupes.slice(0, 60)) {
        output.push(`Lines [${nums.join(', ')}]: ${text.slice(0, 100)}`);
      }
      if (dupes.length > 60) output.push(`… and ${dupes.length - 60} more`);

      return output.join('\n');
    },

    find_todos: async (params, onStage) => {
      const { directory } = params;
      if (!directory?.trim()) throw new Error('Missing required param: directory');

      const tags = (params.tags ?? 'TODO,FIXME,HACK,NOTE,XXX')
        .split(',')
        .map((t) => t.trim().toUpperCase());
      const tagPattern = tags.join('|');

      onStage(`📋 Scanning for ${tags.join(', ')} in ${directory}`);

      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: directory,
        query: tags[0], // seed search — we'll filter client-side
        maxResults: 500,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace scan failed');

      // Re-filter to ensure all tags and extract tag type
      const allResults = result.matches ?? [];
      const tagRe = new RegExp(`(${tagPattern})\\s*:?\\s*(.*)`, 'i');

      const grouped = {};
      for (const m of allResults) {
        const match = m.line.match(tagRe);
        if (!match) continue;
        const tag = match[1].toUpperCase();
        const msg = match[2]?.trim() || '';
        if (!tags.includes(tag)) continue;
        (grouped[tag] = grouped[tag] || []).push({ path: m.path, line: m.lineNumber, msg });
      }

      if (!Object.keys(grouped).length)
        return `No ${tags.join('/')} comments found in ${directory}.`;

      const output = [`TODO scan of ${directory}:`, ''];
      let total = 0;
      for (const tag of tags) {
        if (!grouped[tag]) continue;
        output.push(`### ${tag} (${grouped[tag].length})`);
        for (const item of grouped[tag]) {
          output.push(
            `  ${item.path}:${item.line}${item.msg ? ` — ${item.msg.slice(0, 100)}` : ''}`,
          );
        }
        total += grouped[tag].length;
        output.push('');
      }
      output.unshift(
        `Found ${total} comment${total !== 1 ? 's' : ''} across ${Object.keys(grouped).length} tag type${Object.keys(grouped).length !== 1 ? 's' : ''}:`,
      );

      return output.join('\n');
    },

    get_line_numbers_matching: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const useRegex = params.regex === true;
      const includeText = params.include_text !== false;

      onStage(`🔢 Getting line numbers matching "${pattern}" in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) hits.push({ num: i + 1, text: lines[i] });
      }

      if (!hits.length)
        return `No lines matching "${pattern}" in ${filePath} (${totalLines} lines).`;

      const output = [
        `${hits.length} line${hits.length !== 1 ? 's' : ''} matching "${pattern}" in ${filePath}:`,
        '',
        ...hits.map((h) => (includeText ? `  ${h.num}: ${h.text.trimEnd()}` : `  ${h.num}`)),
      ];

      return output.join('\n');
    },

    comment_out_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const style = getCommentStyle(filePath, params.style);
      const marker = style.single || (style.block ? style.block[0] : '//');

      onStage(`💬 Commenting lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      let changed = 0;
      for (let i = s; i < e; i++) {
        const trimmed = lines[i].trimStart();
        if (!trimmed || trimmed.startsWith(marker)) continue; // already commented or blank
        const indent = lines[i].slice(0, lines[i].length - trimmed.length);
        lines[i] = `${indent}${marker} ${trimmed}`;
        changed++;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Commented ${changed} line${changed !== 1 ? 's' : ''} with "${marker}" in ${filePath}`;
    },

    uncomment_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const style = getCommentStyle(filePath, null);
      const markers = [
        ...(style.single ? [style.single] : []),
        ...(style.block ? [style.block[0]] : []),
        '//',
        '#',
        '--',
        '<!--',
        '/*',
      ];

      onStage(`💬 Uncommenting lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      let changed = 0;
      for (let i = s; i < e; i++) {
        const trimmed = lines[i].trimStart();
        const indent = lines[i].slice(0, lines[i].length - trimmed.length);
        let uncommmented = null;
        for (const m of markers) {
          if (trimmed.startsWith(m)) {
            // Remove marker and one optional space after it
            uncommmented = indent + trimmed.slice(m.length).replace(/^ /, '');
            break;
          }
        }
        if (uncommmented !== null) {
          lines[i] = uncommmented;
          changed++;
        }
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Uncommented ${changed} line${changed !== 1 ? 's' : ''} in ${filePath}`;
    },

    reverse_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      onStage(`🔃 Reversing lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      const block = lines.slice(s, e);
      block.reverse();
      lines.splice(s, block.length, ...block);

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Reversed ${block.length} lines (${start_line}–${end_line}) in ${filePath}`;
    },

    dedup_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const trimCompare = params.trim_before_compare === true;
      const keepBlank = params.keep_blank !== false;

      onStage(`🧹 Removing duplicate lines in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;

      const prefix = lines.slice(0, s);
      const suffix = lines.slice(e);
      const region = lines.slice(s, e);

      const seen = new Set();
      let blankSeen = false;
      const deduped = [];

      for (const line of region) {
        const isBlank = !line.trim();
        if (isBlank) {
          if (keepBlank && !blankSeen) {
            deduped.push(line);
            blankSeen = true;
          } else if (!keepBlank) {
            /* skip */
          } else deduped.push(line); // always keep if keepBlank true and not tracking
          continue;
        }
        blankSeen = false;
        const key = trimCompare ? line.trim() : line;
        if (!seen.has(key)) {
          seen.add(key);
          deduped.push(line);
        }
      }

      const removed = region.length - deduped.length;
      lines.splice(s, region.length, ...deduped);
      await ipcWriteFile(filePath, joinLines([...prefix, ...deduped, ...suffix]));

      return `✅ Removed ${removed} duplicate line${removed !== 1 ? 's' : ''} in ${filePath} (${totalLines} → ${totalLines - removed} lines)`;
    },

    remove_blank_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const mode = (params.mode ?? 'collapse').toLowerCase();
      onStage(`🧹 ${mode === 'delete' ? 'Deleting' : 'Collapsing'} blank lines in ${filePath}`);

      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;

      const region = lines.slice(s, e);
      const processed = [];
      let lastBlank = false;

      for (const line of region) {
        const isBlank = !line.trim();
        if (mode === 'delete') {
          if (!isBlank) processed.push(line);
        } else {
          // collapse
          if (isBlank && lastBlank) continue;
          processed.push(line);
          lastBlank = isBlank;
        }
      }

      const removed = region.length - processed.length;
      const newLines = [...lines.slice(0, s), ...processed, ...lines.slice(e)];
      await ipcWriteFile(filePath, joinLines(newLines));

      return `✅ ${mode === 'delete' ? 'Deleted' : 'Collapsed'} ${removed} blank line${removed !== 1 ? 's' : ''} in ${filePath} (${totalLines} → ${newLines.length} lines)`;
    },

    join_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const separator = params.separator ?? ' ';
      const trimEach = params.trim_each !== false;

      onStage(`🔗 Joining lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      const block = lines.slice(s, e);
      const parts = trimEach ? block.map((l) => l.trim()) : block;
      const joined = parts.join(separator);

      lines.splice(s, block.length, joined);
      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Joined ${block.length} lines into 1 line at line ${start_line} in ${filePath} (separator: "${separator}")`;
    },

    split_line: async (params, onStage) => {
      const { path: filePath, line_number, delimiter } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (line_number == null) throw new Error('Missing required param: line_number');
      if (!delimiter) throw new Error('Missing required param: delimiter');

      const trimParts = params.trim_parts !== false;
      const preserveIndent = params.preserve_indent !== false;

      onStage(`✂️ Splitting line ${line_number} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const idx = Math.max(1, line_number) - 1;
      if (idx >= lines.length)
        throw new Error(`Line ${line_number} does not exist (file has ${lines.length} lines)`);

      const original = lines[idx];
      const indent = preserveIndent ? original.match(/^(\s*)/)[1] : '';
      const raw = preserveIndent ? original.trimStart() : original;

      const parts = raw.split(delimiter);
      if (parts.length === 1)
        return `Line ${line_number} does not contain delimiter "${delimiter}" — no change made.`;

      const newLines = parts.map((p) => `${indent}${trimParts ? p.trim() : p}`);
      lines.splice(idx, 1, ...newLines);
      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Split line ${line_number} into ${newLines.length} lines at delimiter "${delimiter}" in ${filePath}`;
    },

    rename_symbol: async (params, onStage) => {
      const { path: filePath, old_name, new_name } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!old_name?.trim()) throw new Error('Missing required param: old_name');
      if (!new_name?.trim()) throw new Error('Missing required param: new_name');

      const wholeWord = params.whole_word !== false;

      onStage(`🔤 Renaming "${old_name}" → "${new_name}" in ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      const escaped = old_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escaped}\\b` : escaped;
      const regex = new RegExp(pattern, 'g');

      const matches = content.match(regex);
      const count = matches ? matches.length : 0;
      if (!count) return `Symbol "${old_name}" not found in ${filePath} — no changes made.`;

      const updated = content.replace(regex, new_name);
      await ipcWriteFile(filePath, updated);

      return `✅ Renamed "${old_name}" → "${new_name}" (${count} occurrence${count !== 1 ? 's' : ''}) in ${filePath}${wholeWord ? ' [whole-word match]' : ''}`;
    },

    update_json_value: async (params, onStage) => {
      const { path: filePath, key_path, value: rawValue } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!key_path?.trim()) throw new Error('Missing required param: key_path');
      if (rawValue == null) throw new Error('Missing required param: value');

      const createIfMissing = params.create_if_missing === true;

      onStage(`📝 Updating JSON key "${key_path}" in ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      let json;
      try {
        json = JSON.parse(content);
      } catch (e) {
        throw new Error(`File is not valid JSON: ${e.message}`);
      }

      let newValue;
      try {
        newValue = JSON.parse(rawValue);
      } catch {
        throw new Error(
          `value must be a valid JSON literal (e.g. 3000, true, "hello", ["a","b"]). Got: ${rawValue}`,
        );
      }

      const keys = key_path.split('.');
      let cursor = json;

      for (let i = 0; i < keys.length - 1; i++) {
        const k = keys[i];
        if (cursor[k] === undefined) {
          if (!createIfMissing)
            throw new Error(
              `Key "${keys.slice(0, i + 1).join('.')}" does not exist. Set create_if_missing: true to create it.`,
            );
          cursor[k] = {};
        }
        if (typeof cursor[k] !== 'object' || Array.isArray(cursor[k])) {
          throw new Error(
            `Key "${keys.slice(0, i + 1).join('.')}" exists but is not an object — cannot traverse into it.`,
          );
        }
        cursor = cursor[k];
      }

      const lastKey = keys[keys.length - 1];
      const existed = lastKey in cursor;
      const oldValue = cursor[lastKey];
      cursor[lastKey] = newValue;

      // Detect indentation from original file
      const indentMatch = content.match(/^{\s*\n(\s+)/);
      const indent = indentMatch ? indentMatch[1].length : 2;

      await ipcWriteFile(filePath, JSON.stringify(json, null, indent) + '\n');

      const action = existed ? `Updated` : `Created`;
      const oldStr = existed ? ` (was: ${JSON.stringify(oldValue)})` : '';
      return `✅ ${action} "${key_path}" = ${JSON.stringify(newValue)}${oldStr} in ${filePath}`;
    },

    multi_file_replace: async (params, onStage) => {
      const { paths: rawPaths, search, replace } = params;
      if (!rawPaths?.trim()) throw new Error('Missing required param: paths');
      if (!search?.trim()) throw new Error('Missing required param: search');
      if (replace == null) throw new Error('Missing required param: replace');

      const paths = rawPaths
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;
      const flags = caseSensitive ? 'g' : 'gi';

      let regex;
      try {
        regex = useRegex
          ? new RegExp(search, flags)
          : new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      onStage(`🔁 Applying replace across ${paths.length} files`);

      const results = [];
      let totalChanges = 0;

      for (const filePath of paths) {
        try {
          const { content } = await ipcReadFile(filePath);
          const matches = content.match(regex);
          const count = matches ? matches.length : 0;
          if (count) {
            const updated = content.replace(regex, replace);
            await ipcWriteFile(filePath, updated);
            totalChanges += count;
            results.push(`  ✓ ${filePath} — ${count} replacement${count !== 1 ? 's' : ''}`);
          } else {
            results.push(`  · ${filePath} — no matches`);
          }
        } catch (err) {
          results.push(`  ✗ ${filePath} — error: ${err.message}`);
        }
      }

      return [
        `Multi-file replace: "${search}" → "${replace}"`,
        `${totalChanges} total replacement${totalChanges !== 1 ? 's' : ''} across ${paths.length} file${paths.length !== 1 ? 's' : ''}:`,
        '',
        ...results,
      ].join('\n');
    },

    append_to_matching_lines: async (params, onStage) => {
      const { path: filePath, match_pattern, text } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!match_pattern?.trim()) throw new Error('Missing required param: match_pattern');
      if (text == null) throw new Error('Missing required param: text');

      const mode = (params.mode ?? 'append').toLowerCase();
      const useRegex = params.regex === true;
      const skipIfPresent = params.skip_already_present !== false;

      onStage(
        `✏️ ${mode === 'prepend' ? 'Prepending' : 'Appending'} to matching lines in ${filePath}`,
      );
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(match_pattern, 'i')
          : new RegExp(match_pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      } catch (e) {
        throw new Error(`Invalid match_pattern regex: ${e.message}`);
      }

      let changed = 0;
      for (let i = 0; i < lines.length; i++) {
        if (!regex.test(lines[i])) continue;
        if (skipIfPresent && lines[i].includes(text)) continue;
        lines[i] = mode === 'prepend' ? `${text}${lines[i]}` : `${lines[i]}${text}`;
        changed++;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ ${mode === 'prepend' ? 'Prepended' : 'Appended'} "${text}" to ${changed} matching line${changed !== 1 ? 's' : ''} in ${filePath}`;
    },

    replace_in_range: async (params, onStage) => {
      const { path: filePath, start_line, end_line, search, replace } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (!search?.trim()) throw new Error('Missing required param: search');
      if (replace == null) throw new Error('Missing required param: replace');

      const useRegex = params.regex === true;
      const replaceAll = params.replace_all !== false;
      const flags = replaceAll ? 'g' : '';

      onStage(`🎯 Scoped replace in lines ${start_line}–${end_line} of ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      const regionLines = lines.slice(s, e);
      const region = regionLines.join('\n');

      let regex;
      try {
        regex = useRegex
          ? new RegExp(search, flags)
          : new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch (err) {
        throw new Error(`Invalid regex: ${err.message}`);
      }

      const matches = region.match(new RegExp(regex.source, 'g'));
      const count = matches ? matches.length : 0;
      if (!count)
        return `No matches for "${search}" in lines ${start_line}–${end_line} of ${filePath} — no changes.`;

      const updated = region.replace(regex, replace);
      const updatedLines = updated.split('\n');
      lines.splice(s, regionLines.length, ...updatedLines);

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Replaced ${count} occurrence${count !== 1 ? 's' : ''} of "${search}" within lines ${start_line}–${end_line} in ${filePath}`;
    },

    swap_line_ranges: async (params, onStage) => {
      const { path: filePath, a_start, a_end, b_start, b_end } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (a_start == null || a_end == null)
        throw new Error('Missing required params: a_start, a_end');
      if (b_start == null || b_end == null)
        throw new Error('Missing required params: b_start, b_end');
      if (b_start <= a_end)
        throw new Error(
          `Block B (starts at ${b_start}) must begin after Block A ends (${a_end}). Ensure A comes before B.`,
        );

      onStage(
        `↔️ Swapping line ranges A:${a_start}–${a_end} ↔ B:${b_start}–${b_end} in ${filePath}`,
      );
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const as = a_start - 1;
      const ae = a_end;
      const bs = b_start - 1;
      const be = b_end;

      const blockA = lines.slice(as, ae);
      const blockB = lines.slice(bs, be);
      const between = lines.slice(ae, bs);

      // Reconstruct: prefix + B + between + A + suffix
      const newLines = [
        ...lines.slice(0, as),
        ...blockB,
        ...between,
        ...blockA,
        ...lines.slice(be),
      ];

      await ipcWriteFile(filePath, joinLines(newLines));
      return `✅ Swapped Block A (lines ${a_start}–${a_end}, ${blockA.length} lines) ↔ Block B (lines ${b_start}–${b_end}, ${blockB.length} lines) in ${filePath}`;
    },

    replace_between_markers: async (params, onStage) => {
      const { path: filePath, start_marker, end_marker, new_content } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');
      if (new_content == null) throw new Error('Missing required param: new_content');

      const preserveMarkers = params.preserve_markers !== false;
      const occurrence = Math.max(1, params.occurrence ?? 1);

      onStage(`🔄 Replacing content between markers in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let found = 0;
      let startIdx = -1;
      let endIdx = -1;

      for (let i = 0; i < lines.length; i++) {
        if (startIdx === -1 && lines[i].includes(start_marker)) {
          found++;
          if (found === occurrence) {
            startIdx = i;
            continue;
          }
        }
        if (startIdx !== -1 && endIdx === -1 && lines[i].includes(end_marker)) {
          endIdx = i;
          break;
        }
      }

      if (startIdx === -1)
        return `Start marker "${start_marker}" not found (occurrence ${occurrence}) in ${filePath}.`;
      if (endIdx === -1)
        return `Start marker found at line ${startIdx + 1} but end marker "${end_marker}" was not found after it.`;

      const newContentLines = splitLines(new_content);
      const deleteFrom = preserveMarkers ? startIdx + 1 : startIdx;
      const deleteTo = preserveMarkers ? endIdx : endIdx + 1;
      const oldCount = deleteTo - deleteFrom;

      lines.splice(deleteFrom, oldCount, ...newContentLines);
      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Replaced ${oldCount} line${oldCount !== 1 ? 's' : ''} between markers with ${newContentLines.length} new line${newContentLines.length !== 1 ? 's' : ''} in ${filePath}`;
    },

    convert_indentation: async (params, onStage) => {
      const { path: filePath, to } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!to?.trim()) throw new Error('Missing required param: to (must be "tabs" or "spaces")');

      const direction = to.toLowerCase().trim();
      if (direction !== 'tabs' && direction !== 'spaces') {
        throw new Error('to must be "tabs" or "spaces"');
      }

      onStage(`⇥ Converting indentation to ${direction} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      // Auto-detect spaces_per_tab: find most common leading-space count
      let spacesPerTab = params.spaces_per_tab;
      if (!spacesPerTab) {
        const counts = {};
        for (const line of lines) {
          const m = line.match(/^( +)/);
          if (m) {
            const n = m[1].length;
            counts[n] = (counts[n] || 0) + 1;
          }
        }
        // Find smallest common indent > 0
        const candidates = Object.keys(counts)
          .map(Number)
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
        spacesPerTab = candidates[0] || 2;
      }

      let changed = 0;
      const converted = lines.map((line) => {
        if (direction === 'tabs') {
          // Replace leading spaces with tabs
          const m = line.match(/^( +)/);
          if (!m) return line;
          const spaceCount = m[1].length;
          const tabs = Math.floor(spaceCount / spacesPerTab);
          const leftover = spaceCount % spacesPerTab;
          const newLine = '\t'.repeat(tabs) + ' '.repeat(leftover) + line.slice(spaceCount);
          if (newLine !== line) changed++;
          return newLine;
        } else {
          // Replace leading tabs with spaces
          const m = line.match(/^(\t+)/);
          if (!m) return line;
          const tabCount = m[1].length;
          const newLine = ' '.repeat(tabCount * spacesPerTab) + line.slice(tabCount);
          if (newLine !== line) changed++;
          return newLine;
        }
      });

      await ipcWriteFile(filePath, joinLines(converted));
      return `✅ Converted indentation to ${direction} (${spacesPerTab} spaces per tab) — ${changed} line${changed !== 1 ? 's' : ''} changed in ${filePath}`;
    },
  },
});
