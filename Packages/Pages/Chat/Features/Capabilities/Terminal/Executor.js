import { createExecutor } from '../Shared/createExecutor.js';
import { state } from '../../../../../System/State.js';

import { toolsList } from './ToolsList.js';

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
  tools: toolsList,
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

    trace_symbol: async (params, onStage) => {
      const { symbol, path: rootPath } = params;
      if (!symbol?.trim()) throw new Error('Missing required param: symbol');
      const resolvedRoot = resolveWorkingDirectory(rootPath);
      if (!resolvedRoot) throw new Error('No workspace is open.');

      onStage(`🔍 Tracing all usages of "${symbol}" across workspace`);

      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // Run three passes in parallel: definition, import/export, call-site
      const [defResult, importResult, callResult] = await Promise.all([
        window.electronAPI?.invoke?.('search-workspace', {
          rootPath: resolvedRoot,
          query: `(function|class|const|let|var|def|type|interface)\\s+${escaped}`,
          maxResults: 30,
        }),
        window.electronAPI?.invoke?.('search-workspace', {
          rootPath: resolvedRoot,
          query: `import.*${escaped}|export.*${escaped}`,
          maxResults: 30,
        }),
        window.electronAPI?.invoke?.('search-workspace', {
          rootPath: resolvedRoot,
          query: symbol,
          maxResults: 100,
        }),
      ]);

      const defMatches = defResult?.matches ?? [];
      const importMatches = importResult?.matches ?? [];
      const allMatches = callResult?.matches ?? [];

      // Separate call-sites from definitions/imports
      const defPaths = new Set(defMatches.map((m) => `${m.path}:${m.lineNumber}`));
      const importPaths = new Set(importMatches.map((m) => `${m.path}:${m.lineNumber}`));
      const callSites = allMatches.filter(
        (m) =>
          !defPaths.has(`${m.path}:${m.lineNumber}`) &&
          !importPaths.has(`${m.path}:${m.lineNumber}`),
      );

      // Group call-sites by file
      const byFile = {};
      for (const m of callSites) {
        (byFile[m.path] = byFile[m.path] || []).push(m);
      }

      const lines = [`Symbol trace: "${symbol}" in ${resolvedRoot}`, ''];

      if (defMatches.length) {
        lines.push(`### DEFINITIONS (${defMatches.length})`);
        for (const m of defMatches) lines.push(`  ${m.path}:${m.lineNumber} — ${m.line.trim()}`);
        lines.push('');
      }

      if (importMatches.length) {
        lines.push(`### IMPORTS / EXPORTS (${importMatches.length})`);
        for (const m of importMatches) lines.push(`  ${m.path}:${m.lineNumber} — ${m.line.trim()}`);
        lines.push('');
      }

      const fileCount = Object.keys(byFile).length;
      lines.push(
        `### CALL SITES (${callSites.length} across ${fileCount} file${fileCount !== 1 ? 's' : ''})`,
      );
      for (const [filePath, hits] of Object.entries(byFile)) {
        lines.push(`  📄 ${filePath}`);
        for (const h of hits.slice(0, 8))
          lines.push(`     line ${h.lineNumber}: ${h.line.trim().slice(0, 120)}`);
        if (hits.length > 8) lines.push(`     … +${hits.length - 8} more`);
      }

      return lines.join('\n');
    },

    // 2. PROFILE FILE COMPLEXITY
    // Gives the AI a complexity fingerprint of a file: function lengths, nesting
    // depth, largest functions, TODO density — in one call.
    profile_file_complexity: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`📊 Profiling complexity of ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);
      const lang = detectLang(filePath);

      // Detect function start lines using simple heuristics
      const fnStartRe =
        /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|class\s+(\w+)|def\s+(\w+)|(?:public|private|protected)\s+\w+\s+(\w+)\s*\()/;
      const openBrace = /[{(]/g;
      const closeBrace = /[})]/g;

      const functions = [];
      let currentFn = null;
      let depth = 0;
      let startDepth = 0;
      let maxNesting = 0;
      let localMaxNesting = 0;

      for (let i = 0; i < fileLines.length; i++) {
        const trimmed = fileLines[i].trim();
        const m = trimmed.match(fnStartRe);

        if (m && depth <= 1) {
          if (currentFn) {
            currentFn.endLine = i;
            currentFn.length = i - currentFn.startLine;
            currentFn.maxNesting = localMaxNesting;
            functions.push(currentFn);
          }
          const name = m[1] || m[2] || m[3] || m[4] || m[5] || '(anonymous)';
          currentFn = { name, startLine: i + 1, endLine: i + 1, length: 0, maxNesting: 0 };
          startDepth = depth;
          localMaxNesting = 0;
        }

        const opens = (trimmed.match(openBrace) || []).length;
        const closes = (trimmed.match(closeBrace) || []).length;
        depth += opens - closes;
        depth = Math.max(0, depth);
        if (depth > maxNesting) maxNesting = depth;
        if (depth > localMaxNesting) localMaxNesting = depth;
      }

      if (currentFn) {
        currentFn.endLine = fileLines.length;
        currentFn.length = fileLines.length - currentFn.startLine;
        currentFn.maxNesting = localMaxNesting;
        functions.push(currentFn);
      }

      // Complexity stats
      const blankLines = fileLines.filter((l) => !l.trim()).length;
      const commentLines = fileLines.filter((l) => /^\s*(\/\/|#|\/\*|\*|<!--)/.test(l)).length;
      const todoCount = fileLines.filter((l) => /(TODO|FIXME|HACK|XXX)/i.test(l)).length;
      const avgFnLen = functions.length
        ? Math.round(functions.reduce((a, f) => a + f.length, 0) / functions.length)
        : 0;
      const longThreshold = params.long_function_threshold ?? 40;
      const longFns = functions
        .filter((f) => f.length > longThreshold)
        .sort((a, b) => b.length - a.length);

      const complexScore = Math.round(
        maxNesting * 10 +
          longFns.length * 5 +
          todoCount * 2 +
          (totalLines > 300 ? (totalLines - 300) / 30 : 0),
      );

      const lines = [
        `Complexity profile: ${filePath}`,
        `Language: ${lang} | Lines: ${totalLines} | Functions: ${functions.length}`,
        `Blank: ${blankLines} | Comments: ${commentLines} | TODOs: ${todoCount}`,
        `Max nesting depth: ${maxNesting} | Avg function length: ${avgFnLen} lines`,
        `Complexity score: ${complexScore} (higher = more complex)`,
        '',
      ];

      if (longFns.length) {
        lines.push(`### LONG FUNCTIONS (> ${longThreshold} lines)`);
        for (const f of longFns.slice(0, 10)) {
          lines.push(
            `  ${f.name} — lines ${f.startLine}–${f.endLine} (${f.length} lines, max nesting: ${f.maxNesting})`,
          );
        }
        lines.push('');
      }

      // Top 5 by nesting
      const deepFns = [...functions].sort((a, b) => b.maxNesting - a.maxNesting).slice(0, 5);
      if (deepFns.length) {
        lines.push('### MOST DEEPLY NESTED');
        for (const f of deepFns) {
          lines.push(`  ${f.name} — line ${f.startLine} (max depth: ${f.maxNesting})`);
        }
        lines.push('');
      }

      lines.push('### ALL FUNCTIONS');
      for (const f of functions) {
        const flag = f.length > longThreshold ? ' ⚠️' : '';
        lines.push(`  line ${f.startLine}: ${f.name} (${f.length} lines)${flag}`);
      }

      return lines.join('\n');
    },

    // 3. MAP IMPORTS
    // Gives the AI a full picture of what a file depends on and where each
    // dependency comes from — internal vs external, grouped cleanly.
    map_imports: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`🗺️ Mapping imports in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);
      const lang = detectLang(filePath);

      const imports = [];

      // JS/TS patterns
      const jsImportRe = /^import\s+(.+?)\s+from\s+['"](.+?)['"]/;
      const jsRequireRe = /(?:const|let|var)\s+(.+?)\s*=\s*require\(['"](.+?)['"]\)/;
      const jsDynamicRe = /import\(['"](.+?)['"]\)/;
      const jsExportFromRe = /^export\s+.+\s+from\s+['"](.+?)['"]/;
      // Python
      const pyImportRe = /^import\s+(\S+)/;
      const pyFromRe = /^from\s+(\S+)\s+import\s+(.+)/;

      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i].trim();

        let m;
        if ((m = line.match(jsImportRe))) {
          imports.push({ line: i + 1, what: m[1].trim(), from: m[2], kind: 'import' });
        } else if ((m = line.match(jsExportFromRe))) {
          imports.push({ line: i + 1, what: '(re-export)', from: m[1], kind: 'export-from' });
        } else if ((m = line.match(jsRequireRe))) {
          imports.push({ line: i + 1, what: m[1].trim(), from: m[2], kind: 'require' });
        } else if ((m = line.match(jsDynamicRe))) {
          imports.push({ line: i + 1, what: '(dynamic)', from: m[1], kind: 'dynamic' });
        } else if ((m = line.match(pyFromRe))) {
          imports.push({ line: i + 1, what: m[2].trim(), from: m[1], kind: 'from-import' });
        } else if ((m = line.match(pyImportRe))) {
          imports.push({ line: i + 1, what: m[1], from: m[1], kind: 'import' });
        }
      }

      if (!imports.length) return `No imports found in ${filePath} (${totalLines} lines).`;

      const internal = imports.filter((i) => i.from.startsWith('.') || i.from.startsWith('/'));
      const external = imports.filter((i) => !i.from.startsWith('.') && !i.from.startsWith('/'));
      const nodeBuiltins = new Set([
        'fs',
        'path',
        'os',
        'http',
        'https',
        'crypto',
        'events',
        'stream',
        'url',
        'util',
        'child_process',
        'cluster',
        'net',
        'tls',
        'dns',
        'readline',
        'vm',
        'zlib',
        'buffer',
        'assert',
        'perf_hooks',
        'worker_threads',
        'timers',
      ]);
      const stdlib = external.filter((i) => nodeBuiltins.has(i.from.split('/')[0]));
      const thirdParty = external.filter((i) => !nodeBuiltins.has(i.from.split('/')[0]));

      const lines = [
        `Import map: ${filePath}`,
        `Total: ${imports.length} imports | Internal: ${internal.length} | Third-party: ${thirdParty.length} | Stdlib: ${stdlib.length}`,
        '',
      ];

      if (internal.length) {
        lines.push('### INTERNAL (relative/absolute)');
        for (const imp of internal) {
          lines.push(`  line ${imp.line}: ${imp.what}  ←  "${imp.from}" [${imp.kind}]`);
        }
        lines.push('');
      }

      if (thirdParty.length) {
        lines.push('### THIRD-PARTY PACKAGES');
        // Group by package name
        const byPkg = {};
        for (const imp of thirdParty) {
          const pkg = imp.from.split('/')[0];
          (byPkg[pkg] = byPkg[pkg] || []).push(imp);
        }
        for (const [pkg, imps] of Object.entries(byPkg)) {
          lines.push(`  ${pkg}`);
          for (const imp of imps) lines.push(`    line ${imp.line}: ${imp.what}  ←  "${imp.from}"`);
        }
        lines.push('');
      }

      if (stdlib.length) {
        lines.push('### STDLIB / BUILT-INS');
        for (const imp of stdlib) {
          lines.push(`  line ${imp.line}: ${imp.what}  ←  "${imp.from}"`);
        }
        lines.push('');
      }

      const dynamic = imports.filter((i) => i.kind === 'dynamic');
      if (dynamic.length) {
        lines.push('### DYNAMIC IMPORTS');
        for (const imp of dynamic) lines.push(`  line ${imp.line}: "${imp.from}"`);
      }

      return lines.join('\n');
    },

    // 4. FIND DEAD EXPORTS
    // Finds symbols that are exported from a file but never imported anywhere
    // else in the workspace. Instantly spots dead code.
    find_dead_exports: async (params, onStage) => {
      const { path: filePath, workspace_path } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const rootPath = resolveWorkingDirectory(workspace_path);
      if (!rootPath) throw new Error('No workspace is open. Provide workspace_path.');

      onStage(`🪦 Scanning for dead exports in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);

      // Extract all exported names
      const exportedSymbols = [];
      const exportRe =
        /^export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/;
      const namedExportRe = /^export\s+\{([^}]+)\}/;

      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i].trim();
        let m;
        if ((m = line.match(exportRe))) {
          exportedSymbols.push({ name: m[1], line: i + 1 });
        } else if ((m = line.match(namedExportRe))) {
          const names = m[1].split(',').map((s) =>
            s
              .trim()
              .split(/\s+as\s+/)
              .pop()
              .trim(),
          );
          for (const name of names) {
            if (name) exportedSymbols.push({ name, line: i + 1 });
          }
        }
      }

      if (!exportedSymbols.length) return `No exported symbols found in ${filePath}.`;

      onStage(`Checking ${exportedSymbols.length} exports against workspace...`);

      const results = await Promise.all(
        exportedSymbols.map(async (sym) => {
          const result = await window.electronAPI?.invoke?.('search-workspace', {
            rootPath,
            query: sym.name,
            maxResults: 10,
          });
          const matches = (result?.matches ?? []).filter(
            (m) => !m.path.endsWith(filePath.split('/').pop()), // exclude the source file itself
          );
          return { ...sym, usages: matches.length };
        }),
      );

      const dead = results.filter((r) => r.usages === 0);
      const used = results.filter((r) => r.usages > 0);

      const lines = [
        `Dead export analysis: ${filePath}`,
        `Exports checked: ${results.length} | Dead: ${dead.length} | Used: ${used.length}`,
        '',
      ];

      if (dead.length) {
        lines.push(`### DEAD EXPORTS (never imported elsewhere)`);
        for (const s of dead) lines.push(`  line ${s.line}: ${s.name}`);
        lines.push('');
      }

      if (used.length) {
        lines.push(`### USED EXPORTS`);
        for (const s of used)
          lines.push(
            `  line ${s.line}: ${s.name}  (${s.usages} reference${s.usages !== 1 ? 's' : ''} in workspace)`,
          );
      }

      return lines.join('\n');
    },

    // 5. COMPARE JSON FILES
    // Deep semantic diff of two JSON files. Shows added, removed, changed keys
    // with full dot-notation paths. Far smarter than a line diff for configs.
    compare_json_files: async (params, onStage) => {
      const { path_a, path_b } = params;
      if (!path_a?.trim()) throw new Error('Missing required param: path_a');
      if (!path_b?.trim()) throw new Error('Missing required param: path_b');

      onStage(`🔬 Deep-comparing JSON files`);
      const [fileA, fileB] = await Promise.all([ipcReadFile(path_a), ipcReadFile(path_b)]);

      let jsonA, jsonB;
      try {
        jsonA = JSON.parse(fileA.content);
      } catch (e) {
        throw new Error(`${path_a} is not valid JSON: ${e.message}`);
      }
      try {
        jsonB = JSON.parse(fileB.content);
      } catch (e) {
        throw new Error(`${path_b} is not valid JSON: ${e.message}`);
      }

      const added = [];
      const removed = [];
      const changed = [];
      const unchanged = [];

      function deepDiff(a, b, path = '') {
        const allKeys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
        for (const key of allKeys) {
          const fullPath = path ? `${path}.${key}` : key;
          const aVal = a?.[key];
          const bVal = b?.[key];

          if (!(key in (a ?? {}))) {
            added.push({ path: fullPath, value: bVal });
          } else if (!(key in (b ?? {}))) {
            removed.push({ path: fullPath, value: aVal });
          } else if (
            typeof aVal === 'object' &&
            aVal !== null &&
            typeof bVal === 'object' &&
            bVal !== null &&
            !Array.isArray(aVal) &&
            !Array.isArray(bVal)
          ) {
            deepDiff(aVal, bVal, fullPath);
          } else {
            const aStr = JSON.stringify(aVal);
            const bStr = JSON.stringify(bVal);
            if (aStr !== bStr) {
              changed.push({ path: fullPath, from: aVal, to: bVal });
            } else {
              unchanged.push(fullPath);
            }
          }
        }
      }

      deepDiff(jsonA, jsonB);

      const nameA = path_a.split('/').pop();
      const nameB = path_b.split('/').pop();

      const lines = [
        `JSON comparison: ${nameA} → ${nameB}`,
        `Added: ${added.length} | Removed: ${removed.length} | Changed: ${changed.length} | Unchanged: ${unchanged.length}`,
        '',
      ];

      if (added.length) {
        lines.push(`### ADDED (in ${nameB}, not in ${nameA})`);
        for (const a of added) lines.push(`  + ${a.path}: ${JSON.stringify(a.value).slice(0, 80)}`);
        lines.push('');
      }
      if (removed.length) {
        lines.push(`### REMOVED (in ${nameA}, not in ${nameB})`);
        for (const r of removed)
          lines.push(`  - ${r.path}: ${JSON.stringify(r.value).slice(0, 80)}`);
        lines.push('');
      }
      if (changed.length) {
        lines.push(`### CHANGED`);
        for (const c of changed) {
          lines.push(`  ~ ${c.path}`);
          lines.push(`      was: ${JSON.stringify(c.from).slice(0, 80)}`);
          lines.push(`      now: ${JSON.stringify(c.to).slice(0, 80)}`);
        }
        lines.push('');
      }
      if (!added.length && !removed.length && !changed.length) {
        lines.push('✅ Files are semantically identical.');
      }

      return lines.join('\n');
    },

    // 6. EXTRACT ENV VARS
    // Scans a whole workspace for every environment variable reference
    // (process.env.X, os.getenv, import.meta.env, etc.) and lists them all.
    // Lets the AI instantly know what env vars a project needs.
    extract_env_vars: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`🌍 Scanning for environment variable references`);

      const patterns = [
        'process.env.',
        'import.meta.env.',
        'os.getenv(',
        'os.environ',
        'ENV[',
        'System.getenv(',
        'dotenv',
      ];

      const allMatches = [];
      for (const pattern of patterns) {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath,
          query: pattern,
          maxResults: 100,
        });
        if (result?.matches) allMatches.push(...result.matches);
      }

      if (!allMatches.length) return `No environment variable references found in ${rootPath}.`;

      // Extract actual var names
      const varNames = new Map(); // varName -> Set of file paths
      const varRe =
        /(?:process\.env|import\.meta\.env)\.([A-Z_][A-Z0-9_]*)|os\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]|ENV\[['"]([A-Z_][A-Z0-9_]*)['"]/g;

      for (const match of allMatches) {
        let m;
        varRe.lastIndex = 0;
        while ((m = varRe.exec(match.line)) !== null) {
          const name = m[1] || m[2] || m[3];
          if (name) {
            if (!varNames.has(name)) varNames.set(name, new Set());
            varNames.get(name).add(match.path);
          }
        }
      }

      const sorted = [...varNames.entries()].sort((a, b) => a[0].localeCompare(b[0]));

      const lines = [
        `Environment variables in ${rootPath}:`,
        `Found ${sorted.length} unique variable${sorted.length !== 1 ? 's' : ''} across ${new Set(allMatches.map((m) => m.path)).size} files`,
        '',
        '### VARIABLES',
        ...sorted.map(
          ([name, files]) =>
            `  ${name.padEnd(35)} used in ${files.size} file${files.size !== 1 ? 's' : ''}`,
        ),
        '',
        '### .env TEMPLATE',
        '# Copy this to .env and fill in values:',
        ...sorted.map(([name]) => `${name}=`),
      ];

      return lines.join('\n');
    },

    // 7. GET CALL GRAPH
    // For a single file, maps which functions call which other functions.
    // Gives the AI a mental model of internal execution flow instantly.
    get_call_graph: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`📞 Building call graph for ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);

      // Phase 1: detect function boundaries
      const fnBoundaryRe =
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/;
      const functions = [];
      let depth = 0;
      let current = null;

      for (let i = 0; i < fileLines.length; i++) {
        const trimmed = fileLines[i].trim();
        const m = trimmed.match(fnBoundaryRe);
        if (m && depth <= 1) {
          if (current) {
            current.endLine = i;
            functions.push(current);
          }
          current = { name: m[1] || m[2] || m[3], startLine: i, endLine: i, calls: [] };
        }
        depth += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length;
        depth = Math.max(0, depth);
      }
      if (current) {
        current.endLine = fileLines.length - 1;
        functions.push(current);
      }

      // Phase 2: for each function, find calls to other known functions
      const fnNames = new Set(functions.map((f) => f.name));

      for (const fn of functions) {
        const body = fileLines.slice(fn.startLine, fn.endLine + 1).join('\n');
        for (const name of fnNames) {
          if (name === fn.name) continue;
          const callRe = new RegExp(`\\b${name}\\s*\\(`, 'g');
          if (callRe.test(body)) fn.calls.push(name);
        }
      }

      if (!functions.length) return `No functions found in ${filePath}.`;

      const lines = [
        `Call graph: ${filePath} (${totalLines} lines, ${functions.length} functions)`,
        '',
      ];

      for (const fn of functions) {
        if (fn.calls.length) {
          lines.push(`  ${fn.name}  →  ${fn.calls.join(', ')}`);
        } else {
          lines.push(`  ${fn.name}  →  (no internal calls)`);
        }
      }

      // Also find which functions are called by nobody (entry points)
      const calledByAnyone = new Set(functions.flatMap((f) => f.calls));
      const entryPoints = functions.filter((f) => !calledByAnyone.has(f.name));
      if (entryPoints.length) {
        lines.push('');
        lines.push('### ENTRY POINTS (not called by other functions in this file)');
        for (const fn of entryPoints) lines.push(`  ${fn.name}  (line ${fn.startLine + 1})`);
      }

      return lines.join('\n');
    },

    // 8. AUDIT DEPENDENCIES
    // Cross-references the package.json/requirements.txt against actual imports
    // in the source. Finds unused declared deps and undeclared used packages.
    audit_dependencies: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`📦 Auditing dependencies`);

      // Read package.json
      let declaredDeps = new Set();
      let declaredDevDeps = new Set();
      let pkgType = 'unknown';

      try {
        const pkgResult = await ipcReadFile(`${rootPath}/package.json`);
        const pkg = JSON.parse(pkgResult.content);
        pkgType = 'node';
        Object.keys(pkg.dependencies ?? {}).forEach((d) => declaredDeps.add(d));
        Object.keys(pkg.devDependencies ?? {}).forEach((d) => declaredDevDeps.add(d));
      } catch {
        // try requirements.txt
        try {
          const reqResult = await ipcReadFile(`${rootPath}/requirements.txt`);
          pkgType = 'python';
          for (const line of splitLines(reqResult.content)) {
            const pkg = line
              .trim()
              .split(/[>=<!]/)[0]
              .trim()
              .toLowerCase();
            if (pkg && !pkg.startsWith('#')) declaredDeps.add(pkg);
          }
        } catch {
          return 'No package.json or requirements.txt found in workspace root.';
        }
      }

      // Scan workspace for actual imports
      const importResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath,
        query: pkgType === 'node' ? "from '|require('" : 'import |from ',
        maxResults: 500,
      });

      const usedPackages = new Set();
      const importLineRe =
        pkgType === 'node'
          ? /(?:from|require)\s*\(?['"]([^./][^'"]*)['"]/g
          : /^(?:import|from)\s+(\S+)/gm;

      for (const match of importResult?.matches ?? []) {
        let m;
        importLineRe.lastIndex = 0;
        while ((m = importLineRe.exec(match.line)) !== null) {
          const pkg = m[1]
            .split('/')[0]
            .replace(/^@[^/]+\/[^/]+.*/, (s) => s.split('/').slice(0, 2).join('/'));
          if (pkg && !pkg.startsWith('.')) usedPackages.add(pkg.toLowerCase());
        }
      }

      const allDeclared = new Set([...declaredDeps, ...declaredDevDeps]);
      const unused = [...allDeclared].filter((d) => !usedPackages.has(d.toLowerCase()));
      const undeclared = [...usedPackages].filter((u) => !allDeclared.has(u));

      const lines = [
        `Dependency audit: ${rootPath}`,
        `Declared: ${allDeclared.size} (${declaredDeps.size} prod, ${declaredDevDeps.size} dev) | Used in code: ${usedPackages.size}`,
        `Potentially unused: ${unused.length} | Potentially undeclared: ${undeclared.length}`,
        '',
      ];

      if (undeclared.length) {
        lines.push('### ⚠️  USED BUT NOT DECLARED (possible missing deps)');
        for (const d of undeclared.sort()) lines.push(`  ${d}`);
        lines.push('');
      }

      if (unused.length) {
        lines.push('### 🗑️  DECLARED BUT NOT FOUND IN CODE (possibly unused)');
        for (const d of unused.sort())
          lines.push(`  ${d}  [${declaredDevDeps.has(d) ? 'devDep' : 'dep'}]`);
        lines.push('');
      }

      if (!undeclared.length && !unused.length) {
        lines.push('✅ All declared dependencies appear to be used and all imports are declared.');
      }

      return lines.join('\n');
    },

    // 9. SMART GREP
    // Multi-pattern grep with AND/OR/NOT logic across a workspace or file.
    // e.g. "lines that contain X AND Y but NOT Z"
    smart_grep: async (params, onStage) => {
      const { path: filePath, workspace_path, must_contain, must_not_contain, any_of } = params;
      if (!must_contain && !any_of) throw new Error('Provide at least must_contain or any_of.');

      const rootPath = resolveWorkingDirectory(workspace_path);
      const isFile = !!filePath?.trim();

      onStage(`🔍 Smart grep${isFile ? ` in ${filePath}` : ' across workspace'}`);

      let lines;
      let fileMap = {}; // path -> lines array

      if (isFile) {
        const { content } = await ipcReadFile(filePath);
        lines = splitLines(content);
        fileMap[filePath] = lines;
      } else {
        if (!rootPath) throw new Error('Provide either path (single file) or workspace_path.');
        // Seed with must_contain[0] or any_of[0]
        const seedQuery = must_contain?.[0] || any_of?.[0];
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath,
          query: seedQuery,
          maxResults: 300,
        });
        // Group matches by file, then read those files
        const filePaths = [...new Set((result?.matches ?? []).map((m) => m.path))];
        await Promise.all(
          filePaths.map(async (fp) => {
            try {
              const { content } = await ipcReadFile(fp);
              fileMap[fp] = splitLines(content);
            } catch {
              /* skip unreadable */
            }
          }),
        );
      }

      const mustPatterns = (must_contain ?? []).map(
        (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      );
      const notPatterns = (must_not_contain ?? []).map(
        (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      );
      const anyPatterns = (any_of ?? []).map(
        (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
      );

      const hits = [];

      for (const [fp, fileLines] of Object.entries(fileMap)) {
        for (let i = 0; i < fileLines.length; i++) {
          const line = fileLines[i];
          if (mustPatterns.length && !mustPatterns.every((re) => re.test(line))) continue;
          if (notPatterns.length && notPatterns.some((re) => re.test(line))) continue;
          if (anyPatterns.length && !anyPatterns.some((re) => re.test(line))) continue;
          hits.push({ path: fp, lineNum: i + 1, text: line.trim() });
        }
      }

      if (!hits.length) return `No lines matched the given conditions.`;

      const output = [
        `Smart grep results:`,
        must_contain?.length ? `  MUST contain: ${must_contain.join(' AND ')}` : '',
        any_of?.length ? `  ANY OF: ${any_of.join(' | ')}` : '',
        must_not_contain?.length ? `  MUST NOT contain: ${must_not_contain.join(', ')}` : '',
        `  Matches: ${hits.length}`,
        '',
      ].filter(Boolean);

      // Group by file
      const byFile = {};
      for (const h of hits) (byFile[h.path] = byFile[h.path] || []).push(h);

      for (const [fp, fileHits] of Object.entries(byFile)) {
        output.push(`📄 ${fp}`);
        for (const h of fileHits.slice(0, 20))
          output.push(`  ${h.lineNum}: ${h.text.slice(0, 120)}`);
        if (fileHits.length > 20) output.push(`  … +${fileHits.length - 20} more`);
        output.push('');
      }

      return output.join('\n');
    },

    // 10. SNAPSHOT WORKSPACE
    // The ultimate "orient me fast" tool. Gives the AI a single dense summary
    // of the entire codebase: file count, language breakdown, largest files,
    // entry points, test coverage presence, recent git activity — all in one call.
    snapshot_workspace: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`📸 Snapshotting workspace ${rootPath}`);

      const [inspectResult, gitResult, treeResult] = await Promise.all([
        window.electronAPI?.invoke?.('inspect-workspace', { rootPath }),
        window.electronAPI?.invoke?.('git-status', { workingDir: rootPath }),
        window.electronAPI?.invoke?.('list-directory-tree', {
          dirPath: rootPath,
          maxDepth: 3,
          maxEntries: 300,
        }),
      ]);

      const summary = inspectResult?.summary;
      const treeLines = treeResult?.lines ?? [];

      // Analyze tree for stats
      const allEntries = treeLines.filter((l) => l.trim());
      const fileEntries = allEntries.filter((l) => !l.endsWith('/'));
      const dirEntries = allEntries.filter((l) => l.endsWith('/'));

      // Language breakdown from extensions
      const extCount = {};
      for (const entry of fileEntries) {
        const ext = entry.trim().split('.').pop().toLowerCase();
        if (ext && ext.length <= 5) extCount[ext] = (extCount[ext] || 0) + 1;
      }
      const topExts = Object.entries(extCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 8);

      // Detect entry points
      const entryPoints = fileEntries.filter((l) => {
        const name = l.trim().toLowerCase();
        return [
          'index.js',
          'index.ts',
          'main.js',
          'main.ts',
          'app.js',
          'app.ts',
          'server.js',
          'server.ts',
          'main.py',
          'app.py',
          '__init__.py',
        ].some((e) => name.endsWith(e));
      });

      // Detect test files
      const testFiles = fileEntries.filter((l) => {
        const name = l.trim().toLowerCase();
        return (
          name.includes('.test.') ||
          name.includes('.spec.') ||
          name.includes('_test.') ||
          name.includes('/test/') ||
          name.includes('/__tests__/')
        );
      });

      // Git summary
      const gitLines = (gitResult?.stdout ?? '').split('\n').filter(Boolean);
      const branch =
        gitLines.find((l) => l.startsWith('On branch'))?.replace('On branch ', '') || 'unknown';
      const changedFiles = gitLines.filter((l) => /^[MADRC?]/.test(l.trim())).length;

      const lines = [
        `╔══════════════════════════════════════════════╗`,
        `  WORKSPACE SNAPSHOT: ${rootPath.split('/').pop()}`,
        `╚══════════════════════════════════════════════╝`,
        '',
        `📁 Structure: ${fileEntries.length} files in ${dirEntries.length} directories`,
        `🌿 Git: branch "${branch}" | ${changedFiles} changed file${changedFiles !== 1 ? 's' : ''}`,
        '',
      ];

      if (summary) {
        lines.push('### STACK DETECTED');
        lines.push(`  Languages:   ${(summary.languages ?? []).join(', ') || 'unknown'}`);
        lines.push(`  Frameworks:  ${(summary.frameworks ?? []).join(', ') || 'none'}`);
        lines.push(`  Testing:     ${(summary.testing ?? []).join(', ') || 'none'}`);
        lines.push(`  Infra:       ${(summary.infra ?? []).join(', ') || 'none'}`);
        lines.push(`  Pkg manager: ${summary.packageManager || 'unknown'}`);
        lines.push('');
      }

      lines.push('### FILE BREAKDOWN BY EXTENSION');
      for (const [ext, count] of topExts) {
        const bar = '█'.repeat(Math.round((count / Math.max(...topExts.map((e) => e[1]))) * 20));
        lines.push(`  .${ext.padEnd(8)} ${String(count).padStart(4)}  ${bar}`);
      }
      lines.push('');

      if (entryPoints.length) {
        lines.push('### LIKELY ENTRY POINTS');
        for (const ep of entryPoints.slice(0, 8)) lines.push(`  ${ep.trim()}`);
        lines.push('');
      }

      lines.push(`### TEST COVERAGE`);
      lines.push(`  Test files found: ${testFiles.length}`);
      if (testFiles.length) {
        for (const t of testFiles.slice(0, 5)) lines.push(`  ${t.trim()}`);
        if (testFiles.length > 5) lines.push(`  … +${testFiles.length - 5} more`);
      }
      lines.push('');

      if (summary?.packageScripts && Object.keys(summary.packageScripts).length) {
        lines.push('### SCRIPTS');
        for (const [name, cmd] of Object.entries(summary.packageScripts).slice(0, 8)) {
          lines.push(`  ${name.padEnd(15)} ${cmd.slice(0, 70)}`);
        }
        lines.push('');
      }

      if (summary?.notes?.length) {
        lines.push('### NOTES');
        for (const note of summary.notes) lines.push(`  ⚠️  ${note}`);
      }

      return lines.join('\n');
    },
    filter_lines: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;

      onStage(`🔍 Keeping only lines matching "${pattern}" in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? '' : 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
      } catch (e) {
        throw new Error(`Invalid pattern: ${e.message}`);
      }

      const kept = lines.filter((line) => regex.test(line));
      const removed = totalLines - kept.length;

      if (!kept.length)
        return `No lines matched "${pattern}" — all ${totalLines} lines would be deleted. File unchanged.`;

      await ipcWriteFile(filePath, joinLines(kept));
      return `✅ Kept ${kept.length} matching lines, removed ${removed} non-matching lines in ${filePath} (${totalLines} → ${kept.length} lines)`;
    },

    // ── 2. FILTER OUT LINES ──────────────────────────────────────────────────
    // Delete every line that matches a pattern; keep all that don't.
    filter_out_lines: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;

      onStage(`🗑️ Removing lines matching "${pattern}" from ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? '' : 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
      } catch (e) {
        throw new Error(`Invalid pattern: ${e.message}`);
      }

      const kept = lines.filter((line) => !regex.test(line));
      const removed = totalLines - kept.length;

      if (!removed) return `No lines matched "${pattern}" — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(kept));
      return `✅ Removed ${removed} line${removed !== 1 ? 's' : ''} matching "${pattern}" from ${filePath} (${totalLines} → ${kept.length} lines)`;
    },

    // ── 3. INSERT LINE AT PATTERN ────────────────────────────────────────────
    // Insert a new line before or after every line that matches a pattern.
    insert_line_at_pattern: async (params, onStage) => {
      const { path: filePath, pattern, content: insertContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (insertContent == null) throw new Error('Missing required param: content');

      const position = (params.position ?? 'after').toLowerCase();
      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;
      const allOccurrences = params.all_occurrences !== false;

      onStage(`📍 Inserting content ${position} each matching line in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const fileLines = splitLines(content);
      const insertLines = splitLines(insertContent);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? '' : 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
      } catch (e) {
        throw new Error(`Invalid pattern: ${e.message}`);
      }

      const result = [];
      let insertCount = 0;
      for (const line of fileLines) {
        const matches = regex.test(line) && (allOccurrences || insertCount === 0);
        if (matches && position === 'before') result.push(...insertLines);
        result.push(line);
        if (matches && position === 'after') result.push(...insertLines);
        if (matches) insertCount++;
      }

      if (!insertCount) return `No lines matched "${pattern}" — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(result));
      return `✅ Inserted ${insertLines.length} line${insertLines.length !== 1 ? 's' : ''} ${position} each of ${insertCount} matching line${insertCount !== 1 ? 's' : ''} in ${filePath}`;
    },

    // ── 4. REPLACE SINGLE LINE ───────────────────────────────────────────────
    // Replace exactly one line by its 1-based line number.
    replace_single_line: async (params, onStage) => {
      const { path: filePath, line_number, replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (line_number == null) throw new Error('Missing required param: line_number');
      if (typeof replacement !== 'string') throw new Error('Missing required param: replacement');

      onStage(`✏️ Replacing line ${line_number} in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);

      if (line_number < 1 || line_number > totalLines) {
        throw new Error(
          `line_number ${line_number} is out of range (file has ${totalLines} lines)`,
        );
      }

      const lines = splitLines(content);
      const old = lines[line_number - 1];
      lines[line_number - 1] = replacement;
      await ipcWriteFile(filePath, joinLines(lines));

      return [
        `✅ Replaced line ${line_number} in ${filePath}`,
        `  was: ${old.trim().slice(0, 120)}`,
        `  now: ${replacement.trim().slice(0, 120)}`,
      ].join('\n');
    },

    // ── 5. SWAP TWO LINES ────────────────────────────────────────────────────
    // Exchange the content of exactly two lines by their line numbers.
    swap_two_lines: async (params, onStage) => {
      const { path: filePath, line_a, line_b } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (line_a == null) throw new Error('Missing required param: line_a');
      if (line_b == null) throw new Error('Missing required param: line_b');
      if (line_a === line_b) throw new Error('line_a and line_b must be different');

      onStage(`↔️ Swapping lines ${line_a} and ${line_b} in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);

      for (const n of [line_a, line_b]) {
        if (n < 1 || n > totalLines) {
          throw new Error(`Line ${n} is out of range (file has ${totalLines} lines)`);
        }
      }

      const lines = splitLines(content);
      [lines[line_a - 1], lines[line_b - 1]] = [lines[line_b - 1], lines[line_a - 1]];

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Swapped line ${line_a} ↔ line ${line_b} in ${filePath}`;
    },

    // ── 6. ADD FILE HEADER ───────────────────────────────────────────────────
    // Prepend a block of text to the very top of a file.
    add_file_header: async (params, onStage) => {
      const { path: filePath, content: headerContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!headerContent) throw new Error('Missing required param: content');

      const skipIfPresent = params.skip_if_present !== false;
      const separator = params.separator ?? '\n';

      onStage(`📎 Adding header to ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      if (skipIfPresent && content.startsWith(headerContent.trimEnd())) {
        return `Header already present at top of ${filePath} — no change made.`;
      }

      const newContent = headerContent.trimEnd() + separator + content;
      await ipcWriteFile(filePath, newContent);

      const headerLines = splitLines(headerContent).length;
      return `✅ Added ${headerLines}-line header to top of ${filePath}`;
    },

    // ── 7. ADD FILE FOOTER ───────────────────────────────────────────────────
    // Append a block of text to the very bottom of a file.
    add_file_footer: async (params, onStage) => {
      const { path: filePath, content: footerContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!footerContent) throw new Error('Missing required param: content');

      const skipIfPresent = params.skip_if_present !== false;
      const separator = params.separator ?? '\n';

      onStage(`📎 Adding footer to ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      if (skipIfPresent && content.trimEnd().endsWith(footerContent.trimStart())) {
        return `Footer already present at bottom of ${filePath} — no change made.`;
      }

      const newContent = content.trimEnd() + separator + footerContent.trimStart();
      await ipcWriteFile(filePath, newContent);

      const footerLines = splitLines(footerContent).length;
      return `✅ Added ${footerLines}-line footer to bottom of ${filePath}`;
    },

    // ── 8. STRIP COMMENTS ────────────────────────────────────────────────────
    // Remove full-line comments from a file. Comment style is auto-detected
    // from the file extension. Inline comments (code + comment) are left intact
    // by default.
    strip_comments: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const keepBlankLines = params.keep_blank_lines !== false;

      onStage(`🧹 Stripping comment lines from ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const style = getCommentStyle(filePath, null);
      const singleMarkers = [];
      if (style.single) singleMarkers.push(style.single);
      // Always include common fallbacks so mixed files are handled
      for (const m of ['//', '#', '--']) {
        if (!singleMarkers.includes(m)) singleMarkers.push(m);
      }
      const blockStart = style.block?.[0] ?? null;
      const blockEnd = style.block?.[1] ?? null;

      let inBlock = false;
      let removed = 0;
      const result = [];

      for (const line of lines) {
        const trimmed = line.trim();

        // Block comment handling
        if (blockStart && blockEnd) {
          if (!inBlock && trimmed.startsWith(blockStart)) {
            inBlock = !trimmed.slice(blockStart.length).includes(blockEnd);
            removed++;
            if (keepBlankLines) result.push('');
            continue;
          }
          if (inBlock) {
            if (trimmed.includes(blockEnd)) inBlock = false;
            removed++;
            if (keepBlankLines) result.push('');
            continue;
          }
        }

        // Single-line comment handling (full-line only)
        const isFullLineComment = singleMarkers.some((m) => trimmed.startsWith(m));
        if (isFullLineComment) {
          removed++;
          if (keepBlankLines) result.push('');
        } else {
          result.push(line);
        }
      }

      await ipcWriteFile(filePath, joinLines(result));
      return `✅ Removed ${removed} comment line${removed !== 1 ? 's' : ''} from ${filePath} (${totalLines} → ${result.length} lines)`;
    },

    // ── 9. TRUNCATE FILE ─────────────────────────────────────────────────────
    // Keep only the first (or last) N lines of a file; discard the rest.
    truncate_file: async (params, onStage) => {
      const { path: filePath, max_lines } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (max_lines == null) throw new Error('Missing required param: max_lines');
      if (max_lines < 1) throw new Error('max_lines must be at least 1');

      const fromEnd = params.from_end === true;

      onStage(`✂️ Truncating ${filePath} to ${max_lines} line${max_lines !== 1 ? 's' : ''}`);
      const { content, totalLines } = await ipcReadFile(filePath);

      if (totalLines <= max_lines) {
        return `File already has ${totalLines} lines (≤ ${max_lines}) — no change needed.`;
      }

      const lines = splitLines(content);
      const kept = fromEnd ? lines.slice(-max_lines) : lines.slice(0, max_lines);
      const removed = totalLines - kept.length;

      await ipcWriteFile(filePath, joinLines(kept));
      return `✅ Truncated ${filePath}: kept ${kept.length} lines, removed ${removed} from the ${fromEnd ? 'beginning' : 'end'}`;
    },

    // ── 10. EXTRACT UNIQUE LINES ─────────────────────────────────────────────
    // Read a file, deduplicate its lines in order, and write the result to a
    // new output file. The source file is not modified.
    extract_unique_lines: async (params, onStage) => {
      const { path: filePath, output_path } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!output_path?.trim()) throw new Error('Missing required param: output_path');

      const trimCompare = params.trim_before_compare === true;
      const ignoreBlank = params.ignore_blank !== false;

      onStage(`🔑 Extracting unique lines from ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const seen = new Set();
      const unique = [];

      for (const line of lines) {
        if (ignoreBlank && !line.trim()) {
          if (!seen.has('\x00blank\x00')) {
            seen.add('\x00blank\x00');
            unique.push(line);
          }
          continue;
        }
        const key = trimCompare ? line.trim() : line;
        if (!seen.has(key)) {
          seen.add(key);
          unique.push(line);
        }
      }

      const removed = totalLines - unique.length;
      await ipcWriteFile(output_path, joinLines(unique));
      return `✅ Extracted ${unique.length} unique line${unique.length !== 1 ? 's' : ''} (removed ${removed} duplicate${removed !== 1 ? 's' : ''}) from ${filePath} → ${output_path}`;
    },

    // ── 11. PAD LINES ────────────────────────────────────────────────────────
    // Pad each line in a range to a minimum character width using a pad
    // character. Supports left, right, and center alignment.
    pad_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line, width } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (width == null) throw new Error('Missing required param: width');
      if (width < 1) throw new Error('width must be at least 1');

      const align = (params.align ?? 'left').toLowerCase();
      if (!['left', 'right', 'center'].includes(align)) {
        throw new Error('align must be "left", "right", or "center"');
      }
      const padChar = (params.pad_char ?? ' ').charAt(0) || ' ';
      const skipBlank = params.skip_blank_lines === true;

      onStage(`⬜ Padding lines ${start_line}–${end_line} to width ${width} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      let changed = 0;

      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        if (lines[i].length >= width) continue;

        const needed = width - lines[i].length;
        if (align === 'right') {
          lines[i] = padChar.repeat(needed) + lines[i];
        } else if (align === 'center') {
          const left = Math.floor(needed / 2);
          const right = Math.ceil(needed / 2);
          lines[i] = padChar.repeat(left) + lines[i] + padChar.repeat(right);
        } else {
          lines[i] = lines[i] + padChar.repeat(needed);
        }
        changed++;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Padded ${changed} line${changed !== 1 ? 's' : ''} to width ${width} (${align}-aligned, pad: "${padChar}") in ${filePath}`;
    },

    // ── 12. ALIGN ASSIGNMENTS ────────────────────────────────────────────────
    // Vertically align a separator (default =) in a range of lines by padding
    // the left-hand side of each line to the same width. Great for config
    // blocks, destructuring, and CSS properties.
    align_assignments: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const separator = params.separator ?? '=';
      const skipBlank = params.skip_blank_lines !== false;

      onStage(`⬌ Aligning "${separator}" in lines ${start_line}–${end_line} of ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      const block = lines.slice(s, e);

      // First pass: find maximum left-hand side length among lines that contain separator
      let maxLeft = 0;
      const parsed = block.map((line) => {
        if (skipBlank && !line.trim()) return null;
        const idx = line.indexOf(separator);
        if (idx === -1) return null;
        const left = line.slice(0, idx).trimEnd();
        const right = line.slice(idx + separator.length);
        if (left.length > maxLeft) maxLeft = left.length;
        return { left, right };
      });

      // Second pass: rebuild lines with padding
      let changed = 0;
      const aligned = block.map((line, i) => {
        const p = parsed[i];
        if (!p) return line;
        const newLine = p.left.padEnd(maxLeft) + ' ' + separator + ' ' + p.right.trimStart();
        if (newLine !== line) changed++;
        return newLine;
      });

      lines.splice(s, block.length, ...aligned);
      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Aligned ${changed} line${changed !== 1 ? 's' : ''} by "${separator}" (max left width: ${maxLeft}) in ${filePath}`;
    },

    // ── 13. QUOTE LINES ──────────────────────────────────────────────────────
    // Wrap every line in a range with a configurable opening and closing quote
    // character. Existing occurrences of the quote character can be escaped.
    quote_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const openQuote = params.open_quote ?? params.quote_char ?? '"';
      const closeQuote = params.close_quote ?? openQuote;
      const skipBlank = params.skip_blank_lines !== false;
      const escapeExisting = params.escape_existing !== false;

      onStage(`❝ Quoting lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      let changed = 0;

      const escapeRe = new RegExp(openQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');

      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        let text = lines[i];
        if (escapeExisting) text = text.replace(escapeRe, '\\' + openQuote);
        lines[i] = `${openQuote}${text}${closeQuote}`;
        changed++;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Quoted ${changed} line${changed !== 1 ? 's' : ''} with ${openQuote}…${closeQuote} in ${filePath}`;
    },

    // ── 14. UPPERCASE LINES ──────────────────────────────────────────────────
    // Convert every character in a line range to UPPERCASE.
    uppercase_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      onStage(`🔠 Uppercasing lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      let changed = 0;

      for (let i = s; i < e; i++) {
        const upper = lines[i].toUpperCase();
        if (upper !== lines[i]) {
          lines[i] = upper;
          changed++;
        }
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Uppercased ${changed} line${changed !== 1 ? 's' : ''} (lines ${start_line}–${end_line}) in ${filePath}`;
    },

    // ── 15. LOWERCASE LINES ──────────────────────────────────────────────────
    // Convert every character in a line range to lowercase.
    lowercase_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      onStage(`🔡 Lowercasing lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      let changed = 0;

      for (let i = s; i < e; i++) {
        const lower = lines[i].toLowerCase();
        if (lower !== lines[i]) {
          lines[i] = lower;
          changed++;
        }
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Lowercased ${changed} line${changed !== 1 ? 's' : ''} (lines ${start_line}–${end_line}) in ${filePath}`;
    },

    // ── 16. COLLAPSE WHITESPACE ──────────────────────────────────────────────
    // Reduce any run of consecutive whitespace inside each line to a single
    // space. Leading indentation is preserved by default.
    collapse_whitespace: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const preserveIndent = params.preserve_indent !== false;

      onStage(`🧹 Collapsing internal whitespace in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;

      let changed = 0;
      for (let i = s; i < e; i++) {
        const original = lines[i];
        let newLine;
        if (preserveIndent) {
          const m = original.match(/^(\s*)(.*\S)?\s*$/s);
          const indent = m?.[1] ?? '';
          const body = (m?.[2] ?? '').replace(/\s+/g, ' ');
          newLine = indent + body;
        } else {
          newLine = original.trim().replace(/\s+/g, ' ');
        }
        if (newLine !== original) {
          lines[i] = newLine;
          changed++;
        }
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Collapsed whitespace in ${changed} of ${totalLines} lines in ${filePath}`;
    },

    // ── 17. SPLIT FILE AT PATTERN ────────────────────────────────────────────
    // Split a file into two output files at the first line that matches a
    // pattern. The matching line itself can go to part A, part B, or neither.
    split_file_at_pattern: async (params, onStage) => {
      const { path: filePath, pattern, output_path_a, output_path_b } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (!output_path_a?.trim()) throw new Error('Missing required param: output_path_a');
      if (!output_path_b?.trim()) throw new Error('Missing required param: output_path_b');

      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;
      // Where does the split line go? 'a' | 'b' | 'none'
      const matchGoesTo = (params.match_goes_to ?? 'a').toLowerCase();
      const occurrence = Math.max(1, params.occurrence ?? 1);

      onStage(`✂️ Splitting ${filePath} at "${pattern}"`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? '' : 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
      } catch (e) {
        throw new Error(`Invalid pattern: ${e.message}`);
      }

      let found = 0;
      let splitIdx = -1;
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          found++;
          if (found === occurrence) {
            splitIdx = i;
            break;
          }
        }
      }

      if (splitIdx === -1) {
        return `Pattern "${pattern}" not found (occurrence ${occurrence}) in ${filePath} — file not split.`;
      }

      let partA, partB;
      if (matchGoesTo === 'b') {
        partA = lines.slice(0, splitIdx);
        partB = lines.slice(splitIdx);
      } else if (matchGoesTo === 'none') {
        partA = lines.slice(0, splitIdx);
        partB = lines.slice(splitIdx + 1);
      } else {
        // 'a'
        partA = lines.slice(0, splitIdx + 1);
        partB = lines.slice(splitIdx + 1);
      }

      await Promise.all([
        ipcWriteFile(output_path_a, joinLines(partA)),
        ipcWriteFile(output_path_b, joinLines(partB)),
      ]);

      return [
        `✅ Split ${filePath} at line ${splitIdx + 1} (pattern: "${pattern}")`,
        `   Part A: ${partA.length} lines → ${output_path_a}`,
        `   Part B: ${partB.length} lines → ${output_path_b}`,
      ].join('\n');
    },

    // ── 18. ROTATE LINES ─────────────────────────────────────────────────────
    // Rotate a block of lines by N positions. "down" moves the first N lines
    // to the end; "up" moves the last N lines to the front.
    rotate_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line, count } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (count == null) throw new Error('Missing required param: count');
      if (count < 1) throw new Error('count must be at least 1');

      const direction = (params.direction ?? 'down').toLowerCase();
      if (direction !== 'up' && direction !== 'down') {
        throw new Error('direction must be "up" or "down"');
      }

      onStage(
        `🔄 Rotating lines ${start_line}–${end_line} by ${count} (${direction}) in ${filePath}`,
      );
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      const block = lines.slice(s, e);

      if (block.length < 2) return `Range contains fewer than 2 lines — nothing to rotate.`;
      const n = count % block.length;
      if (!n)
        return `Rotation by ${count} is equivalent to no change for a ${block.length}-line range — file unchanged.`;

      const rotated =
        direction === 'up'
          ? [...block.slice(-n), ...block.slice(0, -n)]
          : [...block.slice(n), ...block.slice(0, n)];

      lines.splice(s, block.length, ...rotated);
      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Rotated ${block.length} lines (${start_line}–${end_line}) ${direction} by ${n} position${n !== 1 ? 's' : ''} in ${filePath}`;
    },

    // ── 19. REPLACE CHAR ─────────────────────────────────────────────────────
    // Replace every occurrence of a specific character (or short string) with
    // another throughout a file or within a line range. Simpler and faster than
    // find_replace_regex for single-character substitutions.
    replace_char: async (params, onStage) => {
      const { path: filePath, from_char, to_char } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!from_char) throw new Error('Missing required param: from_char');
      if (to_char == null) throw new Error('Missing required param: to_char');

      onStage(`🔤 Replacing "${from_char}" → "${to_char}" in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;

      const escaped = from_char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'g');

      let totalReplaced = 0;
      let linesChanged = 0;
      for (let i = s; i < e; i++) {
        const matches = lines[i].match(regex);
        if (matches) {
          lines[i] = lines[i].replace(regex, to_char);
          totalReplaced += matches.length;
          linesChanged++;
        }
      }

      if (!totalReplaced) {
        return `"${from_char}" not found in the specified range of ${filePath} — file unchanged.`;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Replaced ${totalReplaced} occurrence${totalReplaced !== 1 ? 's' : ''} of "${from_char}" → "${to_char}" across ${linesChanged} line${linesChanged !== 1 ? 's' : ''} in ${filePath}`;
    },

    // ── 20. COUNT LINES IN RANGE ─────────────────────────────────────────────
    // Lightweight counter for a file or a specific line range, reporting total,
    // blank, non-blank lines, word count, character count, and optionally the
    // number of lines that match an additional filter pattern.
    count_lines_in_range: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`🔢 Counting lines in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;
      const region = lines.slice(s, e);

      const total = region.length;
      const blank = region.filter((l) => !l.trim()).length;
      const nonBlank = total - blank;
      const words = region
        .filter((l) => l.trim())
        .join(' ')
        .split(/\s+/)
        .filter(Boolean).length;
      const chars = region.join('\n').length;

      const rangeLabel =
        params.start_line || params.end_line
          ? `lines ${s + 1}–${e} of ${totalLines}`
          : `all ${totalLines} lines`;

      const output = [
        `Line count for ${filePath} (${rangeLabel}):`,
        `  Total lines:     ${total.toLocaleString()}`,
        `  Blank lines:     ${blank.toLocaleString()}`,
        `  Non-blank lines: ${nonBlank.toLocaleString()}`,
        `  Words:           ${words.toLocaleString()}`,
        `  Characters:      ${chars.toLocaleString()}`,
      ];

      // Optional pattern filter
      if (params.pattern?.trim()) {
        const useRegex = params.regex === true;
        let regex;
        try {
          regex = useRegex
            ? new RegExp(params.pattern, 'i')
            : new RegExp(params.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const patCount = region.filter((l) => regex.test(l)).length;
          output.push(
            `  Matching "${params.pattern}": ${patCount.toLocaleString()} line${patCount !== 1 ? 's' : ''}`,
          );
        } catch (e) {
          output.push(`  Pattern error: ${e.message}`);
        }
      }

      return output.join('\n');
    },

    // 1. FIND LARGEST FILES
    // Lists the N largest files in a directory tree, sorted by size descending.
    // Instantly surfaces bloated assets, accidental binary commits, or log files.
    find_largest_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Provide path.');

      const limit = params.limit ?? 20;
      const extensions = params.extensions
        ? params.extensions.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
        : null;

      onStage(`📦 Finding largest files in ${rootPath}`);

      const extFilter = extensions
        ? `\\( ${extensions.map((e) => `-name "*.${e}"`).join(' -o ')} \\)`
        : '';
      const shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f ${extFilter} -not -path "*/node_modules/*" -not -path "*/.git/*" -printf "%s\t%p\n" 2>/dev/null | sort -rn | head -${limit}`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });

      if (!shellResult?.ok || !shellResult.stdout?.trim()) {
        return `Could not list files. Ensure the workspace path is valid: ${rootPath}`;
      }

      const files = shellResult.stdout
        .trim()
        .split('\n')
        .map((line) => {
          const tab = line.indexOf('\t');
          return { size: parseInt(line.slice(0, tab), 10), path: line.slice(tab + 1) };
        })
        .filter((f) => !isNaN(f.size));

      if (!files.length) return `No files found matching criteria in ${rootPath}.`;

      const lines = [
        `Largest ${files.length} file${files.length !== 1 ? 's' : ''} in ${rootPath}:`,
        '',
        ...files.map((f, i) => {
          const kb = (f.size / 1024).toFixed(1);
          const mb = f.size >= 1_048_576 ? ` (${(f.size / 1_048_576).toFixed(2)} MB)` : '';
          return `  ${String(i + 1).padStart(3)}. ${kb} KB${mb}  ${f.path}`;
        }),
      ];
      return lines.join('\n');
    },

    // 2. FIND FILES BY EXTENSION
    // Lists every file with one or more given extensions in a directory tree.
    // Fast alternative to find_file_by_name when you want all files of a type.
    find_files_by_extension: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Provide path.');
      if (!params.extensions?.trim()) throw new Error('Missing required param: extensions');

      const exts = params.extensions
        .split(',')
        .map((e) => e.trim().replace(/^\./, '').toLowerCase());
      const maxResults = params.max_results ?? 200;

      onStage(`🔎 Finding [${exts.join(', ')}] files in ${rootPath}`);

      const extPatterns = exts.map((e) => `-name "*.${e}"`).join(' -o ');
      const shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -${maxResults + 10}`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });

      if (!shellResult?.ok || !shellResult.stdout?.trim()) {
        return `No files with extension${exts.length > 1 ? 's' : ''} [${exts.join(', ')}] found in ${rootPath}.`;
      }

      const files = shellResult.stdout.trim().split('\n').filter(Boolean).slice(0, maxResults);

      const grouped = {};
      for (const f of files) {
        const ext = f.split('.').pop().toLowerCase();
        (grouped[ext] = grouped[ext] || []).push(f);
      }

      const output = [
        `Files with [${exts.join(', ')}] in ${rootPath}:`,
        `Found ${files.length}${files.length >= maxResults ? '+' : ''} file${files.length !== 1 ? 's' : ''}`,
        '',
      ];

      for (const [ext, list] of Object.entries(grouped)) {
        output.push(`### .${ext.toUpperCase()} (${list.length})`);
        for (const f of list) output.push(`  ${f}`);
        output.push('');
      }

      return output.join('\n');
    },

    // 3. FIND EMPTY FILES
    // Locates zero-byte and optionally whitespace-only files.
    find_empty_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Provide path.');

      const includeWhitespaceOnly = params.include_whitespace_only !== false;
      onStage(`🔍 Finding empty files in ${rootPath}`);

      const shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -empty`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });

      const emptyFiles =
        shellResult?.ok && shellResult.stdout?.trim()
          ? shellResult.stdout.trim().split('\n').filter(Boolean)
          : [];

      let whitespaceFiles = [];
      if (includeWhitespaceOnly) {
        const smallFiles = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -size +0c -size -4k \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.rb" -o -name "*.go" \\) | head -100`,
          cwd: rootPath,
          timeout: 15000,
          allowRisky: false,
        });
        if (smallFiles?.ok && smallFiles.stdout?.trim()) {
          for (const fp of smallFiles.stdout.trim().split('\n').filter(Boolean).slice(0, 50)) {
            try {
              const { content } = await ipcReadFile(fp);
              if (content.trim() === '' && content.length > 0) whitespaceFiles.push(fp);
            } catch {
              /* skip */
            }
          }
        }
      }

      if (!emptyFiles.length && !whitespaceFiles.length) {
        return `No empty files found in ${rootPath}.`;
      }

      const output = [`Empty files in ${rootPath}:`, ''];
      if (emptyFiles.length) {
        output.push(`### ZERO-BYTE FILES (${emptyFiles.length})`);
        emptyFiles.forEach((f) => output.push(`  ${f}`));
        output.push('');
      }
      if (whitespaceFiles.length) {
        output.push(`### WHITESPACE-ONLY FILES (${whitespaceFiles.length})`);
        whitespaceFiles.forEach((f) => output.push(`  ${f}`));
      }
      return output.join('\n');
    },

    // 4. FIND LONG LINES
    // Finds lines exceeding a character-width threshold in a file.
    find_long_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const threshold = params.threshold ?? 100;
      const maxResults = params.max_results ?? 100;

      onStage(`📏 Finding lines longer than ${threshold} chars in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].length > threshold) {
          hits.push({ num: i + 1, len: lines[i].length, text: lines[i] });
          if (hits.length >= maxResults) break;
        }
      }

      if (!hits.length)
        return `No lines exceed ${threshold} characters in ${filePath} (${totalLines} lines).`;

      const longest = hits.reduce((a, b) => (b.len > a.len ? b : a));
      return [
        `Lines > ${threshold} chars in ${filePath}:`,
        `${hits.length}${hits.length >= maxResults ? '+' : ''} long lines | Longest: ${longest.len} chars (line ${longest.num})`,
        '',
        ...hits.map(
          (h) =>
            `  Line ${h.num} (${h.len}): ${h.text.slice(0, 140)}${h.text.length > 140 ? '…' : ''}`,
        ),
      ].join('\n');
    },

    // 5. FIND CONSOLE STATEMENTS
    // Locates every console.log / print / debugger call left in source files.
    find_console_statements: async (params, onStage) => {
      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : null;
      const filePath = params.path?.trim();
      if (!filePath && !rootPath) throw new Error('Provide path (single file) or workspace_path.');

      const defaultPatterns = [
        'console\\.log',
        'console\\.warn',
        'console\\.error',
        'console\\.debug',
        'console\\.info',
        'console\\.trace',
        'debugger',
        'print\\(',
        'pprint\\(',
        'System\\.out\\.println',
        'NSLog\\(',
        'fmt\\.Print',
      ];
      const patterns = params.patterns
        ? params.patterns.split(',').map((p) => p.trim())
        : defaultPatterns;
      const patternRe = new RegExp(patterns.join('|'), 'i');

      onStage(`🔍 Scanning for console/debug statements`);

      const hits = [];

      if (filePath) {
        const { content } = await ipcReadFile(filePath);
        splitLines(content).forEach((line, i) => {
          if (
            patternRe.test(line) &&
            !line.trim().startsWith('//') &&
            !line.trim().startsWith('#')
          ) {
            hits.push({ path: filePath, line: i + 1, text: line.trim() });
          }
        });
      } else {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath,
          query: 'console.log',
          maxResults: 300,
        });
        for (const m of result?.matches ?? []) {
          if (patternRe.test(m.line) && !m.line.trim().startsWith('//')) {
            hits.push({ path: m.path, line: m.lineNumber, text: m.line.trim() });
          }
        }
      }

      if (!hits.length) return `No console/debug statements found.`;

      const byFile = {};
      for (const h of hits) (byFile[h.path] = byFile[h.path] || []).push(h);

      const output = [
        `Console/debug statements: ${hits.length} across ${Object.keys(byFile).length} file${Object.keys(byFile).length !== 1 ? 's' : ''}`,
        '',
      ];
      for (const [fp, fileHits] of Object.entries(byFile)) {
        output.push(`📄 ${fp} (${fileHits.length})`);
        fileHits
          .slice(0, 15)
          .forEach((h) => output.push(`  Line ${h.line}: ${h.text.slice(0, 120)}`));
        if (fileHits.length > 15) output.push(`  … +${fileHits.length - 15} more`);
        output.push('');
      }
      return output.join('\n');
    },

    // 6. FIND HARDCODED VALUES
    // Surfaces magic numbers, hardcoded URLs, and string literals.
    find_hardcoded_values: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const findNumbers = params.find_numbers !== false;
      const findStrings = params.find_strings !== false;
      const findUrls = params.find_urls !== false;
      const minMagicNumber = params.min_magic_number ?? 3;

      onStage(`🔍 Scanning for hardcoded values in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const results = { numbers: [], strings: [], urls: [] };
      const urlRe = /https?:\/\/[^\s'"`,;)>]+/gi;
      const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
      const magicNumRe = /(?<![a-zA-Z_$0-9.])\b([0-9]+(?:\.[0-9]+)?)\b/g;

      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (/^\s*(\/\/|#|\/\*|\*|<!--)/.test(trimmed)) continue;

        if (findUrls) {
          urlRe.lastIndex = 0;
          let m;
          while ((m = urlRe.exec(lines[i])) !== null) {
            results.urls.push({ line: i + 1, value: m[0] });
          }
        }
        if (findNumbers) {
          magicNumRe.lastIndex = 0;
          let m;
          while ((m = magicNumRe.exec(lines[i])) !== null) {
            if (parseFloat(m[1]) >= minMagicNumber) {
              results.numbers.push({ line: i + 1, value: m[1], context: trimmed.slice(0, 80) });
            }
          }
        }
        if (findStrings && !trimmed.startsWith('import') && !trimmed.startsWith('from')) {
          stringRe.lastIndex = 0;
          let m;
          while ((m = stringRe.exec(lines[i])) !== null) {
            const inner = m[1].slice(1, -1);
            if (inner.length >= 3 && inner.trim()) {
              results.strings.push({ line: i + 1, value: m[1].slice(0, 60) });
            }
          }
        }
      }

      const total = results.numbers.length + results.strings.length + results.urls.length;
      if (!total) return `No hardcoded values found in ${filePath} (${totalLines} lines).`;

      const output = [
        `Hardcoded values in ${filePath}:`,
        `Magic numbers: ${results.numbers.length} | String literals: ${results.strings.length} | URLs: ${results.urls.length}`,
        '',
      ];
      if (results.numbers.length) {
        output.push(`### MAGIC NUMBERS (≥ ${minMagicNumber})`);
        results.numbers
          .slice(0, 40)
          .forEach((r) => output.push(`  Line ${r.line}: ${r.value}  ← ${r.context}`));
        if (results.numbers.length > 40) output.push(`  … +${results.numbers.length - 40} more`);
        output.push('');
      }
      if (results.urls.length) {
        output.push('### HARDCODED URLs');
        results.urls.slice(0, 20).forEach((r) => output.push(`  Line ${r.line}: ${r.value}`));
        if (results.urls.length > 20) output.push(`  … +${results.urls.length - 20} more`);
        output.push('');
      }
      if (results.strings.length) {
        output.push('### STRING LITERALS (3+ chars)');
        results.strings.slice(0, 40).forEach((r) => output.push(`  Line ${r.line}: ${r.value}`));
        if (results.strings.length > 40) output.push(`  … +${results.strings.length - 40} more`);
      }
      return output.join('\n');
    },

    // 7. FIND IMPORTS OF
    // Across the whole workspace, finds every file that imports a specific module.
    find_imports_of: async (params, onStage) => {
      const { module: moduleName } = params;
      if (!moduleName?.trim()) throw new Error('Missing required param: module');
      const rootPath = resolveWorkingDirectory(params.workspace_path);
      if (!rootPath) throw new Error('No workspace is open. Provide workspace_path.');

      onStage(`🔗 Finding all files that import "${moduleName}"`);
      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath,
        query: moduleName,
        maxResults: 300,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace search failed');

      const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const importRe = new RegExp(
        `(?:import|from|require)\\s*(?:\\(?\\s*)?['"` +
          '`' +
          `]([^'"` +
          '`' +
          `]*${escaped}[^'"` +
          '`' +
          `]*)['"` +
          '`' +
          `]`,
        'i',
      );

      const hits = [];
      for (const m of result.matches ?? []) {
        if (importRe.test(m.line)) {
          hits.push({ path: m.path, line: m.lineNumber, text: m.line.trim() });
        }
      }

      if (!hits.length) return `No files import "${moduleName}" in ${rootPath}.`;

      const byFile = {};
      for (const h of hits) (byFile[h.path] = byFile[h.path] || []).push(h);

      const output = [
        `Files importing "${moduleName}":`,
        `${Object.keys(byFile).length} file${Object.keys(byFile).length !== 1 ? 's' : ''} (${hits.length} import statement${hits.length !== 1 ? 's' : ''})`,
        '',
      ];
      for (const [fp, fileHits] of Object.entries(byFile)) {
        output.push(`📄 ${fp}`);
        fileHits.forEach((h) => output.push(`   line ${h.line}: ${h.text.slice(0, 120)}`));
      }
      return output.join('\n');
    },

    // 8. FIND FILES WITHOUT PATTERN
    // Returns all files that do NOT contain a given pattern.
    find_files_without_pattern: async (params, onStage) => {
      const { directory, pattern } = params;
      if (!directory?.trim()) throw new Error('Missing required param: directory');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const extensions = params.extensions
        ? params.extensions.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
        : ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'java', 'cs', 'php', 'rs'];
      const maxResults = params.max_results ?? 50;

      onStage(`🔍 Finding files WITHOUT "${pattern}" in ${directory}`);

      const extPatterns = extensions.map((e) => `-name "*.${e}"`).join(' -o ');
      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${directory}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
        cwd: directory,
        timeout: 20000,
        allowRisky: false,
      });

      if (!listResult?.ok || !listResult.stdout?.trim())
        return `Could not list files in ${directory}.`;

      const allFiles = listResult.stdout.trim().split('\n').filter(Boolean);
      const searchResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: directory,
        query: pattern,
        maxResults: allFiles.length + 100,
      });
      const filesWithPattern = new Set((searchResult?.matches ?? []).map((m) => m.path));
      const missingFiles = allFiles.filter((f) => !filesWithPattern.has(f)).slice(0, maxResults);

      if (!missingFiles.length) return `All scanned files contain "${pattern}" in ${directory}.`;

      const byExt = {};
      for (const f of missingFiles) {
        const ext = f.split('.').pop().toLowerCase();
        (byExt[ext] = byExt[ext] || []).push(f);
      }

      const output = [
        `Files NOT containing "${pattern}" in ${directory}:`,
        `${missingFiles.length}${missingFiles.length >= maxResults ? '+' : ''} of ${allFiles.length} files are missing this pattern`,
        '',
      ];
      for (const [ext, files] of Object.entries(byExt)) {
        output.push(`### .${ext.toUpperCase()} (${files.length})`);
        files.forEach((f) => output.push(`  ${f}`));
        output.push('');
      }
      return output.join('\n');
    },

    // 9. FIND NTH OCCURRENCE
    // Locates the exact position of the Nth occurrence of a pattern in a file.
    find_nth_occurrence: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const n = Math.max(1, params.n ?? 1);
      const contextRadius = params.context_lines ?? 10;
      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;

      onStage(`🔢 Finding occurrence #${n} of "${pattern}" in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? '' : 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
      } catch (e) {
        throw new Error(`Invalid pattern: ${e.message}`);
      }

      let found = 0;
      let targetLine = -1;
      const allOccurrences = [];
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          found++;
          allOccurrences.push(i + 1);
          if (found === n) targetLine = i;
        }
      }

      if (targetLine === -1) {
        return [
          `Occurrence #${n} of "${pattern}" not found in ${filePath}.`,
          `Total occurrences: ${found}`,
          found > 0 ? `Found at lines: ${allOccurrences.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      }

      const from = Math.max(0, targetLine - contextRadius);
      const to = Math.min(lines.length - 1, targetLine + contextRadius);
      const output = [
        `Occurrence #${n} of "${pattern}" in ${filePath}:`,
        `Line ${targetLine + 1} of ${totalLines} | Total occurrences: ${found}`,
        found > 1 ? `All at lines: ${allOccurrences.join(', ')}` : '',
        '',
      ].filter(Boolean);
      for (let i = from; i <= to; i++) {
        output.push(`${String(i + 1).padStart(5)}${i === targetLine ? '▶' : ' '} ${lines[i]}`);
      }
      return output.join('\n');
    },

    // 10. FIND ALL URLS
    // Extracts every URL from a file or workspace, grouped by domain.
    find_all_urls: async (params, onStage) => {
      const filePath = params.path?.trim();
      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');

      const schemes = (params.schemes ?? 'http,https').split(',').map((s) => s.trim());
      const urlRe = new RegExp(`(${schemes.join('|')})://[^\\s'"` + '`' + `<>)\\]},;]+`, 'gi');

      onStage(`🔗 Extracting URLs from ${filePath ?? rootPath}`);

      const urlMap = new Map();
      const scanLine = (line, source, lineNum) => {
        urlRe.lastIndex = 0;
        let m;
        while ((m = urlRe.exec(line)) !== null) {
          const url = m[0].replace(/[.,;)>\]'"]+$/, '');
          if (!urlMap.has(url)) urlMap.set(url, new Set());
          urlMap.get(url).add(`${source}:${lineNum}`);
        }
      };

      if (filePath) {
        const { content } = await ipcReadFile(filePath);
        splitLines(content).forEach((line, i) => scanLine(line, filePath, i + 1));
      } else {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath,
          query: '://',
          maxResults: 500,
        });
        for (const m of result?.matches ?? []) scanLine(m.line, m.path, m.lineNumber);
      }

      if (!urlMap.size) return `No URLs found.`;

      const byDomain = {};
      for (const [url, locs] of urlMap.entries()) {
        const domain = url.match(/^https?:\/\/([^/]+)/)?.[1] ?? 'other';
        (byDomain[domain] = byDomain[domain] || []).push({ url, locs: [...locs] });
      }

      const output = [
        `URLs in ${filePath ?? rootPath}:`,
        `${urlMap.size} unique URL${urlMap.size !== 1 ? 's' : ''} across ${Object.keys(byDomain).length} domain${Object.keys(byDomain).length !== 1 ? 's' : ''}`,
        '',
      ];
      for (const [domain, entries] of Object.entries(byDomain)) {
        output.push(`### ${domain} (${entries.length})`);
        for (const { url, locs } of entries) {
          output.push(`  ${url}`);
          if (params.show_locations !== false) {
            locs.slice(0, 3).forEach((l) => output.push(`    ↳ ${l}`));
            if (locs.length > 3) output.push(`    ↳ … +${locs.length - 3} more`);
          }
        }
        output.push('');
      }
      return output.join('\n');
    },

    // 11. FIND COMMENTED CODE BLOCKS
    // Detects runs of commented-out code lines.
    find_commented_code_blocks: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const minBlockSize = params.min_block_size ?? 3;
      onStage(`🔍 Finding commented-out code blocks in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);
      const style = getCommentStyle(filePath, null);
      const marker = style.single || '//';
      const codeSmellRe = /[{}();=<>[\]]/;

      const isCommentedCode = (line) => {
        const t = line.trim();
        if (!t.startsWith(marker)) return false;
        const inner = t.slice(marker.length).trim();
        return codeSmellRe.test(inner) && inner.length > 3;
      };

      const blocks = [];
      let blockStart = -1;
      let blockLines = [];

      for (let i = 0; i < lines.length; i++) {
        if (isCommentedCode(lines[i])) {
          if (blockStart === -1) blockStart = i;
          blockLines.push({ lineNum: i + 1, text: lines[i].trim() });
        } else {
          if (blockStart !== -1 && blockLines.length >= minBlockSize) {
            blocks.push({ start: blockStart + 1, end: i, lines: [...blockLines] });
          }
          blockStart = -1;
          blockLines = [];
        }
      }
      if (blockStart !== -1 && blockLines.length >= minBlockSize) {
        blocks.push({ start: blockStart + 1, end: lines.length, lines: blockLines });
      }

      if (!blocks.length)
        return `No commented-out code blocks (≥ ${minBlockSize} lines) found in ${filePath}.`;

      const output = [
        `Commented-out code blocks in ${filePath}:`,
        `${blocks.length} block${blocks.length !== 1 ? 's' : ''} across ${totalLines} lines`,
        '',
      ];
      for (const block of blocks) {
        output.push(`### Lines ${block.start}–${block.end} (${block.lines.length} lines)`);
        block.lines
          .slice(0, 8)
          .forEach((l) => output.push(`  ${l.lineNum}: ${l.text.slice(0, 100)}`));
        if (block.lines.length > 8) output.push(`  … +${block.lines.length - 8} more`);
        output.push('');
      }
      return output.join('\n');
    },

    // 12. FIND SIMILAR LINES
    // Detects near-duplicate lines using trigram similarity.
    find_similar_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const threshold = params.similarity_threshold ?? 0.85;
      const minLength = params.min_length ?? 20;
      const maxComparisons = 2000;

      onStage(`🔍 Scanning for near-duplicate lines in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const candidates = lines
        .map((text, idx) => ({ idx, text: text.trim() }))
        .filter((l) => l.text.length >= minLength && !l.text.match(/^\s*(\/\/|#|\*)/));

      if (candidates.length > maxComparisons) {
        return `Too many candidate lines (${candidates.length}). Narrow the range.`;
      }

      const trigrams = (s) => {
        const tg = new Set();
        for (let i = 0; i < s.length - 2; i++) tg.add(s.slice(i, i + 3));
        return tg;
      };
      const sim = (a, b) => {
        const ta = trigrams(a),
          tb = trigrams(b);
        let inter = 0;
        for (const t of ta) if (tb.has(t)) inter++;
        return inter / (ta.size + tb.size - inter || 1);
      };

      const pairs = [];
      for (let i = 0; i < candidates.length; i++) {
        for (let j = i + 1; j < candidates.length; j++) {
          if (candidates[i].text === candidates[j].text) continue;
          const s = sim(candidates[i].text, candidates[j].text);
          if (s >= threshold) {
            pairs.push({
              lineA: candidates[i].idx + 1,
              lineB: candidates[j].idx + 1,
              textA: candidates[i].text,
              textB: candidates[j].text,
              pct: Math.round(s * 100),
            });
          }
        }
      }

      if (!pairs.length) return `No similar lines (≥ ${Math.round(threshold * 100)}%) found.`;
      pairs.sort((a, b) => b.pct - a.pct);

      const output = [
        `Similar lines in ${filePath} (≥ ${Math.round(threshold * 100)}% similar):`,
        `${pairs.length} pair${pairs.length !== 1 ? 's' : ''}`,
        '',
      ];
      for (const p of pairs.slice(0, 30)) {
        output.push(`### ${p.pct}% — Lines ${p.lineA} & ${p.lineB}`);
        output.push(`  L${p.lineA}: ${p.textA.slice(0, 100)}`);
        output.push(`  L${p.lineB}: ${p.textB.slice(0, 100)}`);
        output.push('');
      }
      if (pairs.length > 30) output.push(`… +${pairs.length - 30} more pairs`);
      return output.join('\n');
    },

    // 13. FIND FUNCTIONS OVER LENGTH
    // Workspace-wide scan for functions exceeding N lines.
    find_functions_over_length: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.workspace_path);
      if (!rootPath) throw new Error('No workspace is open.');

      const threshold = params.threshold ?? 50;
      const extensions = params.extensions
        ? params.extensions.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
        : ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cs', 'go', 'rb'];

      onStage(`📊 Scanning workspace for functions > ${threshold} lines`);

      const extPatterns = extensions.map((e) => `-name "*.${e}"`).join(' -o ');
      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
        cwd: rootPath,
        timeout: 20000,
        allowRisky: false,
      });

      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No source files found in ${rootPath}.`;

      const files = listResult.stdout.trim().split('\n').filter(Boolean);
      onStage(`Analyzing ${files.length} files…`);

      const fnRe =
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|^class\s+(\w+)|^(?:async\s+)?def\s+(\w+)/;
      const longFunctions = [];

      for (const fp of files.slice(0, 200)) {
        try {
          const { content } = await ipcReadFile(fp);
          const fileLines = splitLines(content);
          let current = null,
            depth = 0;
          for (let i = 0; i < fileLines.length; i++) {
            const t = fileLines[i].trim();
            const m = t.match(fnRe);
            if (m && depth <= 1) {
              if (current) {
                current.length = i - current.startLine;
                if (current.length > threshold) longFunctions.push({ ...current, path: fp });
              }
              current = {
                name: m[1] || m[2] || m[3] || m[4] || '(anon)',
                startLine: i + 1,
                length: 0,
              };
            }
            depth = Math.max(
              0,
              depth + (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length,
            );
          }
          if (current) {
            current.length = fileLines.length - current.startLine;
            if (current.length > threshold) longFunctions.push({ ...current, path: fp });
          }
        } catch {
          /* skip */
        }
      }

      if (!longFunctions.length) return `No functions over ${threshold} lines found.`;
      longFunctions.sort((a, b) => b.length - a.length);

      const byFile = {};
      for (const f of longFunctions) (byFile[f.path] = byFile[f.path] || []).push(f);

      const output = [
        `Functions over ${threshold} lines in ${rootPath}:`,
        `${longFunctions.length} function${longFunctions.length !== 1 ? 's' : ''} across ${Object.keys(byFile).length} files`,
        '',
      ];
      for (const [fp, fns] of Object.entries(byFile)) {
        output.push(`📄 ${fp}`);
        fns.forEach((fn) =>
          output.push(`   ${fn.name}()  line ${fn.startLine}  (${fn.length} lines)`),
        );
      }
      return output.join('\n');
    },

    // 14. FIND UNCLOSED MARKERS
    // Scans for start markers that have no matching end marker.
    find_unclosed_markers: async (params, onStage) => {
      const { path: filePath, start_marker, end_marker } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');

      onStage(`🔍 Checking marker balance in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const opens = [];
      const matched = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(start_marker)) opens.push({ line: i + 1, text: lines[i].trim() });
        if (lines[i].includes(end_marker) && opens.length > 0)
          matched.push({ open: opens.pop(), close: { line: i + 1 } });
      }

      // Extra closes: end markers without a matching open
      const matchedCloseLines = new Set(matched.map((m) => m.close.line));
      const extraCloses = [];
      for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(end_marker) && !matchedCloseLines.has(i + 1)) {
          extraCloses.push({ line: i + 1, text: lines[i].trim() });
        }
      }

      if (!opens.length && !extraCloses.length) {
        return `All "${start_marker}" markers are properly closed. Matched pairs: ${matched.length}`;
      }

      const output = [
        `Marker balance: "${start_marker}" … "${end_marker}" in ${filePath}`,
        `Matched: ${matched.length} | Unclosed: ${opens.length} | Extra closes: ${extraCloses.length}`,
        '',
      ];
      if (opens.length) {
        output.push(`### UNCLOSED "${start_marker}"`);
        opens.forEach((u) => output.push(`  Line ${u.line}: ${u.text.slice(0, 100)}`));
        output.push('');
      }
      if (extraCloses.length) {
        output.push(`### EXTRA "${end_marker}" (no matching open)`);
        extraCloses.forEach((e) => output.push(`  Line ${e.line}: ${e.text.slice(0, 100)}`));
      }
      return output.join('\n');
    },

    // 15. FIND PATTERN NEAR PATTERN
    // Finds lines where pattern A appears within N lines of pattern B.
    find_pattern_near_pattern: async (params, onStage) => {
      const { path: filePath, pattern_a, pattern_b } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern_a?.trim()) throw new Error('Missing required param: pattern_a');
      if (!pattern_b?.trim()) throw new Error('Missing required param: pattern_b');

      const proximity = params.proximity ?? 5;
      const useRegex = params.regex === true;

      onStage(
        `🔍 Finding "${pattern_a}" within ${proximity} lines of "${pattern_b}" in ${filePath}`,
      );
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const makeRe = (p) =>
        useRegex ? new RegExp(p, 'i') : new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

      const reA = makeRe(pattern_a),
        reB = makeRe(pattern_b);
      const linesA = [],
        linesB = [];
      for (let i = 0; i < lines.length; i++) {
        if (reA.test(lines[i])) linesA.push(i);
        if (reB.test(lines[i])) linesB.push(i);
      }

      if (!linesA.length) return `Pattern A "${pattern_a}" not found in ${filePath}.`;
      if (!linesB.length) return `Pattern B "${pattern_b}" not found in ${filePath}.`;

      const pairs = [];
      for (const a of linesA) {
        for (const b of linesB) {
          if (a !== b && Math.abs(a - b) <= proximity) {
            pairs.push({ a: a + 1, b: b + 1, dist: Math.abs(a - b) });
          }
        }
      }

      if (!pairs.length)
        return `No co-occurrences within ${proximity} lines. A at: ${linesA
          .slice(0, 5)
          .map((l) => l + 1)
          .join(', ')} | B at: ${linesB
          .slice(0, 5)
          .map((l) => l + 1)
          .join(', ')}`;

      pairs.sort((a, b) => a.a - b.a);
      const output = [
        `"${pattern_a}" within ${proximity} lines of "${pattern_b}" in ${filePath}:`,
        `${pairs.length} co-occurrence${pairs.length !== 1 ? 's' : ''}`,
        '',
      ];

      for (const p of pairs.slice(0, 30)) {
        const lo = Math.max(0, Math.min(p.a, p.b) - 2);
        const hi = Math.min(lines.length - 1, Math.max(p.a, p.b));
        output.push(`--- A:${p.a} / B:${p.b} (${p.dist} line${p.dist !== 1 ? 's' : ''} apart) ---`);
        for (let i = lo; i <= hi; i++) {
          const tag = i + 1 === p.a ? 'A' : i + 1 === p.b ? 'B' : ' ';
          output.push(`  ${String(i + 1).padStart(5)} ${tag} ${lines[i].trimEnd().slice(0, 100)}`);
        }
        output.push('');
      }
      return output.join('\n');
    },

    // 16. FIND ALL STRING LITERALS
    // Extracts every unique string literal value from a file.
    find_all_string_literals: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const minLength = params.min_length ?? 2;
      const maxLength = params.max_length ?? 200;
      const dedup = params.deduplicate !== false;

      onStage(`📝 Extracting string literals from ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const found = [];
      const stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;

      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (/^\s*(\/\/|#|\/\*|\*|import\s|from\s|require\()/.test(t)) continue;
        stringRe.lastIndex = 0;
        let m;
        while ((m = stringRe.exec(lines[i])) !== null) {
          const inner = m[1].slice(1, -1).replace(/\\./g, (s) => s[1]);
          if (inner.length >= minLength && inner.length <= maxLength && inner.trim()) {
            const quote = m[1][0] === '"' ? 'double' : m[1][0] === "'" ? 'single' : 'template';
            found.push({ line: i + 1, value: inner, raw: m[1], quote });
          }
        }
      }

      if (!found.length) return `No string literals found in ${filePath} (${totalLines} lines).`;

      let results = found;
      if (dedup) {
        const seen = new Set();
        results = found.filter(({ value }) => (seen.has(value) ? false : (seen.add(value), true)));
      }

      const byQuote = { double: [], single: [], template: [] };
      for (const r of results) byQuote[r.quote].push(r);

      const output = [
        `String literals in ${filePath}:`,
        `Total: ${found.length} (${dedup ? results.length + ' unique' : 'all'}) | " ${byQuote.double.length} | ' ${byQuote.single.length} | \` ${byQuote.template.length}`,
        '',
      ];
      for (const [qType, items] of Object.entries(byQuote)) {
        if (!items.length) continue;
        output.push(`### ${qType.toUpperCase()} QUOTES (${items.length})`);
        items
          .slice(0, 50)
          .forEach((item) => output.push(`  Line ${item.line}: ${item.raw.slice(0, 80)}`));
        if (items.length > 50) output.push(`  … +${items.length - 50} more`);
        output.push('');
      }
      return output.join('\n');
    },

    // 17. FIND LINES BY LENGTH RANGE
    // Returns lines whose character count falls within [min, max].
    find_lines_by_length_range: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (params.min_length == null && params.max_length == null)
        throw new Error('Provide min_length or max_length.');

      const minLen = params.min_length ?? 0;
      const maxLen = params.max_length ?? Infinity;
      const skipBlank = params.skip_blank !== false;
      const maxResults = params.max_results ?? 200;

      onStage(
        `📏 Finding lines ${minLen}–${maxLen === Infinity ? '∞' : maxLen} chars in ${filePath}`,
      );
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const hits = [];
      for (let i = 0; i < lines.length; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        if (lines[i].length >= minLen && lines[i].length <= maxLen) {
          hits.push({ num: i + 1, len: lines[i].length, text: lines[i] });
          if (hits.length >= maxResults) break;
        }
      }

      if (!hits.length)
        return `No lines with length ${minLen}–${maxLen === Infinity ? '∞' : maxLen} found.`;

      const avg = Math.round(hits.reduce((a, h) => a + h.len, 0) / hits.length);
      return [
        `Lines ${minLen}–${maxLen === Infinity ? '∞' : maxLen} chars in ${filePath}:`,
        `${hits.length}${hits.length >= maxResults ? '+' : ''} lines | avg length: ${avg} chars`,
        '',
        ...hits.map(
          (h) =>
            `  Line ${h.num} (${h.len}): ${h.text.slice(0, 120)}${h.text.length > 120 ? '…' : ''}`,
        ),
      ].join('\n');
    },

    // 18. FIND FIRST MATCH
    // Finds the very first occurrence of a pattern with generous surrounding context.
    find_first_match: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const contextBefore = params.context_before ?? 10;
      const contextAfter = params.context_after ?? 20;
      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;

      onStage(`🔍 Finding first "${pattern}" in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? '' : 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
      } catch (e) {
        throw new Error(`Invalid pattern: ${e.message}`);
      }

      let matchLine = -1;
      let totalMatches = 0;
      for (let i = 0; i < lines.length; i++) {
        if (regex.test(lines[i])) {
          if (matchLine === -1) matchLine = i;
          totalMatches++;
        }
      }

      if (matchLine === -1)
        return `Pattern "${pattern}" not found in ${filePath} (${totalLines} lines).`;

      const from = Math.max(0, matchLine - contextBefore);
      const to = Math.min(lines.length - 1, matchLine + contextAfter);

      const output = [
        `First match of "${pattern}" in ${filePath}:`,
        `Line ${matchLine + 1} of ${totalLines} | Total occurrences: ${totalMatches}`,
        '',
      ];
      for (let i = from; i <= to; i++) {
        output.push(`${String(i + 1).padStart(5)}${i === matchLine ? '▶' : ' '} ${lines[i]}`);
      }
      return output.join('\n');
    },

    // 19. FIND MULTILINE PATTERN
    // Searches for a regex spanning multiple lines using dot-all mode.
    find_multiline_pattern: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const contextLines = params.context_lines ?? 3;
      const maxMatches = params.max_matches ?? 20;
      const flags = params.flags ?? 'gis';

      onStage(`🔍 Multi-line search in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      const matches = [];
      let m;
      regex.lastIndex = 0;
      while ((m = regex.exec(content)) !== null && matches.length < maxMatches) {
        const startLineIdx = content.slice(0, m.index).split('\n').length - 1;
        const matchLineCount = m[0].split('\n').length;
        matches.push({
          startLine: startLineIdx + 1,
          endLine: startLineIdx + matchLineCount,
          matchLines: matchLineCount,
        });
        if (m[0].length === 0) regex.lastIndex++;
      }

      if (!matches.length)
        return `No multi-line matches for pattern in ${filePath} (${totalLines} lines).`;

      const output = [
        `Multi-line matches in ${filePath}:`,
        `${matches.length}${matches.length >= maxMatches ? '+' : ''} match${matches.length !== 1 ? 'es' : ''}`,
        '',
      ];
      for (const match of matches) {
        const from = Math.max(0, match.startLine - 1 - contextLines);
        const to = Math.min(lines.length - 1, match.endLine - 1 + contextLines);
        output.push(
          `### Match: lines ${match.startLine}–${match.endLine} (${match.matchLines} lines)`,
        );
        for (let i = from; i <= to; i++) {
          const inMatch = i + 1 >= match.startLine && i + 1 <= match.endLine;
          output.push(`${String(i + 1).padStart(5)}${inMatch ? '▶' : ' '} ${lines[i]}`);
        }
        output.push('');
      }
      return output.join('\n');
    },

    // 20. FIND SYMBOL DEFINITIONS
    // Finds only definition sites of a named symbol across the workspace.
    find_symbol_definitions: async (params, onStage) => {
      const { symbol } = params;
      if (!symbol?.trim()) throw new Error('Missing required param: symbol');

      const rootPath = resolveWorkingDirectory(params.workspace_path);
      if (!rootPath) throw new Error('No workspace is open. Provide workspace_path.');

      onStage(`🎯 Finding definitions of "${symbol}" in ${rootPath}`);

      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const defPatterns = [
        `function ${escaped}`,
        `class ${escaped}`,
        `const ${escaped} =`,
        `let ${escaped} =`,
        `var ${escaped} =`,
        `type ${escaped} =`,
        `interface ${escaped}`,
        `enum ${escaped}`,
        `def ${escaped}`,
        `class ${escaped}:`,
        `func ${escaped}(`,
        `type ${escaped} struct`,
      ];

      const results = await Promise.all(
        defPatterns.map((p) =>
          window.electronAPI?.invoke?.('search-workspace', { rootPath, query: p, maxResults: 10 }),
        ),
      );

      const seen = new Set();
      const defs = [];
      for (const result of results) {
        for (const m of result?.matches ?? []) {
          const key = `${m.path}:${m.lineNumber}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const line = m.line.trim();
          if (/\b(function|class|const|let|var|def|type|interface|enum|func|struct)\b/.test(line)) {
            defs.push(m);
          }
        }
      }

      if (!defs.length) {
        return `No definition of "${symbol}" found in ${rootPath}.\nTip: Use trace_symbol for a broader search including call sites.`;
      }

      defs.sort((a, b) => a.path.localeCompare(b.path) || a.lineNumber - b.lineNumber);

      const output = [
        `Definitions of "${symbol}" in ${rootPath}:`,
        `${defs.length} definition${defs.length !== 1 ? 's' : ''}`,
        '',
      ];
      for (const d of defs) {
        output.push(`  ${d.path}:${d.lineNumber}`);
        output.push(`    ${d.line.trim().slice(0, 120)}`);
        output.push('');
      }
      return output.join('\n');
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // 20 NEW FILE-EDITING TOOL HANDLERS
    // Add these inside the `handlers: { ... }` object in Executor.js,
    // after the last existing handler (find_symbol_definitions).
    // Also add each tool name to the `tools: [...]` array in createExecutor.
    // ─────────────────────────────────────────────────────────────────────────────

    // ── 1. REPLACE NTH OCCURRENCE ──────────────────────────────────────────────
    // Replace only the Nth match of a pattern — not all, not just the first.
    // Essential when a symbol appears many times but only one specific instance
    // needs to change (e.g. the 3rd call to a function, the 2nd import block).
    replace_nth_occurrence: async (params, onStage) => {
      const { path: filePath, pattern, replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (replacement == null) throw new Error('Missing required param: replacement');

      const n = Math.max(1, params.n ?? 1);
      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;

      onStage(`🔁 Replacing occurrence #${n} of "${pattern}" in ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      const flags = caseSensitive ? 'g' : 'gi';
      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, flags)
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      let found = 0;
      let replaced = false;
      const updated = content.replace(regex, (match) => {
        found++;
        if (found === n) {
          replaced = true;
          return replacement;
        }
        return match;
      });

      if (!replaced) {
        return `Occurrence #${n} not found — total occurrences: ${found}. File unchanged.`;
      }

      await ipcWriteFile(filePath, updated);
      return `✅ Replaced occurrence #${n} of "${pattern}" → "${replacement}" in ${filePath} (${found} total occurrences found)`;
    },

    // ── 2. ENCLOSE RANGE ───────────────────────────────────────────────────────
    // Insert a custom opening line before and/or a closing line after a range.
    // Perfect for wrapping a block in try { } catch { }, if ( ) { }, a JSDoc
    // comment, or any other structural wrapper — without touching the content.
    enclose_range: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const opening = params.opening ?? null;
      const closing = params.closing ?? null;
      if (!opening && !closing) throw new Error('Provide at least one of: opening, closing.');

      const indentBody = params.indent_body === true;
      const indentAmount = params.indent_amount ?? 2;

      onStage(`📦 Enclosing lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      // Optionally indent body lines
      if (indentBody) {
        const pad = ' '.repeat(indentAmount);
        for (let i = s; i < e; i++) lines[i] = pad + lines[i];
      }

      // Insert closing first (higher index) so the opening splice doesn't shift it
      if (closing) lines.splice(e, 0, closing);
      if (opening) lines.splice(s, 0, opening);

      await ipcWriteFile(filePath, joinLines(lines));

      const inserted = (opening ? 1 : 0) + (closing ? 1 : 0);
      return `✅ Enclosed lines ${start_line}–${end_line} in ${filePath} (+${inserted} wrapper line${inserted !== 1 ? 's' : ''})${indentBody ? `, body indented ${indentAmount} spaces` : ''}`;
    },

    // ── 3. ADD IMPORT STATEMENT ────────────────────────────────────────────────
    // Insert an import/from/require line into a file at the right position,
    // skipping silently if an identical or equivalent statement already exists.
    add_import_statement: async (params, onStage) => {
      const { path: filePath, statement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!statement?.trim()) throw new Error('Missing required param: statement');

      const skipIfPresent = params.skip_if_present !== false;
      const position = (params.position ?? 'auto').toLowerCase();

      onStage(`📥 Adding import to ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      // Check for duplicates
      const normalised = statement.trim();
      if (skipIfPresent && lines.some((l) => l.trim() === normalised)) {
        return `Import already present in ${filePath} — no change made.\n  Found: ${normalised}`;
      }

      // Find the last import line to insert after it ('auto' mode)
      let insertAt = 0;
      if (position === 'auto' || position === 'after_imports') {
        for (let i = 0; i < lines.length; i++) {
          const t = lines[i].trim();
          if (
            t.startsWith('import ') ||
            t.startsWith('from ') ||
            /^(?:const|let|var)\s+\S+\s*=\s*require\(/.test(t)
          ) {
            insertAt = i + 1;
          } else if (insertAt > 0 && t !== '') {
            break; // First non-import non-blank line after imports found
          }
        }
      } else if (position === 'top') {
        insertAt = 0;
      } else if (position === 'bottom') {
        insertAt = lines.length;
      }

      lines.splice(insertAt, 0, normalised);
      await ipcWriteFile(filePath, joinLines(lines));

      return `✅ Added import at line ${insertAt + 1} in ${filePath}:\n  ${normalised}`;
    },

    // ── 4. REMOVE IMPORT STATEMENT ─────────────────────────────────────────────
    // Delete every import/require line that references a specific module name.
    // Handles named imports, default imports, namespace imports, and require().
    remove_import_statement: async (params, onStage) => {
      const { path: filePath, module: moduleName } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!moduleName?.trim()) throw new Error('Missing required param: module');

      onStage(`📤 Removing imports of "${moduleName}" from ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const importRe = new RegExp(
        `(?:^import\\s.*?['"` +
          '`' +
          `]${escaped}['"` +
          '`' +
          `]|^(?:const|let|var)\\s+\\S.*?require\\(['"` +
          '`' +
          `]${escaped}['"` +
          '`' +
          `]\\))`,
        'i',
      );

      const kept = lines.filter((l) => !importRe.test(l.trim()));
      const removed = totalLines - kept.length;

      if (!removed) return `No import of "${moduleName}" found in ${filePath} — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(kept));
      return `✅ Removed ${removed} import line${removed !== 1 ? 's' : ''} referencing "${moduleName}" from ${filePath}`;
    },

    // ── 5. SORT IMPORTS ────────────────────────────────────────────────────────
    // Alphabetically sort all import/require lines at the top of a file.
    // Groups are preserved: external packages, then relative paths (or vice versa).
    sort_imports: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const groupByType = params.group_by_type !== false;
      const descending = params.descending === true;

      onStage(`🔤 Sorting imports in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      // Collect the leading import block
      const importRe = /^(?:import\s|from\s|(?:const|let|var)\s+\S.*?=\s*require\()/;
      let importEnd = 0;
      for (let i = 0; i < lines.length; i++) {
        if (importRe.test(lines[i].trim()) || lines[i].trim() === '') {
          if (importRe.test(lines[i].trim())) importEnd = i + 1;
        } else if (importEnd > 0) {
          break;
        }
      }

      if (!importEnd) return `No import statements detected at the top of ${filePath}.`;

      const importLines = lines.slice(0, importEnd).filter((l) => importRe.test(l.trim()));
      const blanks = lines.slice(0, importEnd).filter((l) => !importRe.test(l.trim()));
      const rest = lines.slice(importEnd);

      let sorted;
      if (groupByType) {
        const external = importLines
          .filter((l) => !l.includes("'./") && !l.includes("'../") && !l.includes('"./'))
          .sort((a, b) => (descending ? b.localeCompare(a) : a.localeCompare(b)));
        const internal = importLines
          .filter(
            (l) =>
              l.includes("'./") || l.includes("'../") || l.includes('"./') || l.includes('"../'),
          )
          .sort((a, b) => (descending ? b.localeCompare(a) : a.localeCompare(b)));
        sorted = [...external, ...(external.length && internal.length ? [''] : []), ...internal];
      } else {
        sorted = [...importLines].sort((a, b) =>
          descending ? b.localeCompare(a) : a.localeCompare(b),
        );
      }

      const newLines = [...sorted, '', ...rest];
      await ipcWriteFile(filePath, joinLines(newLines));

      return `✅ Sorted ${importLines.length} import${importLines.length !== 1 ? 's' : ''} ${descending ? 'descending' : 'ascending'}${groupByType ? ' (external then internal)' : ''} in ${filePath}`;
    },

    // ── 6. INDENT TO LEVEL ─────────────────────────────────────────────────────
    // Set the absolute indentation of every line in a range to exactly N spaces
    // (or N tabs), regardless of current indentation. Unlike indent_lines, which
    // adds/subtracts relative to existing indent, this sets an exact level.
    indent_to_level: async (params, onStage) => {
      const { path: filePath, start_line, end_line, level } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (level == null) throw new Error('Missing required param: level');
      if (level < 0) throw new Error('level must be 0 or greater');

      const useTabs = params.use_tabs === true;
      const spacesPerLevel = params.spaces_per_level ?? 2;
      const skipBlank = params.skip_blank_lines !== false;

      const unit = useTabs ? '\t'.repeat(level) : ' '.repeat(level * spacesPerLevel);

      onStage(
        `⇥ Setting indentation to level ${level} on lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      let changed = 0;

      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        const stripped = lines[i].trimStart();
        const newLine = unit + stripped;
        if (newLine !== lines[i]) {
          lines[i] = newLine;
          changed++;
        }
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Set indentation to level ${level} (${useTabs ? `${level} tab${level !== 1 ? 's' : ''}` : `${level * spacesPerLevel} space${level * spacesPerLevel !== 1 ? 's' : ''}`}) on ${changed} line${changed !== 1 ? 's' : ''} in ${filePath}`;
    },

    // ── 7. APPLY LINE TEMPLATE ─────────────────────────────────────────────────
    // Transform every line in a range through a template string that uses
    // `{line}` as a placeholder for the original line content.
    // Examples: 'console.log({line})', '"{line}",' , `<li>{line}</li>`.
    apply_line_template: async (params, onStage) => {
      const { path: filePath, start_line, end_line, template } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (!template) throw new Error('Missing required param: template');
      if (!template.includes('{line}'))
        throw new Error('template must contain the {line} placeholder');

      const skipBlank = params.skip_blank_lines !== false;
      const trimLine = params.trim_line === true;

      onStage(`🔧 Applying template to lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      let changed = 0;

      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        const lineContent = trimLine ? lines[i].trim() : lines[i];
        lines[i] = template.replace(/\{line\}/g, lineContent);
        changed++;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Applied template to ${changed} line${changed !== 1 ? 's' : ''} in ${filePath}\n  Template: ${template}`;
    },

    // ── 8. CONDITIONAL REPLACE ─────────────────────────────────────────────────
    // Replace a pattern only on lines that ALSO match a guard condition.
    // Example: replace `foo` with `bar` but only on lines that also contain
    // `async` — avoiding accidental changes elsewhere in the file.
    conditional_replace: async (params, onStage) => {
      const { path: filePath, guard_pattern, search, replace } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!guard_pattern?.trim()) throw new Error('Missing required param: guard_pattern');
      if (!search?.trim()) throw new Error('Missing required param: search');
      if (replace == null) throw new Error('Missing required param: replace');

      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;
      const replaceAll = params.replace_all !== false;
      const invertGuard = params.invert_guard === true;

      onStage(`🎯 Conditional replace in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const makeRe = (p, flags) =>
        useRegex
          ? new RegExp(p, flags)
          : new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);

      const flags = (caseSensitive ? '' : 'i') + (replaceAll ? 'g' : '');
      let guardRe, searchRe;
      try {
        guardRe = makeRe(guard_pattern, caseSensitive ? '' : 'i');
        searchRe = makeRe(search, flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      let changedLines = 0;
      let totalReplacements = 0;

      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;

      for (let i = s; i < e; i++) {
        const guardMatches = guardRe.test(lines[i]);
        if (invertGuard ? guardMatches : !guardMatches) continue;

        const matches = lines[i].match(
          new RegExp(searchRe.source, 'g' + (caseSensitive ? '' : 'i')),
        );
        if (!matches) continue;

        lines[i] = lines[i].replace(searchRe, replace);
        changedLines++;
        totalReplacements += matches.length;
      }

      if (!changedLines) return `No lines matched both guard and search pattern — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Replaced ${totalReplacements} occurrence${totalReplacements !== 1 ? 's' : ''} of "${search}" → "${replace}" across ${changedLines} qualifying line${changedLines !== 1 ? 's' : ''} in ${filePath}\n  Guard: ${invertGuard ? 'NOT ' : ''}"${guard_pattern}"`;
    },

    // ── 9. DELETE NTH OCCURRENCE ───────────────────────────────────────────────
    // Remove only the Nth match of a pattern from the file, leaving all other
    // occurrences intact. Useful when a specific duplicate needs removing.
    delete_nth_occurrence: async (params, onStage) => {
      const { path: filePath, pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');

      const n = Math.max(1, params.n ?? 1);
      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;
      const deleteWholeLine = params.delete_whole_line === true;

      onStage(`🗑️ Deleting occurrence #${n} of "${pattern}" in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const flags = caseSensitive ? 'g' : 'gi';
      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, flags)
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }

      if (deleteWholeLine) {
        // Delete the entire line containing the Nth match
        let found = 0;
        let targetLine = -1;
        for (let i = 0; i < lines.length; i++) {
          regex.lastIndex = 0;
          if (regex.test(lines[i])) {
            found++;
            if (found === n) {
              targetLine = i;
              break;
            }
          }
        }
        if (targetLine === -1) {
          return `Occurrence #${n} not found (total: ${found}) — file unchanged.`;
        }
        lines.splice(targetLine, 1);
        await ipcWriteFile(filePath, joinLines(lines));
        return `✅ Deleted line ${targetLine + 1} (occurrence #${n} of "${pattern}") from ${filePath}`;
      } else {
        // Delete only the matched text within the line
        let found = 0;
        let deleted = false;
        const updated = content.replace(regex, (match) => {
          found++;
          if (found === n) {
            deleted = true;
            return '';
          }
          return match;
        });
        if (!deleted) return `Occurrence #${n} not found (total: ${found}) — file unchanged.`;
        await ipcWriteFile(filePath, updated);
        return `✅ Deleted occurrence #${n} of "${pattern}" in ${filePath} (${found} total occurrences)`;
      }
    },

    // ── 10. SET LINE ENDINGS ───────────────────────────────────────────────────
    // Explicitly convert all line endings in a file to LF (\n), CRLF (\r\n),
    // or CR (\r). More targeted than normalize_file, which also trims whitespace
    // and strips BOM.
    set_line_endings: async (params, onStage) => {
      const { path: filePath, style } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!style?.trim()) throw new Error('Missing required param: style (lf | crlf | cr)');

      const normalised = style.toLowerCase().replace('-', '');
      if (!['lf', 'crlf', 'cr'].includes(normalised)) {
        throw new Error('style must be "lf", "crlf", or "cr"');
      }

      onStage(`↵ Converting line endings to ${normalised.toUpperCase()} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);

      // Strip all existing endings first
      const stripped = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
      const eol = normalised === 'crlf' ? '\r\n' : normalised === 'cr' ? '\r' : '\n';
      const converted = stripped.replace(/\n/g, eol);

      if (converted === content) {
        return `File already uses ${normalised.toUpperCase()} line endings — no change made.`;
      }

      await ipcWriteFile(filePath, converted);
      const lineCount = stripped.split('\n').length;
      return `✅ Converted ${lineCount} line${lineCount !== 1 ? 's' : ''} to ${normalised.toUpperCase()} endings in ${filePath}`;
    },

    // ── 11. STRIP LINE PREFIX ──────────────────────────────────────────────────
    // Remove a fixed prefix string from the start of every line in a range.
    // Useful for un-quoting, removing numbering like "1. ", stripping log
    // prefixes like "[INFO] ", or reversing a previous wrap_lines operation.
    strip_line_prefix: async (params, onStage) => {
      const { path: filePath, start_line, end_line, prefix } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (!prefix) throw new Error('Missing required param: prefix');

      const skipIfAbsent = params.skip_if_absent !== false;
      const useRegex = params.regex === true;

      onStage(
        `✂️ Stripping prefix "${prefix}" from lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      let changed = 0;
      let skipped = 0;

      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const prefixRe = useRegex ? new RegExp(`^${prefix}`) : new RegExp(`^${escaped}`);

      for (let i = s; i < e; i++) {
        if (prefixRe.test(lines[i])) {
          lines[i] = lines[i].replace(prefixRe, '');
          changed++;
        } else {
          skipped++;
        }
      }

      if (!changed)
        return `Prefix "${prefix}" not found at the start of any line in the range — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Stripped prefix "${prefix}" from ${changed} line${changed !== 1 ? 's' : ''} (${skipped} line${skipped !== 1 ? 's' : ''} skipped — prefix absent) in ${filePath}`;
    },

    // ── 12. NUMBER LINES IN RANGE ──────────────────────────────────────────────
    // Prefix each line in a range with a sequential number, formatted to a
    // consistent width. Great for generating numbered lists, debugging output,
    // or producing enumerated reference material.
    number_lines_in_range: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const startNum = params.start_number ?? 1;
      const separator = params.separator ?? '. ';
      const padWidth = params.pad_width ?? 0; // 0 = auto
      const skipBlank = params.skip_blank_lines === true;

      onStage(`🔢 Numbering lines ${start_line}–${end_line} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      const blockSize = e - s;
      const maxNum = startNum + blockSize - 1;
      const width = padWidth || String(maxNum).length;

      let counter = startNum;
      let numbered = 0;

      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) {
          counter++;
          continue;
        }
        lines[i] = `${String(counter).padStart(width, '0')}${separator}${lines[i]}`;
        counter++;
        numbered++;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Numbered ${numbered} line${numbered !== 1 ? 's' : ''} (${start_line}–${end_line}, starting at ${startNum}) in ${filePath}`;
    },

    // ── 13. BULK LINE INSERT ───────────────────────────────────────────────────
    // Insert the same content block at multiple specific line positions in one
    // call. Avoids making many sequential insert_into_file calls when you need
    // to inject a blank line, a separator, or a debug statement at known spots.
    bulk_line_insert: async (params, onStage) => {
      const { path: filePath, line_numbers: rawNums, content: insertContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!rawNums?.trim())
        throw new Error('Missing required param: line_numbers (comma-separated)');
      if (insertContent == null) throw new Error('Missing required param: content');

      const position = (params.position ?? 'before').toLowerCase();
      const unique = params.deduplicate !== false;

      let lineNums;
      try {
        lineNums = rawNums.split(',').map((n) => {
          const v = parseInt(n.trim(), 10);
          if (isNaN(v) || v < 1) throw new Error(`Invalid line number: "${n.trim()}"`);
          return v;
        });
      } catch (e) {
        throw new Error(`line_numbers parse error: ${e.message}`);
      }

      if (unique) lineNums = [...new Set(lineNums)];
      lineNums.sort((a, b) => a - b);

      onStage(
        `📍 Inserting at ${lineNums.length} position${lineNums.length !== 1 ? 's' : ''} in ${filePath}`,
      );
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const insertLines = splitLines(insertContent);
      let offset = 0;

      for (const lineNum of lineNums) {
        const clamped = Math.max(1, Math.min(lineNum, totalLines));
        const idx = clamped - 1 + offset;
        const insertAt = position === 'after' ? idx + 1 : idx;
        lines.splice(insertAt, 0, ...insertLines);
        offset += insertLines.length;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Inserted ${insertLines.length} line${insertLines.length !== 1 ? 's' : ''} at ${lineNums.length} position${lineNums.length !== 1 ? 's' : ''} (${position}) in ${filePath}\n  Positions: ${lineNums.join(', ')}`;
    },

    // ── 14. INVERT BOOLEAN VALUES ──────────────────────────────────────────────
    // Toggle boolean-like literals in a range: true↔false, yes↔no, on↔off,
    // 0↔1, True↔False, YES↔NO. Preserves original casing style.
    invert_boolean_values: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      const pairs = params.pairs
        ? JSON.parse(params.pairs)
        : [
            ['true', 'false'],
            ['True', 'False'],
            ['TRUE', 'FALSE'],
            ['yes', 'no'],
            ['Yes', 'No'],
            ['YES', 'NO'],
            ['on', 'off'],
            ['On', 'Off'],
            ['ON', 'OFF'],
            ['enabled', 'disabled'],
            ['Enabled', 'Disabled'],
          ];

      // Include 0↔1 only if explicitly requested (to avoid touching port numbers etc.)
      if (params.include_numeric) pairs.push(['0', '1']);

      onStage(`🔀 Inverting boolean values in lines ${start_line}–${end_line} of ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      // Build a combined regex from all pairs
      const allTokens = pairs.flatMap(([a, b]) => [a, b]);
      const escaped = allTokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const combinedRe = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g');

      // Build fast lookup: value → its opposite
      const flipMap = {};
      for (const [a, b] of pairs) {
        flipMap[a] = b;
        flipMap[b] = a;
      }

      let changedLines = 0;
      let totalFlips = 0;

      for (let i = s; i < e; i++) {
        const original = lines[i];
        const result = original.replace(combinedRe, (match) => flipMap[match] ?? match);
        if (result !== original) {
          const flips = (original.match(combinedRe) || []).length;
          totalFlips += flips;
          changedLines++;
          lines[i] = result;
        }
      }

      if (!changedLines)
        return `No boolean values found to invert in the specified range — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Inverted ${totalFlips} boolean value${totalFlips !== 1 ? 's' : ''} across ${changedLines} line${changedLines !== 1 ? 's' : ''} in ${filePath}`;
    },

    // ── 15. MOVE SECTION TO MARKER ─────────────────────────────────────────────
    // Cut all content between two markers and paste it at a third destination
    // marker — in a single atomic operation. Useful for reorganising config
    // sections, reordering class methods, or shuffling documentation blocks.
    move_section_to_marker: async (params, onStage) => {
      const { path: filePath, start_marker, end_marker, destination_marker } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');
      if (!destination_marker?.trim())
        throw new Error('Missing required param: destination_marker');

      const preserveMarkers = params.preserve_markers !== false;
      const destPosition = (params.destination_position ?? 'after').toLowerCase();

      onStage(`✂️ Moving section between markers in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      // Find source block
      let srcStart = -1,
        srcEnd = -1;
      for (let i = 0; i < lines.length; i++) {
        if (srcStart === -1 && lines[i].includes(start_marker)) {
          srcStart = i;
          continue;
        }
        if (srcStart !== -1 && srcEnd === -1 && lines[i].includes(end_marker)) {
          srcEnd = i;
          break;
        }
      }
      if (srcStart === -1) throw new Error(`start_marker "${start_marker}" not found.`);
      if (srcEnd === -1)
        throw new Error(`end_marker "${end_marker}" not found after start_marker.`);

      // Extract block (inclusive or exclusive of markers)
      const cutFrom = preserveMarkers ? srcStart + 1 : srcStart;
      const cutTo = preserveMarkers ? srcEnd : srcEnd + 1;
      const block = lines.splice(cutFrom, cutTo - cutFrom);

      // Find destination marker in the (now shorter) array
      const destIdx = lines.findIndex((l) => l.includes(destination_marker));
      if (destIdx === -1) throw new Error(`destination_marker "${destination_marker}" not found.`);

      const insertAt = destPosition === 'before' ? destIdx : destIdx + 1;
      lines.splice(insertAt, 0, ...block);

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Moved ${block.length} line${block.length !== 1 ? 's' : ''} from between "${start_marker}" / "${end_marker}" to ${destPosition} "${destination_marker}" in ${filePath}`;
    },

    // ── 16. REPEAT LINES ───────────────────────────────────────────────────────
    // Duplicate each line in a range N times, inserting copies immediately
    // after the original. Unlike duplicate_lines (which copies the whole block
    // once), this repeats every individual line separately.
    repeat_lines: async (params, onStage) => {
      const { path: filePath, start_line, end_line, count } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (count == null) throw new Error('Missing required param: count');
      if (count < 1) throw new Error('count must be at least 1');
      if (count > 20) throw new Error('count capped at 20 to prevent runaway file growth');

      const skipBlank = params.skip_blank_lines === true;

      onStage(`📋 Repeating each line in ${start_line}–${end_line} × ${count} in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      // Build the new range in reverse insertion order
      const insertions = [];
      for (let i = e - 1; i >= s; i--) {
        if (skipBlank && !lines[i].trim()) continue;
        // Insert (count) copies after position i
        const copies = Array.from({ length: count }, () => lines[i]);
        insertions.push({ at: i + 1, lines: copies });
      }

      let totalAdded = 0;
      for (const ins of insertions) {
        lines.splice(ins.at, 0, ...ins.lines);
        totalAdded += ins.lines.length;
      }

      await ipcWriteFile(filePath, joinLines(lines));
      const origCount = e - s;
      return `✅ Repeated ${origCount} line${origCount !== 1 ? 's' : ''} × ${count} (+${totalAdded} new lines) in ${filePath}`;
    },

    // ── 17. SURROUND WITH BLOCK COMMENT ───────────────────────────────────────
    // Wrap a line range with language-appropriate block comment delimiters.
    // Auto-detects the correct delimiters from the file extension
    // (/* */ for JS/CSS, <!-- --> for HTML, {# #} for templates, etc.).
    surround_with_block_comment: async (params, onStage) => {
      const { path: filePath, start_line, end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');

      // Block comment delimiters per extension
      const ext = filePath.split('.').pop().toLowerCase();
      const BLOCK_MAP = {
        js: ['/*', '*/'],
        jsx: ['/*', '*/'],
        ts: ['/*', '*/'],
        tsx: ['/*', '*/'],
        java: ['/*', '*/'],
        cs: ['/*', '*/'],
        c: ['/*', '*/'],
        cpp: ['/*', '*/'],
        go: ['/*', '*/'],
        kt: ['/*', '*/'],
        rs: ['/*', '*/'],
        swift: ['/*', '*/'],
        css: ['/*', '*/'],
        scss: ['/*', '*/'],
        less: ['/*', '*/'],
        php: ['/*', '*/'],
        html: ['<!--', '-->'],
        xml: ['<!--', '-->'],
        svg: ['<!--', '-->'],
        vue: ['<!--', '-->'],
        hbs: ['{{!--', '--}}'],
        njk: ['{#', '#}'],
        py: ['"""', '"""'],
        rb: ['=begin', '=end'],
        sql: ['/*', '*/'],
        lua: ['--[[', ']]'],
      };

      const [open, close] =
        params.open_delimiter && params.close_delimiter
          ? [params.open_delimiter, params.close_delimiter]
          : (BLOCK_MAP[ext] ?? ['/*', '*/']);

      const label = params.label?.trim() || '';
      const labelSuffix = label ? ` ${label}` : '';

      onStage(`💬 Surrounding lines ${start_line}–${end_line} with block comment in ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      lines.splice(e, 0, close + labelSuffix);
      lines.splice(s, 0, open + labelSuffix);

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Surrounded lines ${start_line}–${end_line} with ${open}…${close} in ${filePath}`;
    },

    // ── 18. COPY RANGE TO POSITION ─────────────────────────────────────────────
    // Copy a line range and insert the copy at a different position in the same
    // file. Unlike duplicate_lines (which inserts immediately after the block)
    // or move_lines (which cuts), this leaves the source intact and places a
    // copy at an arbitrary target line.
    copy_range_to_position: async (params, onStage) => {
      const { path: filePath, start_line, end_line, target_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (target_line == null) throw new Error('Missing required param: target_line');

      const position = (params.position ?? 'before').toLowerCase();

      onStage(
        `📋 Copying lines ${start_line}–${end_line} to position ${target_line} in ${filePath}`,
      );
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);
      const t = Math.max(1, Math.min(target_line, totalLines)) - 1;

      const block = lines.slice(s, e);
      const insertAt = position === 'after' ? t + 1 : t;

      // Adjust for the fact that if target is after source, nothing shifts
      lines.splice(insertAt, 0, ...block);

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Copied ${block.length} line${block.length !== 1 ? 's' : ''} (${start_line}–${end_line}) to ${position} line ${target_line} in ${filePath}\n  Source range preserved.`;
    },

    // ── 19. OVERWRITE MATCHING LINES ───────────────────────────────────────────
    // Replace the ENTIRE content of every line that matches a pattern with a
    // fixed replacement string. Different from find_replace_regex (which
    // replaces only the matched portion) — this nukes the whole line.
    overwrite_matching_lines: async (params, onStage) => {
      const { path: filePath, pattern, replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (replacement == null) throw new Error('Missing required param: replacement');

      const useRegex = params.regex === true;
      const caseSensitive = params.case_sensitive === true;

      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;

      onStage(`✏️ Overwriting lines matching "${pattern}" in ${filePath}`);
      const { content, totalLines } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      let regex;
      try {
        regex = useRegex
          ? new RegExp(pattern, caseSensitive ? '' : 'i')
          : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), caseSensitive ? '' : 'i');
      } catch (e) {
        throw new Error(`Invalid pattern: ${e.message}`);
      }

      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;
      let changed = 0;

      for (let i = s; i < e; i++) {
        if (regex.test(lines[i])) {
          lines[i] = replacement;
          changed++;
        }
      }

      if (!changed) return `No lines matched "${pattern}" in ${filePath} — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Overwrote ${changed} of ${totalLines} lines matching "${pattern}" with "${replacement.slice(0, 60)}${replacement.length > 60 ? '…' : ''}" in ${filePath}`;
    },

    // ── 20. REMOVE TRAILING CHARS ──────────────────────────────────────────────
    // Strip specific trailing characters (commas, semicolons, periods, colons,
    // brackets, etc.) from the end of every line in a range. Useful for
    // cleaning up lists, fixing trailing commas after refactoring, or
    // normalising line endings before a transform.
    remove_trailing_chars: async (params, onStage) => {
      const { path: filePath, start_line, end_line, chars } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (!chars) throw new Error('Missing required param: chars');

      const skipBlank = params.skip_blank_lines !== false;
      const greedy = params.greedy === true; // remove ALL trailing occurrences vs just one

      onStage(
        `✂️ Removing trailing "${chars}" from lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      const s = Math.max(1, start_line) - 1;
      const e = Math.min(end_line, lines.length);

      const escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const trailingRe = new RegExp(`(?:${escaped})${greedy ? '+' : ''}$`);

      let changed = 0;
      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        const trimmed = lines[i].replace(trailingRe, '');
        if (trimmed !== lines[i]) {
          lines[i] = trimmed;
          changed++;
        }
      }

      if (!changed) return `No lines in the range ended with "${chars}" — file unchanged.`;

      await ipcWriteFile(filePath, joinLines(lines));
      return `✅ Removed trailing "${chars}" from ${changed} line${changed !== 1 ? 's' : ''} (lines ${start_line}–${end_line}) in ${filePath}`;
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // 20 NEW REPO-INTELLIGENCE TOOL HANDLERS
    // Add these inside the `handlers: { ... }` object in Executor.js,
    // after the last existing handler (remove_trailing_chars).
    // Also add each tool name to the `tools: [...]` array in createExecutor.
    // ─────────────────────────────────────────────────────────────────────────────

    // ── 1. GET_GIT_LOG ─────────────────────────────────────────────────────────────
    // Fetches recent commit history with author, date, and message. Gives the AI
    // immediate temporal context: what changed recently, who owns what, and
    // whether a bug was introduced in a recent commit.
    get_git_log: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      const limit = params.limit ?? 20;
      const branch = params.branch ?? '';
      const filePath = params.file_path ?? '';
      const format = '%h|%an|%ar|%s'; // short hash | author | relative date | subject

      const fileArg = filePath ? `-- "${filePath}"` : '';
      const branchArg = branch ? branch : '';
      const command =
        `git log --pretty=format:"${format}" -n ${limit} ${branchArg} ${fileArg}`.trim();

      onStage(`🕒 Fetching git log in ${workingDirectory}`);
      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command,
        cwd: workingDirectory,
        timeout: 15000,
        allowRisky: false,
      });

      if (!result?.ok || !result.stdout?.trim())
        return `No git history found${filePath ? ` for ${filePath}` : ''}.`;

      const commits = result.stdout
        .trim()
        .split('\n')
        .map((line) => {
          const [hash, author, when, ...msgParts] = line.split('|');
          return { hash, author, when, message: msgParts.join('|') };
        });

      const lines = [
        `Git log: ${workingDirectory}${filePath ? ` — ${filePath}` : ''}${branch ? ` (${branch})` : ''}`,
        `Showing ${commits.length} most recent commit${commits.length !== 1 ? 's' : ''}`,
        '',
        ...commits.map(
          (c) => `  ${c.hash}  ${c.when.padEnd(14)}  ${c.author.padEnd(20)}  ${c.message}`,
        ),
      ];

      return lines.join('\n');
    },

    // ── 2. GET_GIT_BLAME ──────────────────────────────────────────────────────────
    // Shows who last changed each line of a file and when. Lets the AI identify
    // the original author of a bug, understand ownership, and determine if code
    // is ancient legacy or recently introduced.
    get_git_blame: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      const startLine = params.start_line;
      const endLine = params.end_line;
      const lineArg =
        startLine && endLine
          ? `-L ${startLine},${endLine}`
          : startLine
            ? `-L ${startLine},+30`
            : '';

      onStage(`🔍 Running git blame on ${filePath}`);
      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git blame --porcelain ${lineArg} "${filePath}"`,
        cwd: workingDirectory,
        timeout: 20000,
        allowRisky: false,
      });

      if (!result?.ok || !result.stdout?.trim())
        return `Could not run git blame on ${filePath}. Ensure the file is tracked by git.`;

      // Parse porcelain format
      const authorsByHash = {};
      const lineMap = [];
      const blameLines = result.stdout.split('\n');

      let currentHash = null;
      for (const line of blameLines) {
        if (/^[0-9a-f]{40}/.test(line)) {
          const parts = line.split(' ');
          currentHash = parts[0].slice(0, 8);
          const lineNum = parseInt(parts[2], 10);
          if (!isNaN(lineNum)) lineMap.push({ hash: currentHash, lineNum, text: '' });
        } else if (line.startsWith('author ') && currentHash) {
          if (!authorsByHash[currentHash]) authorsByHash[currentHash] = {};
          authorsByHash[currentHash].author = line.slice(7).trim();
        } else if (line.startsWith('author-time ') && currentHash) {
          const ts = parseInt(line.slice(12), 10);
          const date = new Date(ts * 1000).toISOString().slice(0, 10);
          if (authorsByHash[currentHash]) authorsByHash[currentHash].date = date;
        } else if (line.startsWith('\t') && lineMap.length) {
          lineMap[lineMap.length - 1].text = line.slice(1);
        }
      }

      if (!lineMap.length) return `No blame data parsed for ${filePath}.`;

      // Find unique authors
      const authorSet = new Set(
        Object.values(authorsByHash)
          .map((a) => a.author)
          .filter(Boolean),
      );

      const output = [
        `Git blame: ${filePath}`,
        `${lineMap.length} line${lineMap.length !== 1 ? 's' : ''} | Authors: ${[...authorSet].join(', ')}`,
        '',
      ];

      for (const entry of lineMap) {
        const info = authorsByHash[entry.hash] || {};
        const author = (info.author || 'unknown').slice(0, 16).padEnd(16);
        const date = (info.date || '??????????').padEnd(11);
        output.push(
          `  ${String(entry.lineNum).padStart(5)}  ${entry.hash}  ${date}  ${author}  ${entry.text.slice(0, 80)}`,
        );
      }

      return output.join('\n');
    },

    // ── 3. FIND_CIRCULAR_DEPENDENCIES ─────────────────────────────────────────────
    // Detects circular import chains in a JS/TS workspace by building a directed
    // graph of imports and running DFS cycle detection. Circular deps cause subtle
    // runtime bugs and are hard to spot manually.
    find_circular_dependencies: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      const extensions = (params.extensions ?? 'js,ts,jsx,tsx')
        .split(',')
        .map((e) => e.trim().replace(/^\./, '').toLowerCase());

      onStage(`🔄 Building import graph in ${rootPath}`);

      const extPatterns = extensions.map((e) => `-name "*.${e}"`).join(' -o ');
      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*"`,
        cwd: rootPath,
        timeout: 20000,
        allowRisky: false,
      });

      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No source files found in ${rootPath}.`;

      const files = listResult.stdout.trim().split('\n').filter(Boolean).slice(0, 300);
      onStage(`Scanning ${files.length} files for import graph…`);

      // Build adjacency map: filePath → Set<resolvedFilePath>
      const graph = {};
      const importRe =
        /(?:^import\s+.*?from\s+|^(?:const|let|var)\s+\S+\s*=\s*require\s*\(\s*)['"`](\.\.?\/[^'"`]+)['"`]/gm;

      const resolveImport = (fromFile, importPath) => {
        const dir = fromFile.split('/').slice(0, -1).join('/');
        let resolved = dir + '/' + importPath;
        // Normalise ../ and ./
        const parts = resolved.split('/');
        const stack = [];
        for (const p of parts) {
          if (p === '..') stack.pop();
          else if (p !== '.') stack.push(p);
        }
        resolved = stack.join('/');
        // Try to find actual file with extension
        for (const ext of extensions) {
          if (files.includes(resolved + '.' + ext)) return resolved + '.' + ext;
          if (files.includes(resolved + '/index.' + ext)) return resolved + '/index.' + ext;
        }
        return files.find((f) => f.startsWith(resolved)) ?? null;
      };

      for (const fp of files) {
        try {
          const { content } = await ipcReadFile(fp);
          graph[fp] = new Set();
          let m;
          importRe.lastIndex = 0;
          while ((m = importRe.exec(content)) !== null) {
            const resolved = resolveImport(fp, m[1]);
            if (resolved && resolved !== fp) graph[fp].add(resolved);
          }
        } catch {
          graph[fp] = new Set();
        }
      }

      // DFS cycle detection
      const cycles = [];
      const visited = new Set();
      const inStack = new Set();

      const dfs = (node, path) => {
        if (inStack.has(node)) {
          const cycleStart = path.indexOf(node);
          cycles.push(path.slice(cycleStart).concat(node));
          return;
        }
        if (visited.has(node)) return;
        visited.add(node);
        inStack.add(node);
        for (const neighbor of graph[node] ?? []) {
          dfs(neighbor, [...path, node]);
        }
        inStack.delete(node);
      };

      for (const file of files) dfs(file, []);

      if (!cycles.length)
        return `✅ No circular dependencies found in ${rootPath} (${files.length} files scanned).`;

      // Deduplicate cycles (same set of nodes, different entry point)
      const seen = new Set();
      const unique = cycles.filter((c) => {
        const key = [...c].sort().join('|');
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      const shorten = (p) => p.replace(rootPath + '/', '');

      const output = [
        `Circular dependencies in ${rootPath}:`,
        `${unique.length} cycle${unique.length !== 1 ? 's' : ''} found across ${files.length} files`,
        '',
      ];

      for (let i = 0; i < Math.min(unique.length, 20); i++) {
        const cycle = unique[i];
        output.push(`### Cycle ${i + 1} (${cycle.length - 1} hop${cycle.length > 2 ? 's' : ''})`);
        for (let j = 0; j < cycle.length; j++) {
          const arrow = j < cycle.length - 1 ? ' →' : ' ← (back to start)';
          output.push(`  ${shorten(cycle[j])}${arrow}`);
        }
        output.push('');
      }
      if (unique.length > 20) output.push(`… +${unique.length - 20} more cycles`);

      return output.join('\n');
    },

    // ── 4. FIND_TEST_COVERAGE_GAPS ────────────────────────────────────────────────
    // Finds source files that have no corresponding test file anywhere in the
    // workspace. Lets the AI immediately know which modules lack test coverage
    // before writing, refactoring, or debugging code.
    find_test_coverage_gaps: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      const extensions = (params.extensions ?? 'js,ts,jsx,tsx,py')
        .split(',')
        .map((e) => e.trim().replace(/^\./, '').toLowerCase());
      const testPatterns = (params.test_patterns ?? '.test.,.spec.,_test.,test_')
        .split(',')
        .map((p) => p.trim());

      onStage(`🧪 Mapping test coverage gaps in ${rootPath}`);

      const extPat = extensions.map((e) => `-name "*.${e}"`).join(' -o ');
      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( ${extPat} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*"`,
        cwd: rootPath,
        timeout: 20000,
        allowRisky: false,
      });

      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No source files found in ${rootPath}.`;

      const allFiles = listResult.stdout.trim().split('\n').filter(Boolean);
      const testFiles = allFiles.filter((f) => testPatterns.some((p) => f.includes(p)));
      const sourceFiles = allFiles.filter((f) => !testPatterns.some((p) => f.includes(p)));

      // For each source file, check if a test file referencing its base name exists
      const testFileBasenames = new Set(
        testFiles.map((f) => {
          const base = f.split('/').pop();
          return base
            .replace(/\.(test|spec|_test)\.[^.]+$/, '')
            .replace(/\.[^.]+$/, '')
            .toLowerCase();
        }),
      );

      const untested = [];
      const tested = [];

      for (const sf of sourceFiles) {
        const base = sf
          .split('/')
          .pop()
          .replace(/\.[^.]+$/, '')
          .toLowerCase();
        // Also check if a __tests__ folder or test/ folder has anything with the same base
        const hasTest =
          testFileBasenames.has(base) || testFiles.some((t) => t.toLowerCase().includes(base));
        if (hasTest) tested.push(sf);
        else untested.push(sf);
      }

      const pct =
        sourceFiles.length > 0 ? Math.round((tested.length / sourceFiles.length) * 100) : 0;

      const shorten = (p) => p.replace(rootPath + '/', '');

      // Group untested by directory
      const byDir = {};
      for (const f of untested) {
        const dir =
          f
            .replace(rootPath + '/', '')
            .split('/')
            .slice(0, -1)
            .join('/') || '.';
        (byDir[dir] = byDir[dir] || []).push(f);
      }

      const output = [
        `Test coverage gap analysis: ${rootPath}`,
        `Source files: ${sourceFiles.length} | With tests: ${tested.length} | Without tests: ${untested.length}`,
        `Estimated coverage: ${pct}% of source files have a corresponding test`,
        `Test files found: ${testFiles.length}`,
        '',
      ];

      if (!untested.length) {
        output.push('✅ Every source file appears to have a corresponding test file.');
        return output.join('\n');
      }

      output.push(`### UNTESTED SOURCE FILES (${untested.length})`);
      const dirs = Object.entries(byDir).sort((a, b) => b[1].length - a[1].length);
      for (const [dir, files] of dirs.slice(0, 30)) {
        output.push(`  📁 ${dir}/ (${files.length} file${files.length !== 1 ? 's' : ''})`);
        files.slice(0, 8).forEach((f) => output.push(`     ${shorten(f).split('/').pop()}`));
        if (files.length > 8) output.push(`     … +${files.length - 8} more`);
      }

      return output.join('\n');
    },

    // ── 5. FIND_API_ENDPOINTS ─────────────────────────────────────────────────────
    // Detects HTTP route definitions across Express, Fastify, FastAPI, Flask,
    // Django, Rails, and similar frameworks. Instantly gives the AI a full map
    // of the API surface without reading every file.
    find_api_endpoints: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`🌐 Scanning for API endpoint definitions in ${rootPath}`);

      // Patterns that capture HTTP verb + route path
      const patterns = [
        {
          label: 'Express/Fastify JS',
          re: /(?:app|router)\.(get|post|put|patch|delete|all)\s*\(\s*['"`]([^'"`]+)['"`]/,
          framework: 'node',
        },
        {
          label: 'FastAPI/Flask Python',
          re: /@(?:app|router)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/,
          framework: 'python',
        },
        { label: 'Django urls', re: /path\s*\(\s*['"`]([^'"`]+)['"`]\s*,/, framework: 'django' },
        {
          label: 'Rails routes',
          re: /(?:get|post|put|patch|delete)\s+['"]([^'"]+)['"]/,
          framework: 'rails',
        },
        {
          label: 'Next.js API',
          re: /export\s+(?:default\s+)?(?:async\s+)?function\s+handler|export\s+const\s+(?:GET|POST|PUT|PATCH|DELETE)\s*=/,
          framework: 'nextjs',
        },
        {
          label: 'Hono/Elysia',
          re: /\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/,
          framework: 'node',
        },
      ];

      const allQueries = [
        'app.get(',
        'app.post(',
        'router.get(',
        'router.post(',
        '@app.get',
        '@app.post',
        '@router.get',
        '@router.post',
        'path("',
        "path('",
        'export const GET',
        'export const POST',
      ];

      const searchResults = await Promise.all(
        allQueries.slice(0, 5).map((q) =>
          window.electronAPI?.invoke?.('search-workspace', {
            rootPath,
            query: q,
            maxResults: 80,
          }),
        ),
      );

      const allMatches = searchResults.flatMap((r) => r?.matches ?? []);
      const seen = new Set();
      const unique = allMatches.filter((m) => {
        const key = `${m.path}:${m.lineNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (!unique.length) return `No HTTP route definitions found in ${rootPath}.`;

      const endpoints = [];
      for (const m of unique) {
        for (const pat of patterns) {
          const match = m.line.match(pat.re);
          if (match) {
            const verb = (match[1] || 'ANY').toUpperCase();
            const route = match[2] || '(dynamic)';
            endpoints.push({
              verb,
              route,
              file: m.path.replace(rootPath + '/', ''),
              line: m.lineNumber,
              framework: pat.label,
            });
            break;
          }
        }
      }

      if (!endpoints.length)
        return `Found potential route files but could not parse endpoint patterns.`;

      // Group by file
      const byFile = {};
      for (const ep of endpoints) (byFile[ep.file] = byFile[ep.file] || []).push(ep);

      const verbOrder = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4, ANY: 5 };
      const verbColors = { GET: '🟢', POST: '🟡', PUT: '🔵', PATCH: '🟣', DELETE: '🔴', ANY: '⚪' };

      const output = [
        `API endpoints in ${rootPath}:`,
        `${endpoints.length} route${endpoints.length !== 1 ? 's' : ''} across ${Object.keys(byFile).length} file${Object.keys(byFile).length !== 1 ? 's' : ''}`,
        '',
      ];

      for (const [file, eps] of Object.entries(byFile)) {
        output.push(`📄 ${file}`);
        eps
          .sort((a, b) => (verbOrder[a.verb] ?? 9) - (verbOrder[b.verb] ?? 9))
          .forEach((ep) => {
            const icon = verbColors[ep.verb] ?? '⚪';
            output.push(`   ${icon} ${ep.verb.padEnd(7)} ${ep.route}  (line ${ep.line})`);
          });
        output.push('');
      }

      // Summary table
      const verbCounts = {};
      for (const ep of endpoints) verbCounts[ep.verb] = (verbCounts[ep.verb] || 0) + 1;
      output.push('### VERB SUMMARY');
      for (const [verb, count] of Object.entries(verbCounts).sort()) {
        output.push(`  ${verbColors[verb] ?? '⚪'} ${verb.padEnd(8)} ${count}`);
      }

      return output.join('\n');
    },

    // ── 6. FIND_ERROR_HANDLING_GAPS ───────────────────────────────────────────────
    // Finds async functions, Promise chains, and fetch/axios calls that are NOT
    // wrapped in try/catch or .catch(). Missing error handling is a top source of
    // silent failures and hard-to-debug production crashes.
    find_error_handling_gaps: async (params, onStage) => {
      const filePath = params.path?.trim();
      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : filePath
          ? null
          : resolveWorkingDirectory(null);

      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');

      onStage(`🛡️ Scanning for missing error handling`);

      const scanFile = async (fp) => {
        try {
          const { content } = await ipcReadFile(fp);
          const lines = splitLines(content);
          const issues = [];

          // Track try/catch regions
          const tryCatchLines = new Set();
          let depth = 0;
          let inTry = false;
          for (let i = 0; i < lines.length; i++) {
            if (/\btry\s*\{/.test(lines[i])) inTry = true;
            if (inTry) tryCatchLines.add(i);
            depth += (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length;
            if (depth <= 0) {
              inTry = false;
              depth = 0;
            }
          }

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            const isInTry = tryCatchLines.has(i);

            // Bare await without surrounding try/catch
            if (/\bawait\s+\w/.test(line) && !isInTry) {
              // Check if the function above has a try/catch nearby
              const nearby = lines.slice(Math.max(0, i - 5), i + 3).join(' ');
              if (!/try\s*\{/.test(nearby) && !/.catch\(/.test(nearby)) {
                issues.push({ line: i + 1, type: 'bare await', text: line.slice(0, 100) });
              }
            }

            // Promise without .catch
            if (/\bfetch\s*\(|axios\.\w+\s*\(|\.then\s*\(/.test(line) && !isInTry) {
              const block = lines.slice(i, Math.min(lines.length, i + 8)).join('\n');
              if (!block.includes('.catch(') && !block.includes('catch (')) {
                if (!issues.find((x) => x.line === i + 1))
                  issues.push({ line: i + 1, type: 'unhandled Promise', text: line.slice(0, 100) });
              }
            }

            // new Promise without reject
            if (/new\s+Promise\s*\(/.test(line)) {
              const block = lines.slice(i, Math.min(lines.length, i + 15)).join('\n');
              if (!block.includes('reject') && !block.includes('catch')) {
                issues.push({
                  line: i + 1,
                  type: 'Promise missing reject',
                  text: line.slice(0, 100),
                });
              }
            }
          }

          return issues;
        } catch {
          return [];
        }
      };

      let fileMap = {};
      if (filePath) {
        fileMap[filePath] = await scanFile(filePath);
      } else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
          cwd: rootPath,
          timeout: 15000,
          allowRisky: false,
        });
        const files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 150) ?? [];
        onStage(`Scanning ${files.length} files…`);
        for (const fp of files) {
          const issues = await scanFile(fp);
          if (issues.length) fileMap[fp] = issues;
        }
      }

      const allIssues = Object.values(fileMap).flat();
      if (!allIssues.length) return `✅ No obvious error handling gaps found.`;

      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p);

      const output = [
        `Error handling gaps:`,
        `${allIssues.length} potential gap${allIssues.length !== 1 ? 's' : ''} across ${Object.keys(fileMap).length} file${Object.keys(fileMap).length !== 1 ? 's' : ''}`,
        '',
      ];

      const byType = {};
      for (const issues of Object.values(fileMap)) {
        for (const iss of issues) (byType[iss.type] = byType[iss.type] || []).push(iss);
      }
      output.push('### BY TYPE');
      for (const [type, items] of Object.entries(byType)) output.push(`  ${type}: ${items.length}`);
      output.push('');

      for (const [fp, issues] of Object.entries(fileMap)) {
        output.push(`📄 ${shorten(fp)} (${issues.length})`);
        issues
          .slice(0, 8)
          .forEach((iss) =>
            output.push(`   Line ${iss.line} [${iss.type}]: ${iss.text.slice(0, 100)}`),
          );
        if (issues.length > 8) output.push(`   … +${issues.length - 8} more`);
        output.push('');
      }

      return output.join('\n');
    },

    // ── 7. GET_DEPENDENCY_GRAPH ───────────────────────────────────────────────────
    // Builds a file-level import graph and computes fan-in (how many files import
    // this file) and fan-out (how many files this file imports). High fan-in = core
    // module that many depend on. High fan-out = god file. Essential for safe
    // refactoring decisions.
    get_dependency_graph: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      const extensions = (params.extensions ?? 'js,ts,jsx,tsx')
        .split(',')
        .map((e) => e.trim().replace(/^\./, '').toLowerCase());
      const maxFiles = params.max_files ?? 100;

      onStage(`🗺️ Building dependency graph for ${rootPath}`);

      const extPat = extensions.map((e) => `-name "*.${e}"`).join(' -o ');
      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( ${extPat} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*"`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });

      if (!listResult?.ok || !listResult.stdout?.trim()) return `No source files found.`;

      const files = listResult.stdout.trim().split('\n').filter(Boolean).slice(0, maxFiles);
      const fileSet = new Set(files);

      const importRe =
        /(?:^import\s+.*?from\s+|^(?:const|let|var)\s+\S+\s*=\s*require\s*\(\s*)['"`](\.\.?\/[^'"`\n]+)['"`]/gm;

      const fanOut = {}; // file → count of its imports to internal files
      const fanIn = {}; // file → count of files that import it
      const edges = [];

      for (const fp of files) {
        fanOut[fp] = 0;
        fanIn[fp] = fanIn[fp] ?? 0;
      }

      for (const fp of files) {
        try {
          const { content } = await ipcReadFile(fp);
          const dir = fp.split('/').slice(0, -1).join('/');
          let m;
          importRe.lastIndex = 0;
          const seen = new Set();
          while ((m = importRe.exec(content)) !== null) {
            const rel = m[1];
            const parts = (dir + '/' + rel).split('/');
            const stack = [];
            for (const p of parts) {
              if (p === '..') stack.pop();
              else if (p !== '.') stack.push(p);
            }
            const base = stack.join('/');
            const resolved =
              files.find((f) => f === base) ||
              extensions.map((e) => base + '.' + e).find((c) => fileSet.has(c)) ||
              extensions.map((e) => base + '/index.' + e).find((c) => fileSet.has(c));

            if (resolved && resolved !== fp && !seen.has(resolved)) {
              seen.add(resolved);
              fanOut[fp] = (fanOut[fp] || 0) + 1;
              fanIn[resolved] = (fanIn[resolved] || 0) + 1;
              edges.push([fp, resolved]);
            }
          }
        } catch {
          /* skip */
        }
      }

      const shorten = (p) => p.replace(rootPath + '/', '');

      const topFanIn = Object.entries(fanIn)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
      const topFanOut = Object.entries(fanOut)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);
      const isolated = files.filter((f) => !fanIn[f] && !fanOut[f]);

      const output = [
        `Dependency graph: ${rootPath}`,
        `Files: ${files.length} | Edges: ${edges.length} | Isolated: ${isolated.length}`,
        '',
        '### TOP IMPORTED FILES (high fan-in = core modules)',
      ];

      for (const [fp, count] of topFanIn) {
        const bar = '█'.repeat(Math.min(count, 20));
        output.push(`  ${String(count).padStart(3)}x  ${bar}  ${shorten(fp)}`);
      }

      output.push('', '### FILES WITH MOST IMPORTS (high fan-out = potential god files)');
      for (const [fp, count] of topFanOut) {
        const bar = '█'.repeat(Math.min(count, 20));
        output.push(`  ${String(count).padStart(3)} →  ${bar}  ${shorten(fp)}`);
      }

      if (isolated.length) {
        output.push(``, `### ISOLATED FILES (no imports, not imported by anyone)`);
        isolated.slice(0, 20).forEach((f) => output.push(`  ${shorten(f)}`));
        if (isolated.length > 20) output.push(`  … +${isolated.length - 20} more`);
      }

      return output.join('\n');
    },

    // ── 8. FIND_SECURITY_PATTERNS ─────────────────────────────────────────────────
    // Scans for common security anti-patterns: hardcoded secrets, SQL injection
    // vectors, eval() usage, disabled TLS verification, insecure randomness, etc.
    // Not a full SAST tool, but surfaces the obvious red flags instantly.
    find_security_patterns: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`🔐 Scanning for security anti-patterns in ${rootPath}`);

      const checks = [
        { category: 'Hardcoded Secrets', query: 'password =', severity: 'HIGH' },
        { category: 'Hardcoded Secrets', query: 'api_key =', severity: 'HIGH' },
        { category: 'Hardcoded Secrets', query: 'secret =', severity: 'HIGH' },
        { category: 'Hardcoded Secrets', query: 'token =', severity: 'HIGH' },
        { category: 'Code Injection', query: 'eval(', severity: 'HIGH' },
        { category: 'Code Injection', query: 'new Function(', severity: 'HIGH' },
        { category: 'SQL Injection', query: '+ req.', severity: 'MEDIUM' },
        { category: 'SQL Injection', query: 'query(req.', severity: 'MEDIUM' },
        { category: 'Insecure TLS', query: 'rejectUnauthorized: false', severity: 'HIGH' },
        { category: 'Insecure TLS', query: 'verify=False', severity: 'HIGH' },
        { category: 'Insecure Randomness', query: 'Math.random()', severity: 'MEDIUM' },
        { category: 'Path Traversal', query: 'req.params', severity: 'LOW' },
        { category: 'XSS Risk', query: 'innerHTML =', severity: 'MEDIUM' },
        { category: 'XSS Risk', query: 'dangerouslySetInnerHTML', severity: 'MEDIUM' },
        { category: 'Open Redirect', query: 'res.redirect(req.', severity: 'MEDIUM' },
        { category: 'Timing Attack', query: '== req.body.password', severity: 'MEDIUM' },
        { category: 'Debug Left In', query: 'DEBUG = True', severity: 'LOW' },
      ];

      const secretRe =
        /(?:password|secret|api_key|apikey|token|auth)\s*[:=]\s*['"`][^'"`\s]{6,}['"`]/i;
      const findings = [];

      for (const check of checks) {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath,
          query: check.query,
          maxResults: 20,
        });
        for (const m of result?.matches ?? []) {
          // Skip comments and .env files
          if (m.line.trim().startsWith('//') || m.line.trim().startsWith('#')) continue;
          if (m.path.includes('.env') || m.path.includes('test') || m.path.includes('spec'))
            continue;
          findings.push({
            category: check.category,
            severity: check.severity,
            path: m.path.replace(rootPath + '/', ''),
            line: m.lineNumber,
            text: m.line.trim().slice(0, 100),
          });
        }
      }

      if (!findings.length)
        return `✅ No obvious security anti-patterns found in ${rootPath}.\nNote: This is a surface-level scan, not a substitute for a full SAST tool.`;

      const bySeverity = { HIGH: [], MEDIUM: [], LOW: [] };
      for (const f of findings) bySeverity[f.severity]?.push(f);

      const sevIcon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🔵' };

      const output = [
        `Security scan: ${rootPath}`,
        `${findings.length} potential issue${findings.length !== 1 ? 's' : ''} found (surface-level scan only)`,
        `HIGH: ${bySeverity.HIGH.length} | MEDIUM: ${bySeverity.MEDIUM.length} | LOW: ${bySeverity.LOW.length}`,
        '',
        '⚠️  This is not a substitute for a full SAST/security audit.',
        '',
      ];

      for (const sev of ['HIGH', 'MEDIUM', 'LOW']) {
        if (!bySeverity[sev].length) continue;
        output.push(`### ${sevIcon[sev]} ${sev} (${bySeverity[sev].length})`);
        const byCategory = {};
        for (const f of bySeverity[sev])
          (byCategory[f.category] = byCategory[f.category] || []).push(f);
        for (const [cat, items] of Object.entries(byCategory)) {
          output.push(`  ${cat}:`);
          items.slice(0, 5).forEach((f) => output.push(`    ${f.path}:${f.line} — ${f.text}`));
          if (items.length > 5) output.push(`    … +${items.length - 5} more`);
        }
        output.push('');
      }

      return output.join('\n');
    },

    // ── 9. GET_RECENTLY_MODIFIED_FILES ────────────────────────────────────────────
    // Lists files modified most recently, using git log or filesystem mtime.
    // Instantly tells the AI where recent work happened — critical for debugging,
    // code review, and understanding what's in flux.
    get_recently_modified_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      const limit = params.limit ?? 20;
      const days = params.days ?? 7;
      const extensions = params.extensions ?? '';

      onStage(`📅 Finding recently modified files in ${rootPath}`);

      // Try git first (more accurate than mtime)
      const gitResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git log --name-only --pretty=format:"%ar|%s" --since="${days} days ago" --diff-filter=AM | head -200`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });

      if (gitResult?.ok && gitResult.stdout?.trim()) {
        const extFilter = extensions
          ? extensions.split(',').map((e) => '.' + e.trim().replace(/^\./, ''))
          : null;

        const lines = gitResult.stdout.trim().split('\n');
        const fileChanges = new Map(); // file → {when, message}
        let currentMeta = null;

        for (const line of lines) {
          if (line.includes('|')) {
            const [when, ...msgParts] = line.split('|');
            currentMeta = { when: when.trim(), message: msgParts.join('|').trim() };
          } else if (line.trim() && currentMeta && !line.startsWith('diff')) {
            const fp = rootPath + '/' + line.trim();
            if (!fileChanges.has(line.trim())) {
              if (!extFilter || extFilter.some((e) => line.trim().endsWith(e))) {
                fileChanges.set(line.trim(), currentMeta);
              }
            }
          }
        }

        const files = [...fileChanges.entries()].slice(0, limit);
        if (files.length) {
          const output = [
            `Recently modified files in ${rootPath} (last ${days} day${days !== 1 ? 's' : ''}):`,
            `${files.length} file${files.length !== 1 ? 's' : ''} changed`,
            '',
          ];
          for (const [fp, meta] of files) {
            output.push(`  ${meta.when.padEnd(16)}  ${fp}`);
            output.push(`               ↳ ${meta.message.slice(0, 80)}`);
          }
          return output.join('\n');
        }
      }

      // Fallback: filesystem mtime
      const extPat = extensions
        ? extensions
            .split(',')
            .map((e) => `-name "*.${e.trim().replace(/^\./, '')}"`)
            .join(' -o ')
        : '-name "*"';
      const shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( ${extPat} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -newer "${rootPath}/.git/index" -printf "%T+\t%p\n" 2>/dev/null | sort -r | head -${limit}`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });

      if (!shellResult?.ok || !shellResult.stdout?.trim())
        return `Could not determine recently modified files in ${rootPath}.`;

      const files = shellResult.stdout.trim().split('\n').filter(Boolean);
      const output = [`Recently modified files in ${rootPath}:`, ''];
      for (const line of files) {
        const [ts, fp] = line.split('\t');
        output.push(`  ${ts?.slice(0, 16).padEnd(18)}  ${fp?.replace(rootPath + '/', '')}`);
      }
      return output.join('\n');
    },

    // ── 10. FIND_NAMING_INCONSISTENCIES ──────────────────────────────────────────
    // Detects mixed naming conventions within a file or workspace (camelCase vs
    // snake_case vs PascalCase vs kebab-case on variables/functions/files). Naming
    // inconsistency is a reliable signal of multi-author code or rushed refactors.
    find_naming_inconsistencies: async (params, onStage) => {
      const filePath = params.path?.trim();
      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');

      onStage(`📛 Scanning for naming convention inconsistencies`);

      const classify = (name) => {
        if (/^[A-Z][a-zA-Z0-9]*$/.test(name)) return 'PascalCase';
        if (/^[a-z][a-zA-Z0-9]*$/.test(name) && name.includes('') && !/[_-]/.test(name))
          return 'camelCase';
        if (/^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')) return 'snake_case';
        if (/^[a-z][a-z0-9-]*$/.test(name) && name.includes('-')) return 'kebab-case';
        if (/^[A-Z][A-Z0-9_]*$/.test(name)) return 'UPPER_SNAKE';
        return null;
      };

      const scanFile = async (fp) => {
        try {
          const { content } = await ipcReadFile(fp);
          const lines = splitLines(content);
          const names = {
            camelCase: [],
            snake_case: [],
            PascalCase: [],
            'kebab-case': [],
            UPPER_SNAKE: [],
          };

          // Extract identifiers from declarations
          const declRe =
            /(?:const|let|var|function|class|def|type|interface)\s+([a-zA-Z_][a-zA-Z0-9_-]*)/g;
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s*(\/\/|#|\/\*)/.test(line)) continue;
            let m;
            declRe.lastIndex = 0;
            while ((m = declRe.exec(line)) !== null) {
              const name = m[1];
              if (name.length < 3) continue;
              const style = classify(name);
              if (style) names[style].push({ name, line: i + 1 });
            }
          }

          const present = Object.entries(names).filter(([, v]) => v.length > 0);
          if (present.length <= 1) return null;

          // Multiple styles = inconsistency
          return { file: fp, styles: Object.fromEntries(present) };
        } catch {
          return null;
        }
      };

      const results = [];

      if (filePath) {
        const r = await scanFile(filePath);
        if (r) results.push(r);
      } else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
          cwd: rootPath,
          timeout: 15000,
          allowRisky: false,
        });
        const files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 100) ?? [];
        for (const fp of files) {
          const r = await scanFile(fp);
          if (r) results.push(r);
        }
      }

      if (!results.length) return `✅ No naming convention inconsistencies detected.`;

      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p);
      const output = [
        `Naming inconsistencies found in ${results.length} file${results.length !== 1 ? 's' : ''}:`,
        '',
      ];

      for (const r of results.slice(0, 30)) {
        const styles = Object.entries(r.styles)
          .map(([s, v]) => `${s}(${v.length})`)
          .join('  ');
        output.push(`📄 ${shorten(r.file)}`);
        output.push(`   Styles found: ${styles}`);
        // Show a few examples of each style
        for (const [style, items] of Object.entries(r.styles)) {
          const examples = items
            .slice(0, 3)
            .map((x) => x.name)
            .join(', ');
          output.push(
            `   ${style}: ${examples}${items.length > 3 ? ` … +${items.length - 3}` : ''}`,
          );
        }
        output.push('');
      }

      return output.join('\n');
    },

    // ── 11. GET_CONFIG_FILES ──────────────────────────────────────────────────────
    // Locates and summarizes every configuration file in a workspace: package.json,
    // tsconfig, eslint, prettier, docker, CI, etc. Gives the AI a complete picture
    // of project tooling in a single call — without reading each file individually.
    get_config_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`⚙️ Discovering configuration files in ${rootPath}`);

      const CONFIG_PATTERNS = [
        { pattern: 'package.json', category: 'Node', key: true },
        { pattern: 'tsconfig*.json', category: 'TypeScript', key: true },
        { pattern: '.eslintrc*', category: 'Linting', key: false },
        { pattern: 'eslint.config*', category: 'Linting', key: false },
        { pattern: '.prettierrc*', category: 'Formatting', key: false },
        { pattern: 'prettier.config*', category: 'Formatting', key: false },
        { pattern: 'jest.config*', category: 'Testing', key: false },
        { pattern: 'vitest.config*', category: 'Testing', key: false },
        { pattern: 'vite.config*', category: 'Build', key: false },
        { pattern: 'webpack.config*', category: 'Build', key: false },
        { pattern: 'rollup.config*', category: 'Build', key: false },
        { pattern: 'babel.config*', category: 'Transpile', key: false },
        { pattern: '.babelrc*', category: 'Transpile', key: false },
        { pattern: 'Dockerfile*', category: 'Docker', key: false },
        { pattern: 'docker-compose*', category: 'Docker', key: false },
        { pattern: '.env*', category: 'Env', key: false },
        { pattern: '.github/workflows/*.yml', category: 'CI/CD', key: false },
        { pattern: '.gitlab-ci.yml', category: 'CI/CD', key: false },
        { pattern: 'Makefile', category: 'Build', key: false },
        { pattern: 'pyproject.toml', category: 'Python', key: true },
        { pattern: 'setup.py', category: 'Python', key: true },
        { pattern: 'requirements*.txt', category: 'Python', key: false },
        { pattern: 'go.mod', category: 'Go', key: true },
        { pattern: 'Cargo.toml', category: 'Rust', key: true },
        { pattern: '*.config.js', category: 'Config', key: false },
        { pattern: '*.config.ts', category: 'Config', key: false },
      ];

      const foundConfigs = [];

      for (const cfg of CONFIG_PATTERNS) {
        const result = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -maxdepth 4 -name "${cfg.pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -10`,
          cwd: rootPath,
          timeout: 8000,
          allowRisky: false,
        });
        if (result?.ok && result.stdout?.trim()) {
          for (const fp of result.stdout.trim().split('\n').filter(Boolean)) {
            foundConfigs.push({ path: fp, category: cfg.category, key: cfg.key });
          }
        }
      }

      if (!foundConfigs.length) return `No configuration files found in ${rootPath}.`;

      const byCategory = {};
      for (const cfg of foundConfigs)
        (byCategory[cfg.category] = byCategory[cfg.category] || []).push(cfg);

      const shorten = (p) => p.replace(rootPath + '/', '');

      const output = [
        `Configuration files in ${rootPath}:`,
        `${foundConfigs.length} file${foundConfigs.length !== 1 ? 's' : ''} across ${Object.keys(byCategory).length} categories`,
        '',
      ];

      for (const [cat, configs] of Object.entries(byCategory)) {
        output.push(`### ${cat}`);
        for (const cfg of configs) {
          const marker = cfg.key ? ' ⭐' : '';
          output.push(`  ${shorten(cfg.path)}${marker}`);
        }
        output.push('');
      }

      // Summarize key config values from package.json if present
      const pkgJson = foundConfigs.find((c) => c.path.endsWith('package.json'));
      if (pkgJson) {
        try {
          const { content } = await ipcReadFile(pkgJson.path);
          const pkg = JSON.parse(content);
          output.push('### PACKAGE.JSON SUMMARY');
          if (pkg.name) output.push(`  name:    ${pkg.name}`);
          if (pkg.version) output.push(`  version: ${pkg.version}`);
          if (pkg.main) output.push(`  main:    ${pkg.main}`);
          if (pkg.type) output.push(`  type:    ${pkg.type}`);
          if (pkg.engines) output.push(`  engines: ${JSON.stringify(pkg.engines)}`);
        } catch {
          /* skip */
        }
      }

      return output.join('\n');
    },

    // ── 12. FIND_ASYNC_PATTERNS ───────────────────────────────────────────────────
    // Gives the AI a complete map of async usage in a file or workspace: async
    // functions, Promise chains, callbacks, setTimeout/setInterval, EventEmitter.
    // Understands the "async shape" before making concurrency-related changes.
    find_async_patterns: async (params, onStage) => {
      const filePath = params.path?.trim();
      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');

      onStage(`⚡ Mapping async patterns`);

      const PATTERNS = [
        { label: 'async function', re: /\basync\s+function\s+(\w+)/ },
        {
          label: 'async arrow',
          re: /(?:const|let|var)\s+(\w+)\s*=\s*async\s*(?:\([^)]*\)|[a-z_]\w*)\s*=>/,
        },
        { label: 'await', re: /\bawait\s+\w/ },
        { label: 'Promise.all', re: /Promise\.all\s*\(/ },
        { label: 'Promise.race', re: /Promise\.race\s*\(/ },
        { label: 'Promise.allSettled', re: /Promise\.allSettled\s*\(/ },
        { label: 'new Promise', re: /new\s+Promise\s*\(/ },
        { label: '.then()', re: /\.then\s*\(/ },
        { label: '.catch()', re: /\.catch\s*\(/ },
        { label: '.finally()', re: /\.finally\s*\(/ },
        { label: 'setTimeout', re: /\bsetTimeout\s*\(/ },
        { label: 'setInterval', re: /\bsetInterval\s*\(/ },
        { label: 'EventEmitter', re: /\bon\s*\(\s*['"`]/ },
        { label: 'callback pattern', re: /function\s*\([^)]*callback|,\s*cb\s*[,)]/ },
      ];

      const scanFile = async (fp) => {
        try {
          const { content } = await ipcReadFile(fp);
          const lines = splitLines(content);
          const hits = {};
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s*(\/\/|#)/.test(line)) continue;
            for (const p of PATTERNS) {
              if (p.re.test(line)) {
                if (!hits[p.label]) hits[p.label] = [];
                hits[p.label].push(i + 1);
              }
            }
          }
          return hits;
        } catch {
          return {};
        }
      };

      let fileMap = {};
      if (filePath) {
        fileMap[filePath] = await scanFile(filePath);
      } else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
          cwd: rootPath,
          timeout: 15000,
          allowRisky: false,
        });
        const files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 100) ?? [];
        for (const fp of files) {
          const h = await scanFile(fp);
          if (Object.keys(h).length) fileMap[fp] = h;
        }
      }

      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p);

      // Aggregate totals
      const totals = {};
      for (const hits of Object.values(fileMap)) {
        for (const [label, lines] of Object.entries(hits)) {
          totals[label] = (totals[label] || 0) + lines.length;
        }
      }

      const output = [
        `Async pattern analysis: ${filePath ?? rootPath}`,
        `${Object.keys(fileMap).length} file${Object.keys(fileMap).length !== 1 ? 's' : ''} analyzed`,
        '',
        '### PATTERN TOTALS',
        ...Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => `  ${label.padEnd(20)} ${count}`),
        '',
      ];

      if (filePath) {
        const hits = fileMap[filePath] ?? {};
        for (const [label, lineNums] of Object.entries(hits)) {
          output.push(`### ${label.toUpperCase()} (${lineNums.length})`);
          lineNums.slice(0, 10).forEach((n) => output.push(`  Line ${n}`));
          if (lineNums.length > 10) output.push(`  … +${lineNums.length - 10} more`);
          output.push('');
        }
      } else {
        output.push('### FILES WITH MOST ASYNC COMPLEXITY');
        const scored = Object.entries(fileMap)
          .map(([fp, hits]) => ({
            fp,
            score: Object.values(hits).reduce((s, v) => s + v.length, 0),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
        for (const { fp, score } of scored) {
          const labels = Object.entries(fileMap[fp])
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 4)
            .map(([l, v]) => `${l}(${v.length})`)
            .join('  ');
          output.push(`  ${shorten(fp)}`);
          output.push(`    ${labels}`);
        }
      }

      return output.join('\n');
    },

    // ── 13. MAP_COMPONENT_TREE ────────────────────────────────────────────────────
    // Builds a React/Vue component hierarchy by analysing JSX/TSX imports and
    // render calls. Shows which components are composed inside which parents.
    // Gives the AI a mental model of the UI tree before making component changes.
    map_component_tree: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      const entryFile = params.entry_file?.trim() ?? '';
      onStage(`🌲 Mapping component tree in ${rootPath}`);

      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*"`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });

      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No JSX/TSX component files found in ${rootPath}.`;

      const files = listResult.stdout.trim().split('\n').filter(Boolean);
      onStage(`Analyzing ${files.length} component files…`);

      // Extract: component name → { file, renders: Set<componentName> }
      const components = {};
      const jsxTagRe = /<([A-Z][a-zA-Z0-9]*)\s*[^>]*\/?>/g;
      const exportRe = /export\s+(?:default\s+)?(?:function|class|const)\s+([A-Z][a-zA-Z0-9]*)/;

      for (const fp of files) {
        try {
          const { content } = await ipcReadFile(fp);
          const exportMatch = content.match(exportRe);
          const compName =
            exportMatch?.[1] ??
            fp
              .split('/')
              .pop()
              .replace(/\.[jt]sx?$/, '');

          const renderedComponents = new Set();
          let m;
          jsxTagRe.lastIndex = 0;
          while ((m = jsxTagRe.exec(content)) !== null) {
            if (m[1] !== compName) renderedComponents.add(m[1]);
          }

          components[compName] = {
            file: fp.replace(rootPath + '/', ''),
            renders: renderedComponents,
          };
        } catch {
          /* skip */
        }
      }

      if (!Object.keys(components).length) return `No components detected in ${rootPath}.`;

      // Find root components (not rendered by anyone)
      const allRendered = new Set(Object.values(components).flatMap((c) => [...c.renders]));
      const roots = Object.keys(components).filter((c) => !allRendered.has(c));

      const output = [
        `Component tree: ${rootPath}`,
        `${Object.keys(components).length} components found | Likely root${roots.length !== 1 ? 's' : ''}: ${roots.join(', ') || 'none detected'}`,
        '',
      ];

      const printTree = (name, depth, seen = new Set()) => {
        if (seen.has(name) || depth > 6) return;
        seen.add(name);
        const comp = components[name];
        if (!comp) return;
        const indent = '  '.repeat(depth);
        output.push(`${indent}${depth === 0 ? '📦 ' : '  └─ '}${name}  (${comp.file})`);
        for (const child of comp.renders) {
          printTree(child, depth + 1, new Set(seen));
        }
      };

      const treeRoots = entryFile
        ? Object.keys(components).filter((c) => components[c].file.includes(entryFile))
        : roots.slice(0, 5);

      for (const root of treeRoots) {
        output.push(`### TREE FROM: ${root}`);
        printTree(root, 0);
        output.push('');
      }

      // Leaf components
      const leaves = Object.entries(components)
        .filter(([, c]) => c.renders.size === 0)
        .map(([n]) => n);
      if (leaves.length) {
        output.push(`### LEAF COMPONENTS (no children): ${leaves.length}`);
        output.push('  ' + leaves.slice(0, 20).join(', '));
      }

      return output.join('\n');
    },

    // ── 14. COUNT_CODE_BY_AUTHOR ──────────────────────────────────────────────────
    // Uses git blame to compute per-author line counts across the workspace.
    // Shows who wrote what percentage of the codebase — valuable for understanding
    // ownership, finding the right person to ask, and identifying bus-factor risks.
    count_code_by_author: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      const maxFiles = params.max_files ?? 50;
      const fileGlob = params.file_glob ?? '*.{js,ts,jsx,tsx,py}';

      onStage(`👥 Counting code by author in ${workingDirectory}`);

      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git ls-files | head -${maxFiles}`,
        cwd: workingDirectory,
        timeout: 10000,
        allowRisky: false,
      });

      if (!result?.ok || !result.stdout?.trim())
        return `Could not list tracked files. Ensure ${workingDirectory} is a git repo.`;

      const files = result.stdout.trim().split('\n').filter(Boolean);
      onStage(`Blaming ${files.length} files…`);

      const blameResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git ls-files | head -${maxFiles} | xargs -I{} git blame --line-porcelain {} 2>/dev/null | grep "^author " | sort | uniq -c | sort -rn`,
        cwd: workingDirectory,
        timeout: 30000,
        allowRisky: false,
      });

      if (!blameResult?.ok || !blameResult.stdout?.trim()) {
        // Fallback: count commits per author
        const logResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `git log --pretty=format:"%an" | sort | uniq -c | sort -rn | head -20`,
          cwd: workingDirectory,
          timeout: 10000,
          allowRisky: false,
        });

        if (!logResult?.ok) return `Could not compute author statistics.`;

        const lines = logResult.stdout.trim().split('\n').filter(Boolean);
        const output = [`Code by author (commit count) in ${workingDirectory}:`, ''];
        let totalCommits = 0;
        const parsed = lines
          .map((l) => {
            const m = l.trim().match(/^(\d+)\s+(.+)$/);
            if (m) {
              totalCommits += parseInt(m[1], 10);
              return { count: parseInt(m[1], 10), author: m[2] };
            }
            return null;
          })
          .filter(Boolean);

        for (const { count, author } of parsed) {
          const pct = Math.round((count / Math.max(totalCommits, 1)) * 100);
          const bar = '█'.repeat(Math.round(pct / 5));
          output.push(
            `  ${String(count).padStart(5)} commits  ${String(pct).padStart(3)}%  ${bar.padEnd(20)}  ${author}`,
          );
        }
        return output.join('\n');
      }

      // Parse blame output: "  N author Name"
      const authorCounts = {};
      let totalLines = 0;
      for (const line of blameResult.stdout.trim().split('\n')) {
        const m = line.trim().match(/^(\d+)\s+author\s+(.+)$/);
        if (m) {
          const count = parseInt(m[1], 10);
          const author = m[2].trim();
          authorCounts[author] = (authorCounts[author] || 0) + count;
          totalLines += count;
        }
      }

      const sorted = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]);

      const output = [
        `Code ownership by author: ${workingDirectory}`,
        `${totalLines.toLocaleString()} lines across ${files.length} files | ${sorted.length} contributor${sorted.length !== 1 ? 's' : ''}`,
        '',
      ];

      for (const [author, count] of sorted) {
        const pct = Math.round((count / Math.max(totalLines, 1)) * 100);
        const bar = '█'.repeat(Math.round(pct / 3));
        output.push(
          `  ${String(count).padStart(7)} lines  ${String(pct).padStart(3)}%  ${bar.padEnd(34)}  ${author}`,
        );
      }

      if (sorted.length >= 2) {
        const topTwo = sorted.slice(0, 2);
        const topPct = Math.round((topTwo[0][1] / Math.max(totalLines, 1)) * 100);
        output.push('');
        if (topPct > 70) {
          output.push(`⚠️  Bus factor risk: ${topTwo[0][0]} owns ${topPct}% of lines.`);
        }
      }

      return output.join('\n');
    },

    // ── 15. FIND_FEATURE_FLAGS ────────────────────────────────────────────────────
    // Detects feature flag / feature toggle patterns across the codebase.
    // Finds conditional blocks gated on flags, lists all known flag names,
    // and surfaces flags that may be permanently on/off (stale flags).
    find_feature_flags: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`🚩 Scanning for feature flags in ${rootPath}`);

      const FLAG_PATTERNS = [
        /(?:isFeatureEnabled|featureFlags?|getFlag|flags?\.get|flags?\[|FEATURE_|FF_|ENABLE_|feature_flag)\s*\(?['"`]?([A-Z_a-z][A-Z_a-z0-9]*)['"`]?\)?/g,
        /if\s*\(\s*(?:process\.env|config)\.[A-Z_]{3,}\s*\)/g,
        /LaunchDarkly|Unleash|Flagsmith|Split\.io|ConfigCat|Optimizely/gi,
      ];

      const queries = [
        'featureFlag',
        'FEATURE_',
        'isEnabled',
        'feature_flag',
        'LaunchDarkly',
        'Unleash',
        'flag(',
        'flags.',
      ];

      const allMatches = [];
      for (const q of queries) {
        const r = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath,
          query: q,
          maxResults: 80,
        });
        if (r?.matches) allMatches.push(...r.matches);
      }

      const seen = new Set();
      const unique = allMatches.filter((m) => {
        const key = `${m.path}:${m.lineNumber}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });

      if (!unique.length) return `No feature flag patterns found in ${rootPath}.`;

      // Extract flag names
      const flagNames = new Map(); // name → [{file, line}]
      for (const m of unique) {
        for (const re of FLAG_PATTERNS.slice(0, 1)) {
          let match;
          re.lastIndex = 0;
          while ((match = re.exec(m.line)) !== null) {
            const name = match[1];
            if (name && name.length > 2) {
              if (!flagNames.has(name)) flagNames.set(name, []);
              flagNames
                .get(name)
                .push({ file: m.path.replace(rootPath + '/', ''), line: m.lineNumber });
            }
          }
        }
      }

      const shorten = (p) => p.replace(rootPath + '/', '');

      const output = [
        `Feature flags in ${rootPath}:`,
        `${unique.length} references | ${flagNames.size} unique flag name${flagNames.size !== 1 ? 's' : ''} detected`,
        '',
      ];

      if (flagNames.size) {
        output.push('### FLAG NAMES (by usage frequency)');
        const sorted = [...flagNames.entries()].sort((a, b) => b[1].length - a[1].length);
        for (const [name, locs] of sorted.slice(0, 30)) {
          output.push(`  ${name.padEnd(35)} used ${locs.length}x`);
          locs.slice(0, 2).forEach((l) => output.push(`    ${l.file}:${l.line}`));
        }
        output.push('');
      }

      // Show call sites grouped by file
      const byFile = {};
      for (const m of unique) (byFile[shorten(m.path)] = byFile[shorten(m.path)] || []).push(m);
      output.push('### FILES WITH FLAG USAGE');
      for (const [fp, items] of Object.entries(byFile).slice(0, 20)) {
        output.push(`  📄 ${fp} (${items.length} reference${items.length !== 1 ? 's' : ''})`);
      }

      return output.join('\n');
    },

    // ── 16. GET_FUNCTION_CALL_FREQUENCY ──────────────────────────────────────────
    // Counts how often each function/method is called across a workspace.
    // High-frequency calls are hot paths — changes there have wide impact.
    // Zero-frequency internal functions are dead code candidates.
    get_function_call_frequency: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : resolveWorkingDirectory(null);

      onStage(`📊 Analyzing function call frequency for ${filePath}`);
      const { content } = await ipcReadFile(filePath);
      const lines = splitLines(content);

      // Extract all function names defined in this file
      const fnNames = [];
      const fnRe =
        /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?/;

      for (const line of lines) {
        const m = line.trim().match(fnRe);
        if (m) {
          const name = m[1] || m[2];
          if (name && name.length > 2 && !fnNames.includes(name)) fnNames.push(name);
        }
      }

      if (!fnNames.length) return `No function definitions found in ${filePath}.`;

      onStage(`Counting calls for ${fnNames.length} functions…`);

      const callCounts = await Promise.all(
        fnNames.map(async (name) => {
          const r = await window.electronAPI?.invoke?.('search-workspace', {
            rootPath,
            query: name + '(',
            maxResults: 100,
          });
          const matches = (r?.matches ?? []).filter(
            (m) => !m.path.includes('.test.') && !m.path.includes('.spec.'),
          );
          // Subtract definition line itself
          const callsOnly = matches.filter((m) => {
            const t = m.line.trim();
            return (
              !/^(?:export\s+)?(?:async\s+)?function\s+/.test(t) &&
              !/^(?:const|let|var)\s+\w+\s*=/.test(t)
            );
          });
          return { name, callCount: callsOnly.length, totalRefs: matches.length };
        }),
      );

      callCounts.sort((a, b) => b.callCount - a.callCount);

      const maxCalls = Math.max(...callCounts.map((c) => c.callCount), 1);
      const output = [
        `Function call frequency: ${filePath}`,
        `${fnNames.length} functions | Search scope: ${rootPath ?? 'workspace'}`,
        '',
        '### CALL FREQUENCY (sorted by usage)',
      ];

      for (const { name, callCount, totalRefs } of callCounts) {
        const bar = '█'.repeat(Math.min(Math.round((callCount / maxCalls) * 15), 15));
        const flag = callCount === 0 ? '  ⚠️ potentially dead' : '';
        output.push(`  ${String(callCount).padStart(4)}x  ${bar.padEnd(16)}  ${name}${flag}`);
      }

      const deadFns = callCounts.filter((c) => c.callCount === 0);
      if (deadFns.length) {
        output.push('', `### POTENTIALLY DEAD FUNCTIONS (0 external calls)`);
        deadFns.forEach((f) => output.push(`  ${f.name}`));
      }

      return output.join('\n');
    },

    // ── 17. SUMMARIZE_FILE_CHANGES ────────────────────────────────────────────────
    // Runs `git show` or `git diff HEAD~N` on a specific file and distills the
    // recent changes into a structured summary: lines added/removed, functions
    // touched, and a plain-language description of what changed. Gives the AI
    // immediate commit-level context without reading raw diffs.
    summarize_file_changes: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory) throw new Error('No workspace is open. Provide working_directory.');

      const commits = params.commits ?? 1;

      onStage(`📝 Summarizing changes to ${filePath}`);

      const diffResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git log --oneline -${commits} -- "${filePath}"`,
        cwd: workingDirectory,
        timeout: 10000,
        allowRisky: false,
      });

      if (!diffResult?.ok || !diffResult.stdout?.trim())
        return `No recent git history found for ${filePath}.`;

      const recentCommits = diffResult.stdout.trim().split('\n');

      const output = [
        `Change summary: ${filePath}`,
        `Last ${recentCommits.length} commit${recentCommits.length !== 1 ? 's' : ''}:`,
        '',
      ];

      for (const commitLine of recentCommits) {
        const [hash, ...msgParts] = commitLine.split(' ');
        const message = msgParts.join(' ');
        output.push(`### ${hash}: ${message}`);

        const showResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `git show --stat ${hash} -- "${filePath}"`,
          cwd: workingDirectory,
          timeout: 10000,
          allowRisky: false,
        });

        if (showResult?.ok && showResult.stdout?.trim()) {
          const statLines = showResult.stdout.trim().split('\n');
          const summary = statLines[statLines.length - 1];
          if (summary) output.push(`  ${summary}`);
        }

        // Get the actual diff for this commit
        const patchResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `git show ${hash} -- "${filePath}" | grep "^[+-]" | grep -v "^[+-][+-][+-]" | head -60`,
          cwd: workingDirectory,
          timeout: 10000,
          allowRisky: false,
        });

        if (patchResult?.ok && patchResult.stdout?.trim()) {
          const diffLines = patchResult.stdout.trim().split('\n');
          const added = diffLines.filter((l) => l.startsWith('+')).length;
          const removed = diffLines.filter((l) => l.startsWith('-')).length;
          output.push(`  +${added} lines added, -${removed} lines removed`);

          // Find touched functions
          const fnRe =
            /^[+-]\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)|^[+-]\s*(?:const|let|var)\s+(\w+)\s*=/;
          const touched = new Set();
          for (const dl of diffLines) {
            const m = dl.match(fnRe);
            if (m) touched.add(m[1] || m[2]);
          }
          if (touched.size) output.push(`  Functions touched: ${[...touched].join(', ')}`);

          // Show first few interesting diff lines
          const interesting = diffLines
            .filter((l) => l.trim().length > 3 && !l.startsWith('+++') && !l.startsWith('---'))
            .slice(0, 8);
          if (interesting.length) {
            output.push('  Preview:');
            interesting.forEach((l) => output.push(`    ${l.slice(0, 100)}`));
          }
        }
        output.push('');
      }

      return output.join('\n');
    },

    // ── 18. FIND_PERFORMANCE_PATTERNS ────────────────────────────────────────────
    // Scans for common performance anti-patterns: nested loops with N+1 queries,
    // synchronous operations in async contexts, heavy work in render cycles,
    // missing memoization, large array operations, etc.
    find_performance_patterns: async (params, onStage) => {
      const filePath = params.path?.trim();
      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');

      onStage(`⚡ Scanning for performance anti-patterns`);

      const CHECKS = [
        {
          label: 'N+1 query risk (await in loop)',
          re: /for\s*\(.*\)|\.forEach\(|for\s+\w+\s+of\b/,
          followRe: /\bawait\b/,
          range: 3,
        },
        { label: 'Synchronous FS in async context', re: /readFileSync|writeFileSync|execSync/ },
        {
          label: 'JSON.parse in hot loop',
          re: /(?:for|forEach|map|filter|reduce).*JSON\.parse|JSON\.parse.*(?:for|forEach)/,
        },
        {
          label: 'Heavy work in render/useEffect',
          re: /useEffect|componentDidUpdate|render\s*\(\s*\)/,
        },
        {
          label: 'Missing memo/useMemo',
          re: /const\s+\w+\s*=\s*\[.*\]\.filter\(|\.map\(.*\)\.filter\(/,
        },
        { label: 'Spread in loop', re: /(?:for|map|reduce)[\s\S]{0,30}\.\.\.\w/ },
        { label: 'select(*) or SELECT *', re: /SELECT\s+\*\s+FROM|\.find\(\s*\)/ },
        { label: 'Missing index hint (large query)', re: /WHERE\s+(?!.*INDEX)\w+\s*=/i },
        {
          label: 'Busy wait / polling',
          re: /while\s*\(true\)|setInterval\s*\(\s*(?:async)?\s*\(\s*\)\s*=>\s*\{[\s\S]{0,200}await/,
        },
        {
          label: 'Array inside render',
          re: /(?:const|let)\s+\w+\s*=\s*\[.*\].*return\s*\(|return\s*\(\s*</,
        },
      ];

      const scanFile = async (fp) => {
        try {
          const { content } = await ipcReadFile(fp);
          const lines = splitLines(content);
          const issues = [];

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (/^\s*(\/\/|#)/.test(line)) continue;

            for (const check of CHECKS) {
              if (check.followRe) {
                // Check if pattern exists followed by another within `range` lines
                if (check.re.test(line)) {
                  const window = lines.slice(i + 1, i + 1 + (check.range ?? 3)).join('\n');
                  if (check.followRe.test(window)) {
                    issues.push({
                      line: i + 1,
                      label: check.label,
                      text: line.trim().slice(0, 100),
                    });
                  }
                }
              } else {
                if (check.re.test(line)) {
                  issues.push({ line: i + 1, label: check.label, text: line.trim().slice(0, 100) });
                }
              }
            }
          }
          return issues;
        } catch {
          return [];
        }
      };

      let fileMap = {};
      if (filePath) {
        fileMap[filePath] = await scanFile(filePath);
      } else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
          cwd: rootPath,
          timeout: 15000,
          allowRisky: false,
        });
        const files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 100) ?? [];
        for (const fp of files) {
          const issues = await scanFile(fp);
          if (issues.length) fileMap[fp] = issues;
        }
      }

      const allIssues = Object.values(fileMap).flat();
      if (!allIssues.length) return `✅ No obvious performance anti-patterns detected.`;

      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p);
      const byLabel = {};
      for (const iss of allIssues) (byLabel[iss.label] = byLabel[iss.label] || []).push(iss);

      const output = [
        `Performance anti-patterns: ${filePath ?? rootPath}`,
        `${allIssues.length} potential issue${allIssues.length !== 1 ? 's' : ''} across ${Object.keys(fileMap).length} file${Object.keys(fileMap).length !== 1 ? 's' : ''}`,
        '',
        '### BY PATTERN TYPE',
        ...Object.entries(byLabel)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([label, items]) => `  ${label}: ${items.length}`),
        '',
      ];

      for (const [fp, issues] of Object.entries(fileMap)) {
        output.push(`📄 ${shorten(fp)} (${issues.length})`);
        issues
          .slice(0, 6)
          .forEach((iss) => output.push(`   Line ${iss.line} — ${iss.label}\n     ${iss.text}`));
        if (issues.length > 6) output.push(`   … +${issues.length - 6} more`);
        output.push('');
      }

      return output.join('\n');
    },

    // ── 19. GET_WORKSPACE_HEALTH_SCORE ────────────────────────────────────────────
    // Aggregates multiple code quality signals into a single health dashboard:
    // lint errors, test presence, circular deps, long functions, missing error
    // handling, hardcoded secrets, console statements, and stale TODOs.
    // The single best "orient me" tool before starting any significant work.
    get_workspace_health_score: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`🏥 Computing workspace health score…`);

      const checks = {};

      // 1. Count source files
      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l`,
        cwd: rootPath,
        timeout: 10000,
        allowRisky: false,
      });
      checks.sourceFiles = parseInt(listResult?.stdout?.trim() ?? '0', 10);

      // 2. Test files
      const testResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( -name "*.test.*" -o -name "*.spec.*" \\) -not -path "*/node_modules/*" | wc -l`,
        cwd: rootPath,
        timeout: 10000,
        allowRisky: false,
      });
      checks.testFiles = parseInt(testResult?.stdout?.trim() ?? '0', 10);

      // 3. TODOs
      const todoResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath,
        query: 'TODO',
        maxResults: 200,
      });
      checks.todos = todoResult?.matches?.length ?? 0;

      // 4. Console statements
      const consoleResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath,
        query: 'console.log(',
        maxResults: 100,
      });
      checks.consoleLogs = consoleResult?.matches?.length ?? 0;

      // 5. Hardcoded secrets hint
      const secretResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath,
        query: 'password =',
        maxResults: 20,
      });
      checks.potentialSecrets = (secretResult?.matches ?? []).filter(
        (m) => !m.line.trim().startsWith('//') && !m.path.includes('.env'),
      ).length;

      // 6. Long files
      const longFileResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" \\) -not -path "*/node_modules/*" | xargs wc -l 2>/dev/null | sort -rn | awk '$1 > 500 {print}' | wc -l`,
        cwd: rootPath,
        timeout: 15000,
        allowRisky: false,
      });
      checks.longFiles = parseInt(longFileResult?.stdout?.trim() ?? '0', 10);

      // 7. Git health
      const gitResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git status --porcelain 2>/dev/null | wc -l`,
        cwd: rootPath,
        timeout: 10000,
        allowRisky: false,
      });
      checks.uncommittedChanges = parseInt(gitResult?.stdout?.trim() ?? '0', 10);

      const branchResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git branch 2>/dev/null | wc -l`,
        cwd: rootPath,
        timeout: 10000,
        allowRisky: false,
      });
      checks.branches = parseInt(branchResult?.stdout?.trim() ?? '0', 10);

      // 8. Dependencies
      const depResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `[ -f "${rootPath}/package.json" ] && node -e "const p=require('${rootPath}/package.json'); console.log(Object.keys({...p.dependencies,...p.devDependencies}).length)" 2>/dev/null || echo 0`,
        cwd: rootPath,
        timeout: 10000,
        allowRisky: false,
      });
      checks.totalDeps = parseInt(depResult?.stdout?.trim() ?? '0', 10);

      // Scoring (0-100)
      const scoreItems = [];
      const testRatio = checks.testFiles / Math.max(checks.sourceFiles, 1);
      const testScore = Math.min(Math.round(testRatio * 100), 25);
      scoreItems.push({
        name: 'Test coverage',
        score: testScore,
        max: 25,
        detail: `${checks.testFiles} test files / ${checks.sourceFiles} source files`,
      });

      const consoleScore = Math.max(0, 15 - Math.floor(checks.consoleLogs / 3));
      scoreItems.push({
        name: 'No debug leftovers',
        score: consoleScore,
        max: 15,
        detail: `${checks.consoleLogs} console.log calls`,
      });

      const secretScore =
        checks.potentialSecrets === 0 ? 20 : Math.max(0, 20 - checks.potentialSecrets * 5);
      scoreItems.push({
        name: 'No hardcoded secrets',
        score: secretScore,
        max: 20,
        detail: `${checks.potentialSecrets} potential secrets found`,
      });

      const todoScore = Math.max(0, 10 - Math.floor(checks.todos / 10));
      scoreItems.push({
        name: 'Low TODO debt',
        score: todoScore,
        max: 10,
        detail: `${checks.todos} TODO comments`,
      });

      const fileScore = Math.max(0, 15 - Math.floor(checks.longFiles / 2));
      scoreItems.push({
        name: 'File size discipline',
        score: fileScore,
        max: 15,
        detail: `${checks.longFiles} files > 500 lines`,
      });

      const gitScore =
        checks.uncommittedChanges < 5
          ? 15
          : Math.max(0, 15 - Math.floor(checks.uncommittedChanges / 3));
      scoreItems.push({
        name: 'Clean git status',
        score: gitScore,
        max: 15,
        detail: `${checks.uncommittedChanges} uncommitted changes`,
      });

      const totalScore = scoreItems.reduce((s, i) => s + i.score, 0);
      const grade =
        totalScore >= 85
          ? 'A'
          : totalScore >= 70
            ? 'B'
            : totalScore >= 55
              ? 'C'
              : totalScore >= 40
                ? 'D'
                : 'F';

      const gradeEmoji = { A: '🟢', B: '🟡', C: '🟠', D: '🔴', F: '🔴' };

      const output = [
        `╔══════════════════════════════════════════╗`,
        `  WORKSPACE HEALTH SCORE`,
        `  ${rootPath.split('/').pop()}`,
        `╚══════════════════════════════════════════╝`,
        '',
        `  ${gradeEmoji[grade]} Overall: ${totalScore}/100  (Grade ${grade})`,
        '',
        '### SCORE BREAKDOWN',
        ...scoreItems.map((item) => {
          const bar = '█'.repeat(item.score) + '░'.repeat(item.max - item.score);
          return `  ${item.name.padEnd(28)} ${String(item.score).padStart(2)}/${item.max}  ${bar}  ${item.detail}`;
        }),
        '',
        '### QUICK STATS',
        `  Source files:       ${checks.sourceFiles}`,
        `  Test files:         ${checks.testFiles}`,
        `  Total deps:         ${checks.totalDeps}`,
        `  Git branches:       ${checks.branches}`,
        `  Uncommitted:        ${checks.uncommittedChanges}`,
        '',
        totalScore >= 70
          ? '✅ Codebase looks healthy. Focus on areas below 70%.'
          : '⚠️  Several quality concerns detected. See breakdown above.',
      ];

      return output.join('\n');
    },

    // ── 20. GET_ARCHITECTURE_OVERVIEW ─────────────────────────────────────────────
    // Produces a high-level architectural summary: layers of the codebase,
    // separation of concerns, module boundaries, entry points, data flow direction,
    // and a plain-language description of how the system is structured.
    // The best tool to call when the AI needs to understand a new codebase
    // holistically before making any architectural decisions.
    get_architecture_overview: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');

      onStage(`🏗️ Building architectural overview of ${rootPath}`);

      // 1. Get workspace snapshot
      const [inspectResult, treeResult, gitResult] = await Promise.all([
        window.electronAPI?.invoke?.('inspect-workspace', { rootPath }),
        window.electronAPI?.invoke?.('list-directory-tree', {
          dirPath: rootPath,
          maxDepth: 3,
          maxEntries: 200,
        }),
        window.electronAPI?.invoke?.('run-shell-command', {
          command: `git log --oneline -5 2>/dev/null || echo "(no git)"`,
          cwd: rootPath,
          timeout: 8000,
          allowRisky: false,
        }),
      ]);

      const summary = inspectResult?.summary;
      const treeLines = treeResult?.lines ?? [];

      // 2. Identify architectural layers from directory names
      const LAYER_HINTS = {
        'api|routes|controllers|handlers|endpoints': 'API Layer',
        'services|domain|core|business|usecases|use_cases': 'Business Logic',
        'models|entities|schemas|db|database|repositories|repos': 'Data / Persistence',
        'components|views|pages|screens|ui': 'Presentation / UI',
        'utils|helpers|lib|shared|common': 'Shared Utilities',
        'hooks|context|store|state|redux|zustand|mobx': 'State Management',
        'middleware|guards|interceptors|decorators': 'Middleware / Cross-cutting',
        'config|settings|env': 'Configuration',
        'tests|__tests__|spec|e2e|fixtures': 'Testing',
        'scripts|tools|cli': 'Dev Tooling',
        'types|interfaces|models': 'Type Definitions',
      };

      const topDirs = treeLines
        .filter((l) => l.endsWith('/') && l.split('/').length <= 3)
        .map((l) => l.trim().replace(/\/$/, '').split('/').pop().toLowerCase());

      const detectedLayers = {};
      for (const dir of topDirs) {
        for (const [pattern, label] of Object.entries(LAYER_HINTS)) {
          if (new RegExp(pattern).test(dir)) {
            if (!detectedLayers[label]) detectedLayers[label] = [];
            detectedLayers[label].push(dir);
          }
        }
      }

      // 3. Find entry points
      const ENTRY_PATTERNS = [
        'index.js',
        'index.ts',
        'main.js',
        'main.ts',
        'app.js',
        'app.ts',
        'server.js',
        'server.ts',
        'main.py',
        'app.py',
        '__main__.py',
      ];
      const entryPoints = treeLines.filter(
        (l) => ENTRY_PATTERNS.some((e) => l.trim().endsWith(e)) && !l.includes('node_modules'),
      );

      // 4. Detect architectural pattern
      const allDirs = topDirs.join(' ');
      let archPattern = 'Unknown';
      if (/controller.*service|service.*repository|repository/.test(allDirs))
        archPattern = 'Layered / MVC';
      else if (/domain|usecase|entit/.test(allDirs)) archPattern = 'Clean Architecture / DDD';
      else if (/feature|modules?/.test(allDirs)) archPattern = 'Feature-based / Modular';
      else if (
        /api|service|gateway/.test(allDirs) &&
        summary?.frameworks?.join('').includes('Express')
      )
        archPattern = 'Microservice / API-first';
      else if (
        summary?.frameworks?.some((f) =>
          ['next', 'nuxt', 'remix', 'gatsby'].includes(f?.toLowerCase()),
        )
      )
        archPattern = 'Full-stack Framework (SSR/SSG)';
      else if (
        summary?.frameworks?.some((f) =>
          ['react', 'vue', 'angular', 'svelte'].includes(f?.toLowerCase()),
        )
      )
        archPattern = 'SPA / Client-side';
      else if (/routes|pages/.test(allDirs)) archPattern = 'Router-centric';

      // 5. Data flow direction inference
      let dataFlow = 'Cannot determine without deeper analysis.';
      if (archPattern.includes('Layered') || archPattern.includes('Clean')) {
        dataFlow =
          'Request → Controller/Handler → Service → Repository → Database\nResponse flows in reverse.';
      } else if (archPattern.includes('SPA')) {
        dataFlow = 'User Event → Component → State/Store → API call → Update State → Re-render';
      } else if (archPattern.includes('SSR')) {
        dataFlow =
          'Browser request → Server renders page → Client hydrates → User events → API updates';
      }

      // 6. Summarize recent commits for context
      const recentCommits = gitResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 5) ?? [];

      const output = [
        `╔══════════════════════════════════════════════════╗`,
        `  ARCHITECTURE OVERVIEW`,
        `  ${rootPath.split('/').pop()}`,
        `╚══════════════════════════════════════════════════╝`,
        '',
        `### DETECTED PATTERN`,
        `  ${archPattern}`,
        '',
        `### TECH STACK`,
        `  Languages:  ${(summary?.languages ?? []).join(', ') || 'unknown'}`,
        `  Frameworks: ${(summary?.frameworks ?? []).join(', ') || 'none detected'}`,
        `  Testing:    ${(summary?.testing ?? []).join(', ') || 'none detected'}`,
        `  Pkg mgr:    ${summary?.packageManager || 'unknown'}`,
        '',
      ];

      if (Object.keys(detectedLayers).length) {
        output.push('### ARCHITECTURAL LAYERS');
        for (const [layer, dirs] of Object.entries(detectedLayers)) {
          output.push(`  ${layer.padEnd(32)} ← ${dirs.join(', ')}`);
        }
        output.push('');
      }

      output.push('### DATA FLOW');
      output.push(`  ${dataFlow.replace(/\n/g, '\n  ')}`);
      output.push('');

      if (entryPoints.length) {
        output.push('### ENTRY POINTS');
        entryPoints.slice(0, 8).forEach((ep) => output.push(`  ${ep.trim()}`));
        output.push('');
      }

      if (summary?.packageScripts && Object.keys(summary.packageScripts).length) {
        output.push('### KEY SCRIPTS');
        Object.entries(summary.packageScripts)
          .slice(0, 6)
          .forEach(([k, v]) => output.push(`  ${k.padEnd(15)} ${v.slice(0, 60)}`));
        output.push('');
      }

      if (recentCommits.length && !recentCommits[0].includes('no git')) {
        output.push('### RECENT COMMITS');
        recentCommits.forEach((c) => output.push(`  ${c}`));
        output.push('');
      }

      output.push('### AI GUIDANCE');
      output.push(`  Pattern detected: ${archPattern}`);
      if (detectedLayers['API Layer'])
        output.push(`  API surface likely in: ${detectedLayers['API Layer'].join(', ')}`);
      if (detectedLayers['Business Logic'])
        output.push(`  Business logic likely in: ${detectedLayers['Business Logic'].join(', ')}`);
      if (detectedLayers['Data / Persistence'])
        output.push(`  Data layer likely in: ${detectedLayers['Data / Persistence'].join(', ')}`);
      output.push('  Run get_dependency_graph and find_api_endpoints for deeper analysis.');

      return output.join('\n');
    },
  },
});
