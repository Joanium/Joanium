import { createExecutor } from '../Shared/createExecutor.js';
import { state } from '../../../../../System/State.js';
import { buildPatternRegex } from './PatternUtils.js';
import { toolsList } from './ToolsList.js';
function resolveWorkingDirectory(explicitPath) {
  return explicitPath?.trim() || state.workspacePath || '';
}
function formatRisk(risk) {
  if (!risk || !risk.level || 'low' === risk.level) return '';
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
  if (
    (summary.ciWorkflows?.length && lines.push(`CI workflows: ${summary.ciWorkflows.join(', ')}`),
    summary.dockerFiles?.length && lines.push(`Docker files: ${summary.dockerFiles.join(', ')}`),
    summary.envFiles?.length && lines.push(`Env files: ${summary.envFiles.join(', ')}`),
    summary.packageScripts && Object.keys(summary.packageScripts).length)
  ) {
    const scriptPreview = Object.entries(summary.packageScripts)
      .slice(0, 12)
      .map(([name, value]) => `- ${name}: ${value}`)
      .join('\n');
    lines.push('', 'Scripts:', scriptPreview);
  }
  return (
    summary.notes?.length && lines.push('', 'Notes:', ...summary.notes.map((note) => `- ${note}`)),
    summary.topEntries?.length &&
      lines.push(
        '',
        'Top-level entries:',
        ...summary.topEntries
          .slice(0, 40)
          .map((entry) => `- ${entry.name}${'dir' === entry.type ? '/' : ''}`),
      ),
    lines.join('\n')
  );
}
async function ipcReadFile(filePath) {
  const result = await window.electronAPI?.invoke?.('read-local-file', {
    filePath: filePath,
    maxLines: 5e5,
  });
  if (!result?.ok) throw new Error(result?.error ?? `Could not read file: ${filePath}`);
  return { content: result.content, totalLines: result.totalLines, sizeBytes: result.sizeBytes };
}
// ── File-diff helpers (used by write handlers to emit jo:file-changed) ──
function _emitFileDiff(filePath, before, after) {
  try {
    window.dispatchEvent(
      new CustomEvent('jo:file-changed', {
        detail: { filePath, before: before ?? '', after: after ?? '' },
      }),
    );
  } catch {}
}
async function _readAndEmitFileDiff(filePath, before) {
  try {
    const r = await ipcReadFile(filePath);
    _emitFileDiff(filePath, before, r.content);
  } catch {}
}
async function ipcWriteFile(filePath, content) {
  const result = await window.electronAPI?.invoke?.('write-ai-file', {
    filePath: filePath,
    content: content,
    append: !1,
  });
  if (!result?.ok) throw new Error(result?.error ?? `Could not write file: ${filePath}`);
  return result;
}
function splitLines(content) {
  return content.split('\n');
}
function joinLines(lines) {
  return lines.join('\n');
}
function clampLine(oneBased, length) {
  return Math.max(1, Math.min(oneBased, length));
}
function detectLang(filePath) {
  return (
    {
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
    }[filePath.split('.').pop().toLowerCase()] || 'unknown'
  );
}
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
  html: { single: null, block: ['\x3c!--', '--\x3e'] },
  xml: { single: null, block: ['\x3c!--', '--\x3e'] },
  svg: { single: null, block: ['\x3c!--', '--\x3e'] },
  css: { single: null, block: ['/*', '*/'] },
  scss: { single: '//', block: ['/*', '*/'] },
  less: { single: '//', block: ['/*', '*/'] },
};
function getCommentStyle(filePath, override) {
  if (override)
    return (
      {
        '//': { single: '//', block: null },
        '#': { single: '#', block: null },
        '--': { single: '--', block: null },
        '/* */': { single: null, block: ['/*', '*/'] },
        '\x3c!-- --\x3e': { single: null, block: ['\x3c!--', '--\x3e'] },
      }[override] || { single: override, block: null }
    );
  const ext = filePath.split('.').pop().toLowerCase();
  return COMMENT_STYLES[ext] || { single: '//', block: null };
}
export const { handles: handles, execute: execute } = createExecutor({
  name: 'TerminalExecutor',
  tools: toolsList,
  handlers: {
    inspect_workspace: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');
      onStage(`📂 Inspecting workspace ${rootPath}`);
      const result = await window.electronAPI?.invoke?.('inspect-workspace', {
        rootPath: rootPath,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace inspection failed');
      return formatWorkspaceSummary(result.summary);
    },
    search_workspace: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');
      if (!params.query?.trim()) throw new Error('Missing required param: query');
      onStage(`🔎 Searching workspace for "${params.query}"`);
      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: rootPath,
        query: params.query,
        maxResults: params.max_results,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace search failed');
      return result.matches?.length
        ? [
            `Matches for "${params.query}" in ${result.root}:`,
            '',
            ...result.matches.map((match) => `- ${match.path}:${match.lineNumber} — ${match.line}`),
          ].join('\n')
        : `No matches for "${params.query}" in ${rootPath}.`;
    },
    find_file_by_name: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');
      if (!params.name?.trim()) throw new Error('Missing required param: name');
      onStage(`🔎 Finding file "${params.name}"`);
      const result = await window.electronAPI?.invoke?.('find-file-by-name', {
        rootPath: rootPath,
        name: params.name,
        maxResults: params.max_results,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Find file failed');
      return result.matches?.length
        ? [
            `Files matching "${params.name}" in ${result.root}:`,
            '',
            ...result.matches.map((match) => `- ${match.path}`),
          ].join('\n')
        : `No files matching "${params.name}" found in ${rootPath}.`;
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
      const {
        command: command,
        timeout_seconds: timeout_seconds = 30,
        allow_risky: allow_risky = !1,
      } = params;
      if (!command?.trim()) throw new Error('Missing required param: command');
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      onStage(`💻 Running: \`${command.slice(0, 80)}${command.length > 80 ? '…' : ''}\``);
      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command: command,
        cwd: workingDirectory,
        timeout: 1e3 * timeout_seconds,
        allowRisky: allow_risky,
      });
      if (!result) return '⚠️ Shell command execution is not available in this environment.';
      if (!result.ok && result.error)
        return [result.error, formatRisk(result.risk)].filter(Boolean).join('\n\n');
      const parts = [];
      if ((result.cwd && parts.push(`Working directory: ${result.cwd}`), result.risk)) {
        const riskText = formatRisk(result.risk);
        riskText && parts.push(riskText);
      }
      return (
        result.timedOut && parts.push(`⏰ Command timed out after ${timeout_seconds}s`),
        result.stdout?.trim() && parts.push(`STDOUT:\n\`\`\`\n${result.stdout.trim()}\n\`\`\``),
        result.stderr?.trim() && parts.push(`STDERR:\n\`\`\`\n${result.stderr.trim()}\n\`\`\``),
        0 !== result.exitCode && parts.push(`Exit code: ${result.exitCode}`),
        result.stdout?.trim() || result.stderr?.trim() || parts.push('(no output)'),
        parts.join('\n\n')
      );
    },
    read_local_file: async (params, onStage) => {
      const { path: filePath, max_lines: max_lines } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`📄 Reading ${filePath}`);
      const result = await window.electronAPI?.invoke?.('read-local-file', {
        filePath: filePath,
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
      const result = await window.electronAPI?.invoke?.('extract-document-text', {
        filePath: filePath,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Document extraction failed');
      return (function (result, filePath) {
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
      })(result, filePath);
    },
    read_file_chunk: async (params, onStage) => {
      const { path: filePath, start_line: start_line, line_count: line_count } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_line) throw new Error('Missing required param: start_line');
      onStage(`📄 Reading lines around ${filePath}:${start_line}`);
      const result = await window.electronAPI?.invoke?.('read-file-chunk', {
        filePath: filePath,
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
      onStage('Reading multiple files');
      const result = await window.electronAPI?.invoke?.('read-multiple-local-files', {
        paths: params.paths,
        maxLinesPerFile: params.max_lines_per_file,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Multi-file read failed');
      return (function (result) {
        return [
          `Read ${result.files.length} file${1 !== result.files.length ? 's' : ''}:`,
          '',
          ...result.files.map((file) =>
            file.ok
              ? [
                  `### ${file.path}`,
                  `Size: ${(file.sizeBytes / 1024).toFixed(1)} KB | Lines: ${file.totalLines}`,
                  '```',
                  file.content,
                  '```',
                ].join('\n')
              : [`### ${file.path}`, `Error: ${file.error}`].join('\n'),
          ),
        ].join('\n');
      })(result);
    },
    list_directory: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');
      onStage(`📁 Listing ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('list-directory', { dirPath: dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Directory listing failed');
      const lines = result.entries.map((entry) => {
        const icon = 'dir' === entry.type ? '📁' : '📄',
          size =
            null != entry.size
              ? ` (${entry.size < 1024 ? `${entry.size} B` : `${(entry.size / 1024).toFixed(1)} KB`})`
              : '';
        return `${icon} ${entry.name}${'dir' === entry.type ? '/' : ''}${size}`;
      });
      return [
        `Directory: ${result.path}`,
        `${result.count} item${1 !== result.count ? 's' : ''}:`,
        '',
        ...lines,
      ].join('\n');
    },
    list_directory_tree: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');
      onStage(`Listing tree for ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('list-directory-tree', {
        dirPath: dirPath,
        maxDepth: params.max_depth,
        maxEntries: params.max_entries,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Directory tree failed');
      return (function (result) {
        return [
          `Directory tree for ${result.path}:`,
          `Entries shown: ${result.count}${result.truncated ? ' (truncated)' : ''} | Depth: ${result.maxDepth}`,
          '```',
          result.lines.join('\n'),
          '```',
        ].join('\n');
      })(result);
    },
    write_file: async (params, onStage) => {
      const { path: filePath, content: content } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == content) throw new Error('Missing required param: content');
      const append = !0 === params.append || 'true' === params.append;
      onStage(`✍️ ${append ? 'Appending to' : 'Writing'} ${filePath}`);
      let _diffBefore = '';
      try {
        _diffBefore = (await ipcReadFile(filePath)).content;
      } catch {
        _diffBefore = '';
      }
      const result = await window.electronAPI?.invoke?.('write-ai-file', {
        filePath: filePath,
        content: content,
        append: append,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'File write failed');
      if (append) {
        _readAndEmitFileDiff(filePath, _diffBefore);
      } else {
        _emitFileDiff(filePath, _diffBefore, content);
      }
      return `✅ File ${append ? 'appended' : 'written'}: ${result.path} (${result.bytes} bytes)`;
    },
    apply_file_patch: async (params, onStage) => {
      const { path: filePath, search: search, replace: replace, replace_all: replace_all } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if ('string' != typeof search || !search.length)
        throw new Error('Missing required param: search');
      if ('string' != typeof replace) throw new Error('Missing required param: replace');
      onStage(`🩹 Patching ${filePath}`);
      let _diffBefore = '';
      try {
        _diffBefore = (await ipcReadFile(filePath)).content;
      } catch {
        _diffBefore = '';
      }
      const result = await window.electronAPI?.invoke?.('apply-file-patch', {
        filePath: filePath,
        search: search,
        replace: replace,
        replaceAll: replace_all,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'File patch failed');
      _readAndEmitFileDiff(filePath, _diffBefore);
      return `✅ Patched ${result.path} (${result.replacements} replacement${1 !== result.replacements ? 's' : ''})`;
    },
    replace_lines_in_file: async (params, onStage) => {
      const {
        path: filePath,
        start_line: start_line,
        end_line: end_line,
        replacement: replacement,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if ('string' != typeof replacement) throw new Error('Missing required param: replacement');
      onStage(`Replacing lines ${start_line}-${end_line} in ${filePath}`);
      let _diffBefore = '';
      try {
        _diffBefore = (await ipcReadFile(filePath)).content;
      } catch {
        _diffBefore = '';
      }
      const result = await window.electronAPI?.invoke?.('replace-lines-in-file', {
        filePath: filePath,
        startLine: start_line,
        endLine: end_line,
        replacement: replacement,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Line replacement failed');
      _readAndEmitFileDiff(filePath, _diffBefore);
      return `✅ Replaced lines ${result.startLine}-${result.endLine} in ${result.path}`;
    },
    insert_into_file: async (params, onStage) => {
      const { path: filePath, content: content } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if ('string' != typeof content) throw new Error('Missing required param: content');
      onStage(`Inserting text into ${filePath}`);
      let _diffBefore = '';
      try {
        _diffBefore = (await ipcReadFile(filePath)).content;
      } catch {
        _diffBefore = '';
      }
      const result = await window.electronAPI?.invoke?.('insert-into-file', {
        filePath: filePath,
        content: content,
        position: params.position,
        lineNumber: params.line_number,
        anchor: params.anchor,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Insert failed');
      _readAndEmitFileDiff(filePath, _diffBefore);
      return `✅ Inserted text into ${result.path} using ${result.mode} targeting (${result.position})`;
    },
    create_folder: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');
      onStage(`📁 Creating folder ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('create-directory', { dirPath: dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Folder creation failed');
      return `✅ Folder created: ${result.path}`;
    },
    copy_item: async (params, onStage) => {
      const { source_path: source_path, destination_path: destination_path } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!destination_path?.trim()) throw new Error('Missing required param: destination_path');
      onStage(`Copying ${source_path}`);
      let _destBefore = '';
      try {
        _destBefore = (await ipcReadFile(destination_path)).content;
      } catch {}
      const result = await window.electronAPI?.invoke?.('copy-item', {
        sourcePath: source_path,
        destinationPath: destination_path,
        overwrite: params.overwrite,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Copy failed');
      _readAndEmitFileDiff(destination_path, _destBefore);
      return `✅ Copied ${result.source} -> ${result.destination}`;
    },
    move_item: async (params, onStage) => {
      const { source_path: source_path, destination_path: destination_path } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!destination_path?.trim()) throw new Error('Missing required param: destination_path');
      onStage(`Moving ${source_path}`);
      let _srcBefore = '';
      try {
        _srcBefore = (await ipcReadFile(source_path)).content;
      } catch {}
      let _destBefore = '';
      try {
        _destBefore = (await ipcReadFile(destination_path)).content;
      } catch {}
      const result = await window.electronAPI?.invoke?.('move-item', {
        sourcePath: source_path,
        destinationPath: destination_path,
        overwrite: params.overwrite,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Move failed');
      _emitFileDiff(source_path, _srcBefore, '');
      _emitFileDiff(destination_path, _destBefore, _srcBefore);
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
        checkout: params.checkout ?? !0,
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
      return (function (result) {
        const lines = [];
        if (
          (result.summary && lines.push(formatWorkspaceSummary(result.summary), ''),
          !result.commands?.length)
        )
          return (lines.push(result.error || 'No project checks ran.'), lines.join('\n'));
        lines.push(`Overall status: **${result.ok ? 'passed' : 'needs attention'}**`, '');
        for (const command of result.commands)
          (lines.push(`### ${command.label.toUpperCase()}`),
            lines.push(`Command: \`${command.command}\``),
            lines.push(`Exit code: ${command.exitCode}${command.timedOut ? ' (timed out)' : ''}`),
            command.stdout?.trim() && lines.push('STDOUT:', '```', command.stdout.trim(), '```'),
            command.stderr?.trim() && lines.push('STDERR:', '```', command.stderr.trim(), '```'),
            command.stdout?.trim() || command.stderr?.trim() || lines.push('(no output)'),
            lines.push(''));
        return lines.join('\n');
      })(result);
    },
    open_folder: async (params, onStage) => {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');
      onStage(`📂 Opening folder in OS ${dirPath}`);
      const result = await window.electronAPI?.invoke?.('open-folder-os', { dirPath: dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Opening folder failed');
      return `✅ Opened folder in system file explorer: ${dirPath}`;
    },
    delete_item: async (params, onStage) => {
      const { path: itemPath } = params;
      if (!itemPath?.trim()) throw new Error('Missing required param: path');
      onStage(`🗑️ Deleting ${itemPath}`);
      let _before = '';
      try {
        _before = (await ipcReadFile(itemPath)).content;
      } catch {}
      const result = await window.electronAPI?.invoke?.('delete-item', { itemPath: itemPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Delete failed');
      _emitFileDiff(itemPath, _before, '');
      return `✅ Successfully deleted: ${itemPath}`;
    },
    start_local_server: async (params, onStage) => {
      const { command: command } = params;
      if (!command?.trim()) throw new Error('Missing required param: command');
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      onStage(`🚀 Starting server: ${command}`);
      const invokePayload = { command: command, cwd: workingDirectory };
      null != params.settle_ms &&
        '' !== params.settle_ms &&
        (invokePayload.settleMs = Number(params.settle_ms));
      const result = await window.electronAPI?.invoke?.('pty-spawn', invokePayload);
      if (!result?.ok) {
        const parts = [result.error ?? 'Background process failed to start'];
        throw (
          null != result.exitCode && parts.push(`Exit code: ${result.exitCode}`),
          result.outputSnippet?.trim() &&
            parts.push('', 'Captured output:', '```', result.outputSnippet.trim(), '```'),
          new Error(parts.join('\n'))
        );
      }
      return `[TERMINAL:${result.pid}]\n\nBackground command is running. Output appears in the terminal above.`;
    },
    get_file_metadata: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`🔍 Reading metadata for ${filePath}`);
      const {
          content: content,
          totalLines: totalLines,
          sizeBytes: sizeBytes,
        } = await ipcReadFile(filePath),
        words = content.trim() ? content.trim().split(/\s+/).length : 0,
        chars = content.length,
        ext = filePath.split('.').pop().toLowerCase(),
        lang = detectLang(filePath),
        blankLines = content.split('\n').filter((l) => !l.trim()).length,
        avgLineLen = totalLines > 0 ? Math.round(chars / totalLines) : 0;
      return [
        `File: ${filePath}`,
        `Extension: .${ext} | Language: ${lang}`,
        'Size: ' + (sizeBytes < 1024 ? `${sizeBytes} B` : `${(sizeBytes / 1024).toFixed(2)} KB`),
        `Lines: ${totalLines} total (${blankLines} blank, ${totalLines - blankLines} non-blank)`,
        `Words: ${words.toLocaleString()}`,
        `Characters: ${chars.toLocaleString()}`,
        `Avg line length: ${avgLineLen} chars`,
        'Has CRLF line endings: ' + (content.includes('\r\n') ? 'Yes' : 'No'),
        'Has BOM: ' + (65279 === content.charCodeAt(0) ? 'Yes' : 'No'),
        'Trailing newline: ' + (content.endsWith('\n') ? 'Yes' : 'No'),
      ].join('\n');
    },
    search_in_file: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const contextLines = params.context_lines ?? 2,
        maxMatches = params.max_matches ?? 50,
        caseSensitive = !0 === params.case_sensitive,
        useRegex = !0 === params.regex;
      onStage(`🔎 Searching in ${filePath} for "${pattern}"`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        fileLines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? 'g' : 'gi',
        errorPrefix: 'Invalid regex pattern',
      });
      const matchedIndices = [];
      for (
        let i = 0;
        i < fileLines.length &&
        ((regex.lastIndex = 0),
        !(
          regex.test(fileLines[i]) && (matchedIndices.push(i), matchedIndices.length >= maxMatches)
        ));
        i++
      );
      if (!matchedIndices.length)
        return `No matches for "${pattern}" in ${filePath} (${totalLines} lines searched).`;
      const output = [
          `Found ${matchedIndices.length}${matchedIndices.length >= maxMatches ? '+' : ''} match${1 !== matchedIndices.length ? 'es' : ''} for "${pattern}" in ${filePath}:`,
          '',
        ],
        blocks = [];
      let block = null;
      for (const idx of matchedIndices) {
        const from = Math.max(0, idx - contextLines),
          to = Math.min(fileLines.length - 1, idx + contextLines);
        !block || from > block.to + 1
          ? (block && blocks.push(block), (block = { from: from, to: to, matches: [idx] }))
          : ((block.to = Math.max(block.to, to)), block.matches.push(idx));
      }
      block && blocks.push(block);
      for (const b of blocks) {
        output.push(`--- lines ${b.from + 1}–${b.to + 1} ---`);
        for (let i = b.from; i <= b.to; i++) {
          const lineNum = String(i + 1).padStart(5, ' '),
            marker = b.matches.includes(i) ? '▶' : ' ';
          output.push(`${lineNum}${marker} ${fileLines[i]}`);
        }
        output.push('');
      }
      return output.join('\n');
    },
    read_file_around_line: async (params, onStage) => {
      const { path: filePath, line: line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!line) throw new Error('Missing required param: line');
      const radius = params.radius ?? 15;
      onStage(`📄 Reading context around line ${line} in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        fileLines = splitLines(content),
        center = clampLine(line, fileLines.length) - 1,
        from = Math.max(0, center - radius),
        to = Math.min(fileLines.length - 1, center + radius),
        output = [
          `File: ${filePath} | Total lines: ${totalLines}`,
          `Showing lines ${from + 1}–${to + 1} (centered on line ${line}):`,
          '',
        ];
      for (let i = from; i <= to; i++) {
        const lineNum = String(i + 1).padStart(5, ' '),
          marker = i === center ? '▶' : ' ';
        output.push(`${lineNum}${marker} ${fileLines[i]}`);
      }
      return output.join('\n');
    },
    count_occurrences: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const caseSensitive = !0 === params.case_sensitive,
        useRegex = !0 === params.regex;
      onStage(`🔢 Counting occurrences of "${pattern}" in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        fileLines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? 'g' : 'gi',
        errorPrefix: 'Invalid regex',
      });
      let totalCount = 0;
      const hitLines = [];
      for (let i = 0; i < fileLines.length; i++) {
        regex.lastIndex = 0;
        const lineMatches = fileLines[i].match(regex);
        lineMatches &&
          ((totalCount += lineMatches.length),
          hitLines.push({ line: i + 1, count: lineMatches.length, text: fileLines[i].trim() }));
      }
      return totalCount
        ? [
            `"${pattern}" in ${filePath}:`,
            `Total occurrences: ${totalCount} across ${hitLines.length} line${1 !== hitLines.length ? 's' : ''} (of ${totalLines} total)`,
            '',
            'Lines with matches:',
            ...hitLines
              .slice(0, 100)
              .map(
                (h) =>
                  `  Line ${h.line}${h.count > 1 ? ` (×${h.count})` : ''}: ${h.text.slice(0, 120)}`,
              ),
            ...(hitLines.length > 100 ? [`  … and ${hitLines.length - 100} more lines`] : []),
          ].join('\n')
        : `No occurrences of "${pattern}" in ${filePath} (${totalLines} lines searched).`;
    },
    get_file_structure: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`🗂️ Extracting structure from ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        fileLines = splitLines(content),
        lang = detectLang(filePath),
        patterns = {
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
        },
        activePats =
          patterns[lang] || patterns['ts' === lang ? 'js' : 'unknown'] || patterns.unknown,
        entries = [];
      for (let i = 0; i < fileLines.length; i++) {
        const trimmed = fileLines[i].trim();
        if (trimmed)
          for (const pat of activePats) {
            const m = trimmed.match(pat.re);
            if (m) {
              const name = m[pat.group]?.trim() ?? trimmed.slice(0, 60);
              entries.push({ lineNum: i + 1, label: pat.label, name: name });
              break;
            }
          }
      }
      if (!entries.length)
        return `No recognizable structure found in ${filePath} (${totalLines} lines, detected: ${lang}).`;
      const grouped = {};
      for (const e of entries) (grouped[e.label] = grouped[e.label] || []).push(e);
      const output = [`Structure of ${filePath} (${totalLines} lines, ${lang}):`, ''],
        order = [
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
      for (const lbl of [...order, ...Object.keys(grouped).filter((k) => !order.includes(k))])
        if (grouped[lbl]) {
          output.push(`### ${lbl.toUpperCase()} (${grouped[lbl].length})`);
          for (const e of grouped[lbl].slice(0, 40)) output.push(`  Line ${e.lineNum}: ${e.name}`);
          (grouped[lbl].length > 40 && output.push(`  … +${grouped[lbl].length - 40} more`),
            output.push(''));
        }
      return output.join('\n');
    },
    diff_two_files: async (params, onStage) => {
      const { path_a: path_a, path_b: path_b } = params;
      if (!path_a?.trim()) throw new Error('Missing required param: path_a');
      if (!path_b?.trim()) throw new Error('Missing required param: path_b');
      const contextLines = params.context_lines ?? 3;
      onStage(`📊 Diffing ${path_a} vs ${path_b}`);
      const [fileA, fileB] = await Promise.all([ipcReadFile(path_a), ipcReadFile(path_b)]),
        linesA = splitLines(fileA.content),
        linesB = splitLines(fileB.content),
        diff = (function (linesA, linesB, nameA, nameB, contextLines = 3) {
          const output = [`--- ${nameA}`, `+++ ${nameB}`],
            n = linesA.length,
            m = linesB.length;
          if (n > 2e3 || m > 2e3)
            return (
              output.push(
                '(diff truncated — files too large for inline diff; use git diff instead)',
              ),
              output.join('\n')
            );
          const dp = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
          for (let i = 1; i <= n; i++)
            for (let j = 1; j <= m; j++)
              dp[i][j] =
                linesA[i - 1] === linesB[j - 1]
                  ? dp[i - 1][j - 1] + 1
                  : Math.max(dp[i - 1][j], dp[i][j - 1]);
          const edits = [];
          let i = n,
            j = m;
          for (; i > 0 || j > 0; )
            i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]
              ? (edits.push({ type: 'eq', lineA: i, lineB: j, text: linesA[i - 1] }), i--, j--)
              : j > 0 && (0 === i || dp[i][j - 1] >= dp[i - 1][j])
                ? (edits.push({ type: 'ins', lineA: i, lineB: j, text: linesB[j - 1] }), j--)
                : (edits.push({ type: 'del', lineA: i, lineB: j, text: linesA[i - 1] }), i--);
          edits.reverse();
          const changed = edits
            .map((e, idx) => ({ ...e, idx: idx }))
            .filter((e) => 'eq' !== e.type);
          if (!changed.length) return ['(files are identical)'].join('\n');
          const hunks = [];
          let hunk = null;
          for (const ch of changed)
            !hunk || ch.idx - hunk.end > 2 * contextLines
              ? (hunk && hunks.push(hunk), (hunk = { start: ch.idx, end: ch.idx, changes: [ch] }))
              : ((hunk.end = ch.idx), hunk.changes.push(ch));
          hunk && hunks.push(hunk);
          for (const h of hunks) {
            const from = Math.max(0, h.start - contextLines),
              to = Math.min(edits.length - 1, h.end + contextLines),
              slice = edits.slice(from, to + 1),
              aStart = slice.find((e) => 'ins' !== e.type)?.lineA ?? 1,
              bStart = slice.find((e) => 'del' !== e.type)?.lineB ?? 1,
              aCount = slice.filter((e) => 'ins' !== e.type).length,
              bCount = slice.filter((e) => 'del' !== e.type).length;
            output.push(`@@ -${aStart},${aCount} +${bStart},${bCount} @@`);
            for (const e of slice)
              'eq' === e.type
                ? output.push(` ${e.text}`)
                : 'del' === e.type
                  ? output.push(`-${e.text}`)
                  : output.push(`+${e.text}`);
          }
          return output.join('\n');
        })(linesA, linesB, path_a.split('/').pop(), path_b.split('/').pop(), contextLines);
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
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      onStage(`🗑️ Deleting lines ${start_line}–${end_line} from ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = clampLine(start_line, lines.length) - 1,
        e = clampLine(end_line, lines.length);
      if (s >= e)
        throw new Error(`start_line (${start_line}) must be less than end_line (${end_line})`);
      const deleted = e - s;
      lines.splice(s, deleted);
      await ipcWriteFile(filePath, joinLines(lines));
      _emitFileDiff(filePath, content, joinLines(lines));
      return `✅ Deleted ${deleted} line${1 !== deleted ? 's' : ''} (${start_line}–${end_line}) from ${filePath}\nFile now has ${lines.length} lines (was ${totalLines}).`;
    },
    move_lines: async (params, onStage) => {
      const {
        path: filePath,
        start_line: start_line,
        end_line: end_line,
        target_line: target_line,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (null == target_line) throw new Error('Missing required param: target_line');
      onStage(
        `↕️ Moving lines ${start_line}–${end_line} to before line ${target_line} in ${filePath}`,
      );
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = clampLine(start_line, lines.length) - 1,
        e = clampLine(end_line, lines.length),
        t = clampLine(target_line, lines.length) - 1;
      if (t >= s && t <= e)
        throw new Error(
          `target_line (${target_line}) is inside the source range (${start_line}–${end_line})`,
        );
      const block = lines.splice(s, e - s),
        insertAt = t > e ? t - block.length : t;
      lines.splice(insertAt, 0, ...block);
      await ipcWriteFile(filePath, joinLines(lines));
      _emitFileDiff(filePath, content, joinLines(lines));
      return `✅ Moved ${block.length} line${1 !== block.length ? 's' : ''} (${start_line}–${end_line}) to position ${target_line} in ${filePath}`;
    },
    duplicate_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      onStage(`📋 Duplicating lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = clampLine(start_line, lines.length) - 1,
        e = clampLine(end_line, lines.length),
        block = lines.slice(s, e);
      lines.splice(e, 0, ...block);
      await ipcWriteFile(filePath, joinLines(lines));
      _emitFileDiff(filePath, content, joinLines(lines));
      return `✅ Duplicated ${block.length} line${1 !== block.length ? 's' : ''} (${start_line}–${end_line}) — copy inserted at line ${e + 1} in ${filePath}`;
    },
    sort_lines_in_range: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const descending = !0 === params.descending,
        trimBeforeSort = !0 === params.trim_before_sort;
      onStage(`🔤 Sorting lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = clampLine(start_line, lines.length) - 1,
        e = clampLine(end_line, lines.length),
        block = lines.slice(s, e),
        sorted = [...block].sort((a, b) => {
          const ca = trimBeforeSort ? a.trimStart() : a,
            cb = trimBeforeSort ? b.trimStart() : b;
          return descending ? cb.localeCompare(ca) : ca.localeCompare(cb);
        });
      lines.splice(s, block.length, ...sorted);
      await ipcWriteFile(filePath, joinLines(lines));
      _emitFileDiff(filePath, content, joinLines(lines));
      return `✅ Sorted ${block.length} line${1 !== block.length ? 's' : ''} (${start_line}–${end_line}) in ${descending ? 'descending' : 'ascending'} order in ${filePath}`;
    },
    indent_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const amount = params.amount ?? 2,
        useTabs = !0 === params.use_tabs,
        unit = useTabs ? '\t' : ' '.repeat(Math.abs(amount)),
        adding = amount > 0;
      onStage(
        `${adding ? '→' : '←'} ${adding ? 'Indenting' : 'Dedenting'} lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = clampLine(start_line, lines.length) - 1,
        e = clampLine(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++)
        if (adding) ((lines[i] = unit + lines[i]), changed++);
        else {
          const stripped = useTabs
            ? lines[i].replace(/^\t/, '')
            : lines[i].replace(new RegExp(`^ {1,${Math.abs(amount)}}`), '');
          stripped !== lines[i] && ((lines[i] = stripped), changed++);
        }
      await ipcWriteFile(filePath, joinLines(lines));
      _emitFileDiff(filePath, content, joinLines(lines));
      return `✅ ${adding ? 'Indented' : 'Dedented'} ${changed} line${1 !== changed ? 's' : ''} by ${useTabs ? '1 tab' : `${Math.abs(amount)} space${1 !== Math.abs(amount) ? 's' : ''}`} in ${filePath}`;
    },
    wrap_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const prefix = params.prefix ?? '',
        suffix = params.suffix ?? '',
        skipEmpty = !0 === params.skip_empty_lines;
      if (!prefix && !suffix) throw new Error('At least one of prefix or suffix is required.');
      onStage(`🎁 Wrapping lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = clampLine(start_line, lines.length) - 1,
        e = clampLine(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++)
        (skipEmpty && !lines[i].trim()) ||
          ((lines[i] = `${prefix}${lines[i]}${suffix}`), changed++);
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Wrapped ${changed} line${1 !== changed ? 's' : ''} with prefix="${prefix}" suffix="${suffix}" in ${filePath}`
      );
    },
    find_replace_regex: async (params, onStage) => {
      const { path: filePath, pattern: pattern, replacement: replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (null == replacement) throw new Error('Missing required param: replacement');
      const flags = params.flags ?? 'gm';
      onStage(`🔁 Regex replace in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath);
      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }
      const matches = content.match(regex),
        count = matches ? matches.length : 0;
      if (!count) return `No matches for /${pattern}/${flags} in ${filePath} — file unchanged.`;
      const updated = content.replace(regex, replacement);
      return (
        await ipcWriteFile(filePath, updated),
        `✅ Replaced ${count} match${1 !== count ? 'es' : ''} of /${pattern}/${flags} in ${filePath}`
      );
    },
    batch_replace: async (params, onStage) => {
      const { path: filePath, replacements: raw } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!raw?.trim()) throw new Error('Missing required param: replacements');
      let pairs;
      try {
        if (((pairs = JSON.parse(raw)), !Array.isArray(pairs))) throw new Error('Not an array');
      } catch (e) {
        throw new Error(
          `replacements must be a JSON array of {search, replace} objects: ${e.message}`,
        );
      }
      const useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive;
      onStage(`🔁 Applying ${pairs.length} replacements in ${filePath}`);
      let { content: content } = await ipcReadFile(filePath);
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
        const matches = content.match(regex),
          count = matches ? matches.length : 0;
        (count && (content = content.replace(regex, pair.replace ?? '')),
          results.push(
            `  ${count > 0 ? '✓' : '·'} "${pair.search}" → "${pair.replace ?? ''}" (${count} replacement${1 !== count ? 's' : ''})`,
          ));
      }
      return (
        await ipcWriteFile(filePath, content),
        [`✅ Batch replace complete in ${filePath}:`, ...results].join('\n')
      );
    },
    insert_at_marker: async (params, onStage) => {
      const { path: filePath, marker: marker, content: insertContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!marker?.trim()) throw new Error('Missing required param: marker');
      if (null == insertContent) throw new Error('Missing required param: content');
      const position = (params.position ?? 'after').toLowerCase(),
        allOccurrences = !0 === params.all_occurrences;
      onStage(`📍 Inserting at marker "${marker}" in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        markerIndices = [];
      for (let i = 0; i < lines.length; i++) lines[i].includes(marker) && markerIndices.push(i);
      if (!markerIndices.length)
        return `Marker "${marker}" not found in ${filePath} — file unchanged.`;
      const targets = allOccurrences ? markerIndices : [markerIndices[0]],
        insertLines = splitLines(insertContent);
      for (let k = targets.length - 1; k >= 0; k--) {
        const idx = targets[k],
          insertAt = 'before' === position ? idx : idx + 1;
        lines.splice(insertAt, 0, ...insertLines);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Inserted ${insertLines.length} line${1 !== insertLines.length ? 's' : ''} ${position} ${targets.length} marker${1 !== targets.length ? 's' : ''} ("${marker}") in ${filePath}`
      );
    },
    backup_file: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`💾 Backing up ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        ts = (function () {
          const d = new Date(),
            pad = (n) => String(n).padStart(2, '0');
          return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`;
        })(),
        parts = filePath.split('/'),
        filename = parts.pop(),
        backupPath = `${params.backup_dir?.trim() || parts.join('/')}/${filename}.${ts}.bak`;
      return (await ipcWriteFile(backupPath, content), `✅ Backup created: ${backupPath}`);
    },
    extract_lines_to_file: async (params, onStage) => {
      const {
        source_path: source_path,
        output_path: output_path,
        start_line: start_line,
        end_line: end_line,
      } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!output_path?.trim()) throw new Error('Missing required param: output_path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      onStage(`✂️ Extracting lines ${start_line}–${end_line} from ${source_path}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(source_path),
        lines = splitLines(content),
        s = clampLine(start_line, lines.length) - 1,
        e = clampLine(end_line, lines.length),
        extracted = lines.slice(s, e);
      return (
        await ipcWriteFile(output_path, joinLines(extracted)),
        `✅ Extracted ${extracted.length} line${1 !== extracted.length ? 's' : ''} (${start_line}–${end_line} of ${totalLines}) from ${source_path} → ${output_path}`
      );
    },
    merge_files: async (params, onStage) => {
      const { source_paths: rawPaths, output_path: output_path } = params;
      if (!rawPaths?.trim()) throw new Error('Missing required param: source_paths');
      if (!output_path?.trim()) throw new Error('Missing required param: output_path');
      const paths = rawPaths
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      if (paths.length < 2)
        throw new Error('source_paths must contain at least 2 comma-separated paths');
      const separator = (params.separator ?? '\n').replace(/\\n/g, '\n');
      onStage(`🔗 Merging ${paths.length} files into ${output_path}`);
      const chunks = [];
      let totalLines = 0;
      for (const p of paths) {
        const { content: content, totalLines: tl } = await ipcReadFile(p);
        (chunks.push(content), (totalLines += tl));
      }
      const merged = chunks.join(separator);
      return (
        await ipcWriteFile(output_path, merged),
        `✅ Merged ${paths.length} files (${totalLines} total lines) → ${output_path}\nSources: ${paths.join(', ')}`
      );
    },
    trim_file_whitespace: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`✂️ Trimming trailing whitespace in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content);
      let changed = 0;
      const trimmed = lines.map((l) => {
        const t = l.trimEnd();
        return (t !== l && changed++, t);
      });
      for (; trimmed.length > 1 && '' === trimmed[trimmed.length - 1]; ) trimmed.pop();
      return (
        trimmed.push(''),
        await ipcWriteFile(filePath, trimmed.join('\n')),
        `✅ Trimmed trailing whitespace on ${changed} of ${totalLines} lines in ${filePath}`
      );
    },
    normalize_file: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`🧹 Normalizing ${filePath}`);
      let { content: content } = await ipcReadFile(filePath);
      const changes = [];
      (65279 === content.charCodeAt(0) &&
        ((content = content.slice(1)), changes.push('stripped BOM')),
        content.includes('\r\n') &&
          ((content = content.replace(/\r\n/g, '\n')), changes.push('converted CRLF → LF')),
        content.includes('\r') &&
          ((content = content.replace(/\r/g, '')), changes.push('removed stray CR')));
      const lines = content.split('\n');
      let trailingFixed = 0;
      const cleaned = lines.map((l) => {
        const t = l.trimEnd();
        return (t !== l && trailingFixed++, t);
      });
      for (
        trailingFixed && changes.push(`trimmed trailing whitespace on ${trailingFixed} lines`);
        cleaned.length > 1 && '' === cleaned[cleaned.length - 1];
      )
        cleaned.pop();
      cleaned.push('');
      const normalized = cleaned.join('\n');
      return (
        await ipcWriteFile(filePath, normalized),
        changes.length
          ? `✅ Normalized ${filePath}:\n${changes.map((c) => `  • ${c}`).join('\n')}`
          : `✅ ${filePath} was already normalized — no changes made.`
      );
    },
    find_files_by_content: async (params, onStage) => {
      const { directory: directory, pattern: pattern } = params;
      if (!directory?.trim()) throw new Error('Missing required param: directory');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const maxResults = params.max_results ?? 30,
        allowedExts =
          (params.case_sensitive,
          params.regex,
          params.file_glob
            ? params.file_glob.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
            : null);
      onStage(`🔍 Scanning files in ${directory} for "${pattern}"`);
      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: directory,
        query: pattern,
        maxResults: 5 * maxResults,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Content search failed');
      if (!result.matches?.length) return `No files containing "${pattern}" found in ${directory}.`;
      const byFile = {};
      for (const m of result.matches) {
        const ext = m.path.split('.').pop().toLowerCase();
        (allowedExts && !allowedExts.includes(ext)) ||
          (byFile[m.path] = byFile[m.path] || []).push(m);
      }
      const files = Object.entries(byFile).slice(0, maxResults);
      if (!files.length)
        return 'No matching files found (extension filter may have excluded results).';
      const output = [
        `Files containing "${pattern}" in ${directory}:`,
        `Found in ${files.length} file${1 !== files.length ? 's' : ''}${Object.keys(byFile).length > maxResults ? ` (showing first ${maxResults})` : ''}:`,
        '',
      ];
      for (const [filePath, matches] of files) {
        output.push(`📄 ${filePath} (${matches.length} match${1 !== matches.length ? 'es' : ''})`);
        for (const m of matches.slice(0, 5))
          output.push(`   Line ${m.lineNumber}: ${m.line.trim().slice(0, 120)}`);
        (matches.length > 5 && output.push(`   … +${matches.length - 5} more matches`),
          output.push(''));
      }
      return output.join('\n');
    },
    find_between_markers: async (params, onStage) => {
      const { path: filePath, start_marker: start_marker, end_marker: end_marker } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');
      const inclusive = !1 !== params.inclusive,
        occurrence = Math.max(1, params.occurrence ?? 1);
      onStage(`🔖 Finding content between markers in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content);
      let found = 0,
        startIdx = -1,
        endIdx = -1;
      for (let i = 0; i < lines.length; i++)
        if (-1 === startIdx && lines[i].includes(start_marker) && (found++, found === occurrence))
          startIdx = i;
        else if (-1 !== startIdx && -1 === endIdx && lines[i].includes(end_marker)) {
          endIdx = i;
          break;
        }
      if (-1 === startIdx) return `Start marker "${start_marker}" not found in ${filePath}.`;
      if (-1 === endIdx)
        return `Start marker found at line ${startIdx + 1} but end marker "${end_marker}" was not found after it.`;
      const from = inclusive ? startIdx : startIdx + 1,
        to = inclusive ? endIdx + 1 : endIdx,
        block = lines.slice(from, to);
      return [
        `Content between "${start_marker}" and "${end_marker}" (occurrence ${occurrence}) in ${filePath}:`,
        `Lines ${from + 1}–${to} | ${block.length} line${1 !== block.length ? 's' : ''}`,
        '',
        '```',
        block.join('\n'),
        '```',
      ].join('\n');
    },
    find_duplicate_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const ignoreBlank = !1 !== params.ignore_blank,
        trimCompare = !1 !== params.trim_before_compare;
      onStage(`🔍 Scanning for duplicate lines in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        start = (params.start_line ? Math.max(1, params.start_line) : 1) - 1,
        end = params.end_line ? Math.min(params.end_line, lines.length) : lines.length,
        slice = lines.slice(start, end),
        seen = new Map();
      for (let i = 0; i < slice.length; i++) {
        const raw = slice[i];
        if (ignoreBlank && !raw.trim()) continue;
        const key = trimCompare ? raw.trim() : raw;
        (seen.has(key) || seen.set(key, []), seen.get(key).push(start + i + 1));
      }
      const dupes = [...seen.entries()].filter(([, nums]) => nums.length > 1);
      if (!dupes.length)
        return `No duplicate lines found in ${filePath} (${totalLines} lines scanned).`;
      const output = [
        `Duplicate lines in ${filePath} (${dupes.length} unique value${1 !== dupes.length ? 's' : ''} duplicated):`,
        '',
      ];
      for (const [text, nums] of dupes.slice(0, 60))
        output.push(`Lines [${nums.join(', ')}]: ${text.slice(0, 100)}`);
      return (
        dupes.length > 60 && output.push(`… and ${dupes.length - 60} more`),
        output.join('\n')
      );
    },
    find_todos: async (params, onStage) => {
      const { directory: directory } = params;
      if (!directory?.trim()) throw new Error('Missing required param: directory');
      const tags = (params.tags ?? 'TODO,FIXME,HACK,NOTE,XXX')
          .split(',')
          .map((t) => t.trim().toUpperCase()),
        tagPattern = tags.join('|');
      onStage(`📋 Scanning for ${tags.join(', ')} in ${directory}`);
      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: directory,
        query: tags[0],
        maxResults: 500,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace scan failed');
      const allResults = result.matches ?? [],
        tagRe = new RegExp(`(${tagPattern})\\s*:?\\s*(.*)`, 'i'),
        grouped = {};
      for (const m of allResults) {
        const match = m.line.match(tagRe);
        if (!match) continue;
        const tag = match[1].toUpperCase(),
          msg = match[2]?.trim() || '';
        tags.includes(tag) &&
          (grouped[tag] = grouped[tag] || []).push({ path: m.path, line: m.lineNumber, msg: msg });
      }
      if (!Object.keys(grouped).length)
        return `No ${tags.join('/')} comments found in ${directory}.`;
      const output = [`TODO scan of ${directory}:`, ''];
      let total = 0;
      for (const tag of tags)
        if (grouped[tag]) {
          output.push(`### ${tag} (${grouped[tag].length})`);
          for (const item of grouped[tag])
            output.push(
              `  ${item.path}:${item.line}${item.msg ? ` — ${item.msg.slice(0, 100)}` : ''}`,
            );
          ((total += grouped[tag].length), output.push(''));
        }
      return (
        output.unshift(
          `Found ${total} comment${1 !== total ? 's' : ''} across ${Object.keys(grouped).length} tag type${1 !== Object.keys(grouped).length ? 's' : ''}:`,
        ),
        output.join('\n')
      );
    },
    get_line_numbers_matching: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const useRegex = !0 === params.regex,
        includeText = !1 !== params.include_text;
      onStage(`🔢 Getting line numbers matching "${pattern}" in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: 'i',
        errorPrefix: 'Invalid regex',
      });
      const hits = [];
      for (let i = 0; i < lines.length; i++)
        regex.test(lines[i]) && hits.push({ num: i + 1, text: lines[i] });
      return hits.length
        ? [
            `${hits.length} line${1 !== hits.length ? 's' : ''} matching "${pattern}" in ${filePath}:`,
            '',
            ...hits.map((h) => (includeText ? `  ${h.num}: ${h.text.trimEnd()}` : `  ${h.num}`)),
          ].join('\n')
        : `No lines matching "${pattern}" in ${filePath} (${totalLines} lines).`;
    },
    comment_out_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const style = getCommentStyle(filePath, params.style),
        marker = style.single || (style.block ? style.block[0] : '//');
      onStage(`💬 Commenting lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++) {
        const trimmed = lines[i].trimStart();
        if (!trimmed || trimmed.startsWith(marker)) continue;
        const indent = lines[i].slice(0, lines[i].length - trimmed.length);
        ((lines[i] = `${indent}${marker} ${trimmed}`), changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Commented ${changed} line${1 !== changed ? 's' : ''} with "${marker}" in ${filePath}`
      );
    },
    uncomment_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const style = getCommentStyle(filePath, null),
        markers = [
          ...(style.single ? [style.single] : []),
          ...(style.block ? [style.block[0]] : []),
          '//',
          '#',
          '--',
          '\x3c!--',
          '/*',
        ];
      onStage(`💬 Uncommenting lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++) {
        const trimmed = lines[i].trimStart(),
          indent = lines[i].slice(0, lines[i].length - trimmed.length);
        let uncommmented = null;
        for (const m of markers)
          if (trimmed.startsWith(m)) {
            uncommmented = indent + trimmed.slice(m.length).replace(/^ /, '');
            break;
          }
        null !== uncommmented && ((lines[i] = uncommmented), changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Uncommented ${changed} line${1 !== changed ? 's' : ''} in ${filePath}`
      );
    },
    reverse_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      onStage(`🔃 Reversing lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        block = lines.slice(s, e);
      return (
        block.reverse(),
        lines.splice(s, block.length, ...block),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Reversed ${block.length} lines (${start_line}–${end_line}) in ${filePath}`
      );
    },
    dedup_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const trimCompare = !0 === params.trim_before_compare,
        keepBlank = !1 !== params.keep_blank;
      onStage(`🧹 Removing duplicate lines in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1,
        e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length,
        prefix = lines.slice(0, s),
        suffix = lines.slice(e),
        region = lines.slice(s, e),
        seen = new Set();
      let blankSeen = !1;
      const deduped = [];
      for (const line of region) {
        if (!line.trim()) {
          keepBlank && !blankSeen
            ? (deduped.push(line), (blankSeen = !0))
            : keepBlank && deduped.push(line);
          continue;
        }
        blankSeen = !1;
        const key = trimCompare ? line.trim() : line;
        seen.has(key) || (seen.add(key), deduped.push(line));
      }
      const removed = region.length - deduped.length;
      return (
        lines.splice(s, region.length, ...deduped),
        await ipcWriteFile(filePath, joinLines([...prefix, ...deduped, ...suffix])),
        `✅ Removed ${removed} duplicate line${1 !== removed ? 's' : ''} in ${filePath} (${totalLines} → ${totalLines - removed} lines)`
      );
    },
    remove_blank_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const mode = (params.mode ?? 'collapse').toLowerCase();
      onStage(`🧹 ${'delete' === mode ? 'Deleting' : 'Collapsing'} blank lines in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1,
        e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length,
        region = lines.slice(s, e),
        processed = [];
      let lastBlank = !1;
      for (const line of region) {
        const isBlank = !line.trim();
        if ('delete' === mode) isBlank || processed.push(line);
        else {
          if (isBlank && lastBlank) continue;
          (processed.push(line), (lastBlank = isBlank));
        }
      }
      const removed = region.length - processed.length,
        newLines = [...lines.slice(0, s), ...processed, ...lines.slice(e)];
      return (
        await ipcWriteFile(filePath, joinLines(newLines)),
        `✅ ${'delete' === mode ? 'Deleted' : 'Collapsed'} ${removed} blank line${1 !== removed ? 's' : ''} in ${filePath} (${totalLines} → ${newLines.length} lines)`
      );
    },
    join_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const separator = params.separator ?? ' ',
        trimEach = !1 !== params.trim_each;
      onStage(`🔗 Joining lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        block = lines.slice(s, e),
        joined = (trimEach ? block.map((l) => l.trim()) : block).join(separator);
      return (
        lines.splice(s, block.length, joined),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Joined ${block.length} lines into 1 line at line ${start_line} in ${filePath} (separator: "${separator}")`
      );
    },
    split_line: async (params, onStage) => {
      const { path: filePath, line_number: line_number, delimiter: delimiter } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == line_number) throw new Error('Missing required param: line_number');
      if (!delimiter) throw new Error('Missing required param: delimiter');
      const trimParts = !1 !== params.trim_parts,
        preserveIndent = !1 !== params.preserve_indent;
      onStage(`✂️ Splitting line ${line_number} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        idx = Math.max(1, line_number) - 1;
      if (idx >= lines.length)
        throw new Error(`Line ${line_number} does not exist (file has ${lines.length} lines)`);
      const original = lines[idx],
        indent = preserveIndent ? original.match(/^(\s*)/)[1] : '',
        parts = (preserveIndent ? original.trimStart() : original).split(delimiter);
      if (1 === parts.length)
        return `Line ${line_number} does not contain delimiter "${delimiter}" — no change made.`;
      const newLines = parts.map((p) => `${indent}${trimParts ? p.trim() : p}`);
      return (
        lines.splice(idx, 1, ...newLines),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Split line ${line_number} into ${newLines.length} lines at delimiter "${delimiter}" in ${filePath}`
      );
    },
    rename_symbol: async (params, onStage) => {
      const { path: filePath, old_name: old_name, new_name: new_name } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!old_name?.trim()) throw new Error('Missing required param: old_name');
      if (!new_name?.trim()) throw new Error('Missing required param: new_name');
      const wholeWord = !1 !== params.whole_word;
      onStage(`🔤 Renaming "${old_name}" → "${new_name}" in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        escaped = old_name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        regex = new RegExp(wholeWord ? `\\b${escaped}\\b` : escaped, 'g'),
        matches = content.match(regex),
        count = matches ? matches.length : 0;
      if (!count) return `Symbol "${old_name}" not found in ${filePath} — no changes made.`;
      const updated = content.replace(regex, new_name);
      return (
        await ipcWriteFile(filePath, updated),
        `✅ Renamed "${old_name}" → "${new_name}" (${count} occurrence${1 !== count ? 's' : ''}) in ${filePath}${wholeWord ? ' [whole-word match]' : ''}`
      );
    },
    update_json_value: async (params, onStage) => {
      const { path: filePath, key_path: key_path, value: rawValue } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!key_path?.trim()) throw new Error('Missing required param: key_path');
      if (null == rawValue) throw new Error('Missing required param: value');
      const createIfMissing = !0 === params.create_if_missing;
      onStage(`📝 Updating JSON key "${key_path}" in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath);
      let json, newValue;
      try {
        json = JSON.parse(content);
      } catch (e) {
        throw new Error(`File is not valid JSON: ${e.message}`);
      }
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
        if (void 0 === cursor[k]) {
          if (!createIfMissing)
            throw new Error(
              `Key "${keys.slice(0, i + 1).join('.')}" does not exist. Set create_if_missing: true to create it.`,
            );
          cursor[k] = {};
        }
        if ('object' != typeof cursor[k] || Array.isArray(cursor[k]))
          throw new Error(
            `Key "${keys.slice(0, i + 1).join('.')}" exists but is not an object — cannot traverse into it.`,
          );
        cursor = cursor[k];
      }
      const lastKey = keys[keys.length - 1],
        existed = lastKey in cursor,
        oldValue = cursor[lastKey];
      cursor[lastKey] = newValue;
      const indentMatch = content.match(/^{\s*\n(\s+)/),
        indent = indentMatch ? indentMatch[1].length : 2;
      await ipcWriteFile(filePath, JSON.stringify(json, null, indent) + '\n');
      const action = existed ? 'Updated' : 'Created',
        oldStr = existed ? ` (was: ${JSON.stringify(oldValue)})` : '';
      return `✅ ${action} "${key_path}" = ${JSON.stringify(newValue)}${oldStr} in ${filePath}`;
    },
    multi_file_replace: async (params, onStage) => {
      const { paths: rawPaths, search: search, replace: replace } = params;
      if (!rawPaths?.trim()) throw new Error('Missing required param: paths');
      if (!search?.trim()) throw new Error('Missing required param: search');
      if (null == replace) throw new Error('Missing required param: replace');
      const paths = rawPaths
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean),
        useRegex = !0 === params.regex,
        flags = !0 === params.case_sensitive ? 'g' : 'gi';
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
      for (const filePath of paths)
        try {
          const { content: content } = await ipcReadFile(filePath),
            matches = content.match(regex),
            count = matches ? matches.length : 0;
          if (count) {
            const updated = content.replace(regex, replace);
            (await ipcWriteFile(filePath, updated),
              (totalChanges += count),
              results.push(`  ✓ ${filePath} — ${count} replacement${1 !== count ? 's' : ''}`));
          } else results.push(`  · ${filePath} — no matches`);
        } catch (err) {
          results.push(`  ✗ ${filePath} — error: ${err.message}`);
        }
      return [
        `Multi-file replace: "${search}" → "${replace}"`,
        `${totalChanges} total replacement${1 !== totalChanges ? 's' : ''} across ${paths.length} file${1 !== paths.length ? 's' : ''}:`,
        '',
        ...results,
      ].join('\n');
    },
    append_to_matching_lines: async (params, onStage) => {
      const { path: filePath, match_pattern: match_pattern, text: text } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!match_pattern?.trim()) throw new Error('Missing required param: match_pattern');
      if (null == text) throw new Error('Missing required param: text');
      const mode = (params.mode ?? 'append').toLowerCase(),
        useRegex = !0 === params.regex,
        skipIfPresent = !1 !== params.skip_already_present;
      onStage(
        `✏️ ${'prepend' === mode ? 'Prepending' : 'Appending'} to matching lines in ${filePath}`,
      );
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content);
      let regex;
      try {
        regex = useRegex
          ? new RegExp(match_pattern, 'i')
          : new RegExp(match_pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      } catch (e) {
        throw new Error(`Invalid match_pattern regex: ${e.message}`);
      }
      let changed = 0;
      for (let i = 0; i < lines.length; i++)
        regex.test(lines[i]) &&
          ((skipIfPresent && lines[i].includes(text)) ||
            ((lines[i] = 'prepend' === mode ? `${text}${lines[i]}` : `${lines[i]}${text}`),
            changed++));
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ ${'prepend' === mode ? 'Prepended' : 'Appended'} "${text}" to ${changed} matching line${1 !== changed ? 's' : ''} in ${filePath}`
      );
    },
    replace_in_range: async (params, onStage) => {
      const {
        path: filePath,
        start_line: start_line,
        end_line: end_line,
        search: search,
        replace: replace,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (!search?.trim()) throw new Error('Missing required param: search');
      if (null == replace) throw new Error('Missing required param: replace');
      const useRegex = !0 === params.regex,
        flags = !1 !== params.replace_all ? 'g' : '';
      onStage(`🎯 Scoped replace in lines ${start_line}–${end_line} of ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        regionLines = lines.slice(s, e),
        region = regionLines.join('\n');
      let regex;
      try {
        regex = useRegex
          ? new RegExp(search, flags)
          : new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags);
      } catch (err) {
        throw new Error(`Invalid regex: ${err.message}`);
      }
      const matches = region.match(new RegExp(regex.source, 'g')),
        count = matches ? matches.length : 0;
      if (!count)
        return `No matches for "${search}" in lines ${start_line}–${end_line} of ${filePath} — no changes.`;
      const updatedLines = region.replace(regex, replace).split('\n');
      return (
        lines.splice(s, regionLines.length, ...updatedLines),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Replaced ${count} occurrence${1 !== count ? 's' : ''} of "${search}" within lines ${start_line}–${end_line} in ${filePath}`
      );
    },
    swap_line_ranges: async (params, onStage) => {
      const {
        path: filePath,
        a_start: a_start,
        a_end: a_end,
        b_start: b_start,
        b_end: b_end,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == a_start || null == a_end)
        throw new Error('Missing required params: a_start, a_end');
      if (null == b_start || null == b_end)
        throw new Error('Missing required params: b_start, b_end');
      if (b_start <= a_end)
        throw new Error(
          `Block B (starts at ${b_start}) must begin after Block A ends (${a_end}). Ensure A comes before B.`,
        );
      onStage(
        `↔️ Swapping line ranges A:${a_start}–${a_end} ↔ B:${b_start}–${b_end} in ${filePath}`,
      );
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        as = a_start - 1,
        ae = a_end,
        bs = b_start - 1,
        be = b_end,
        blockA = lines.slice(as, ae),
        blockB = lines.slice(bs, be),
        between = lines.slice(ae, bs),
        newLines = [...lines.slice(0, as), ...blockB, ...between, ...blockA, ...lines.slice(be)];
      return (
        await ipcWriteFile(filePath, joinLines(newLines)),
        `✅ Swapped Block A (lines ${a_start}–${a_end}, ${blockA.length} lines) ↔ Block B (lines ${b_start}–${b_end}, ${blockB.length} lines) in ${filePath}`
      );
    },
    replace_between_markers: async (params, onStage) => {
      const {
        path: filePath,
        start_marker: start_marker,
        end_marker: end_marker,
        new_content: new_content,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');
      if (null == new_content) throw new Error('Missing required param: new_content');
      const preserveMarkers = !1 !== params.preserve_markers,
        occurrence = Math.max(1, params.occurrence ?? 1);
      onStage(`🔄 Replacing content between markers in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content);
      let found = 0,
        startIdx = -1,
        endIdx = -1;
      for (let i = 0; i < lines.length; i++)
        if (-1 === startIdx && lines[i].includes(start_marker) && (found++, found === occurrence))
          startIdx = i;
        else if (-1 !== startIdx && -1 === endIdx && lines[i].includes(end_marker)) {
          endIdx = i;
          break;
        }
      if (-1 === startIdx)
        return `Start marker "${start_marker}" not found (occurrence ${occurrence}) in ${filePath}.`;
      if (-1 === endIdx)
        return `Start marker found at line ${startIdx + 1} but end marker "${end_marker}" was not found after it.`;
      const newContentLines = splitLines(new_content),
        deleteFrom = preserveMarkers ? startIdx + 1 : startIdx,
        oldCount = (preserveMarkers ? endIdx : endIdx + 1) - deleteFrom;
      return (
        lines.splice(deleteFrom, oldCount, ...newContentLines),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Replaced ${oldCount} line${1 !== oldCount ? 's' : ''} between markers with ${newContentLines.length} new line${1 !== newContentLines.length ? 's' : ''} in ${filePath}`
      );
    },
    convert_indentation: async (params, onStage) => {
      const { path: filePath, to: to } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!to?.trim()) throw new Error('Missing required param: to (must be "tabs" or "spaces")');
      const direction = to.toLowerCase().trim();
      if ('tabs' !== direction && 'spaces' !== direction)
        throw new Error('to must be "tabs" or "spaces"');
      onStage(`⇥ Converting indentation to ${direction} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content);
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
        const candidates = Object.keys(counts)
          .map(Number)
          .filter((n) => n > 0)
          .sort((a, b) => a - b);
        spacesPerTab = candidates[0] || 2;
      }
      let changed = 0;
      const converted = lines.map((line) => {
        if ('tabs' === direction) {
          const m = line.match(/^( +)/);
          if (!m) return line;
          const spaceCount = m[1].length,
            tabs = Math.floor(spaceCount / spacesPerTab),
            leftover = spaceCount % spacesPerTab,
            newLine = '\t'.repeat(tabs) + ' '.repeat(leftover) + line.slice(spaceCount);
          return (newLine !== line && changed++, newLine);
        }
        {
          const m = line.match(/^(\t+)/);
          if (!m) return line;
          const tabCount = m[1].length,
            newLine = ' '.repeat(tabCount * spacesPerTab) + line.slice(tabCount);
          return (newLine !== line && changed++, newLine);
        }
      });
      return (
        await ipcWriteFile(filePath, joinLines(converted)),
        `✅ Converted indentation to ${direction} (${spacesPerTab} spaces per tab) — ${changed} line${1 !== changed ? 's' : ''} changed in ${filePath}`
      );
    },
    trace_symbol: async (params, onStage) => {
      const { symbol: symbol, path: rootPath } = params;
      if (!symbol?.trim()) throw new Error('Missing required param: symbol');
      const resolvedRoot = resolveWorkingDirectory(rootPath);
      if (!resolvedRoot) throw new Error('No workspace is open.');
      onStage(`🔍 Tracing all usages of "${symbol}" across workspace`);
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        [defResult, importResult, callResult] = await Promise.all([
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
        ]),
        defMatches = defResult?.matches ?? [],
        importMatches = importResult?.matches ?? [],
        allMatches = callResult?.matches ?? [],
        defPaths = new Set(defMatches.map((m) => `${m.path}:${m.lineNumber}`)),
        importPaths = new Set(importMatches.map((m) => `${m.path}:${m.lineNumber}`)),
        callSites = allMatches.filter(
          (m) =>
            !defPaths.has(`${m.path}:${m.lineNumber}`) &&
            !importPaths.has(`${m.path}:${m.lineNumber}`),
        ),
        byFile = {};
      for (const m of callSites) (byFile[m.path] = byFile[m.path] || []).push(m);
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
        `### CALL SITES (${callSites.length} across ${fileCount} file${1 !== fileCount ? 's' : ''})`,
      );
      for (const [filePath, hits] of Object.entries(byFile)) {
        lines.push(`  📄 ${filePath}`);
        for (const h of hits.slice(0, 8))
          lines.push(`     line ${h.lineNumber}: ${h.line.trim().slice(0, 120)}`);
        hits.length > 8 && lines.push(`     … +${hits.length - 8} more`);
      }
      return lines.join('\n');
    },
    profile_file_complexity: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`📊 Profiling complexity of ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        fileLines = splitLines(content),
        lang = detectLang(filePath),
        fnStartRe =
          /^(?:export\s+)?(?:async\s+)?(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|class\s+(\w+)|def\s+(\w+)|(?:public|private|protected)\s+\w+\s+(\w+)\s*\()/,
        openBrace = /[{(]/g,
        closeBrace = /[})]/g,
        functions = [];
      let currentFn = null,
        depth = 0,
        startDepth = 0,
        maxNesting = 0,
        localMaxNesting = 0;
      for (let i = 0; i < fileLines.length; i++) {
        const trimmed = fileLines[i].trim(),
          m = trimmed.match(fnStartRe);
        (m &&
          depth <= 1 &&
          (currentFn &&
            ((currentFn.endLine = i),
            (currentFn.length = i - currentFn.startLine),
            (currentFn.maxNesting = localMaxNesting),
            functions.push(currentFn)),
          (currentFn = {
            name: m[1] || m[2] || m[3] || m[4] || m[5] || '(anonymous)',
            startLine: i + 1,
            endLine: i + 1,
            length: 0,
            maxNesting: 0,
          }),
          (startDepth = depth),
          (localMaxNesting = 0)),
          (depth +=
            (trimmed.match(openBrace) || []).length - (trimmed.match(closeBrace) || []).length),
          (depth = Math.max(0, depth)),
          depth > maxNesting && (maxNesting = depth),
          depth > localMaxNesting && (localMaxNesting = depth));
      }
      currentFn &&
        ((currentFn.endLine = fileLines.length),
        (currentFn.length = fileLines.length - currentFn.startLine),
        (currentFn.maxNesting = localMaxNesting),
        functions.push(currentFn));
      const blankLines = fileLines.filter((l) => !l.trim()).length,
        commentLines = fileLines.filter((l) => /^\s*(\/\/|#|\/\*|\*|<!--)/.test(l)).length,
        todoCount = fileLines.filter((l) => /(TODO|FIXME|HACK|XXX)/i.test(l)).length,
        avgFnLen = functions.length
          ? Math.round(functions.reduce((a, f) => a + f.length, 0) / functions.length)
          : 0,
        longThreshold = params.long_function_threshold ?? 40,
        longFns = functions
          .filter((f) => f.length > longThreshold)
          .sort((a, b) => b.length - a.length),
        complexScore = Math.round(
          10 * maxNesting +
            5 * longFns.length +
            2 * todoCount +
            (totalLines > 300 ? (totalLines - 300) / 30 : 0),
        ),
        lines = [
          `Complexity profile: ${filePath}`,
          `Language: ${lang} | Lines: ${totalLines} | Functions: ${functions.length}`,
          `Blank: ${blankLines} | Comments: ${commentLines} | TODOs: ${todoCount}`,
          `Max nesting depth: ${maxNesting} | Avg function length: ${avgFnLen} lines`,
          `Complexity score: ${complexScore} (higher = more complex)`,
          '',
        ];
      if (longFns.length) {
        lines.push(`### LONG FUNCTIONS (> ${longThreshold} lines)`);
        for (const f of longFns.slice(0, 10))
          lines.push(
            `  ${f.name} — lines ${f.startLine}–${f.endLine} (${f.length} lines, max nesting: ${f.maxNesting})`,
          );
        lines.push('');
      }
      const deepFns = [...functions].sort((a, b) => b.maxNesting - a.maxNesting).slice(0, 5);
      if (deepFns.length) {
        lines.push('### MOST DEEPLY NESTED');
        for (const f of deepFns)
          lines.push(`  ${f.name} — line ${f.startLine} (max depth: ${f.maxNesting})`);
        lines.push('');
      }
      lines.push('### ALL FUNCTIONS');
      for (const f of functions) {
        const flag = f.length > longThreshold ? ' ⚠️' : '';
        lines.push(`  line ${f.startLine}: ${f.name} (${f.length} lines)${flag}`);
      }
      return lines.join('\n');
    },
    map_imports: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`🗺️ Mapping imports in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        fileLines = splitLines(content),
        imports = (detectLang(filePath), []),
        jsImportRe = /^import\s+(.+?)\s+from\s+['"](.+?)['"]/,
        jsRequireRe = /(?:const|let|var)\s+(.+?)\s*=\s*require\(['"](.+?)['"]\)/,
        jsDynamicRe = /import\(['"](.+?)['"]\)/,
        jsExportFromRe = /^export\s+.+\s+from\s+['"](.+?)['"]/,
        pyImportRe = /^import\s+(\S+)/,
        pyFromRe = /^from\s+(\S+)\s+import\s+(.+)/;
      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i].trim();
        let m;
        (m = line.match(jsImportRe))
          ? imports.push({ line: i + 1, what: m[1].trim(), from: m[2], kind: 'import' })
          : (m = line.match(jsExportFromRe))
            ? imports.push({ line: i + 1, what: '(re-export)', from: m[1], kind: 'export-from' })
            : (m = line.match(jsRequireRe))
              ? imports.push({ line: i + 1, what: m[1].trim(), from: m[2], kind: 'require' })
              : (m = line.match(jsDynamicRe))
                ? imports.push({ line: i + 1, what: '(dynamic)', from: m[1], kind: 'dynamic' })
                : (m = line.match(pyFromRe))
                  ? imports.push({
                      line: i + 1,
                      what: m[2].trim(),
                      from: m[1],
                      kind: 'from-import',
                    })
                  : (m = line.match(pyImportRe)) &&
                    imports.push({ line: i + 1, what: m[1], from: m[1], kind: 'import' });
      }
      if (!imports.length) return `No imports found in ${filePath} (${totalLines} lines).`;
      const internal = imports.filter((i) => i.from.startsWith('.') || i.from.startsWith('/')),
        external = imports.filter((i) => !i.from.startsWith('.') && !i.from.startsWith('/')),
        nodeBuiltins = new Set([
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
        ]),
        stdlib = external.filter((i) => nodeBuiltins.has(i.from.split('/')[0])),
        thirdParty = external.filter((i) => !nodeBuiltins.has(i.from.split('/')[0])),
        lines = [
          `Import map: ${filePath}`,
          `Total: ${imports.length} imports | Internal: ${internal.length} | Third-party: ${thirdParty.length} | Stdlib: ${stdlib.length}`,
          '',
        ];
      if (internal.length) {
        lines.push('### INTERNAL (relative/absolute)');
        for (const imp of internal)
          lines.push(`  line ${imp.line}: ${imp.what}  ←  "${imp.from}" [${imp.kind}]`);
        lines.push('');
      }
      if (thirdParty.length) {
        lines.push('### THIRD-PARTY PACKAGES');
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
        for (const imp of stdlib) lines.push(`  line ${imp.line}: ${imp.what}  ←  "${imp.from}"`);
        lines.push('');
      }
      const dynamic = imports.filter((i) => 'dynamic' === i.kind);
      if (dynamic.length) {
        lines.push('### DYNAMIC IMPORTS');
        for (const imp of dynamic) lines.push(`  line ${imp.line}: "${imp.from}"`);
      }
      return lines.join('\n');
    },
    find_dead_exports: async (params, onStage) => {
      const { path: filePath, workspace_path: workspace_path } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const rootPath = resolveWorkingDirectory(workspace_path);
      if (!rootPath) throw new Error('No workspace is open. Provide workspace_path.');
      onStage(`🪦 Scanning for dead exports in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        fileLines = splitLines(content),
        exportedSymbols = [],
        exportRe =
          /^export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface|enum)\s+(\w+)/,
        namedExportRe = /^export\s+\{([^}]+)\}/;
      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i].trim();
        let m;
        if ((m = line.match(exportRe))) exportedSymbols.push({ name: m[1], line: i + 1 });
        else if ((m = line.match(namedExportRe))) {
          const names = m[1].split(',').map((s) =>
            s
              .trim()
              .split(/\s+as\s+/)
              .pop()
              .trim(),
          );
          for (const name of names) name && exportedSymbols.push({ name: name, line: i + 1 });
        }
      }
      if (!exportedSymbols.length) return `No exported symbols found in ${filePath}.`;
      onStage(`Checking ${exportedSymbols.length} exports against workspace...`);
      const results = await Promise.all(
          exportedSymbols.map(async (sym) => {
            const result = await window.electronAPI?.invoke?.('search-workspace', {
                rootPath: rootPath,
                query: sym.name,
                maxResults: 10,
              }),
              matches = (result?.matches ?? []).filter(
                (m) => !m.path.endsWith(filePath.split('/').pop()),
              );
            return { ...sym, usages: matches.length };
          }),
        ),
        dead = results.filter((r) => 0 === r.usages),
        used = results.filter((r) => r.usages > 0),
        lines = [
          `Dead export analysis: ${filePath}`,
          `Exports checked: ${results.length} | Dead: ${dead.length} | Used: ${used.length}`,
          '',
        ];
      if (dead.length) {
        lines.push('### DEAD EXPORTS (never imported elsewhere)');
        for (const s of dead) lines.push(`  line ${s.line}: ${s.name}`);
        lines.push('');
      }
      if (used.length) {
        lines.push('### USED EXPORTS');
        for (const s of used)
          lines.push(
            `  line ${s.line}: ${s.name}  (${s.usages} reference${1 !== s.usages ? 's' : ''} in workspace)`,
          );
      }
      return lines.join('\n');
    },
    compare_json_files: async (params, onStage) => {
      const { path_a: path_a, path_b: path_b } = params;
      if (!path_a?.trim()) throw new Error('Missing required param: path_a');
      if (!path_b?.trim()) throw new Error('Missing required param: path_b');
      onStage('🔬 Deep-comparing JSON files');
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
      const added = [],
        removed = [],
        changed = [],
        unchanged = [];
      !(function deepDiff(a, b, path = '') {
        const allKeys = new Set([...Object.keys(a ?? {}), ...Object.keys(b ?? {})]);
        for (const key of allKeys) {
          const fullPath = path ? `${path}.${key}` : key,
            aVal = a?.[key],
            bVal = b?.[key];
          key in (a ?? {})
            ? key in (b ?? {})
              ? 'object' != typeof aVal ||
                null === aVal ||
                'object' != typeof bVal ||
                null === bVal ||
                Array.isArray(aVal) ||
                Array.isArray(bVal)
                ? JSON.stringify(aVal) !== JSON.stringify(bVal)
                  ? changed.push({ path: fullPath, from: aVal, to: bVal })
                  : unchanged.push(fullPath)
                : deepDiff(aVal, bVal, fullPath)
              : removed.push({ path: fullPath, value: aVal })
            : added.push({ path: fullPath, value: bVal });
        }
      })(jsonA, jsonB);
      const nameA = path_a.split('/').pop(),
        nameB = path_b.split('/').pop(),
        lines = [
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
        lines.push('### CHANGED');
        for (const c of changed)
          (lines.push(`  ~ ${c.path}`),
            lines.push(`      was: ${JSON.stringify(c.from).slice(0, 80)}`),
            lines.push(`      now: ${JSON.stringify(c.to).slice(0, 80)}`));
        lines.push('');
      }
      return (
        added.length ||
          removed.length ||
          changed.length ||
          lines.push('✅ Files are semantically identical.'),
        lines.join('\n')
      );
    },
    extract_env_vars: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage('🌍 Scanning for environment variable references');
      const patterns = [
          'process.env.',
          'import.meta.env.',
          'os.getenv(',
          'os.environ',
          'ENV[',
          'System.getenv(',
          'dotenv',
        ],
        allMatches = [];
      for (const pattern of patterns) {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath: rootPath,
          query: pattern,
          maxResults: 100,
        });
        result?.matches && allMatches.push(...result.matches);
      }
      if (!allMatches.length) return `No environment variable references found in ${rootPath}.`;
      const varNames = new Map(),
        varRe =
          /(?:process\.env|import\.meta\.env)\.([A-Z_][A-Z0-9_]*)|os\.getenv\(['"]([A-Z_][A-Z0-9_]*)['"]|ENV\[['"]([A-Z_][A-Z0-9_]*)['"]/g;
      for (const match of allMatches) {
        let m;
        for (varRe.lastIndex = 0; null !== (m = varRe.exec(match.line)); ) {
          const name = m[1] || m[2] || m[3];
          name &&
            (varNames.has(name) || varNames.set(name, new Set()),
            varNames.get(name).add(match.path));
        }
      }
      const sorted = [...varNames.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      return [
        `Environment variables in ${rootPath}:`,
        `Found ${sorted.length} unique variable${1 !== sorted.length ? 's' : ''} across ${new Set(allMatches.map((m) => m.path)).size} files`,
        '',
        '### VARIABLES',
        ...sorted.map(
          ([name, files]) =>
            `  ${name.padEnd(35)} used in ${files.size} file${1 !== files.size ? 's' : ''}`,
        ),
        '',
        '### .env TEMPLATE',
        '# Copy this to .env and fill in values:',
        ...sorted.map(([name]) => `${name}=`),
      ].join('\n');
    },
    get_call_graph: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`📞 Building call graph for ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        fileLines = splitLines(content),
        fnBoundaryRe =
          /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function/,
        functions = [];
      let depth = 0,
        current = null;
      for (let i = 0; i < fileLines.length; i++) {
        const trimmed = fileLines[i].trim(),
          m = trimmed.match(fnBoundaryRe);
        (m &&
          depth <= 1 &&
          (current && ((current.endLine = i), functions.push(current)),
          (current = { name: m[1] || m[2] || m[3], startLine: i, endLine: i, calls: [] })),
          (depth += (trimmed.match(/\{/g) || []).length - (trimmed.match(/\}/g) || []).length),
          (depth = Math.max(0, depth)));
      }
      current && ((current.endLine = fileLines.length - 1), functions.push(current));
      const fnNames = new Set(functions.map((f) => f.name));
      for (const fn of functions) {
        const body = fileLines.slice(fn.startLine, fn.endLine + 1).join('\n');
        for (const name of fnNames)
          name !== fn.name &&
            new RegExp(`\\b${name}\\s*\\(`, 'g').test(body) &&
            fn.calls.push(name);
      }
      if (!functions.length) return `No functions found in ${filePath}.`;
      const lines = [
        `Call graph: ${filePath} (${totalLines} lines, ${functions.length} functions)`,
        '',
      ];
      for (const fn of functions)
        fn.calls.length
          ? lines.push(`  ${fn.name}  →  ${fn.calls.join(', ')}`)
          : lines.push(`  ${fn.name}  →  (no internal calls)`);
      const calledByAnyone = new Set(functions.flatMap((f) => f.calls)),
        entryPoints = functions.filter((f) => !calledByAnyone.has(f.name));
      if (entryPoints.length) {
        (lines.push(''),
          lines.push('### ENTRY POINTS (not called by other functions in this file)'));
        for (const fn of entryPoints) lines.push(`  ${fn.name}  (line ${fn.startLine + 1})`);
      }
      return lines.join('\n');
    },
    audit_dependencies: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage('📦 Auditing dependencies');
      let declaredDeps = new Set(),
        declaredDevDeps = new Set(),
        pkgType = 'unknown';
      try {
        const pkgResult = await ipcReadFile(`${rootPath}/package.json`),
          pkg = JSON.parse(pkgResult.content);
        ((pkgType = 'node'),
          Object.keys(pkg.dependencies ?? {}).forEach((d) => declaredDeps.add(d)),
          Object.keys(pkg.devDependencies ?? {}).forEach((d) => declaredDevDeps.add(d)));
      } catch {
        try {
          const reqResult = await ipcReadFile(`${rootPath}/requirements.txt`);
          pkgType = 'python';
          for (const line of splitLines(reqResult.content)) {
            const pkg = line
              .trim()
              .split(/[>=<!]/)[0]
              .trim()
              .toLowerCase();
            pkg && !pkg.startsWith('#') && declaredDeps.add(pkg);
          }
        } catch {
          return 'No package.json or requirements.txt found in workspace root.';
        }
      }
      const importResult = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath: rootPath,
          query: 'node' === pkgType ? "from '|require('" : 'import |from ',
          maxResults: 500,
        }),
        usedPackages = new Set(),
        importLineRe =
          'node' === pkgType
            ? /(?:from|require)\s*\(?['"]([^./][^'"]*)['"]/g
            : /^(?:import|from)\s+(\S+)/gm;
      for (const match of importResult?.matches ?? []) {
        let m;
        for (importLineRe.lastIndex = 0; null !== (m = importLineRe.exec(match.line)); ) {
          const pkg = m[1]
            .split('/')[0]
            .replace(/^@[^/]+\/[^/]+.*/, (s) => s.split('/').slice(0, 2).join('/'));
          pkg && !pkg.startsWith('.') && usedPackages.add(pkg.toLowerCase());
        }
      }
      const allDeclared = new Set([...declaredDeps, ...declaredDevDeps]),
        unused = [...allDeclared].filter((d) => !usedPackages.has(d.toLowerCase())),
        undeclared = [...usedPackages].filter((u) => !allDeclared.has(u)),
        lines = [
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
      return (
        undeclared.length ||
          unused.length ||
          lines.push(
            '✅ All declared dependencies appear to be used and all imports are declared.',
          ),
        lines.join('\n')
      );
    },
    smart_grep: async (params, onStage) => {
      const {
        path: filePath,
        workspace_path: workspace_path,
        must_contain: must_contain,
        must_not_contain: must_not_contain,
        any_of: any_of,
      } = params;
      if (!must_contain && !any_of) throw new Error('Provide at least must_contain or any_of.');
      const rootPath = resolveWorkingDirectory(workspace_path),
        isFile = !!filePath?.trim();
      let lines;
      onStage('🔍 Smart grep' + (isFile ? ` in ${filePath}` : ' across workspace'));
      let fileMap = {};
      if (isFile) {
        const { content: content } = await ipcReadFile(filePath);
        ((lines = splitLines(content)), (fileMap[filePath] = lines));
      } else {
        if (!rootPath) throw new Error('Provide either path (single file) or workspace_path.');
        const seedQuery = must_contain?.[0] || any_of?.[0],
          result = await window.electronAPI?.invoke?.('search-workspace', {
            rootPath: rootPath,
            query: seedQuery,
            maxResults: 300,
          }),
          filePaths = [...new Set((result?.matches ?? []).map((m) => m.path))];
        await Promise.all(
          filePaths.map(async (fp) => {
            try {
              const { content: content } = await ipcReadFile(fp);
              fileMap[fp] = splitLines(content);
            } catch {}
          }),
        );
      }
      const mustPatterns = (must_contain ?? []).map(
          (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        ),
        notPatterns = (must_not_contain ?? []).map(
          (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        ),
        anyPatterns = (any_of ?? []).map(
          (p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        ),
        hits = [];
      for (const [fp, fileLines] of Object.entries(fileMap))
        for (let i = 0; i < fileLines.length; i++) {
          const line = fileLines[i];
          (mustPatterns.length && !mustPatterns.every((re) => re.test(line))) ||
            (notPatterns.length && notPatterns.some((re) => re.test(line))) ||
            (anyPatterns.length && !anyPatterns.some((re) => re.test(line))) ||
            hits.push({ path: fp, lineNum: i + 1, text: line.trim() });
        }
      if (!hits.length) return 'No lines matched the given conditions.';
      const output = [
          'Smart grep results:',
          must_contain?.length ? `  MUST contain: ${must_contain.join(' AND ')}` : '',
          any_of?.length ? `  ANY OF: ${any_of.join(' | ')}` : '',
          must_not_contain?.length ? `  MUST NOT contain: ${must_not_contain.join(', ')}` : '',
          `  Matches: ${hits.length}`,
          '',
        ].filter(Boolean),
        byFile = {};
      for (const h of hits) (byFile[h.path] = byFile[h.path] || []).push(h);
      for (const [fp, fileHits] of Object.entries(byFile)) {
        output.push(`📄 ${fp}`);
        for (const h of fileHits.slice(0, 20))
          output.push(`  ${h.lineNum}: ${h.text.slice(0, 120)}`);
        (fileHits.length > 20 && output.push(`  … +${fileHits.length - 20} more`), output.push(''));
      }
      return output.join('\n');
    },
    snapshot_workspace: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage(`📸 Snapshotting workspace ${rootPath}`);
      const [inspectResult, gitResult, treeResult] = await Promise.all([
          window.electronAPI?.invoke?.('inspect-workspace', { rootPath: rootPath }),
          window.electronAPI?.invoke?.('git-status', { workingDir: rootPath }),
          window.electronAPI?.invoke?.('list-directory-tree', {
            dirPath: rootPath,
            maxDepth: 3,
            maxEntries: 300,
          }),
        ]),
        summary = inspectResult?.summary,
        allEntries = (treeResult?.lines ?? []).filter((l) => l.trim()),
        fileEntries = allEntries.filter((l) => !l.endsWith('/')),
        dirEntries = allEntries.filter((l) => l.endsWith('/')),
        extCount = {};
      for (const entry of fileEntries) {
        const ext = entry.trim().split('.').pop().toLowerCase();
        ext && ext.length <= 5 && (extCount[ext] = (extCount[ext] || 0) + 1);
      }
      const topExts = Object.entries(extCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 8),
        entryPoints = fileEntries.filter((l) => {
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
        }),
        testFiles = fileEntries.filter((l) => {
          const name = l.trim().toLowerCase();
          return (
            name.includes('.test.') ||
            name.includes('.spec.') ||
            name.includes('_test.') ||
            name.includes('/test/') ||
            name.includes('/__tests__/')
          );
        }),
        gitLines = (gitResult?.stdout ?? '').split('\n').filter(Boolean),
        branch =
          gitLines.find((l) => l.startsWith('On branch'))?.replace('On branch ', '') || 'unknown',
        changedFiles = gitLines.filter((l) => /^[MADRC?]/.test(l.trim())).length,
        lines = [
          `  WORKSPACE SNAPSHOT: ${rootPath.split('/').pop()}`,
          '',
          `📁 Structure: ${fileEntries.length} files in ${dirEntries.length} directories`,
          `🌿 Git: branch "${branch}" | ${changedFiles} changed file${1 !== changedFiles ? 's' : ''}`,
          '',
        ];
      (summary &&
        (lines.push('### STACK DETECTED'),
        lines.push(`  Languages:   ${(summary.languages ?? []).join(', ') || 'unknown'}`),
        lines.push(`  Frameworks:  ${(summary.frameworks ?? []).join(', ') || 'none'}`),
        lines.push(`  Testing:     ${(summary.testing ?? []).join(', ') || 'none'}`),
        lines.push(`  Infra:       ${(summary.infra ?? []).join(', ') || 'none'}`),
        lines.push(`  Pkg manager: ${summary.packageManager || 'unknown'}`),
        lines.push('')),
        lines.push('### FILE BREAKDOWN BY EXTENSION'));
      for (const [ext, count] of topExts) {
        const bar = '█'.repeat(Math.round((count / Math.max(...topExts.map((e) => e[1]))) * 20));
        lines.push(`  .${ext.padEnd(8)} ${String(count).padStart(4)}  ${bar}`);
      }
      if ((lines.push(''), entryPoints.length)) {
        lines.push('### LIKELY ENTRY POINTS');
        for (const ep of entryPoints.slice(0, 8)) lines.push(`  ${ep.trim()}`);
        lines.push('');
      }
      if (
        (lines.push('### TEST COVERAGE'),
        lines.push(`  Test files found: ${testFiles.length}`),
        testFiles.length)
      ) {
        for (const t of testFiles.slice(0, 5)) lines.push(`  ${t.trim()}`);
        testFiles.length > 5 && lines.push(`  … +${testFiles.length - 5} more`);
      }
      if ((lines.push(''), summary?.packageScripts && Object.keys(summary.packageScripts).length)) {
        lines.push('### SCRIPTS');
        for (const [name, cmd] of Object.entries(summary.packageScripts).slice(0, 8))
          lines.push(`  ${name.padEnd(15)} ${cmd.slice(0, 70)}`);
        lines.push('');
      }
      if (summary?.notes?.length) {
        lines.push('### NOTES');
        for (const note of summary.notes) lines.push(`  ⚠️  ${note}`);
      }
      return lines.join('\n');
    },
    filter_lines: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive;
      onStage(`🔍 Keeping only lines matching "${pattern}" in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? '' : 'i',
        errorPrefix: 'Invalid pattern',
      });
      const kept = lines.filter((line) => regex.test(line)),
        removed = totalLines - kept.length;
      return kept.length
        ? (await ipcWriteFile(filePath, joinLines(kept)),
          `✅ Kept ${kept.length} matching lines, removed ${removed} non-matching lines in ${filePath} (${totalLines} → ${kept.length} lines)`)
        : `No lines matched "${pattern}" — all ${totalLines} lines would be deleted. File unchanged.`;
    },
    filter_out_lines: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive;
      onStage(`🗑️ Removing lines matching "${pattern}" from ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? '' : 'i',
        errorPrefix: 'Invalid pattern',
      });
      const kept = lines.filter((line) => !regex.test(line)),
        removed = totalLines - kept.length;
      return removed
        ? (await ipcWriteFile(filePath, joinLines(kept)),
          `✅ Removed ${removed} line${1 !== removed ? 's' : ''} matching "${pattern}" from ${filePath} (${totalLines} → ${kept.length} lines)`)
        : `No lines matched "${pattern}" — file unchanged.`;
    },
    insert_line_at_pattern: async (params, onStage) => {
      const { path: filePath, pattern: pattern, content: insertContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (null == insertContent) throw new Error('Missing required param: content');
      const position = (params.position ?? 'after').toLowerCase(),
        useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive,
        allOccurrences = !1 !== params.all_occurrences;
      onStage(`📍 Inserting content ${position} each matching line in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        fileLines = splitLines(content),
        insertLines = splitLines(insertContent);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? '' : 'i',
        errorPrefix: 'Invalid pattern',
      });
      const result = [];
      let insertCount = 0;
      for (const line of fileLines) {
        const matches = regex.test(line) && (allOccurrences || 0 === insertCount);
        (matches && 'before' === position && result.push(...insertLines),
          result.push(line),
          matches && 'after' === position && result.push(...insertLines),
          matches && insertCount++);
      }
      return insertCount
        ? (await ipcWriteFile(filePath, joinLines(result)),
          `✅ Inserted ${insertLines.length} line${1 !== insertLines.length ? 's' : ''} ${position} each of ${insertCount} matching line${1 !== insertCount ? 's' : ''} in ${filePath}`)
        : `No lines matched "${pattern}" — file unchanged.`;
    },
    replace_single_line: async (params, onStage) => {
      const { path: filePath, line_number: line_number, replacement: replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == line_number) throw new Error('Missing required param: line_number');
      if ('string' != typeof replacement) throw new Error('Missing required param: replacement');
      onStage(`✏️ Replacing line ${line_number} in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath);
      if (line_number < 1 || line_number > totalLines)
        throw new Error(
          `line_number ${line_number} is out of range (file has ${totalLines} lines)`,
        );
      const lines = splitLines(content),
        old = lines[line_number - 1];
      return (
        (lines[line_number - 1] = replacement),
        await ipcWriteFile(filePath, joinLines(lines)),
        [
          `✅ Replaced line ${line_number} in ${filePath}`,
          `  was: ${old.trim().slice(0, 120)}`,
          `  now: ${replacement.trim().slice(0, 120)}`,
        ].join('\n')
      );
    },
    swap_two_lines: async (params, onStage) => {
      const { path: filePath, line_a: line_a, line_b: line_b } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == line_a) throw new Error('Missing required param: line_a');
      if (null == line_b) throw new Error('Missing required param: line_b');
      if (line_a === line_b) throw new Error('line_a and line_b must be different');
      onStage(`↔️ Swapping lines ${line_a} and ${line_b} in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath);
      for (const n of [line_a, line_b])
        if (n < 1 || n > totalLines)
          throw new Error(`Line ${n} is out of range (file has ${totalLines} lines)`);
      const lines = splitLines(content);
      return (
        ([lines[line_a - 1], lines[line_b - 1]] = [lines[line_b - 1], lines[line_a - 1]]),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Swapped line ${line_a} ↔ line ${line_b} in ${filePath}`
      );
    },
    add_file_header: async (params, onStage) => {
      const { path: filePath, content: headerContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!headerContent) throw new Error('Missing required param: content');
      const skipIfPresent = !1 !== params.skip_if_present,
        separator = params.separator ?? '\n';
      onStage(`📎 Adding header to ${filePath}`);
      const { content: content } = await ipcReadFile(filePath);
      if (skipIfPresent && content.startsWith(headerContent.trimEnd()))
        return `Header already present at top of ${filePath} — no change made.`;
      const newContent = headerContent.trimEnd() + separator + content;
      return (
        await ipcWriteFile(filePath, newContent),
        `✅ Added ${splitLines(headerContent).length}-line header to top of ${filePath}`
      );
    },
    add_file_footer: async (params, onStage) => {
      const { path: filePath, content: footerContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!footerContent) throw new Error('Missing required param: content');
      const skipIfPresent = !1 !== params.skip_if_present,
        separator = params.separator ?? '\n';
      onStage(`📎 Adding footer to ${filePath}`);
      const { content: content } = await ipcReadFile(filePath);
      if (skipIfPresent && content.trimEnd().endsWith(footerContent.trimStart()))
        return `Footer already present at bottom of ${filePath} — no change made.`;
      const newContent = content.trimEnd() + separator + footerContent.trimStart();
      return (
        await ipcWriteFile(filePath, newContent),
        `✅ Added ${splitLines(footerContent).length}-line footer to bottom of ${filePath}`
      );
    },
    strip_comments: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const keepBlankLines = !1 !== params.keep_blank_lines;
      onStage(`🧹 Stripping comment lines from ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        style = getCommentStyle(filePath, null),
        singleMarkers = [];
      style.single && singleMarkers.push(style.single);
      for (const m of ['//', '#', '--']) singleMarkers.includes(m) || singleMarkers.push(m);
      const blockStart = style.block?.[0] ?? null,
        blockEnd = style.block?.[1] ?? null;
      let inBlock = !1,
        removed = 0;
      const result = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (blockStart && blockEnd) {
          if (!inBlock && trimmed.startsWith(blockStart)) {
            ((inBlock = !trimmed.slice(blockStart.length).includes(blockEnd)),
              removed++,
              keepBlankLines && result.push(''));
            continue;
          }
          if (inBlock) {
            (trimmed.includes(blockEnd) && (inBlock = !1),
              removed++,
              keepBlankLines && result.push(''));
            continue;
          }
        }
        singleMarkers.some((m) => trimmed.startsWith(m))
          ? (removed++, keepBlankLines && result.push(''))
          : result.push(line);
      }
      return (
        await ipcWriteFile(filePath, joinLines(result)),
        `✅ Removed ${removed} comment line${1 !== removed ? 's' : ''} from ${filePath} (${totalLines} → ${result.length} lines)`
      );
    },
    truncate_file: async (params, onStage) => {
      const { path: filePath, max_lines: max_lines } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == max_lines) throw new Error('Missing required param: max_lines');
      if (max_lines < 1) throw new Error('max_lines must be at least 1');
      const fromEnd = !0 === params.from_end;
      onStage(`✂️ Truncating ${filePath} to ${max_lines} line${1 !== max_lines ? 's' : ''}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath);
      if (totalLines <= max_lines)
        return `File already has ${totalLines} lines (≤ ${max_lines}) — no change needed.`;
      const lines = splitLines(content),
        kept = fromEnd ? lines.slice(-max_lines) : lines.slice(0, max_lines),
        removed = totalLines - kept.length;
      return (
        await ipcWriteFile(filePath, joinLines(kept)),
        `✅ Truncated ${filePath}: kept ${kept.length} lines, removed ${removed} from the ${fromEnd ? 'beginning' : 'end'}`
      );
    },
    extract_unique_lines: async (params, onStage) => {
      const { path: filePath, output_path: output_path } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!output_path?.trim()) throw new Error('Missing required param: output_path');
      const trimCompare = !0 === params.trim_before_compare,
        ignoreBlank = !1 !== params.ignore_blank;
      onStage(`🔑 Extracting unique lines from ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        seen = new Set(),
        unique = [];
      for (const line of lines) {
        if (ignoreBlank && !line.trim()) {
          seen.has('\0blank\0') || (seen.add('\0blank\0'), unique.push(line));
          continue;
        }
        const key = trimCompare ? line.trim() : line;
        seen.has(key) || (seen.add(key), unique.push(line));
      }
      const removed = totalLines - unique.length;
      return (
        await ipcWriteFile(output_path, joinLines(unique)),
        `✅ Extracted ${unique.length} unique line${1 !== unique.length ? 's' : ''} (removed ${removed} duplicate${1 !== removed ? 's' : ''}) from ${filePath} → ${output_path}`
      );
    },
    pad_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line, width: width } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (null == width) throw new Error('Missing required param: width');
      if (width < 1) throw new Error('width must be at least 1');
      const align = (params.align ?? 'left').toLowerCase();
      if (!['left', 'right', 'center'].includes(align))
        throw new Error('align must be "left", "right", or "center"');
      const padChar = (params.pad_char ?? ' ').charAt(0) || ' ',
        skipBlank = !0 === params.skip_blank_lines;
      onStage(`⬜ Padding lines ${start_line}–${end_line} to width ${width} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        if (lines[i].length >= width) continue;
        const needed = width - lines[i].length;
        if ('right' === align) lines[i] = padChar.repeat(needed) + lines[i];
        else if ('center' === align) {
          const left = Math.floor(needed / 2),
            right = Math.ceil(needed / 2);
          lines[i] = padChar.repeat(left) + lines[i] + padChar.repeat(right);
        } else lines[i] = lines[i] + padChar.repeat(needed);
        changed++;
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Padded ${changed} line${1 !== changed ? 's' : ''} to width ${width} (${align}-aligned, pad: "${padChar}") in ${filePath}`
      );
    },
    align_assignments: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const separator = params.separator ?? '=',
        skipBlank = !1 !== params.skip_blank_lines;
      onStage(`⬌ Aligning "${separator}" in lines ${start_line}–${end_line} of ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        block = lines.slice(s, e);
      let maxLeft = 0;
      const parsed = block.map((line) => {
        if (skipBlank && !line.trim()) return null;
        const idx = line.indexOf(separator);
        if (-1 === idx) return null;
        const left = line.slice(0, idx).trimEnd(),
          right = line.slice(idx + separator.length);
        return (left.length > maxLeft && (maxLeft = left.length), { left: left, right: right });
      });
      let changed = 0;
      const aligned = block.map((line, i) => {
        const p = parsed[i];
        if (!p) return line;
        const newLine = p.left.padEnd(maxLeft) + ' ' + separator + ' ' + p.right.trimStart();
        return (newLine !== line && changed++, newLine);
      });
      return (
        lines.splice(s, block.length, ...aligned),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Aligned ${changed} line${1 !== changed ? 's' : ''} by "${separator}" (max left width: ${maxLeft}) in ${filePath}`
      );
    },
    quote_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const openQuote = params.open_quote ?? params.quote_char ?? '"',
        closeQuote = params.close_quote ?? openQuote,
        skipBlank = !1 !== params.skip_blank_lines,
        escapeExisting = !1 !== params.escape_existing;
      onStage(`❝ Quoting lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      const escapeRe = new RegExp(openQuote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        let text = lines[i];
        (escapeExisting && (text = text.replace(escapeRe, '\\' + openQuote)),
          (lines[i] = `${openQuote}${text}${closeQuote}`),
          changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Quoted ${changed} line${1 !== changed ? 's' : ''} with ${openQuote}…${closeQuote} in ${filePath}`
      );
    },
    uppercase_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      onStage(`🔠 Uppercasing lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++) {
        const upper = lines[i].toUpperCase();
        upper !== lines[i] && ((lines[i] = upper), changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Uppercased ${changed} line${1 !== changed ? 's' : ''} (lines ${start_line}–${end_line}) in ${filePath}`
      );
    },
    lowercase_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      onStage(`🔡 Lowercasing lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++) {
        const lower = lines[i].toLowerCase();
        lower !== lines[i] && ((lines[i] = lower), changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Lowercased ${changed} line${1 !== changed ? 's' : ''} (lines ${start_line}–${end_line}) in ${filePath}`
      );
    },
    collapse_whitespace: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const preserveIndent = !1 !== params.preserve_indent;
      onStage(`🧹 Collapsing internal whitespace in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1,
        e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;
      let changed = 0;
      for (let i = s; i < e; i++) {
        const original = lines[i];
        let newLine;
        if (preserveIndent) {
          const m = original.match(/^(\s*)(.*\S)?\s*$/s);
          newLine = (m?.[1] ?? '') + (m?.[2] ?? '').replace(/\s+/g, ' ');
        } else newLine = original.trim().replace(/\s+/g, ' ');
        newLine !== original && ((lines[i] = newLine), changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Collapsed whitespace in ${changed} of ${totalLines} lines in ${filePath}`
      );
    },
    split_file_at_pattern: async (params, onStage) => {
      const {
        path: filePath,
        pattern: pattern,
        output_path_a: output_path_a,
        output_path_b: output_path_b,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (!output_path_a?.trim()) throw new Error('Missing required param: output_path_a');
      if (!output_path_b?.trim()) throw new Error('Missing required param: output_path_b');
      const useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive,
        matchGoesTo = (params.match_goes_to ?? 'a').toLowerCase(),
        occurrence = Math.max(1, params.occurrence ?? 1);
      onStage(`✂️ Splitting ${filePath} at "${pattern}"`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? '' : 'i',
        errorPrefix: 'Invalid pattern',
      });
      let partA,
        partB,
        found = 0,
        splitIdx = -1;
      for (let i = 0; i < lines.length; i++)
        if (regex.test(lines[i]) && (found++, found === occurrence)) {
          splitIdx = i;
          break;
        }
      return -1 === splitIdx
        ? `Pattern "${pattern}" not found (occurrence ${occurrence}) in ${filePath} — file not split.`
        : ('b' === matchGoesTo
            ? ((partA = lines.slice(0, splitIdx)), (partB = lines.slice(splitIdx)))
            : 'none' === matchGoesTo
              ? ((partA = lines.slice(0, splitIdx)), (partB = lines.slice(splitIdx + 1)))
              : ((partA = lines.slice(0, splitIdx + 1)), (partB = lines.slice(splitIdx + 1))),
          await Promise.all([
            ipcWriteFile(output_path_a, joinLines(partA)),
            ipcWriteFile(output_path_b, joinLines(partB)),
          ]),
          [
            `✅ Split ${filePath} at line ${splitIdx + 1} (pattern: "${pattern}")`,
            `   Part A: ${partA.length} lines → ${output_path_a}`,
            `   Part B: ${partB.length} lines → ${output_path_b}`,
          ].join('\n'));
    },
    rotate_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line, count: count } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (null == count) throw new Error('Missing required param: count');
      if (count < 1) throw new Error('count must be at least 1');
      const direction = (params.direction ?? 'down').toLowerCase();
      if ('up' !== direction && 'down' !== direction)
        throw new Error('direction must be "up" or "down"');
      onStage(
        `🔄 Rotating lines ${start_line}–${end_line} by ${count} (${direction}) in ${filePath}`,
      );
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        block = lines.slice(s, e);
      if (block.length < 2) return 'Range contains fewer than 2 lines — nothing to rotate.';
      const n = count % block.length;
      if (!n)
        return `Rotation by ${count} is equivalent to no change for a ${block.length}-line range — file unchanged.`;
      const rotated =
        'up' === direction
          ? [...block.slice(-n), ...block.slice(0, -n)]
          : [...block.slice(n), ...block.slice(0, n)];
      return (
        lines.splice(s, block.length, ...rotated),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Rotated ${block.length} lines (${start_line}–${end_line}) ${direction} by ${n} position${1 !== n ? 's' : ''} in ${filePath}`
      );
    },
    replace_char: async (params, onStage) => {
      const { path: filePath, from_char: from_char, to_char: to_char } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!from_char) throw new Error('Missing required param: from_char');
      if (null == to_char) throw new Error('Missing required param: to_char');
      onStage(`🔤 Replacing "${from_char}" → "${to_char}" in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1,
        e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length,
        escaped = from_char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        regex = new RegExp(escaped, 'g');
      let totalReplaced = 0,
        linesChanged = 0;
      for (let i = s; i < e; i++) {
        const matches = lines[i].match(regex);
        matches &&
          ((lines[i] = lines[i].replace(regex, to_char)),
          (totalReplaced += matches.length),
          linesChanged++);
      }
      return totalReplaced
        ? (await ipcWriteFile(filePath, joinLines(lines)),
          `✅ Replaced ${totalReplaced} occurrence${1 !== totalReplaced ? 's' : ''} of "${from_char}" → "${to_char}" across ${linesChanged} line${1 !== linesChanged ? 's' : ''} in ${filePath}`)
        : `"${from_char}" not found in the specified range of ${filePath} — file unchanged.`;
    },
    count_lines_in_range: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      onStage(`🔢 Counting lines in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1,
        e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length,
        region = lines.slice(s, e),
        total = region.length,
        blank = region.filter((l) => !l.trim()).length,
        nonBlank = total - blank,
        words = region
          .filter((l) => l.trim())
          .join(' ')
          .split(/\s+/)
          .filter(Boolean).length,
        chars = region.join('\n').length,
        output = [
          `Line count for ${filePath} (${params.start_line || params.end_line ? `lines ${s + 1}–${e} of ${totalLines}` : `all ${totalLines} lines`}):`,
          `  Total lines:     ${total.toLocaleString()}`,
          `  Blank lines:     ${blank.toLocaleString()}`,
          `  Non-blank lines: ${nonBlank.toLocaleString()}`,
          `  Words:           ${words.toLocaleString()}`,
          `  Characters:      ${chars.toLocaleString()}`,
        ];
      if (params.pattern?.trim()) {
        const useRegex = !0 === params.regex;
        let regex;
        try {
          regex = useRegex
            ? new RegExp(params.pattern, 'i')
            : new RegExp(params.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
          const patCount = region.filter((l) => regex.test(l)).length;
          output.push(
            `  Matching "${params.pattern}": ${patCount.toLocaleString()} line${1 !== patCount ? 's' : ''}`,
          );
        } catch (e) {
          output.push(`  Pattern error: ${e.message}`);
        }
      }
      return output.join('\n');
    },
    find_largest_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Provide path.');
      const limit = params.limit ?? 20,
        extensions = params.extensions
          ? params.extensions.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
          : null;
      onStage(`📦 Finding largest files in ${rootPath}`);
      const extFilter = extensions
          ? `\\( ${extensions.map((e) => `-name "*.${e}"`).join(' -o ')} \\)`
          : '',
        shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f ${extFilter} -not -path "*/node_modules/*" -not -path "*/.git/*" -printf "%s\t%p\n" 2>/dev/null | sort -rn | head -${limit}`,
          cwd: rootPath,
          timeout: 15e3,
          allowRisky: !1,
        });
      if (!shellResult?.ok || !shellResult.stdout?.trim())
        return `Could not list files. Ensure the workspace path is valid: ${rootPath}`;
      const files = shellResult.stdout
        .trim()
        .split('\n')
        .map((line) => {
          const tab = line.indexOf('\t');
          return { size: parseInt(line.slice(0, tab), 10), path: line.slice(tab + 1) };
        })
        .filter((f) => !isNaN(f.size));
      return files.length
        ? [
            `Largest ${files.length} file${1 !== files.length ? 's' : ''} in ${rootPath}:`,
            '',
            ...files.map((f, i) => {
              const kb = (f.size / 1024).toFixed(1),
                mb = f.size >= 1048576 ? ` (${(f.size / 1048576).toFixed(2)} MB)` : '';
              return `  ${String(i + 1).padStart(3)}. ${kb} KB${mb}  ${f.path}`;
            }),
          ].join('\n')
        : `No files found matching criteria in ${rootPath}.`;
    },
    find_files_by_extension: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Provide path.');
      if (!params.extensions?.trim()) throw new Error('Missing required param: extensions');
      const exts = params.extensions
          .split(',')
          .map((e) => e.trim().replace(/^\./, '').toLowerCase()),
        maxResults = params.max_results ?? 200;
      onStage(`🔎 Finding [${exts.join(', ')}] files in ${rootPath}`);
      const extPatterns = exts.map((e) => `-name "*.${e}"`).join(' -o '),
        shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" | head -${maxResults + 10}`,
          cwd: rootPath,
          timeout: 15e3,
          allowRisky: !1,
        });
      if (!shellResult?.ok || !shellResult.stdout?.trim())
        return `No files with extension${exts.length > 1 ? 's' : ''} [${exts.join(', ')}] found in ${rootPath}.`;
      const files = shellResult.stdout.trim().split('\n').filter(Boolean).slice(0, maxResults),
        grouped = {};
      for (const f of files) {
        const ext = f.split('.').pop().toLowerCase();
        (grouped[ext] = grouped[ext] || []).push(f);
      }
      const output = [
        `Files with [${exts.join(', ')}] in ${rootPath}:`,
        `Found ${files.length}${files.length >= maxResults ? '+' : ''} file${1 !== files.length ? 's' : ''}`,
        '',
      ];
      for (const [ext, list] of Object.entries(grouped)) {
        output.push(`### .${ext.toUpperCase()} (${list.length})`);
        for (const f of list) output.push(`  ${f}`);
        output.push('');
      }
      return output.join('\n');
    },
    find_empty_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Provide path.');
      const includeWhitespaceOnly = !1 !== params.include_whitespace_only;
      onStage(`🔍 Finding empty files in ${rootPath}`);
      const shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -empty`,
          cwd: rootPath,
          timeout: 15e3,
          allowRisky: !1,
        }),
        emptyFiles =
          shellResult?.ok && shellResult.stdout?.trim()
            ? shellResult.stdout.trim().split('\n').filter(Boolean)
            : [];
      let whitespaceFiles = [];
      if (includeWhitespaceOnly) {
        const smallFiles = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f -not -path "*/node_modules/*" -not -path "*/.git/*" -size +0c -size -4k \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.rb" -o -name "*.go" \\) | head -100`,
          cwd: rootPath,
          timeout: 15e3,
          allowRisky: !1,
        });
        if (smallFiles?.ok && smallFiles.stdout?.trim())
          for (const fp of smallFiles.stdout.trim().split('\n').filter(Boolean).slice(0, 50))
            try {
              const { content: content } = await ipcReadFile(fp);
              '' === content.trim() && content.length > 0 && whitespaceFiles.push(fp);
            } catch {}
      }
      if (!emptyFiles.length && !whitespaceFiles.length)
        return `No empty files found in ${rootPath}.`;
      const output = [`Empty files in ${rootPath}:`, ''];
      return (
        emptyFiles.length &&
          (output.push(`### ZERO-BYTE FILES (${emptyFiles.length})`),
          emptyFiles.forEach((f) => output.push(`  ${f}`)),
          output.push('')),
        whitespaceFiles.length &&
          (output.push(`### WHITESPACE-ONLY FILES (${whitespaceFiles.length})`),
          whitespaceFiles.forEach((f) => output.push(`  ${f}`))),
        output.join('\n')
      );
    },
    find_long_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const threshold = params.threshold ?? 100,
        maxResults = params.max_results ?? 100;
      onStage(`📏 Finding lines longer than ${threshold} chars in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        hits = [];
      for (
        let i = 0;
        i < lines.length &&
        !(
          lines[i].length > threshold &&
          (hits.push({ num: i + 1, len: lines[i].length, text: lines[i] }),
          hits.length >= maxResults)
        );
        i++
      );
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
    find_console_statements: async (params, onStage) => {
      const rootPath = params.workspace_path
          ? resolveWorkingDirectory(params.workspace_path)
          : null,
        filePath = params.path?.trim();
      if (!filePath && !rootPath) throw new Error('Provide path (single file) or workspace_path.');
      const patterns = params.patterns
          ? params.patterns.split(',').map((p) => p.trim())
          : [
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
            ],
        patternRe = new RegExp(patterns.join('|'), 'i');
      onStage('🔍 Scanning for console/debug statements');
      const hits = [];
      if (filePath) {
        const { content: content } = await ipcReadFile(filePath);
        splitLines(content).forEach((line, i) => {
          !patternRe.test(line) ||
            line.trim().startsWith('//') ||
            line.trim().startsWith('#') ||
            hits.push({ path: filePath, line: i + 1, text: line.trim() });
        });
      } else {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath: rootPath,
          query: 'console.log',
          maxResults: 300,
        });
        for (const m of result?.matches ?? [])
          patternRe.test(m.line) &&
            !m.line.trim().startsWith('//') &&
            hits.push({ path: m.path, line: m.lineNumber, text: m.line.trim() });
      }
      if (!hits.length) return 'No console/debug statements found.';
      const byFile = {};
      for (const h of hits) (byFile[h.path] = byFile[h.path] || []).push(h);
      const output = [
        `Console/debug statements: ${hits.length} across ${Object.keys(byFile).length} file${1 !== Object.keys(byFile).length ? 's' : ''}`,
        '',
      ];
      for (const [fp, fileHits] of Object.entries(byFile))
        (output.push(`📄 ${fp} (${fileHits.length})`),
          fileHits
            .slice(0, 15)
            .forEach((h) => output.push(`  Line ${h.line}: ${h.text.slice(0, 120)}`)),
          fileHits.length > 15 && output.push(`  … +${fileHits.length - 15} more`),
          output.push(''));
      return output.join('\n');
    },
    find_hardcoded_values: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const findNumbers = !1 !== params.find_numbers,
        findStrings = !1 !== params.find_strings,
        findUrls = !1 !== params.find_urls,
        minMagicNumber = params.min_magic_number ?? 3;
      onStage(`🔍 Scanning for hardcoded values in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        results = { numbers: [], strings: [], urls: [] },
        urlRe = /https?:\/\/[^\s'"`,;)>]+/gi,
        stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g,
        magicNumRe = /(?<![a-zA-Z_$0-9.])\b([0-9]+(?:\.[0-9]+)?)\b/g;
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (!/^\s*(\/\/|#|\/\*|\*|<!--)/.test(trimmed)) {
          if (findUrls) {
            let m;
            for (urlRe.lastIndex = 0; null !== (m = urlRe.exec(lines[i])); )
              results.urls.push({ line: i + 1, value: m[0] });
          }
          if (findNumbers) {
            let m;
            for (magicNumRe.lastIndex = 0; null !== (m = magicNumRe.exec(lines[i])); )
              parseFloat(m[1]) >= minMagicNumber &&
                results.numbers.push({ line: i + 1, value: m[1], context: trimmed.slice(0, 80) });
          }
          if (findStrings && !trimmed.startsWith('import') && !trimmed.startsWith('from')) {
            let m;
            for (stringRe.lastIndex = 0; null !== (m = stringRe.exec(lines[i])); ) {
              const inner = m[1].slice(1, -1);
              inner.length >= 3 &&
                inner.trim() &&
                results.strings.push({ line: i + 1, value: m[1].slice(0, 60) });
            }
          }
        }
      }
      if (!(results.numbers.length + results.strings.length + results.urls.length))
        return `No hardcoded values found in ${filePath} (${totalLines} lines).`;
      const output = [
        `Hardcoded values in ${filePath}:`,
        `Magic numbers: ${results.numbers.length} | String literals: ${results.strings.length} | URLs: ${results.urls.length}`,
        '',
      ];
      return (
        results.numbers.length &&
          (output.push(`### MAGIC NUMBERS (≥ ${minMagicNumber})`),
          results.numbers
            .slice(0, 40)
            .forEach((r) => output.push(`  Line ${r.line}: ${r.value}  ← ${r.context}`)),
          results.numbers.length > 40 && output.push(`  … +${results.numbers.length - 40} more`),
          output.push('')),
        results.urls.length &&
          (output.push('### HARDCODED URLs'),
          results.urls.slice(0, 20).forEach((r) => output.push(`  Line ${r.line}: ${r.value}`)),
          results.urls.length > 20 && output.push(`  … +${results.urls.length - 20} more`),
          output.push('')),
        results.strings.length &&
          (output.push('### STRING LITERALS (3+ chars)'),
          results.strings.slice(0, 40).forEach((r) => output.push(`  Line ${r.line}: ${r.value}`)),
          results.strings.length > 40 && output.push(`  … +${results.strings.length - 40} more`)),
        output.join('\n')
      );
    },
    find_imports_of: async (params, onStage) => {
      const { module: moduleName } = params;
      if (!moduleName?.trim()) throw new Error('Missing required param: module');
      const rootPath = resolveWorkingDirectory(params.workspace_path);
      if (!rootPath) throw new Error('No workspace is open. Provide workspace_path.');
      onStage(`🔗 Finding all files that import "${moduleName}"`);
      const result = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: rootPath,
        query: moduleName,
        maxResults: 300,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace search failed');
      const escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        importRe = new RegExp(
          `(?:import|from|require)\\s*(?:\\(?\\s*)?['"\`]([^'"\`]*${escaped}[^'"\`]*)['"\`]`,
          'i',
        ),
        hits = [];
      for (const m of result.matches ?? [])
        importRe.test(m.line) &&
          hits.push({ path: m.path, line: m.lineNumber, text: m.line.trim() });
      if (!hits.length) return `No files import "${moduleName}" in ${rootPath}.`;
      const byFile = {};
      for (const h of hits) (byFile[h.path] = byFile[h.path] || []).push(h);
      const output = [
        `Files importing "${moduleName}":`,
        `${Object.keys(byFile).length} file${1 !== Object.keys(byFile).length ? 's' : ''} (${hits.length} import statement${1 !== hits.length ? 's' : ''})`,
        '',
      ];
      for (const [fp, fileHits] of Object.entries(byFile))
        (output.push(`📄 ${fp}`),
          fileHits.forEach((h) => output.push(`   line ${h.line}: ${h.text.slice(0, 120)}`)));
      return output.join('\n');
    },
    find_files_without_pattern: async (params, onStage) => {
      const { directory: directory, pattern: pattern } = params;
      if (!directory?.trim()) throw new Error('Missing required param: directory');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const extensions = params.extensions
          ? params.extensions.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
          : ['js', 'ts', 'jsx', 'tsx', 'py', 'rb', 'go', 'java', 'cs', 'php', 'rs'],
        maxResults = params.max_results ?? 50;
      onStage(`🔍 Finding files WITHOUT "${pattern}" in ${directory}`);
      const extPatterns = extensions.map((e) => `-name "*.${e}"`).join(' -o '),
        listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${directory}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
          cwd: directory,
          timeout: 2e4,
          allowRisky: !1,
        });
      if (!listResult?.ok || !listResult.stdout?.trim())
        return `Could not list files in ${directory}.`;
      const allFiles = listResult.stdout.trim().split('\n').filter(Boolean),
        searchResult = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath: directory,
          query: pattern,
          maxResults: allFiles.length + 100,
        }),
        filesWithPattern = new Set((searchResult?.matches ?? []).map((m) => m.path)),
        missingFiles = allFiles.filter((f) => !filesWithPattern.has(f)).slice(0, maxResults);
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
      for (const [ext, files] of Object.entries(byExt))
        (output.push(`### .${ext.toUpperCase()} (${files.length})`),
          files.forEach((f) => output.push(`  ${f}`)),
          output.push(''));
      return output.join('\n');
    },
    find_nth_occurrence: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const n = Math.max(1, params.n ?? 1),
        contextRadius = params.context_lines ?? 10,
        useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive;
      onStage(`🔢 Finding occurrence #${n} of "${pattern}" in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? '' : 'i',
        errorPrefix: 'Invalid pattern',
      });
      let found = 0,
        targetLine = -1;
      const allOccurrences = [];
      for (let i = 0; i < lines.length; i++)
        regex.test(lines[i]) &&
          (found++, allOccurrences.push(i + 1), found === n && (targetLine = i));
      if (-1 === targetLine)
        return [
          `Occurrence #${n} of "${pattern}" not found in ${filePath}.`,
          `Total occurrences: ${found}`,
          found > 0 ? `Found at lines: ${allOccurrences.join(', ')}` : '',
        ]
          .filter(Boolean)
          .join('\n');
      const from = Math.max(0, targetLine - contextRadius),
        to = Math.min(lines.length - 1, targetLine + contextRadius),
        output = [
          `Occurrence #${n} of "${pattern}" in ${filePath}:`,
          `Line ${targetLine + 1} of ${totalLines} | Total occurrences: ${found}`,
          found > 1 ? `All at lines: ${allOccurrences.join(', ')}` : '',
          '',
        ].filter(Boolean);
      for (let i = from; i <= to; i++)
        output.push(`${String(i + 1).padStart(5)}${i === targetLine ? '▶' : ' '} ${lines[i]}`);
      return output.join('\n');
    },
    find_all_urls: async (params, onStage) => {
      const filePath = params.path?.trim(),
        rootPath = params.workspace_path ? resolveWorkingDirectory(params.workspace_path) : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');
      const schemes = (params.schemes ?? 'http,https').split(',').map((s) => s.trim()),
        urlRe = new RegExp(`(${schemes.join('|')})://[^\\s'"\`<>)\\]},;]+`, 'gi');
      onStage(`🔗 Extracting URLs from ${filePath ?? rootPath}`);
      const urlMap = new Map(),
        scanLine = (line, source, lineNum) => {
          let m;
          for (urlRe.lastIndex = 0; null !== (m = urlRe.exec(line)); ) {
            const url = m[0].replace(/[.,;)>\]'"]+$/, '');
            (urlMap.has(url) || urlMap.set(url, new Set()),
              urlMap.get(url).add(`${source}:${lineNum}`));
          }
        };
      if (filePath) {
        const { content: content } = await ipcReadFile(filePath);
        splitLines(content).forEach((line, i) => scanLine(line, filePath, i + 1));
      } else {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath: rootPath,
          query: '://',
          maxResults: 500,
        });
        for (const m of result?.matches ?? []) scanLine(m.line, m.path, m.lineNumber);
      }
      if (!urlMap.size) return 'No URLs found.';
      const byDomain = {};
      for (const [url, locs] of urlMap.entries()) {
        const domain = url.match(/^https?:\/\/([^/]+)/)?.[1] ?? 'other';
        (byDomain[domain] = byDomain[domain] || []).push({ url: url, locs: [...locs] });
      }
      const output = [
        `URLs in ${filePath ?? rootPath}:`,
        `${urlMap.size} unique URL${1 !== urlMap.size ? 's' : ''} across ${Object.keys(byDomain).length} domain${1 !== Object.keys(byDomain).length ? 's' : ''}`,
        '',
      ];
      for (const [domain, entries] of Object.entries(byDomain)) {
        output.push(`### ${domain} (${entries.length})`);
        for (const { url: url, locs: locs } of entries)
          (output.push(`  ${url}`),
            !1 !== params.show_locations &&
              (locs.slice(0, 3).forEach((l) => output.push(`    ↳ ${l}`)),
              locs.length > 3 && output.push(`    ↳ … +${locs.length - 3} more`)));
        output.push('');
      }
      return output.join('\n');
    },
    find_commented_code_blocks: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const minBlockSize = params.min_block_size ?? 3;
      onStage(`🔍 Finding commented-out code blocks in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        marker = getCommentStyle(filePath, null).single || '//',
        codeSmellRe = /[{}();=<>[\]]/,
        isCommentedCode = (line) => {
          const t = line.trim();
          if (!t.startsWith(marker)) return !1;
          const inner = t.slice(marker.length).trim();
          return codeSmellRe.test(inner) && inner.length > 3;
        },
        blocks = [];
      let blockStart = -1,
        blockLines = [];
      for (let i = 0; i < lines.length; i++)
        isCommentedCode(lines[i])
          ? (-1 === blockStart && (blockStart = i),
            blockLines.push({ lineNum: i + 1, text: lines[i].trim() }))
          : (-1 !== blockStart &&
              blockLines.length >= minBlockSize &&
              blocks.push({ start: blockStart + 1, end: i, lines: [...blockLines] }),
            (blockStart = -1),
            (blockLines = []));
      if (
        (-1 !== blockStart &&
          blockLines.length >= minBlockSize &&
          blocks.push({ start: blockStart + 1, end: lines.length, lines: blockLines }),
        !blocks.length)
      )
        return `No commented-out code blocks (≥ ${minBlockSize} lines) found in ${filePath}.`;
      const output = [
        `Commented-out code blocks in ${filePath}:`,
        `${blocks.length} block${1 !== blocks.length ? 's' : ''} across ${totalLines} lines`,
        '',
      ];
      for (const block of blocks)
        (output.push(`### Lines ${block.start}–${block.end} (${block.lines.length} lines)`),
          block.lines
            .slice(0, 8)
            .forEach((l) => output.push(`  ${l.lineNum}: ${l.text.slice(0, 100)}`)),
          block.lines.length > 8 && output.push(`  … +${block.lines.length - 8} more`),
          output.push(''));
      return output.join('\n');
    },
    find_similar_lines: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const threshold = params.similarity_threshold ?? 0.85,
        minLength = params.min_length ?? 20;
      onStage(`🔍 Scanning for near-duplicate lines in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        candidates = splitLines(content)
          .map((text, idx) => ({ idx: idx, text: text.trim() }))
          .filter((l) => l.text.length >= minLength && !l.text.match(/^\s*(\/\/|#|\*)/));
      if (candidates.length > 2e3)
        return `Too many candidate lines (${candidates.length}). Narrow the range.`;
      const trigrams = (s) => {
          const tg = new Set();
          for (let i = 0; i < s.length - 2; i++) tg.add(s.slice(i, i + 3));
          return tg;
        },
        sim = (a, b) => {
          const ta = trigrams(a),
            tb = trigrams(b);
          let inter = 0;
          for (const t of ta) tb.has(t) && inter++;
          return inter / (ta.size + tb.size - inter || 1);
        },
        pairs = [];
      for (let i = 0; i < candidates.length; i++)
        for (let j = i + 1; j < candidates.length; j++) {
          if (candidates[i].text === candidates[j].text) continue;
          const s = sim(candidates[i].text, candidates[j].text);
          s >= threshold &&
            pairs.push({
              lineA: candidates[i].idx + 1,
              lineB: candidates[j].idx + 1,
              textA: candidates[i].text,
              textB: candidates[j].text,
              pct: Math.round(100 * s),
            });
        }
      if (!pairs.length) return `No similar lines (≥ ${Math.round(100 * threshold)}%) found.`;
      pairs.sort((a, b) => b.pct - a.pct);
      const output = [
        `Similar lines in ${filePath} (≥ ${Math.round(100 * threshold)}% similar):`,
        `${pairs.length} pair${1 !== pairs.length ? 's' : ''}`,
        '',
      ];
      for (const p of pairs.slice(0, 30))
        (output.push(`### ${p.pct}% — Lines ${p.lineA} & ${p.lineB}`),
          output.push(`  L${p.lineA}: ${p.textA.slice(0, 100)}`),
          output.push(`  L${p.lineB}: ${p.textB.slice(0, 100)}`),
          output.push(''));
      return (
        pairs.length > 30 && output.push(`… +${pairs.length - 30} more pairs`),
        output.join('\n')
      );
    },
    find_functions_over_length: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.workspace_path);
      if (!rootPath) throw new Error('No workspace is open.');
      const threshold = params.threshold ?? 50,
        extensions = params.extensions
          ? params.extensions.split(',').map((e) => e.trim().replace(/^\./, '').toLowerCase())
          : ['js', 'ts', 'jsx', 'tsx', 'py', 'java', 'cs', 'go', 'rb'];
      onStage(`📊 Scanning workspace for functions > ${threshold} lines`);
      const extPatterns = extensions.map((e) => `-name "*.${e}"`).join(' -o '),
        listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
          cwd: rootPath,
          timeout: 2e4,
          allowRisky: !1,
        });
      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No source files found in ${rootPath}.`;
      const files = listResult.stdout.trim().split('\n').filter(Boolean);
      onStage(`Analyzing ${files.length} files…`);
      const fnRe =
          /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(|^class\s+(\w+)|^(?:async\s+)?def\s+(\w+)/,
        longFunctions = [];
      for (const fp of files.slice(0, 200))
        try {
          const { content: content } = await ipcReadFile(fp),
            fileLines = splitLines(content);
          let current = null,
            depth = 0;
          for (let i = 0; i < fileLines.length; i++) {
            const t = fileLines[i].trim(),
              m = t.match(fnRe);
            (m &&
              depth <= 1 &&
              (current &&
                ((current.length = i - current.startLine),
                current.length > threshold && longFunctions.push({ ...current, path: fp })),
              (current = {
                name: m[1] || m[2] || m[3] || m[4] || '(anon)',
                startLine: i + 1,
                length: 0,
              })),
              (depth = Math.max(
                0,
                depth + (t.match(/\{/g) || []).length - (t.match(/\}/g) || []).length,
              )));
          }
          current &&
            ((current.length = fileLines.length - current.startLine),
            current.length > threshold && longFunctions.push({ ...current, path: fp }));
        } catch {}
      if (!longFunctions.length) return `No functions over ${threshold} lines found.`;
      longFunctions.sort((a, b) => b.length - a.length);
      const byFile = {};
      for (const f of longFunctions) (byFile[f.path] = byFile[f.path] || []).push(f);
      const output = [
        `Functions over ${threshold} lines in ${rootPath}:`,
        `${longFunctions.length} function${1 !== longFunctions.length ? 's' : ''} across ${Object.keys(byFile).length} files`,
        '',
      ];
      for (const [fp, fns] of Object.entries(byFile))
        (output.push(`📄 ${fp}`),
          fns.forEach((fn) =>
            output.push(`   ${fn.name}()  line ${fn.startLine}  (${fn.length} lines)`),
          ));
      return output.join('\n');
    },
    find_unclosed_markers: async (params, onStage) => {
      const { path: filePath, start_marker: start_marker, end_marker: end_marker } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');
      onStage(`🔍 Checking marker balance in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        opens = [],
        matched = [];
      for (let i = 0; i < lines.length; i++)
        (lines[i].includes(start_marker) && opens.push({ line: i + 1, text: lines[i].trim() }),
          lines[i].includes(end_marker) &&
            opens.length > 0 &&
            matched.push({ open: opens.pop(), close: { line: i + 1 } }));
      const matchedCloseLines = new Set(matched.map((m) => m.close.line)),
        extraCloses = [];
      for (let i = 0; i < lines.length; i++)
        lines[i].includes(end_marker) &&
          !matchedCloseLines.has(i + 1) &&
          extraCloses.push({ line: i + 1, text: lines[i].trim() });
      if (!opens.length && !extraCloses.length)
        return `All "${start_marker}" markers are properly closed. Matched pairs: ${matched.length}`;
      const output = [
        `Marker balance: "${start_marker}" … "${end_marker}" in ${filePath}`,
        `Matched: ${matched.length} | Unclosed: ${opens.length} | Extra closes: ${extraCloses.length}`,
        '',
      ];
      return (
        opens.length &&
          (output.push(`### UNCLOSED "${start_marker}"`),
          opens.forEach((u) => output.push(`  Line ${u.line}: ${u.text.slice(0, 100)}`)),
          output.push('')),
        extraCloses.length &&
          (output.push(`### EXTRA "${end_marker}" (no matching open)`),
          extraCloses.forEach((e) => output.push(`  Line ${e.line}: ${e.text.slice(0, 100)}`))),
        output.join('\n')
      );
    },
    find_pattern_near_pattern: async (params, onStage) => {
      const { path: filePath, pattern_a: pattern_a, pattern_b: pattern_b } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern_a?.trim()) throw new Error('Missing required param: pattern_a');
      if (!pattern_b?.trim()) throw new Error('Missing required param: pattern_b');
      const proximity = params.proximity ?? 5,
        useRegex = !0 === params.regex;
      onStage(
        `🔍 Finding "${pattern_a}" within ${proximity} lines of "${pattern_b}" in ${filePath}`,
      );
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        makeRe = (p) =>
          useRegex ? new RegExp(p, 'i') : new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
        reA = makeRe(pattern_a),
        reB = makeRe(pattern_b),
        linesA = [],
        linesB = [];
      for (let i = 0; i < lines.length; i++)
        (reA.test(lines[i]) && linesA.push(i), reB.test(lines[i]) && linesB.push(i));
      if (!linesA.length) return `Pattern A "${pattern_a}" not found in ${filePath}.`;
      if (!linesB.length) return `Pattern B "${pattern_b}" not found in ${filePath}.`;
      const pairs = [];
      for (const a of linesA)
        for (const b of linesB)
          a !== b &&
            Math.abs(a - b) <= proximity &&
            pairs.push({ a: a + 1, b: b + 1, dist: Math.abs(a - b) });
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
        `${pairs.length} co-occurrence${1 !== pairs.length ? 's' : ''}`,
        '',
      ];
      for (const p of pairs.slice(0, 30)) {
        const lo = Math.max(0, Math.min(p.a, p.b) - 2),
          hi = Math.min(lines.length - 1, Math.max(p.a, p.b));
        output.push(`--- A:${p.a} / B:${p.b} (${p.dist} line${1 !== p.dist ? 's' : ''} apart) ---`);
        for (let i = lo; i <= hi; i++) {
          const tag = i + 1 === p.a ? 'A' : i + 1 === p.b ? 'B' : ' ';
          output.push(`  ${String(i + 1).padStart(5)} ${tag} ${lines[i].trimEnd().slice(0, 100)}`);
        }
        output.push('');
      }
      return output.join('\n');
    },
    find_all_string_literals: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const minLength = params.min_length ?? 2,
        maxLength = params.max_length ?? 200,
        dedup = !1 !== params.deduplicate;
      onStage(`📝 Extracting string literals from ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        found = [],
        stringRe = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)/g;
      for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (/^\s*(\/\/|#|\/\*|\*|import\s|from\s|require\()/.test(t)) continue;
        let m;
        for (stringRe.lastIndex = 0; null !== (m = stringRe.exec(lines[i])); ) {
          const inner = m[1].slice(1, -1).replace(/\\./g, (s) => s[1]);
          if (inner.length >= minLength && inner.length <= maxLength && inner.trim()) {
            const quote = '"' === m[1][0] ? 'double' : "'" === m[1][0] ? 'single' : 'template';
            found.push({ line: i + 1, value: inner, raw: m[1], quote: quote });
          }
        }
      }
      if (!found.length) return `No string literals found in ${filePath} (${totalLines} lines).`;
      let results = found;
      if (dedup) {
        const seen = new Set();
        results = found.filter(({ value: value }) => !seen.has(value) && (seen.add(value), !0));
      }
      const byQuote = { double: [], single: [], template: [] };
      for (const r of results) byQuote[r.quote].push(r);
      const output = [
        `String literals in ${filePath}:`,
        `Total: ${found.length} (${dedup ? results.length + ' unique' : 'all'}) | " ${byQuote.double.length} | ' ${byQuote.single.length} | \` ${byQuote.template.length}`,
        '',
      ];
      for (const [qType, items] of Object.entries(byQuote))
        items.length &&
          (output.push(`### ${qType.toUpperCase()} QUOTES (${items.length})`),
          items
            .slice(0, 50)
            .forEach((item) => output.push(`  Line ${item.line}: ${item.raw.slice(0, 80)}`)),
          items.length > 50 && output.push(`  … +${items.length - 50} more`),
          output.push(''));
      return output.join('\n');
    },
    find_lines_by_length_range: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == params.min_length && null == params.max_length)
        throw new Error('Provide min_length or max_length.');
      const minLen = params.min_length ?? 0,
        maxLen = params.max_length ?? 1 / 0,
        skipBlank = !1 !== params.skip_blank,
        maxResults = params.max_results ?? 200;
      onStage(`📏 Finding lines ${minLen}–${maxLen === 1 / 0 ? '∞' : maxLen} chars in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        hits = [];
      for (
        let i = 0;
        i < lines.length &&
        !(
          (!skipBlank || lines[i].trim()) &&
          lines[i].length >= minLen &&
          lines[i].length <= maxLen &&
          (hits.push({ num: i + 1, len: lines[i].length, text: lines[i] }),
          hits.length >= maxResults)
        );
        i++
      );
      if (!hits.length)
        return `No lines with length ${minLen}–${maxLen === 1 / 0 ? '∞' : maxLen} found.`;
      const avg = Math.round(hits.reduce((a, h) => a + h.len, 0) / hits.length);
      return [
        `Lines ${minLen}–${maxLen === 1 / 0 ? '∞' : maxLen} chars in ${filePath}:`,
        `${hits.length}${hits.length >= maxResults ? '+' : ''} lines | avg length: ${avg} chars`,
        '',
        ...hits.map(
          (h) =>
            `  Line ${h.num} (${h.len}): ${h.text.slice(0, 120)}${h.text.length > 120 ? '…' : ''}`,
        ),
      ].join('\n');
    },
    find_first_match: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const contextBefore = params.context_before ?? 10,
        contextAfter = params.context_after ?? 20,
        useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive;
      onStage(`🔍 Finding first "${pattern}" in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? '' : 'i',
        errorPrefix: 'Invalid pattern',
      });
      let matchLine = -1,
        totalMatches = 0;
      for (let i = 0; i < lines.length; i++)
        regex.test(lines[i]) && (-1 === matchLine && (matchLine = i), totalMatches++);
      if (-1 === matchLine)
        return `Pattern "${pattern}" not found in ${filePath} (${totalLines} lines).`;
      const from = Math.max(0, matchLine - contextBefore),
        to = Math.min(lines.length - 1, matchLine + contextAfter),
        output = [
          `First match of "${pattern}" in ${filePath}:`,
          `Line ${matchLine + 1} of ${totalLines} | Total occurrences: ${totalMatches}`,
          '',
        ];
      for (let i = from; i <= to; i++)
        output.push(`${String(i + 1).padStart(5)}${i === matchLine ? '▶' : ' '} ${lines[i]}`);
      return output.join('\n');
    },
    find_multiline_pattern: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const contextLines = params.context_lines ?? 3,
        maxMatches = params.max_matches ?? 20,
        flags = params.flags ?? 'gis';
      onStage(`🔍 Multi-line search in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content);
      let regex;
      try {
        regex = new RegExp(pattern, flags);
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }
      const matches = [];
      let m;
      for (
        regex.lastIndex = 0;
        null !== (m = regex.exec(content)) && matches.length < maxMatches;
      ) {
        const startLineIdx = content.slice(0, m.index).split('\n').length - 1,
          matchLineCount = m[0].split('\n').length;
        (matches.push({
          startLine: startLineIdx + 1,
          endLine: startLineIdx + matchLineCount,
          matchLines: matchLineCount,
        }),
          0 === m[0].length && regex.lastIndex++);
      }
      if (!matches.length)
        return `No multi-line matches for pattern in ${filePath} (${totalLines} lines).`;
      const output = [
        `Multi-line matches in ${filePath}:`,
        `${matches.length}${matches.length >= maxMatches ? '+' : ''} match${1 !== matches.length ? 'es' : ''}`,
        '',
      ];
      for (const match of matches) {
        const from = Math.max(0, match.startLine - 1 - contextLines),
          to = Math.min(lines.length - 1, match.endLine - 1 + contextLines);
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
    find_symbol_definitions: async (params, onStage) => {
      const { symbol: symbol } = params;
      if (!symbol?.trim()) throw new Error('Missing required param: symbol');
      const rootPath = resolveWorkingDirectory(params.workspace_path);
      if (!rootPath) throw new Error('No workspace is open. Provide workspace_path.');
      onStage(`🎯 Finding definitions of "${symbol}" in ${rootPath}`);
      const escaped = symbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        defPatterns = [
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
        ],
        results = await Promise.all(
          defPatterns.map((p) =>
            window.electronAPI?.invoke?.('search-workspace', {
              rootPath: rootPath,
              query: p,
              maxResults: 10,
            }),
          ),
        ),
        seen = new Set(),
        defs = [];
      for (const result of results)
        for (const m of result?.matches ?? []) {
          const key = `${m.path}:${m.lineNumber}`;
          if (seen.has(key)) continue;
          seen.add(key);
          const line = m.line.trim();
          /\b(function|class|const|let|var|def|type|interface|enum|func|struct)\b/.test(line) &&
            defs.push(m);
        }
      if (!defs.length)
        return `No definition of "${symbol}" found in ${rootPath}.\nTip: Use trace_symbol for a broader search including call sites.`;
      defs.sort((a, b) => a.path.localeCompare(b.path) || a.lineNumber - b.lineNumber);
      const output = [
        `Definitions of "${symbol}" in ${rootPath}:`,
        `${defs.length} definition${1 !== defs.length ? 's' : ''}`,
        '',
      ];
      for (const d of defs)
        (output.push(`  ${d.path}:${d.lineNumber}`),
          output.push(`    ${d.line.trim().slice(0, 120)}`),
          output.push(''));
      return output.join('\n');
    },
    replace_nth_occurrence: async (params, onStage) => {
      const { path: filePath, pattern: pattern, replacement: replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (null == replacement) throw new Error('Missing required param: replacement');
      const n = Math.max(1, params.n ?? 1),
        useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive;
      onStage(`🔁 Replacing occurrence #${n} of "${pattern}" in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        flags = caseSensitive ? 'g' : 'gi';
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: flags,
        errorPrefix: 'Invalid regex',
      });
      let found = 0,
        replaced = !1;
      const updated = content.replace(
        regex,
        (match) => (found++, found === n ? ((replaced = !0), replacement) : match),
      );
      return replaced
        ? (await ipcWriteFile(filePath, updated),
          `✅ Replaced occurrence #${n} of "${pattern}" → "${replacement}" in ${filePath} (${found} total occurrences found)`)
        : `Occurrence #${n} not found — total occurrences: ${found}. File unchanged.`;
    },
    enclose_range: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const opening = params.opening ?? null,
        closing = params.closing ?? null;
      if (!opening && !closing) throw new Error('Provide at least one of: opening, closing.');
      const indentBody = !0 === params.indent_body,
        indentAmount = params.indent_amount ?? 2;
      onStage(`📦 Enclosing lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      if (indentBody) {
        const pad = ' '.repeat(indentAmount);
        for (let i = s; i < e; i++) lines[i] = pad + lines[i];
      }
      (closing && lines.splice(e, 0, closing),
        opening && lines.splice(s, 0, opening),
        await ipcWriteFile(filePath, joinLines(lines)));
      const inserted = (opening ? 1 : 0) + (closing ? 1 : 0);
      return `✅ Enclosed lines ${start_line}–${end_line} in ${filePath} (+${inserted} wrapper line${1 !== inserted ? 's' : ''})${indentBody ? `, body indented ${indentAmount} spaces` : ''}`;
    },
    add_import_statement: async (params, onStage) => {
      const { path: filePath, statement: statement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!statement?.trim()) throw new Error('Missing required param: statement');
      const skipIfPresent = !1 !== params.skip_if_present,
        position = (params.position ?? 'auto').toLowerCase();
      onStage(`📥 Adding import to ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        normalised = statement.trim();
      if (skipIfPresent && lines.some((l) => l.trim() === normalised))
        return `Import already present in ${filePath} — no change made.\n  Found: ${normalised}`;
      let insertAt = 0;
      if ('auto' === position || 'after_imports' === position)
        for (let i = 0; i < lines.length; i++) {
          const t = lines[i].trim();
          if (
            t.startsWith('import ') ||
            t.startsWith('from ') ||
            /^(?:const|let|var)\s+\S+\s*=\s*require\(/.test(t)
          )
            insertAt = i + 1;
          else if (insertAt > 0 && '' !== t) break;
        }
      else 'top' === position ? (insertAt = 0) : 'bottom' === position && (insertAt = lines.length);
      return (
        lines.splice(insertAt, 0, normalised),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Added import at line ${insertAt + 1} in ${filePath}:\n  ${normalised}`
      );
    },
    remove_import_statement: async (params, onStage) => {
      const { path: filePath, module: moduleName } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!moduleName?.trim()) throw new Error('Missing required param: module');
      onStage(`📤 Removing imports of "${moduleName}" from ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        escaped = moduleName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        importRe = new RegExp(
          `(?:^import\\s.*?['"\`]${escaped}['"\`]|^(?:const|let|var)\\s+\\S.*?require\\(['"\`]${escaped}['"\`]\\))`,
          'i',
        ),
        kept = lines.filter((l) => !importRe.test(l.trim())),
        removed = totalLines - kept.length;
      return removed
        ? (await ipcWriteFile(filePath, joinLines(kept)),
          `✅ Removed ${removed} import line${1 !== removed ? 's' : ''} referencing "${moduleName}" from ${filePath}`)
        : `No import of "${moduleName}" found in ${filePath} — file unchanged.`;
    },
    sort_imports: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const groupByType = !1 !== params.group_by_type,
        descending = !0 === params.descending;
      onStage(`🔤 Sorting imports in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        importRe = /^(?:import\s|from\s|(?:const|let|var)\s+\S.*?=\s*require\()/;
      let importEnd = 0;
      for (let i = 0; i < lines.length; i++)
        if (importRe.test(lines[i].trim()) || '' === lines[i].trim())
          importRe.test(lines[i].trim()) && (importEnd = i + 1);
        else if (importEnd > 0) break;
      if (!importEnd) return `No import statements detected at the top of ${filePath}.`;
      const importLines = lines.slice(0, importEnd).filter((l) => importRe.test(l.trim())),
        rest =
          (lines.slice(0, importEnd).filter((l) => !importRe.test(l.trim())),
          lines.slice(importEnd));
      let sorted;
      if (groupByType) {
        const external = importLines
            .filter((l) => !l.includes("'./") && !l.includes("'../") && !l.includes('"./'))
            .sort((a, b) => (descending ? b.localeCompare(a) : a.localeCompare(b))),
          internal = importLines
            .filter(
              (l) =>
                l.includes("'./") || l.includes("'../") || l.includes('"./') || l.includes('"../'),
            )
            .sort((a, b) => (descending ? b.localeCompare(a) : a.localeCompare(b)));
        sorted = [...external, ...(external.length && internal.length ? [''] : []), ...internal];
      } else
        sorted = [...importLines].sort((a, b) =>
          descending ? b.localeCompare(a) : a.localeCompare(b),
        );
      const newLines = [...sorted, '', ...rest];
      return (
        await ipcWriteFile(filePath, joinLines(newLines)),
        `✅ Sorted ${importLines.length} import${1 !== importLines.length ? 's' : ''} ${descending ? 'descending' : 'ascending'}${groupByType ? ' (external then internal)' : ''} in ${filePath}`
      );
    },
    indent_to_level: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line, level: level } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (null == level) throw new Error('Missing required param: level');
      if (level < 0) throw new Error('level must be 0 or greater');
      const useTabs = !0 === params.use_tabs,
        spacesPerLevel = params.spaces_per_level ?? 2,
        skipBlank = !1 !== params.skip_blank_lines,
        unit = useTabs ? '\t'.repeat(level) : ' '.repeat(level * spacesPerLevel);
      onStage(
        `⇥ Setting indentation to level ${level} on lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        const newLine = unit + lines[i].trimStart();
        newLine !== lines[i] && ((lines[i] = newLine), changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Set indentation to level ${level} (${useTabs ? `${level} tab${1 !== level ? 's' : ''}` : `${level * spacesPerLevel} space${level * spacesPerLevel !== 1 ? 's' : ''}`}) on ${changed} line${1 !== changed ? 's' : ''} in ${filePath}`
      );
    },
    apply_line_template: async (params, onStage) => {
      const {
        path: filePath,
        start_line: start_line,
        end_line: end_line,
        template: template,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (!template) throw new Error('Missing required param: template');
      if (!template.includes('{line}'))
        throw new Error('template must contain the {line} placeholder');
      const skipBlank = !1 !== params.skip_blank_lines,
        trimLine = !0 === params.trim_line;
      onStage(`🔧 Applying template to lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0;
      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        const lineContent = trimLine ? lines[i].trim() : lines[i];
        ((lines[i] = template.replace(/\{line\}/g, lineContent)), changed++);
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Applied template to ${changed} line${1 !== changed ? 's' : ''} in ${filePath}\n  Template: ${template}`
      );
    },
    conditional_replace: async (params, onStage) => {
      const {
        path: filePath,
        guard_pattern: guard_pattern,
        search: search,
        replace: replace,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!guard_pattern?.trim()) throw new Error('Missing required param: guard_pattern');
      if (!search?.trim()) throw new Error('Missing required param: search');
      if (null == replace) throw new Error('Missing required param: replace');
      const useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive,
        replaceAll = !1 !== params.replace_all,
        invertGuard = !0 === params.invert_guard;
      onStage(`🎯 Conditional replace in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        makeRe = (p, flags) =>
          useRegex
            ? new RegExp(p, flags)
            : new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags),
        flags = (caseSensitive ? '' : 'i') + (replaceAll ? 'g' : '');
      let guardRe, searchRe;
      try {
        ((guardRe = makeRe(guard_pattern, caseSensitive ? '' : 'i')),
          (searchRe = makeRe(search, flags)));
      } catch (e) {
        throw new Error(`Invalid regex: ${e.message}`);
      }
      let changedLines = 0,
        totalReplacements = 0;
      const s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1,
        e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;
      for (let i = s; i < e; i++) {
        const guardMatches = guardRe.test(lines[i]);
        if (invertGuard ? guardMatches : !guardMatches) continue;
        const matches = lines[i].match(
          new RegExp(searchRe.source, 'g' + (caseSensitive ? '' : 'i')),
        );
        matches &&
          ((lines[i] = lines[i].replace(searchRe, replace)),
          changedLines++,
          (totalReplacements += matches.length));
      }
      return changedLines
        ? (await ipcWriteFile(filePath, joinLines(lines)),
          `✅ Replaced ${totalReplacements} occurrence${1 !== totalReplacements ? 's' : ''} of "${search}" → "${replace}" across ${changedLines} qualifying line${1 !== changedLines ? 's' : ''} in ${filePath}\n  Guard: ${invertGuard ? 'NOT ' : ''}"${guard_pattern}"`)
        : 'No lines matched both guard and search pattern — file unchanged.';
    },
    delete_nth_occurrence: async (params, onStage) => {
      const { path: filePath, pattern: pattern } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      const n = Math.max(1, params.n ?? 1),
        useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive,
        deleteWholeLine = !0 === params.delete_whole_line;
      onStage(`🗑️ Deleting occurrence #${n} of "${pattern}" in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        flags = caseSensitive ? 'g' : 'gi';
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: flags,
        errorPrefix: 'Invalid regex',
      });
      if (deleteWholeLine) {
        let found = 0,
          targetLine = -1;
        for (let i = 0; i < lines.length; i++)
          if (((regex.lastIndex = 0), regex.test(lines[i]) && (found++, found === n))) {
            targetLine = i;
            break;
          }
        return -1 === targetLine
          ? `Occurrence #${n} not found (total: ${found}) — file unchanged.`
          : (lines.splice(targetLine, 1),
            await ipcWriteFile(filePath, joinLines(lines)),
            `✅ Deleted line ${targetLine + 1} (occurrence #${n} of "${pattern}") from ${filePath}`);
      }
      {
        let found = 0,
          deleted = !1;
        const updated = content.replace(
          regex,
          (match) => (found++, found === n ? ((deleted = !0), '') : match),
        );
        return deleted
          ? (await ipcWriteFile(filePath, updated),
            `✅ Deleted occurrence #${n} of "${pattern}" in ${filePath} (${found} total occurrences)`)
          : `Occurrence #${n} not found (total: ${found}) — file unchanged.`;
      }
    },
    set_line_endings: async (params, onStage) => {
      const { path: filePath, style: style } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!style?.trim()) throw new Error('Missing required param: style (lf | crlf | cr)');
      const normalised = style.toLowerCase().replace('-', '');
      if (!['lf', 'crlf', 'cr'].includes(normalised))
        throw new Error('style must be "lf", "crlf", or "cr"');
      onStage(`↵ Converting line endings to ${normalised.toUpperCase()} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        stripped = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n'),
        eol = 'crlf' === normalised ? '\r\n' : 'cr' === normalised ? '\r' : '\n',
        converted = stripped.replace(/\n/g, eol);
      if (converted === content)
        return `File already uses ${normalised.toUpperCase()} line endings — no change made.`;
      await ipcWriteFile(filePath, converted);
      const lineCount = stripped.split('\n').length;
      return `✅ Converted ${lineCount} line${1 !== lineCount ? 's' : ''} to ${normalised.toUpperCase()} endings in ${filePath}`;
    },
    strip_line_prefix: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line, prefix: prefix } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (!prefix) throw new Error('Missing required param: prefix');
      params.skip_if_absent;
      const useRegex = !0 === params.regex;
      onStage(
        `✂️ Stripping prefix "${prefix}" from lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      let changed = 0,
        skipped = 0;
      const escaped = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        prefixRe = useRegex ? new RegExp(`^${prefix}`) : new RegExp(`^${escaped}`);
      for (let i = s; i < e; i++)
        prefixRe.test(lines[i])
          ? ((lines[i] = lines[i].replace(prefixRe, '')), changed++)
          : skipped++;
      return changed
        ? (await ipcWriteFile(filePath, joinLines(lines)),
          `✅ Stripped prefix "${prefix}" from ${changed} line${1 !== changed ? 's' : ''} (${skipped} line${1 !== skipped ? 's' : ''} skipped — prefix absent) in ${filePath}`)
        : `Prefix "${prefix}" not found at the start of any line in the range — file unchanged.`;
    },
    number_lines_in_range: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const startNum = params.start_number ?? 1,
        separator = params.separator ?? '. ',
        padWidth = params.pad_width ?? 0,
        skipBlank = !0 === params.skip_blank_lines;
      onStage(`🔢 Numbering lines ${start_line}–${end_line} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        width = padWidth || String(startNum + (e - s) - 1).length;
      let counter = startNum,
        numbered = 0;
      for (let i = s; i < e; i++)
        !skipBlank || lines[i].trim()
          ? ((lines[i] = `${String(counter).padStart(width, '0')}${separator}${lines[i]}`),
            counter++,
            numbered++)
          : counter++;
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Numbered ${numbered} line${1 !== numbered ? 's' : ''} (${start_line}–${end_line}, starting at ${startNum}) in ${filePath}`
      );
    },
    bulk_line_insert: async (params, onStage) => {
      const { path: filePath, line_numbers: rawNums, content: insertContent } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!rawNums?.trim())
        throw new Error('Missing required param: line_numbers (comma-separated)');
      if (null == insertContent) throw new Error('Missing required param: content');
      const position = (params.position ?? 'before').toLowerCase(),
        unique = !1 !== params.deduplicate;
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
      (unique && (lineNums = [...new Set(lineNums)]),
        lineNums.sort((a, b) => a - b),
        onStage(
          `📍 Inserting at ${lineNums.length} position${1 !== lineNums.length ? 's' : ''} in ${filePath}`,
        ));
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        insertLines = splitLines(insertContent);
      let offset = 0;
      for (const lineNum of lineNums) {
        const idx = Math.max(1, Math.min(lineNum, totalLines)) - 1 + offset,
          insertAt = 'after' === position ? idx + 1 : idx;
        (lines.splice(insertAt, 0, ...insertLines), (offset += insertLines.length));
      }
      return (
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Inserted ${insertLines.length} line${1 !== insertLines.length ? 's' : ''} at ${lineNums.length} position${1 !== lineNums.length ? 's' : ''} (${position}) in ${filePath}\n  Positions: ${lineNums.join(', ')}`
      );
    },
    invert_boolean_values: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
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
      (params.include_numeric && pairs.push(['0', '1']),
        onStage(`🔀 Inverting boolean values in lines ${start_line}–${end_line} of ${filePath}`));
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        escaped = pairs
          .flatMap(([a, b]) => [a, b])
          .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        combinedRe = new RegExp(`\\b(${escaped.join('|')})\\b`, 'g'),
        flipMap = {};
      for (const [a, b] of pairs) ((flipMap[a] = b), (flipMap[b] = a));
      let changedLines = 0,
        totalFlips = 0;
      for (let i = s; i < e; i++) {
        const original = lines[i],
          result = original.replace(combinedRe, (match) => flipMap[match] ?? match);
        result !== original &&
          ((totalFlips += (original.match(combinedRe) || []).length),
          changedLines++,
          (lines[i] = result));
      }
      return changedLines
        ? (await ipcWriteFile(filePath, joinLines(lines)),
          `✅ Inverted ${totalFlips} boolean value${1 !== totalFlips ? 's' : ''} across ${changedLines} line${1 !== changedLines ? 's' : ''} in ${filePath}`)
        : 'No boolean values found to invert in the specified range — file unchanged.';
    },
    move_section_to_marker: async (params, onStage) => {
      const {
        path: filePath,
        start_marker: start_marker,
        end_marker: end_marker,
        destination_marker: destination_marker,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_marker?.trim()) throw new Error('Missing required param: start_marker');
      if (!end_marker?.trim()) throw new Error('Missing required param: end_marker');
      if (!destination_marker?.trim())
        throw new Error('Missing required param: destination_marker');
      const preserveMarkers = !1 !== params.preserve_markers,
        destPosition = (params.destination_position ?? 'after').toLowerCase();
      onStage(`✂️ Moving section between markers in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content);
      let srcStart = -1,
        srcEnd = -1;
      for (let i = 0; i < lines.length; i++)
        if (-1 === srcStart && lines[i].includes(start_marker)) srcStart = i;
        else if (-1 !== srcStart && -1 === srcEnd && lines[i].includes(end_marker)) {
          srcEnd = i;
          break;
        }
      if (-1 === srcStart) throw new Error(`start_marker "${start_marker}" not found.`);
      if (-1 === srcEnd)
        throw new Error(`end_marker "${end_marker}" not found after start_marker.`);
      const cutFrom = preserveMarkers ? srcStart + 1 : srcStart,
        cutTo = preserveMarkers ? srcEnd : srcEnd + 1,
        block = lines.splice(cutFrom, cutTo - cutFrom),
        destIdx = lines.findIndex((l) => l.includes(destination_marker));
      if (-1 === destIdx) throw new Error(`destination_marker "${destination_marker}" not found.`);
      const insertAt = 'before' === destPosition ? destIdx : destIdx + 1;
      return (
        lines.splice(insertAt, 0, ...block),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Moved ${block.length} line${1 !== block.length ? 's' : ''} from between "${start_marker}" / "${end_marker}" to ${destPosition} "${destination_marker}" in ${filePath}`
      );
    },
    repeat_lines: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line, count: count } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (null == count) throw new Error('Missing required param: count');
      if (count < 1) throw new Error('count must be at least 1');
      if (count > 20) throw new Error('count capped at 20 to prevent runaway file growth');
      const skipBlank = !0 === params.skip_blank_lines;
      onStage(`📋 Repeating each line in ${start_line}–${end_line} × ${count} in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        insertions = [];
      for (let i = e - 1; i >= s; i--) {
        if (skipBlank && !lines[i].trim()) continue;
        const copies = Array.from({ length: count }, () => lines[i]);
        insertions.push({ at: i + 1, lines: copies });
      }
      let totalAdded = 0;
      for (const ins of insertions)
        (lines.splice(ins.at, 0, ...ins.lines), (totalAdded += ins.lines.length));
      await ipcWriteFile(filePath, joinLines(lines));
      const origCount = e - s;
      return `✅ Repeated ${origCount} line${1 !== origCount ? 's' : ''} × ${count} (+${totalAdded} new lines) in ${filePath}`;
    },
    surround_with_block_comment: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      const ext = filePath.split('.').pop().toLowerCase(),
        [open, close] =
          params.open_delimiter && params.close_delimiter
            ? [params.open_delimiter, params.close_delimiter]
            : ({
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
                html: ['\x3c!--', '--\x3e'],
                xml: ['\x3c!--', '--\x3e'],
                svg: ['\x3c!--', '--\x3e'],
                vue: ['\x3c!--', '--\x3e'],
                hbs: ['{{!--', '--}}'],
                njk: ['{#', '#}'],
                py: ['"""', '"""'],
                rb: ['=begin', '=end'],
                sql: ['/*', '*/'],
                lua: ['--[[', ']]'],
              }[ext] ?? ['/*', '*/']),
        label = params.label?.trim() || '',
        labelSuffix = label ? ` ${label}` : '';
      onStage(`💬 Surrounding lines ${start_line}–${end_line} with block comment in ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length);
      return (
        lines.splice(e, 0, close + labelSuffix),
        lines.splice(s, 0, open + labelSuffix),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Surrounded lines ${start_line}–${end_line} with ${open}…${close} in ${filePath}`
      );
    },
    copy_range_to_position: async (params, onStage) => {
      const {
        path: filePath,
        start_line: start_line,
        end_line: end_line,
        target_line: target_line,
      } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (null == target_line) throw new Error('Missing required param: target_line');
      const position = (params.position ?? 'before').toLowerCase();
      onStage(
        `📋 Copying lines ${start_line}–${end_line} to position ${target_line} in ${filePath}`,
      );
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        t = Math.max(1, Math.min(target_line, totalLines)) - 1,
        block = lines.slice(s, e),
        insertAt = 'after' === position ? t + 1 : t;
      return (
        lines.splice(insertAt, 0, ...block),
        await ipcWriteFile(filePath, joinLines(lines)),
        `✅ Copied ${block.length} line${1 !== block.length ? 's' : ''} (${start_line}–${end_line}) to ${position} line ${target_line} in ${filePath}\n  Source range preserved.`
      );
    },
    overwrite_matching_lines: async (params, onStage) => {
      const { path: filePath, pattern: pattern, replacement: replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!pattern?.trim()) throw new Error('Missing required param: pattern');
      if (null == replacement) throw new Error('Missing required param: replacement');
      const useRegex = !0 === params.regex,
        caseSensitive = !0 === params.case_sensitive,
        s = (params.start_line ? Math.max(1, params.start_line) : 1) - 1;
      onStage(`✏️ Overwriting lines matching "${pattern}" in ${filePath}`);
      const { content: content, totalLines: totalLines } = await ipcReadFile(filePath),
        lines = splitLines(content);
      const regex = buildPatternRegex(pattern, {
        useRegex: useRegex,
        flags: caseSensitive ? '' : 'i',
        errorPrefix: 'Invalid pattern',
      });
      const e = params.end_line ? Math.min(params.end_line, lines.length) : lines.length;
      let changed = 0;
      for (let i = s; i < e; i++) regex.test(lines[i]) && ((lines[i] = replacement), changed++);
      return changed
        ? (await ipcWriteFile(filePath, joinLines(lines)),
          `✅ Overwrote ${changed} of ${totalLines} lines matching "${pattern}" with "${replacement.slice(0, 60)}${replacement.length > 60 ? '…' : ''}" in ${filePath}`)
        : `No lines matched "${pattern}" in ${filePath} — file unchanged.`;
    },
    remove_trailing_chars: async (params, onStage) => {
      const { path: filePath, start_line: start_line, end_line: end_line, chars: chars } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (null == start_line) throw new Error('Missing required param: start_line');
      if (null == end_line) throw new Error('Missing required param: end_line');
      if (!chars) throw new Error('Missing required param: chars');
      const skipBlank = !1 !== params.skip_blank_lines,
        greedy = !0 === params.greedy;
      onStage(
        `✂️ Removing trailing "${chars}" from lines ${start_line}–${end_line} in ${filePath}`,
      );
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        s = Math.max(1, start_line) - 1,
        e = Math.min(end_line, lines.length),
        escaped = chars.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        trailingRe = new RegExp(`(?:${escaped})${greedy ? '+' : ''}$`);
      let changed = 0;
      for (let i = s; i < e; i++) {
        if (skipBlank && !lines[i].trim()) continue;
        const trimmed = lines[i].replace(trailingRe, '');
        trimmed !== lines[i] && ((lines[i] = trimmed), changed++);
      }
      return changed
        ? (await ipcWriteFile(filePath, joinLines(lines)),
          `✅ Removed trailing "${chars}" from ${changed} line${1 !== changed ? 's' : ''} (lines ${start_line}–${end_line}) in ${filePath}`)
        : `No lines in the range ended with "${chars}" — file unchanged.`;
    },
    get_git_log: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');
      const limit = params.limit ?? 20,
        branch = params.branch ?? '',
        filePath = params.file_path ?? '',
        command =
          `git log --pretty=format:"%h|%an|%ar|%s" -n ${limit} ${branch || ''} ${filePath ? `-- "${filePath}"` : ''}`.trim();
      onStage(`🕒 Fetching git log in ${workingDirectory}`);
      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command: command,
        cwd: workingDirectory,
        timeout: 15e3,
        allowRisky: !1,
      });
      if (!result?.ok || !result.stdout?.trim())
        return `No git history found${filePath ? ` for ${filePath}` : ''}.`;
      const commits = result.stdout
        .trim()
        .split('\n')
        .map((line) => {
          const [hash, author, when, ...msgParts] = line.split('|');
          return { hash: hash, author: author, when: when, message: msgParts.join('|') };
        });
      return [
        `Git log: ${workingDirectory}${filePath ? ` — ${filePath}` : ''}${branch ? ` (${branch})` : ''}`,
        `Showing ${commits.length} most recent commit${1 !== commits.length ? 's' : ''}`,
        '',
        ...commits.map(
          (c) => `  ${c.hash}  ${c.when.padEnd(14)}  ${c.author.padEnd(20)}  ${c.message}`,
        ),
      ].join('\n');
    },
    get_git_blame: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');
      const startLine = params.start_line,
        endLine = params.end_line,
        lineArg =
          startLine && endLine
            ? `-L ${startLine},${endLine}`
            : startLine
              ? `-L ${startLine},+30`
              : '';
      onStage(`🔍 Running git blame on ${filePath}`);
      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git blame --porcelain ${lineArg} "${filePath}"`,
        cwd: workingDirectory,
        timeout: 2e4,
        allowRisky: !1,
      });
      if (!result?.ok || !result.stdout?.trim())
        return `Could not run git blame on ${filePath}. Ensure the file is tracked by git.`;
      const authorsByHash = {},
        lineMap = [],
        blameLines = result.stdout.split('\n');
      let currentHash = null;
      for (const line of blameLines)
        if (/^[0-9a-f]{40}/.test(line)) {
          const parts = line.split(' ');
          currentHash = parts[0].slice(0, 8);
          const lineNum = parseInt(parts[2], 10);
          isNaN(lineNum) || lineMap.push({ hash: currentHash, lineNum: lineNum, text: '' });
        } else if (line.startsWith('author ') && currentHash)
          (authorsByHash[currentHash] || (authorsByHash[currentHash] = {}),
            (authorsByHash[currentHash].author = line.slice(7).trim()));
        else if (line.startsWith('author-time ') && currentHash) {
          const ts = parseInt(line.slice(12), 10),
            date = new Date(1e3 * ts).toISOString().slice(0, 10);
          authorsByHash[currentHash] && (authorsByHash[currentHash].date = date);
        } else
          line.startsWith('\t') &&
            lineMap.length &&
            (lineMap[lineMap.length - 1].text = line.slice(1));
      if (!lineMap.length) return `No blame data parsed for ${filePath}.`;
      const authorSet = new Set(
          Object.values(authorsByHash)
            .map((a) => a.author)
            .filter(Boolean),
        ),
        output = [
          `Git blame: ${filePath}`,
          `${lineMap.length} line${1 !== lineMap.length ? 's' : ''} | Authors: ${[...authorSet].join(', ')}`,
          '',
        ];
      for (const entry of lineMap) {
        const info = authorsByHash[entry.hash] || {},
          author = (info.author || 'unknown').slice(0, 16).padEnd(16),
          date = (info.date || '??????????').padEnd(11);
        output.push(
          `  ${String(entry.lineNum).padStart(5)}  ${entry.hash}  ${date}  ${author}  ${entry.text.slice(0, 80)}`,
        );
      }
      return output.join('\n');
    },
    find_circular_dependencies: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      const extensions = (params.extensions ?? 'js,ts,jsx,tsx')
        .split(',')
        .map((e) => e.trim().replace(/^\./, '').toLowerCase());
      onStage(`🔄 Building import graph in ${rootPath}`);
      const extPatterns = extensions.map((e) => `-name "*.${e}"`).join(' -o '),
        listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( ${extPatterns} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*"`,
          cwd: rootPath,
          timeout: 2e4,
          allowRisky: !1,
        });
      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No source files found in ${rootPath}.`;
      const files = listResult.stdout.trim().split('\n').filter(Boolean).slice(0, 300);
      onStage(`Scanning ${files.length} files for import graph…`);
      const graph = {},
        importRe =
          /(?:^import\s+.*?from\s+|^(?:const|let|var)\s+\S+\s*=\s*require\s*\(\s*)['"`](\.\.?\/[^'"`]+)['"`]/gm,
        resolveImport = (fromFile, importPath) => {
          let resolved = fromFile.split('/').slice(0, -1).join('/') + '/' + importPath;
          const parts = resolved.split('/'),
            stack = [];
          for (const p of parts) '..' === p ? stack.pop() : '.' !== p && stack.push(p);
          resolved = stack.join('/');
          for (const ext of extensions) {
            if (files.includes(resolved + '.' + ext)) return resolved + '.' + ext;
            if (files.includes(resolved + '/index.' + ext)) return resolved + '/index.' + ext;
          }
          return files.find((f) => f.startsWith(resolved)) ?? null;
        };
      for (const fp of files)
        try {
          const { content: content } = await ipcReadFile(fp);
          let m;
          for (
            graph[fp] = new Set(), importRe.lastIndex = 0;
            null !== (m = importRe.exec(content));
          ) {
            const resolved = resolveImport(fp, m[1]);
            resolved && resolved !== fp && graph[fp].add(resolved);
          }
        } catch {
          graph[fp] = new Set();
        }
      const cycles = [],
        visited = new Set(),
        inStack = new Set(),
        dfs = (node, path) => {
          if (inStack.has(node)) {
            const cycleStart = path.indexOf(node);
            return void cycles.push(path.slice(cycleStart).concat(node));
          }
          if (!visited.has(node)) {
            (visited.add(node), inStack.add(node));
            for (const neighbor of graph[node] ?? []) dfs(neighbor, [...path, node]);
            inStack.delete(node);
          }
        };
      for (const file of files) dfs(file, []);
      if (!cycles.length)
        return `✅ No circular dependencies found in ${rootPath} (${files.length} files scanned).`;
      const seen = new Set(),
        unique = cycles.filter((c) => {
          const key = [...c].sort().join('|');
          return !seen.has(key) && (seen.add(key), !0);
        }),
        shorten = (p) => p.replace(rootPath + '/', ''),
        output = [
          `Circular dependencies in ${rootPath}:`,
          `${unique.length} cycle${1 !== unique.length ? 's' : ''} found across ${files.length} files`,
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
      return (
        unique.length > 20 && output.push(`… +${unique.length - 20} more cycles`),
        output.join('\n')
      );
    },
    find_test_coverage_gaps: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      const extensions = (params.extensions ?? 'js,ts,jsx,tsx,py')
          .split(',')
          .map((e) => e.trim().replace(/^\./, '').toLowerCase()),
        testPatterns = (params.test_patterns ?? '.test.,.spec.,_test.,test_')
          .split(',')
          .map((p) => p.trim());
      onStage(`🧪 Mapping test coverage gaps in ${rootPath}`);
      const extPat = extensions.map((e) => `-name "*.${e}"`).join(' -o '),
        listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( ${extPat} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*" -not -path "*/build/*"`,
          cwd: rootPath,
          timeout: 2e4,
          allowRisky: !1,
        });
      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No source files found in ${rootPath}.`;
      const allFiles = listResult.stdout.trim().split('\n').filter(Boolean),
        testFiles = allFiles.filter((f) => testPatterns.some((p) => f.includes(p))),
        sourceFiles = allFiles.filter((f) => !testPatterns.some((p) => f.includes(p))),
        testFileBasenames = new Set(
          testFiles.map((f) =>
            f
              .split('/')
              .pop()
              .replace(/\.(test|spec|_test)\.[^.]+$/, '')
              .replace(/\.[^.]+$/, '')
              .toLowerCase(),
          ),
        ),
        untested = [],
        tested = [];
      for (const sf of sourceFiles) {
        const base = sf
          .split('/')
          .pop()
          .replace(/\.[^.]+$/, '')
          .toLowerCase();
        testFileBasenames.has(base) || testFiles.some((t) => t.toLowerCase().includes(base))
          ? tested.push(sf)
          : untested.push(sf);
      }
      const pct =
          sourceFiles.length > 0 ? Math.round((tested.length / sourceFiles.length) * 100) : 0,
        byDir = {};
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
      if (!untested.length)
        return (
          output.push('✅ Every source file appears to have a corresponding test file.'),
          output.join('\n')
        );
      output.push(`### UNTESTED SOURCE FILES (${untested.length})`);
      const dirs = Object.entries(byDir).sort((a, b) => b[1].length - a[1].length);
      for (const [dir, files] of dirs.slice(0, 30))
        (output.push(`  📁 ${dir}/ (${files.length} file${1 !== files.length ? 's' : ''})`),
          files.slice(0, 8).forEach((f) => {
            return output.push(`     ${((p = f), p.replace(rootPath + '/', '')).split('/').pop()}`);
            var p;
          }),
          files.length > 8 && output.push(`     … +${files.length - 8} more`));
      return output.join('\n');
    },
    find_api_endpoints: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage(`🌐 Scanning for API endpoint definitions in ${rootPath}`);
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
        ],
        allMatches = (
          await Promise.all(
            [
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
            ]
              .slice(0, 5)
              .map((q) =>
                window.electronAPI?.invoke?.('search-workspace', {
                  rootPath: rootPath,
                  query: q,
                  maxResults: 80,
                }),
              ),
          )
        ).flatMap((r) => r?.matches ?? []),
        seen = new Set(),
        unique = allMatches.filter((m) => {
          const key = `${m.path}:${m.lineNumber}`;
          return !seen.has(key) && (seen.add(key), !0);
        });
      if (!unique.length) return `No HTTP route definitions found in ${rootPath}.`;
      const endpoints = [];
      for (const m of unique)
        for (const pat of patterns) {
          const match = m.line.match(pat.re);
          if (match) {
            const verb = (match[1] || 'ANY').toUpperCase(),
              route = match[2] || '(dynamic)';
            endpoints.push({
              verb: verb,
              route: route,
              file: m.path.replace(rootPath + '/', ''),
              line: m.lineNumber,
              framework: pat.label,
            });
            break;
          }
        }
      if (!endpoints.length)
        return 'Found potential route files but could not parse endpoint patterns.';
      const byFile = {};
      for (const ep of endpoints) (byFile[ep.file] = byFile[ep.file] || []).push(ep);
      const verbOrder = { GET: 0, POST: 1, PUT: 2, PATCH: 3, DELETE: 4, ANY: 5 },
        verbColors = { GET: '🟢', POST: '🟡', PUT: '🔵', PATCH: '🟣', DELETE: '🔴', ANY: '⚪' },
        output = [
          `API endpoints in ${rootPath}:`,
          `${endpoints.length} route${1 !== endpoints.length ? 's' : ''} across ${Object.keys(byFile).length} file${1 !== Object.keys(byFile).length ? 's' : ''}`,
          '',
        ];
      for (const [file, eps] of Object.entries(byFile))
        (output.push(`📄 ${file}`),
          eps
            .sort((a, b) => (verbOrder[a.verb] ?? 9) - (verbOrder[b.verb] ?? 9))
            .forEach((ep) => {
              const icon = verbColors[ep.verb] ?? '⚪';
              output.push(`   ${icon} ${ep.verb.padEnd(7)} ${ep.route}  (line ${ep.line})`);
            }),
          output.push(''));
      const verbCounts = {};
      for (const ep of endpoints) verbCounts[ep.verb] = (verbCounts[ep.verb] || 0) + 1;
      output.push('### VERB SUMMARY');
      for (const [verb, count] of Object.entries(verbCounts).sort())
        output.push(`  ${verbColors[verb] ?? '⚪'} ${verb.padEnd(8)} ${count}`);
      return output.join('\n');
    },
    find_error_handling_gaps: async (params, onStage) => {
      const filePath = params.path?.trim(),
        rootPath = params.workspace_path
          ? resolveWorkingDirectory(params.workspace_path)
          : filePath
            ? null
            : resolveWorkingDirectory(null);
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');
      onStage('🛡️ Scanning for missing error handling');
      const scanFile = async (fp) => {
        try {
          const { content: content } = await ipcReadFile(fp),
            lines = splitLines(content),
            issues = [],
            tryCatchLines = new Set();
          let depth = 0,
            inTry = !1;
          for (let i = 0; i < lines.length; i++)
            (/\btry\s*\{/.test(lines[i]) && (inTry = !0),
              inTry && tryCatchLines.add(i),
              (depth +=
                (lines[i].match(/\{/g) || []).length - (lines[i].match(/\}/g) || []).length),
              depth <= 0 && ((inTry = !1), (depth = 0)));
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim(),
              isInTry = tryCatchLines.has(i);
            if (/\bawait\s+\w/.test(line) && !isInTry) {
              const nearby = lines.slice(Math.max(0, i - 5), i + 3).join(' ');
              /try\s*\{/.test(nearby) ||
                /.catch\(/.test(nearby) ||
                issues.push({ line: i + 1, type: 'bare await', text: line.slice(0, 100) });
            }
            if (/\bfetch\s*\(|axios\.\w+\s*\(|\.then\s*\(/.test(line) && !isInTry) {
              const block = lines.slice(i, Math.min(lines.length, i + 8)).join('\n');
              block.includes('.catch(') ||
                block.includes('catch (') ||
                issues.find((x) => x.line === i + 1) ||
                issues.push({ line: i + 1, type: 'unhandled Promise', text: line.slice(0, 100) });
            }
            if (/new\s+Promise\s*\(/.test(line)) {
              const block = lines.slice(i, Math.min(lines.length, i + 15)).join('\n');
              block.includes('reject') ||
                block.includes('catch') ||
                issues.push({
                  line: i + 1,
                  type: 'Promise missing reject',
                  text: line.slice(0, 100),
                });
            }
          }
          return issues;
        } catch {
          return [];
        }
      };
      let fileMap = {};
      if (filePath) fileMap[filePath] = await scanFile(filePath);
      else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
            command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
            cwd: rootPath,
            timeout: 15e3,
            allowRisky: !1,
          }),
          files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 150) ?? [];
        onStage(`Scanning ${files.length} files…`);
        for (const fp of files) {
          const issues = await scanFile(fp);
          issues.length && (fileMap[fp] = issues);
        }
      }
      const allIssues = Object.values(fileMap).flat();
      if (!allIssues.length) return '✅ No obvious error handling gaps found.';
      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p),
        output = [
          'Error handling gaps:',
          `${allIssues.length} potential gap${1 !== allIssues.length ? 's' : ''} across ${Object.keys(fileMap).length} file${1 !== Object.keys(fileMap).length ? 's' : ''}`,
          '',
        ],
        byType = {};
      for (const issues of Object.values(fileMap))
        for (const iss of issues) (byType[iss.type] = byType[iss.type] || []).push(iss);
      output.push('### BY TYPE');
      for (const [type, items] of Object.entries(byType)) output.push(`  ${type}: ${items.length}`);
      output.push('');
      for (const [fp, issues] of Object.entries(fileMap))
        (output.push(`📄 ${shorten(fp)} (${issues.length})`),
          issues
            .slice(0, 8)
            .forEach((iss) =>
              output.push(`   Line ${iss.line} [${iss.type}]: ${iss.text.slice(0, 100)}`),
            ),
          issues.length > 8 && output.push(`   … +${issues.length - 8} more`),
          output.push(''));
      return output.join('\n');
    },
    get_dependency_graph: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      const extensions = (params.extensions ?? 'js,ts,jsx,tsx')
          .split(',')
          .map((e) => e.trim().replace(/^\./, '').toLowerCase()),
        maxFiles = params.max_files ?? 100;
      onStage(`🗺️ Building dependency graph for ${rootPath}`);
      const extPat = extensions.map((e) => `-name "*.${e}"`).join(' -o '),
        listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( ${extPat} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*"`,
          cwd: rootPath,
          timeout: 15e3,
          allowRisky: !1,
        });
      if (!listResult?.ok || !listResult.stdout?.trim()) return 'No source files found.';
      const files = listResult.stdout.trim().split('\n').filter(Boolean).slice(0, maxFiles),
        fileSet = new Set(files),
        importRe =
          /(?:^import\s+.*?from\s+|^(?:const|let|var)\s+\S+\s*=\s*require\s*\(\s*)['"`](\.\.?\/[^'"`\n]+)['"`]/gm,
        fanOut = {},
        fanIn = {},
        edges = [];
      for (const fp of files) ((fanOut[fp] = 0), (fanIn[fp] = fanIn[fp] ?? 0));
      for (const fp of files)
        try {
          const { content: content } = await ipcReadFile(fp),
            dir = fp.split('/').slice(0, -1).join('/');
          let m;
          importRe.lastIndex = 0;
          const seen = new Set();
          for (; null !== (m = importRe.exec(content)); ) {
            const parts = (dir + '/' + m[1]).split('/'),
              stack = [];
            for (const p of parts) '..' === p ? stack.pop() : '.' !== p && stack.push(p);
            const base = stack.join('/'),
              resolved =
                files.find((f) => f === base) ||
                extensions.map((e) => base + '.' + e).find((c) => fileSet.has(c)) ||
                extensions.map((e) => base + '/index.' + e).find((c) => fileSet.has(c));
            resolved &&
              resolved !== fp &&
              !seen.has(resolved) &&
              (seen.add(resolved),
              (fanOut[fp] = (fanOut[fp] || 0) + 1),
              (fanIn[resolved] = (fanIn[resolved] || 0) + 1),
              edges.push([fp, resolved]));
          }
        } catch {}
      const shorten = (p) => p.replace(rootPath + '/', ''),
        topFanIn = Object.entries(fanIn)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15),
        topFanOut = Object.entries(fanOut)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 15),
        isolated = files.filter((f) => !fanIn[f] && !fanOut[f]),
        output = [
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
      return (
        isolated.length &&
          (output.push('', '### ISOLATED FILES (no imports, not imported by anyone)'),
          isolated.slice(0, 20).forEach((f) => output.push(`  ${shorten(f)}`)),
          isolated.length > 20 && output.push(`  … +${isolated.length - 20} more`)),
        output.join('\n')
      );
    },
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
        ],
        findings = [];
      for (const check of checks) {
        const result = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath: rootPath,
          query: check.query,
          maxResults: 20,
        });
        for (const m of result?.matches ?? [])
          m.line.trim().startsWith('//') ||
            m.line.trim().startsWith('#') ||
            m.path.includes('.env') ||
            m.path.includes('test') ||
            m.path.includes('spec') ||
            findings.push({
              category: check.category,
              severity: check.severity,
              path: m.path.replace(rootPath + '/', ''),
              line: m.lineNumber,
              text: m.line.trim().slice(0, 100),
            });
      }
      if (!findings.length)
        return `✅ No obvious security anti-patterns found in ${rootPath}.\nNote: This is a surface-level scan, not a substitute for a full SAST tool.`;
      const bySeverity = { HIGH: [], MEDIUM: [], LOW: [] };
      for (const f of findings) bySeverity[f.severity]?.push(f);
      const sevIcon = { HIGH: '🔴', MEDIUM: '🟡', LOW: '🔵' },
        output = [
          `Security scan: ${rootPath}`,
          `${findings.length} potential issue${1 !== findings.length ? 's' : ''} found (surface-level scan only)`,
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
        for (const [cat, items] of Object.entries(byCategory))
          (output.push(`  ${cat}:`),
            items.slice(0, 5).forEach((f) => output.push(`    ${f.path}:${f.line} — ${f.text}`)),
            items.length > 5 && output.push(`    … +${items.length - 5} more`));
        output.push('');
      }
      return output.join('\n');
    },
    get_recently_modified_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      const limit = params.limit ?? 20,
        days = params.days ?? 7,
        extensions = params.extensions ?? '';
      onStage(`📅 Finding recently modified files in ${rootPath}`);
      const gitResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git log --name-only --pretty=format:"%ar|%s" --since="${days} days ago" --diff-filter=AM | head -200`,
        cwd: rootPath,
        timeout: 15e3,
        allowRisky: !1,
      });
      if (gitResult?.ok && gitResult.stdout?.trim()) {
        const extFilter = extensions
            ? extensions.split(',').map((e) => '.' + e.trim().replace(/^\./, ''))
            : null,
          lines = gitResult.stdout.trim().split('\n'),
          fileChanges = new Map();
        let currentMeta = null;
        for (const line of lines)
          if (line.includes('|')) {
            const [when, ...msgParts] = line.split('|');
            currentMeta = { when: when.trim(), message: msgParts.join('|').trim() };
          } else
            line.trim() &&
              currentMeta &&
              !line.startsWith('diff') &&
              (line.trim(),
              fileChanges.has(line.trim()) ||
                (extFilter && !extFilter.some((e) => line.trim().endsWith(e))) ||
                fileChanges.set(line.trim(), currentMeta));
        const files = [...fileChanges.entries()].slice(0, limit);
        if (files.length) {
          const output = [
            `Recently modified files in ${rootPath} (last ${days} day${1 !== days ? 's' : ''}):`,
            `${files.length} file${1 !== files.length ? 's' : ''} changed`,
            '',
          ];
          for (const [fp, meta] of files)
            (output.push(`  ${meta.when.padEnd(16)}  ${fp}`),
              output.push(`               ↳ ${meta.message.slice(0, 80)}`));
          return output.join('\n');
        }
      }
      const extPat = extensions
          ? extensions
              .split(',')
              .map((e) => `-name "*.${e.trim().replace(/^\./, '')}"`)
              .join(' -o ')
          : '-name "*"',
        shellResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( ${extPat} \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -newer "${rootPath}/.git/index" -printf "%T+\t%p\n" 2>/dev/null | sort -r | head -${limit}`,
          cwd: rootPath,
          timeout: 15e3,
          allowRisky: !1,
        });
      if (!shellResult?.ok || !shellResult.stdout?.trim())
        return `Could not determine recently modified files in ${rootPath}.`;
      const files = shellResult.stdout.trim().split('\n').filter(Boolean),
        output = [`Recently modified files in ${rootPath}:`, ''];
      for (const line of files) {
        const [ts, fp] = line.split('\t');
        output.push(`  ${ts?.slice(0, 16).padEnd(18)}  ${fp?.replace(rootPath + '/', '')}`);
      }
      return output.join('\n');
    },
    find_naming_inconsistencies: async (params, onStage) => {
      const filePath = params.path?.trim(),
        rootPath = params.workspace_path ? resolveWorkingDirectory(params.workspace_path) : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');
      onStage('📛 Scanning for naming convention inconsistencies');
      const classify = (name) =>
          /^[A-Z][a-zA-Z0-9]*$/.test(name)
            ? 'PascalCase'
            : /^[a-z][a-zA-Z0-9]*$/.test(name) && name.includes('') && !/[_-]/.test(name)
              ? 'camelCase'
              : /^[a-z][a-z0-9_]*$/.test(name) && name.includes('_')
                ? 'snake_case'
                : /^[a-z][a-z0-9-]*$/.test(name) && name.includes('-')
                  ? 'kebab-case'
                  : /^[A-Z][A-Z0-9_]*$/.test(name)
                    ? 'UPPER_SNAKE'
                    : null,
        scanFile = async (fp) => {
          try {
            const { content: content } = await ipcReadFile(fp),
              lines = splitLines(content),
              names = {
                camelCase: [],
                snake_case: [],
                PascalCase: [],
                'kebab-case': [],
                UPPER_SNAKE: [],
              },
              declRe =
                /(?:const|let|var|function|class|def|type|interface)\s+([a-zA-Z_][a-zA-Z0-9_-]*)/g;
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (/^\s*(\/\/|#|\/\*)/.test(line)) continue;
              let m;
              for (declRe.lastIndex = 0; null !== (m = declRe.exec(line)); ) {
                const name = m[1];
                if (name.length < 3) continue;
                const style = classify(name);
                style && names[style].push({ name: name, line: i + 1 });
              }
            }
            const present = Object.entries(names).filter(([, v]) => v.length > 0);
            return present.length <= 1 ? null : { file: fp, styles: Object.fromEntries(present) };
          } catch {
            return null;
          }
        },
        results = [];
      if (filePath) {
        const r = await scanFile(filePath);
        r && results.push(r);
      } else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
            command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.py" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
            cwd: rootPath,
            timeout: 15e3,
            allowRisky: !1,
          }),
          files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 100) ?? [];
        for (const fp of files) {
          const r = await scanFile(fp);
          r && results.push(r);
        }
      }
      if (!results.length) return '✅ No naming convention inconsistencies detected.';
      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p),
        output = [
          `Naming inconsistencies found in ${results.length} file${1 !== results.length ? 's' : ''}:`,
          '',
        ];
      for (const r of results.slice(0, 30)) {
        const styles = Object.entries(r.styles)
          .map(([s, v]) => `${s}(${v.length})`)
          .join('  ');
        (output.push(`📄 ${shorten(r.file)}`), output.push(`   Styles found: ${styles}`));
        for (const [style, items] of Object.entries(r.styles)) {
          const examples = items
            .slice(0, 3)
            .map((x) => x.name)
            .join(', ');
          output.push(
            `   ${style}: ${examples}${items.length > 3 ? ' … +' + (items.length - 3) : ''}`,
          );
        }
        output.push('');
      }
      return output.join('\n');
    },
    get_config_files: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage(`⚙️ Discovering configuration files in ${rootPath}`);
      const CONFIG_PATTERNS = [
          { pattern: 'package.json', category: 'Node', key: !0 },
          { pattern: 'tsconfig*.json', category: 'TypeScript', key: !0 },
          { pattern: '.eslintrc*', category: 'Linting', key: !1 },
          { pattern: 'eslint.config*', category: 'Linting', key: !1 },
          { pattern: '.prettierrc*', category: 'Formatting', key: !1 },
          { pattern: 'prettier.config*', category: 'Formatting', key: !1 },
          { pattern: 'jest.config*', category: 'Testing', key: !1 },
          { pattern: 'vitest.config*', category: 'Testing', key: !1 },
          { pattern: 'vite.config*', category: 'Build', key: !1 },
          { pattern: 'webpack.config*', category: 'Build', key: !1 },
          { pattern: 'rollup.config*', category: 'Build', key: !1 },
          { pattern: 'babel.config*', category: 'Transpile', key: !1 },
          { pattern: '.babelrc*', category: 'Transpile', key: !1 },
          { pattern: 'Dockerfile*', category: 'Docker', key: !1 },
          { pattern: 'docker-compose*', category: 'Docker', key: !1 },
          { pattern: '.env*', category: 'Env', key: !1 },
          { pattern: '.github/workflows/*.yml', category: 'CI/CD', key: !1 },
          { pattern: '.gitlab-ci.yml', category: 'CI/CD', key: !1 },
          { pattern: 'Makefile', category: 'Build', key: !1 },
          { pattern: 'pyproject.toml', category: 'Python', key: !0 },
          { pattern: 'setup.py', category: 'Python', key: !0 },
          { pattern: 'requirements*.txt', category: 'Python', key: !1 },
          { pattern: 'go.mod', category: 'Go', key: !0 },
          { pattern: 'Cargo.toml', category: 'Rust', key: !0 },
          { pattern: '*.config.js', category: 'Config', key: !1 },
          { pattern: '*.config.ts', category: 'Config', key: !1 },
        ],
        foundConfigs = [];
      for (const cfg of CONFIG_PATTERNS) {
        const result = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -maxdepth 4 -name "${cfg.pattern}" -not -path "*/node_modules/*" -not -path "*/.git/*" 2>/dev/null | head -10`,
          cwd: rootPath,
          timeout: 8e3,
          allowRisky: !1,
        });
        if (result?.ok && result.stdout?.trim())
          for (const fp of result.stdout.trim().split('\n').filter(Boolean))
            foundConfigs.push({ path: fp, category: cfg.category, key: cfg.key });
      }
      if (!foundConfigs.length) return `No configuration files found in ${rootPath}.`;
      const byCategory = {};
      for (const cfg of foundConfigs)
        (byCategory[cfg.category] = byCategory[cfg.category] || []).push(cfg);
      const shorten = (p) => p.replace(rootPath + '/', ''),
        output = [
          `Configuration files in ${rootPath}:`,
          `${foundConfigs.length} file${1 !== foundConfigs.length ? 's' : ''} across ${Object.keys(byCategory).length} categories`,
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
      const pkgJson = foundConfigs.find((c) => c.path.endsWith('package.json'));
      if (pkgJson)
        try {
          const { content: content } = await ipcReadFile(pkgJson.path),
            pkg = JSON.parse(content);
          (output.push('### PACKAGE.JSON SUMMARY'),
            pkg.name && output.push(`  name:    ${pkg.name}`),
            pkg.version && output.push(`  version: ${pkg.version}`),
            pkg.main && output.push(`  main:    ${pkg.main}`),
            pkg.type && output.push(`  type:    ${pkg.type}`),
            pkg.engines && output.push(`  engines: ${JSON.stringify(pkg.engines)}`));
        } catch {}
      return output.join('\n');
    },
    find_async_patterns: async (params, onStage) => {
      const filePath = params.path?.trim(),
        rootPath = params.workspace_path ? resolveWorkingDirectory(params.workspace_path) : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');
      onStage('⚡ Mapping async patterns');
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
        ],
        scanFile = async (fp) => {
          try {
            const { content: content } = await ipcReadFile(fp),
              lines = splitLines(content),
              hits = {};
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (!/^\s*(\/\/|#)/.test(line))
                for (const p of PATTERNS)
                  p.re.test(line) &&
                    (hits[p.label] || (hits[p.label] = []), hits[p.label].push(i + 1));
            }
            return hits;
          } catch {
            return {};
          }
        };
      let fileMap = {};
      if (filePath) fileMap[filePath] = await scanFile(filePath);
      else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
            command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
            cwd: rootPath,
            timeout: 15e3,
            allowRisky: !1,
          }),
          files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 100) ?? [];
        for (const fp of files) {
          const h = await scanFile(fp);
          Object.keys(h).length && (fileMap[fp] = h);
        }
      }
      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p),
        totals = {};
      for (const hits of Object.values(fileMap))
        for (const [label, lines] of Object.entries(hits))
          totals[label] = (totals[label] || 0) + lines.length;
      const output = [
        `Async pattern analysis: ${filePath ?? rootPath}`,
        `${Object.keys(fileMap).length} file${1 !== Object.keys(fileMap).length ? 's' : ''} analyzed`,
        '',
        '### PATTERN TOTALS',
        ...Object.entries(totals)
          .sort((a, b) => b[1] - a[1])
          .map(([label, count]) => `  ${label.padEnd(20)} ${count}`),
        '',
      ];
      if (filePath) {
        const hits = fileMap[filePath] ?? {};
        for (const [label, lineNums] of Object.entries(hits))
          (output.push(`### ${label.toUpperCase()} (${lineNums.length})`),
            lineNums.slice(0, 10).forEach((n) => output.push(`  Line ${n}`)),
            lineNums.length > 10 && output.push(`  … +${lineNums.length - 10} more`),
            output.push(''));
      } else {
        output.push('### FILES WITH MOST ASYNC COMPLEXITY');
        const scored = Object.entries(fileMap)
          .map(([fp, hits]) => ({
            fp: fp,
            score: Object.values(hits).reduce((s, v) => s + v.length, 0),
          }))
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);
        for (const { fp: fp, score: score } of scored) {
          const labels = Object.entries(fileMap[fp])
            .sort((a, b) => b[1].length - a[1].length)
            .slice(0, 4)
            .map(([l, v]) => `${l}(${v.length})`)
            .join('  ');
          (output.push(`  ${shorten(fp)}`), output.push(`    ${labels}`));
        }
      }
      return output.join('\n');
    },
    map_component_tree: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      const entryFile = params.entry_file?.trim() ?? '';
      onStage(`🌲 Mapping component tree in ${rootPath}`);
      const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( -name "*.jsx" -o -name "*.tsx" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" -not -path "*/dist/*"`,
        cwd: rootPath,
        timeout: 15e3,
        allowRisky: !1,
      });
      if (!listResult?.ok || !listResult.stdout?.trim())
        return `No JSX/TSX component files found in ${rootPath}.`;
      const files = listResult.stdout.trim().split('\n').filter(Boolean);
      onStage(`Analyzing ${files.length} component files…`);
      const components = {},
        jsxTagRe = /<([A-Z][a-zA-Z0-9]*)\s*[^>]*\/?>/g,
        exportRe = /export\s+(?:default\s+)?(?:function|class|const)\s+([A-Z][a-zA-Z0-9]*)/;
      for (const fp of files)
        try {
          const { content: content } = await ipcReadFile(fp),
            exportMatch = content.match(exportRe),
            compName =
              exportMatch?.[1] ??
              fp
                .split('/')
                .pop()
                .replace(/\.[jt]sx?$/, ''),
            renderedComponents = new Set();
          let m;
          for (jsxTagRe.lastIndex = 0; null !== (m = jsxTagRe.exec(content)); )
            m[1] !== compName && renderedComponents.add(m[1]);
          components[compName] = {
            file: fp.replace(rootPath + '/', ''),
            renders: renderedComponents,
          };
        } catch {}
      if (!Object.keys(components).length) return `No components detected in ${rootPath}.`;
      const allRendered = new Set(Object.values(components).flatMap((c) => [...c.renders])),
        roots = Object.keys(components).filter((c) => !allRendered.has(c)),
        output = [
          `Component tree: ${rootPath}`,
          `${Object.keys(components).length} components found | Likely root${1 !== roots.length ? 's' : ''}: ${roots.join(', ') || 'none detected'}`,
          '',
        ],
        printTree = (name, depth, seen = new Set()) => {
          if (seen.has(name) || depth > 6) return;
          seen.add(name);
          const comp = components[name];
          if (!comp) return;
          const indent = '  '.repeat(depth);
          output.push(`${indent}${0 === depth ? '📦 ' : '  └─ '}${name}  (${comp.file})`);
          for (const child of comp.renders) printTree(child, depth + 1, new Set(seen));
        },
        treeRoots = entryFile
          ? Object.keys(components).filter((c) => components[c].file.includes(entryFile))
          : roots.slice(0, 5);
      for (const root of treeRoots)
        (output.push(`### TREE FROM: ${root}`), printTree(root, 0), output.push(''));
      const leaves = Object.entries(components)
        .filter(([, c]) => 0 === c.renders.size)
        .map(([n]) => n);
      return (
        leaves.length &&
          (output.push(`### LEAF COMPONENTS (no children): ${leaves.length}`),
          output.push('  ' + leaves.slice(0, 20).join(', '))),
        output.join('\n')
      );
    },
    count_code_by_author: async (params, onStage) => {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory)
        throw new Error('No workspace is open. Set a workspace or provide working_directory.');
      const maxFiles = params.max_files ?? 50;
      (params.file_glob, onStage(`👥 Counting code by author in ${workingDirectory}`));
      const result = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git ls-files | head -${maxFiles}`,
        cwd: workingDirectory,
        timeout: 1e4,
        allowRisky: !1,
      });
      if (!result?.ok || !result.stdout?.trim())
        return `Could not list tracked files. Ensure ${workingDirectory} is a git repo.`;
      const files = result.stdout.trim().split('\n').filter(Boolean);
      onStage(`Blaming ${files.length} files…`);
      const blameResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `git ls-files | head -${maxFiles} | xargs -I{} git blame --line-porcelain {} 2>/dev/null | grep "^author " | sort | uniq -c | sort -rn`,
        cwd: workingDirectory,
        timeout: 3e4,
        allowRisky: !1,
      });
      if (!blameResult?.ok || !blameResult.stdout?.trim()) {
        const logResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: 'git log --pretty=format:"%an" | sort | uniq -c | sort -rn | head -20',
          cwd: workingDirectory,
          timeout: 1e4,
          allowRisky: !1,
        });
        if (!logResult?.ok) return 'Could not compute author statistics.';
        const lines = logResult.stdout.trim().split('\n').filter(Boolean),
          output = [`Code by author (commit count) in ${workingDirectory}:`, ''];
        let totalCommits = 0;
        const parsed = lines
          .map((l) => {
            const m = l.trim().match(/^(\d+)\s+(.+)$/);
            return m
              ? ((totalCommits += parseInt(m[1], 10)), { count: parseInt(m[1], 10), author: m[2] })
              : null;
          })
          .filter(Boolean);
        for (const { count: count, author: author } of parsed) {
          const pct = Math.round((count / Math.max(totalCommits, 1)) * 100),
            bar = '█'.repeat(Math.round(pct / 5));
          output.push(
            `  ${String(count).padStart(5)} commits  ${String(pct).padStart(3)}%  ${bar.padEnd(20)}  ${author}`,
          );
        }
        return output.join('\n');
      }
      const authorCounts = {};
      let totalLines = 0;
      for (const line of blameResult.stdout.trim().split('\n')) {
        const m = line.trim().match(/^(\d+)\s+author\s+(.+)$/);
        if (m) {
          const count = parseInt(m[1], 10),
            author = m[2].trim();
          ((authorCounts[author] = (authorCounts[author] || 0) + count), (totalLines += count));
        }
      }
      const sorted = Object.entries(authorCounts).sort((a, b) => b[1] - a[1]),
        output = [
          `Code ownership by author: ${workingDirectory}`,
          `${totalLines.toLocaleString()} lines across ${files.length} files | ${sorted.length} contributor${1 !== sorted.length ? 's' : ''}`,
          '',
        ];
      for (const [author, count] of sorted) {
        const pct = Math.round((count / Math.max(totalLines, 1)) * 100),
          bar = '█'.repeat(Math.round(pct / 3));
        output.push(
          `  ${String(count).padStart(7)} lines  ${String(pct).padStart(3)}%  ${bar.padEnd(34)}  ${author}`,
        );
      }
      if (sorted.length >= 2) {
        const topTwo = sorted.slice(0, 2),
          topPct = Math.round((topTwo[0][1] / Math.max(totalLines, 1)) * 100);
        (output.push(''),
          topPct > 70 &&
            output.push(`⚠️  Bus factor risk: ${topTwo[0][0]} owns ${topPct}% of lines.`));
      }
      return output.join('\n');
    },
    find_feature_flags: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage(`🚩 Scanning for feature flags in ${rootPath}`);
      const FLAG_PATTERNS = [
          /(?:isFeatureEnabled|featureFlags?|getFlag|flags?\.get|flags?\[|FEATURE_|FF_|ENABLE_|feature_flag)\s*\(?['"`]?([A-Z_a-z][A-Z_a-z0-9]*)['"`]?\)?/g,
          /if\s*\(\s*(?:process\.env|config)\.[A-Z_]{3,}\s*\)/g,
          /LaunchDarkly|Unleash|Flagsmith|Split\.io|ConfigCat|Optimizely/gi,
        ],
        queries = [
          'featureFlag',
          'FEATURE_',
          'isEnabled',
          'feature_flag',
          'LaunchDarkly',
          'Unleash',
          'flag(',
          'flags.',
        ],
        allMatches = [];
      for (const q of queries) {
        const r = await window.electronAPI?.invoke?.('search-workspace', {
          rootPath: rootPath,
          query: q,
          maxResults: 80,
        });
        r?.matches && allMatches.push(...r.matches);
      }
      const seen = new Set(),
        unique = allMatches.filter((m) => {
          const key = `${m.path}:${m.lineNumber}`;
          return !seen.has(key) && (seen.add(key), !0);
        });
      if (!unique.length) return `No feature flag patterns found in ${rootPath}.`;
      const flagNames = new Map();
      for (const m of unique)
        for (const re of FLAG_PATTERNS.slice(0, 1)) {
          let match;
          for (re.lastIndex = 0; null !== (match = re.exec(m.line)); ) {
            const name = match[1];
            name &&
              name.length > 2 &&
              (flagNames.has(name) || flagNames.set(name, []),
              flagNames
                .get(name)
                .push({ file: m.path.replace(rootPath + '/', ''), line: m.lineNumber }));
          }
        }
      const shorten = (p) => p.replace(rootPath + '/', ''),
        output = [
          `Feature flags in ${rootPath}:`,
          `${unique.length} references | ${flagNames.size} unique flag name${1 !== flagNames.size ? 's' : ''} detected`,
          '',
        ];
      if (flagNames.size) {
        output.push('### FLAG NAMES (by usage frequency)');
        const sorted = [...flagNames.entries()].sort((a, b) => b[1].length - a[1].length);
        for (const [name, locs] of sorted.slice(0, 30))
          (output.push(`  ${name.padEnd(35)} used ${locs.length}x`),
            locs.slice(0, 2).forEach((l) => output.push(`    ${l.file}:${l.line}`)));
        output.push('');
      }
      const byFile = {};
      for (const m of unique) (byFile[shorten(m.path)] = byFile[shorten(m.path)] || []).push(m);
      output.push('### FILES WITH FLAG USAGE');
      for (const [fp, items] of Object.entries(byFile).slice(0, 20))
        output.push(`  📄 ${fp} (${items.length} reference${1 !== items.length ? 's' : ''})`);
      return output.join('\n');
    },
    get_function_call_frequency: async (params, onStage) => {
      const { path: filePath } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      const rootPath = params.workspace_path
        ? resolveWorkingDirectory(params.workspace_path)
        : resolveWorkingDirectory(null);
      onStage(`📊 Analyzing function call frequency for ${filePath}`);
      const { content: content } = await ipcReadFile(filePath),
        lines = splitLines(content),
        fnNames = [],
        fnRe =
          /^(?:export\s+)?(?:async\s+)?function\s+(\w+)|^(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?\(?/;
      for (const line of lines) {
        const m = line.trim().match(fnRe);
        if (m) {
          const name = m[1] || m[2];
          name && name.length > 2 && !fnNames.includes(name) && fnNames.push(name);
        }
      }
      if (!fnNames.length) return `No function definitions found in ${filePath}.`;
      onStage(`Counting calls for ${fnNames.length} functions…`);
      const callCounts = await Promise.all(
        fnNames.map(async (name) => {
          const r = await window.electronAPI?.invoke?.('search-workspace', {
              rootPath: rootPath,
              query: name + '(',
              maxResults: 100,
            }),
            matches = (r?.matches ?? []).filter(
              (m) => !m.path.includes('.test.') && !m.path.includes('.spec.'),
            );
          return {
            name: name,
            callCount: matches.filter((m) => {
              const t = m.line.trim();
              return (
                !/^(?:export\s+)?(?:async\s+)?function\s+/.test(t) &&
                !/^(?:const|let|var)\s+\w+\s*=/.test(t)
              );
            }).length,
            totalRefs: matches.length,
          };
        }),
      );
      callCounts.sort((a, b) => b.callCount - a.callCount);
      const maxCalls = Math.max(...callCounts.map((c) => c.callCount), 1),
        output = [
          `Function call frequency: ${filePath}`,
          `${fnNames.length} functions | Search scope: ${rootPath ?? 'workspace'}`,
          '',
          '### CALL FREQUENCY (sorted by usage)',
        ];
      for (const { name: name, callCount: callCount, totalRefs: totalRefs } of callCounts) {
        const bar = '█'.repeat(Math.min(Math.round((callCount / maxCalls) * 15), 15)),
          flag = 0 === callCount ? '  ⚠️ potentially dead' : '';
        output.push(`  ${String(callCount).padStart(4)}x  ${bar.padEnd(16)}  ${name}${flag}`);
      }
      const deadFns = callCounts.filter((c) => 0 === c.callCount);
      return (
        deadFns.length &&
          (output.push('', '### POTENTIALLY DEAD FUNCTIONS (0 external calls)'),
          deadFns.forEach((f) => output.push(`  ${f.name}`))),
        output.join('\n')
      );
    },
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
        timeout: 1e4,
        allowRisky: !1,
      });
      if (!diffResult?.ok || !diffResult.stdout?.trim())
        return `No recent git history found for ${filePath}.`;
      const recentCommits = diffResult.stdout.trim().split('\n'),
        output = [
          `Change summary: ${filePath}`,
          `Last ${recentCommits.length} commit${1 !== recentCommits.length ? 's' : ''}:`,
          '',
        ];
      for (const commitLine of recentCommits) {
        const [hash, ...msgParts] = commitLine.split(' '),
          message = msgParts.join(' ');
        output.push(`### ${hash}: ${message}`);
        const showResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `git show --stat ${hash} -- "${filePath}"`,
          cwd: workingDirectory,
          timeout: 1e4,
          allowRisky: !1,
        });
        if (showResult?.ok && showResult.stdout?.trim()) {
          const statLines = showResult.stdout.trim().split('\n'),
            summary = statLines[statLines.length - 1];
          summary && output.push(`  ${summary}`);
        }
        const patchResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `git show ${hash} -- "${filePath}" | grep "^[+-]" | grep -v "^[+-][+-][+-]" | head -60`,
          cwd: workingDirectory,
          timeout: 1e4,
          allowRisky: !1,
        });
        if (patchResult?.ok && patchResult.stdout?.trim()) {
          const diffLines = patchResult.stdout.trim().split('\n'),
            added = diffLines.filter((l) => l.startsWith('+')).length,
            removed = diffLines.filter((l) => l.startsWith('-')).length;
          output.push(`  +${added} lines added, -${removed} lines removed`);
          const fnRe =
              /^[+-]\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)|^[+-]\s*(?:const|let|var)\s+(\w+)\s*=/,
            touched = new Set();
          for (const dl of diffLines) {
            const m = dl.match(fnRe);
            m && touched.add(m[1] || m[2]);
          }
          touched.size && output.push(`  Functions touched: ${[...touched].join(', ')}`);
          const interesting = diffLines
            .filter((l) => l.trim().length > 3 && !l.startsWith('+++') && !l.startsWith('---'))
            .slice(0, 8);
          interesting.length &&
            (output.push('  Preview:'),
            interesting.forEach((l) => output.push(`    ${l.slice(0, 100)}`)));
        }
        output.push('');
      }
      return output.join('\n');
    },
    find_performance_patterns: async (params, onStage) => {
      const filePath = params.path?.trim(),
        rootPath = params.workspace_path ? resolveWorkingDirectory(params.workspace_path) : null;
      if (!filePath && !rootPath) throw new Error('Provide path or workspace_path.');
      onStage('⚡ Scanning for performance anti-patterns');
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
        ],
        scanFile = async (fp) => {
          try {
            const { content: content } = await ipcReadFile(fp),
              lines = splitLines(content),
              issues = [];
            for (let i = 0; i < lines.length; i++) {
              const line = lines[i];
              if (!/^\s*(\/\/|#)/.test(line))
                for (const check of CHECKS)
                  if (check.followRe) {
                    if (check.re.test(line)) {
                      const window = lines.slice(i + 1, i + 1 + (check.range ?? 3)).join('\n');
                      check.followRe.test(window) &&
                        issues.push({
                          line: i + 1,
                          label: check.label,
                          text: line.trim().slice(0, 100),
                        });
                    }
                  } else
                    check.re.test(line) &&
                      issues.push({
                        line: i + 1,
                        label: check.label,
                        text: line.trim().slice(0, 100),
                      });
            }
            return issues;
          } catch {
            return [];
          }
        };
      let fileMap = {};
      if (filePath) fileMap[filePath] = await scanFile(filePath);
      else {
        const listResult = await window.electronAPI?.invoke?.('run-shell-command', {
            command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" \\) -not -path "*/node_modules/*" -not -path "*/.git/*"`,
            cwd: rootPath,
            timeout: 15e3,
            allowRisky: !1,
          }),
          files = listResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 100) ?? [];
        for (const fp of files) {
          const issues = await scanFile(fp);
          issues.length && (fileMap[fp] = issues);
        }
      }
      const allIssues = Object.values(fileMap).flat();
      if (!allIssues.length) return '✅ No obvious performance anti-patterns detected.';
      const shorten = (p) => (rootPath ? p.replace(rootPath + '/', '') : p),
        byLabel = {};
      for (const iss of allIssues) (byLabel[iss.label] = byLabel[iss.label] || []).push(iss);
      const output = [
        `Performance anti-patterns: ${filePath ?? rootPath}`,
        `${allIssues.length} potential issue${1 !== allIssues.length ? 's' : ''} across ${Object.keys(fileMap).length} file${1 !== Object.keys(fileMap).length ? 's' : ''}`,
        '',
        '### BY PATTERN TYPE',
        ...Object.entries(byLabel)
          .sort((a, b) => b[1].length - a[1].length)
          .map(([label, items]) => `  ${label}: ${items.length}`),
        '',
      ];
      for (const [fp, issues] of Object.entries(fileMap))
        (output.push(`📄 ${shorten(fp)} (${issues.length})`),
          issues
            .slice(0, 6)
            .forEach((iss) => output.push(`   Line ${iss.line} — ${iss.label}\n     ${iss.text}`)),
          issues.length > 6 && output.push(`   … +${issues.length - 6} more`),
          output.push(''));
      return output.join('\n');
    },
    get_workspace_health_score: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage('🏥 Computing workspace health score…');
      const checks = {},
        listResult = await window.electronAPI?.invoke?.('run-shell-command', {
          command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" -o -name "*.jsx" -o -name "*.tsx" -o -name "*.py" \\) -not -path "*/node_modules/*" -not -path "*/.git/*" | wc -l`,
          cwd: rootPath,
          timeout: 1e4,
          allowRisky: !1,
        });
      checks.sourceFiles = parseInt(listResult?.stdout?.trim() ?? '0', 10);
      const testResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( -name "*.test.*" -o -name "*.spec.*" \\) -not -path "*/node_modules/*" | wc -l`,
        cwd: rootPath,
        timeout: 1e4,
        allowRisky: !1,
      });
      checks.testFiles = parseInt(testResult?.stdout?.trim() ?? '0', 10);
      const todoResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: rootPath,
        query: 'TODO',
        maxResults: 200,
      });
      checks.todos = todoResult?.matches?.length ?? 0;
      const consoleResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: rootPath,
        query: 'console.log(',
        maxResults: 100,
      });
      checks.consoleLogs = consoleResult?.matches?.length ?? 0;
      const secretResult = await window.electronAPI?.invoke?.('search-workspace', {
        rootPath: rootPath,
        query: 'password =',
        maxResults: 20,
      });
      checks.potentialSecrets = (secretResult?.matches ?? []).filter(
        (m) => !m.line.trim().startsWith('//') && !m.path.includes('.env'),
      ).length;
      const longFileResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `find "${rootPath}" -type f \\( -name "*.js" -o -name "*.ts" \\) -not -path "*/node_modules/*" | xargs wc -l 2>/dev/null | sort -rn | awk '$1 > 500 {print}' | wc -l`,
        cwd: rootPath,
        timeout: 15e3,
        allowRisky: !1,
      });
      checks.longFiles = parseInt(longFileResult?.stdout?.trim() ?? '0', 10);
      const gitResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: 'git status --porcelain 2>/dev/null | wc -l',
        cwd: rootPath,
        timeout: 1e4,
        allowRisky: !1,
      });
      checks.uncommittedChanges = parseInt(gitResult?.stdout?.trim() ?? '0', 10);
      const branchResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: 'git branch 2>/dev/null | wc -l',
        cwd: rootPath,
        timeout: 1e4,
        allowRisky: !1,
      });
      checks.branches = parseInt(branchResult?.stdout?.trim() ?? '0', 10);
      const depResult = await window.electronAPI?.invoke?.('run-shell-command', {
        command: `[ -f "${rootPath}/package.json" ] && node -e "const p=require('${rootPath}/package.json'); console.log(Object.keys({...p.dependencies,...p.devDependencies}).length)" 2>/dev/null || echo 0`,
        cwd: rootPath,
        timeout: 1e4,
        allowRisky: !1,
      });
      checks.totalDeps = parseInt(depResult?.stdout?.trim() ?? '0', 10);
      const scoreItems = [],
        testRatio = checks.testFiles / Math.max(checks.sourceFiles, 1),
        testScore = Math.min(Math.round(100 * testRatio), 25);
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
        0 === checks.potentialSecrets ? 20 : Math.max(0, 20 - 5 * checks.potentialSecrets);
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
      const totalScore = scoreItems.reduce((s, i) => s + i.score, 0),
        grade =
          totalScore >= 85
            ? 'A'
            : totalScore >= 70
              ? 'B'
              : totalScore >= 55
                ? 'C'
                : totalScore >= 40
                  ? 'D'
                  : 'F';
      return [
        '  WORKSPACE HEALTH SCORE',
        `  ${rootPath.split('/').pop()}`,
        '',
        `  ${{ A: '🟢', B: '🟡', C: '🟠', D: '🔴', F: '🔴' }[grade]} Overall: ${totalScore}/100  (Grade ${grade})`,
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
      ].join('\n');
    },
    get_architecture_overview: async (params, onStage) => {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open.');
      onStage(`🏗️ Building architectural overview of ${rootPath}`);
      const [inspectResult, treeResult, gitResult] = await Promise.all([
          window.electronAPI?.invoke?.('inspect-workspace', { rootPath: rootPath }),
          window.electronAPI?.invoke?.('list-directory-tree', {
            dirPath: rootPath,
            maxDepth: 3,
            maxEntries: 200,
          }),
          window.electronAPI?.invoke?.('run-shell-command', {
            command: 'git log --oneline -5 2>/dev/null || echo "(no git)"',
            cwd: rootPath,
            timeout: 8e3,
            allowRisky: !1,
          }),
        ]),
        summary = inspectResult?.summary,
        treeLines = treeResult?.lines ?? [],
        LAYER_HINTS = {
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
        },
        topDirs = treeLines
          .filter((l) => l.endsWith('/') && l.split('/').length <= 3)
          .map((l) => l.trim().replace(/\/$/, '').split('/').pop().toLowerCase()),
        detectedLayers = {};
      for (const dir of topDirs)
        for (const [pattern, label] of Object.entries(LAYER_HINTS))
          new RegExp(pattern).test(dir) &&
            (detectedLayers[label] || (detectedLayers[label] = []),
            detectedLayers[label].push(dir));
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
        ],
        entryPoints = treeLines.filter(
          (l) => ENTRY_PATTERNS.some((e) => l.trim().endsWith(e)) && !l.includes('node_modules'),
        ),
        allDirs = topDirs.join(' ');
      let archPattern = 'Unknown';
      /controller.*service|service.*repository|repository/.test(allDirs)
        ? (archPattern = 'Layered / MVC')
        : /domain|usecase|entit/.test(allDirs)
          ? (archPattern = 'Clean Architecture / DDD')
          : /feature|modules?/.test(allDirs)
            ? (archPattern = 'Feature-based / Modular')
            : /api|service|gateway/.test(allDirs) &&
                summary?.frameworks?.join('').includes('Express')
              ? (archPattern = 'Microservice / API-first')
              : summary?.frameworks?.some((f) =>
                    ['next', 'nuxt', 'remix', 'gatsby'].includes(f?.toLowerCase()),
                  )
                ? (archPattern = 'Full-stack Framework (SSR/SSG)')
                : summary?.frameworks?.some((f) =>
                      ['react', 'vue', 'angular', 'svelte'].includes(f?.toLowerCase()),
                    )
                  ? (archPattern = 'SPA / Client-side')
                  : /routes|pages/.test(allDirs) && (archPattern = 'Router-centric');
      let dataFlow = 'Cannot determine without deeper analysis.';
      archPattern.includes('Layered') || archPattern.includes('Clean')
        ? (dataFlow =
            'Request → Controller/Handler → Service → Repository → Database\nResponse flows in reverse.')
        : archPattern.includes('SPA')
          ? (dataFlow =
              'User Event → Component → State/Store → API call → Update State → Re-render')
          : archPattern.includes('SSR') &&
            (dataFlow =
              'Browser request → Server renders page → Client hydrates → User events → API updates');
      const recentCommits = gitResult?.stdout?.trim().split('\n').filter(Boolean).slice(0, 5) ?? [],
        output = [
          '  ARCHITECTURE OVERVIEW',
          `  ${rootPath.split('/').pop()}`,
          '',
          '### DETECTED PATTERN',
          `  ${archPattern}`,
          '',
          '### TECH STACK',
          `  Languages:  ${(summary?.languages ?? []).join(', ') || 'unknown'}`,
          `  Frameworks: ${(summary?.frameworks ?? []).join(', ') || 'none detected'}`,
          `  Testing:    ${(summary?.testing ?? []).join(', ') || 'none detected'}`,
          `  Pkg mgr:    ${summary?.packageManager || 'unknown'}`,
          '',
        ];
      if (Object.keys(detectedLayers).length) {
        output.push('### ARCHITECTURAL LAYERS');
        for (const [layer, dirs] of Object.entries(detectedLayers))
          output.push(`  ${layer.padEnd(32)} ← ${dirs.join(', ')}`);
        output.push('');
      }
      return (
        output.push('### DATA FLOW'),
        output.push(`  ${dataFlow.replace(/\n/g, '\n  ')}`),
        output.push(''),
        entryPoints.length &&
          (output.push('### ENTRY POINTS'),
          entryPoints.slice(0, 8).forEach((ep) => output.push(`  ${ep.trim()}`)),
          output.push('')),
        summary?.packageScripts &&
          Object.keys(summary.packageScripts).length &&
          (output.push('### KEY SCRIPTS'),
          Object.entries(summary.packageScripts)
            .slice(0, 6)
            .forEach(([k, v]) => output.push(`  ${k.padEnd(15)} ${v.slice(0, 60)}`)),
          output.push('')),
        recentCommits.length &&
          !recentCommits[0].includes('no git') &&
          (output.push('### RECENT COMMITS'),
          recentCommits.forEach((c) => output.push(`  ${c}`)),
          output.push('')),
        output.push('### AI GUIDANCE'),
        output.push(`  Pattern detected: ${archPattern}`),
        detectedLayers['API Layer'] &&
          output.push(`  API surface likely in: ${detectedLayers['API Layer'].join(', ')}`),
        detectedLayers['Business Logic'] &&
          output.push(`  Business logic likely in: ${detectedLayers['Business Logic'].join(', ')}`),
        detectedLayers['Data / Persistence'] &&
          output.push(`  Data layer likely in: ${detectedLayers['Data / Persistence'].join(', ')}`),
        output.push('  Run get_dependency_graph and find_api_endpoints for deeper analysis.'),
        output.join('\n')
      );
    },
  },
});
