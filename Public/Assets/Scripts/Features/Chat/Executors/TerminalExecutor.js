// Evelina — Features/Chat/Executors/TerminalExecutor.js
// Bridges the AI's local-dev tool calls to the Electron IPC layer.

import { state } from '../../../Shared/State.js';

const HANDLED = new Set([
  'inspect_workspace',
  'search_workspace',
  'find_file_by_name',
  'run_shell_command',
  'assess_shell_command',
  'read_local_file',
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
]);

export function handles(toolName) { return HANDLED.has(toolName); }

function resolveWorkingDirectory(explicitPath) {
  return explicitPath?.trim() || state.workspacePath || '';
}

function formatRisk(risk) {
  if (!risk || !risk.level || risk.level === 'low') return '';
  const reasons = (risk.reasons ?? []).map(reason => `- ${reason}`).join('\n');
  return [
    `Risk: **${risk.level}**`,
    reasons || '- No specific reason was returned.',
  ].join('\n');
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
    lines.push('', 'Notes:', ...summary.notes.map(note => `- ${note}`));
  }
  if (summary.topEntries?.length) {
    lines.push(
      '',
      'Top-level entries:',
      ...summary.topEntries.slice(0, 40).map(entry => `- ${entry.name}${entry.type === 'dir' ? '/' : ''}`),
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
    ...result.files.map(file => {
      if (!file.ok) {
        return [
          `### ${file.path}`,
          `Error: ${file.error}`,
        ].join('\n');
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

export async function execute(toolName, params, onStage = () => { }) {
  switch (toolName) {
    case 'inspect_workspace': {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');

      onStage(`📂 Inspecting workspace ${rootPath}`);
      const result = await window.electronAPI?.inspectWorkspace?.({ rootPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace inspection failed');
      return formatWorkspaceSummary(result.summary);
    }

    case 'search_workspace': {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');
      if (!params.query?.trim()) throw new Error('Missing required param: query');

      onStage(`🔎 Searching workspace for "${params.query}"`);
      const result = await window.electronAPI?.searchWorkspace?.({
        rootPath,
        query: params.query,
        maxResults: params.max_results,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Workspace search failed');
      if (!result.matches?.length) return `No matches for "${params.query}" in ${rootPath}.`;

      return [
        `Matches for "${params.query}" in ${result.root}:`,
        '',
        ...result.matches.map(match => `- ${match.path}:${match.lineNumber} — ${match.line}`),
      ].join('\n');
    }

    case 'find_file_by_name': {
      const rootPath = resolveWorkingDirectory(params.path);
      if (!rootPath) throw new Error('No workspace is open. Set a workspace or provide a path.');
      if (!params.name?.trim()) throw new Error('Missing required param: name');

      onStage(`🔎 Finding file "${params.name}"`);
      const result = await window.electronAPI?.findFileByName?.({
        rootPath,
        name: params.name,
        maxResults: params.max_results,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Find file failed');
      if (!result.matches?.length) return `No files matching "${params.name}" found in ${rootPath}.`;

      return [
        `Files matching "${params.name}" in ${result.root}:`,
        '',
        ...result.matches.map(match => `- ${match.path}`),
      ].join('\n');
    }

    case 'assess_shell_command': {
      if (!params.command?.trim()) throw new Error('Missing required param: command');
      onStage('🛡️ Assessing shell command risk');
      const result = await window.electronAPI?.assessCommandRisk?.({ command: params.command });
      if (!result?.ok) throw new Error(result?.error ?? 'Risk assessment failed');
      return formatRisk(result.risk) || 'Risk: **low**';
    }

    case 'run_shell_command': {
      const { command, timeout_seconds = 30, allow_risky = false } = params;
      if (!command?.trim()) throw new Error('Missing required param: command');

      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      onStage(`💻 Running: \`${command.slice(0, 80)}${command.length > 80 ? '…' : ''}\``);

      const result = await window.electronAPI?.runShellCommand?.({
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
    }

    case 'read_local_file': {
      const { path: filePath, max_lines } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');

      onStage(`📄 Reading ${filePath}`);
      const result = await window.electronAPI?.readLocalFile?.({
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
    }

    case 'read_file_chunk': {
      const { path: filePath, start_line, line_count } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (!start_line) throw new Error('Missing required param: start_line');

      onStage(`📄 Reading lines around ${filePath}:${start_line}`);
      const result = await window.electronAPI?.readFileChunk?.({
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
    }

    case 'read_multiple_local_files': {
      if (!params.paths?.trim()) throw new Error('Missing required param: paths');

      onStage(`Reading multiple files`);
      const result = await window.electronAPI?.readMultipleLocalFiles?.({
        paths: params.paths,
        maxLinesPerFile: params.max_lines_per_file,
      });

      if (!result?.ok) throw new Error(result?.error ?? 'Multi-file read failed');
      return formatMultipleFileReads(result);
    }

    case 'list_directory': {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`📁 Listing ${dirPath}`);
      const result = await window.electronAPI?.listDirectory?.({ dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Directory listing failed');

      const lines = result.entries.map(entry => {
        const icon = entry.type === 'dir' ? '📁' : '📄';
        const size = entry.size != null
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
    }

    case 'list_directory_tree': {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`Listing tree for ${dirPath}`);
      const result = await window.electronAPI?.listDirectoryTree?.({
        dirPath,
        maxDepth: params.max_depth,
        maxEntries: params.max_entries,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Directory tree failed');
      return formatDirectoryTree(result);
    }

    case 'write_file': {
      const { path: filePath, content } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (content == null) throw new Error('Missing required param: content');

      const append = params.append === true || params.append === 'true';
      onStage(`✍️ ${append ? 'Appending to' : 'Writing'} ${filePath}`);
      const result = await window.electronAPI?.writeAIFile?.({ filePath, content, append });
      if (!result?.ok) throw new Error(result?.error ?? 'File write failed');
      return `✅ File ${append ? 'appended' : 'written'}: ${result.path} (${result.bytes} bytes)`;
    }

    case 'apply_file_patch': {
      const { path: filePath, search, replace, replace_all } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (typeof search !== 'string' || !search.length) throw new Error('Missing required param: search');
      if (typeof replace !== 'string') throw new Error('Missing required param: replace');

      onStage(`🩹 Patching ${filePath}`);
      const result = await window.electronAPI?.applyFilePatch?.({
        filePath,
        search,
        replace,
        replaceAll: replace_all,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'File patch failed');
      return `✅ Patched ${result.path} (${result.replacements} replacement${result.replacements !== 1 ? 's' : ''})`;
    }

    case 'replace_lines_in_file': {
      const { path: filePath, start_line, end_line, replacement } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (start_line == null) throw new Error('Missing required param: start_line');
      if (end_line == null) throw new Error('Missing required param: end_line');
      if (typeof replacement !== 'string') throw new Error('Missing required param: replacement');

      onStage(`Replacing lines ${start_line}-${end_line} in ${filePath}`);
      const result = await window.electronAPI?.replaceLinesInFile?.({
        filePath,
        startLine: start_line,
        endLine: end_line,
        replacement,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Line replacement failed');
      return `✅ Replaced lines ${result.startLine}-${result.endLine} in ${result.path}`;
    }

    case 'insert_into_file': {
      const { path: filePath, content } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (typeof content !== 'string') throw new Error('Missing required param: content');

      onStage(`Inserting text into ${filePath}`);
      const result = await window.electronAPI?.insertIntoFile?.({
        filePath,
        content,
        position: params.position,
        lineNumber: params.line_number,
        anchor: params.anchor,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Insert failed');
      return `✅ Inserted text into ${result.path} using ${result.mode} targeting (${result.position})`;
    }

    case 'create_folder': {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`📁 Creating folder ${dirPath}`);
      const result = await window.electronAPI?.createDirectory?.({ dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Folder creation failed');
      return `✅ Folder created: ${result.path}`;
    }

    case 'copy_item': {
      const { source_path, destination_path } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!destination_path?.trim()) throw new Error('Missing required param: destination_path');

      onStage(`Copying ${source_path}`);
      const result = await window.electronAPI?.copyItem?.({
        sourcePath: source_path,
        destinationPath: destination_path,
        overwrite: params.overwrite,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Copy failed');
      return `✅ Copied ${result.source} -> ${result.destination}`;
    }

    case 'move_item': {
      const { source_path, destination_path } = params;
      if (!source_path?.trim()) throw new Error('Missing required param: source_path');
      if (!destination_path?.trim()) throw new Error('Missing required param: destination_path');

      onStage(`Moving ${source_path}`);
      const result = await window.electronAPI?.moveItem?.({
        sourcePath: source_path,
        destinationPath: destination_path,
        overwrite: params.overwrite,
      });
      if (!result?.ok) throw new Error(result?.error ?? 'Move failed');
      return `✅ Moved ${result.source} -> ${result.destination}`;
    }

    case 'git_status': {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory) throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      onStage(`🌿 Reading git status in ${workingDirectory}`);
      const result = await window.electronAPI?.gitStatus?.({ workingDir: workingDirectory });
      if (!result?.ok) throw new Error(result?.error ?? 'git status failed');
      return [
        `Git status for ${workingDirectory}:`,
        '```',
        (result.stdout || result.stderr || '(no output)').trim(),
        '```',
      ].join('\n');
    }

    case 'git_diff': {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory) throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      onStage(`🌿 Reading git diff in ${workingDirectory}`);
      const result = await window.electronAPI?.gitDiff?.({
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
    }

    case 'git_create_branch': {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory) throw new Error('No workspace is open. Set a workspace or provide working_directory.');
      if (!params.branch_name?.trim()) throw new Error('Missing required param: branch_name');

      onStage(`🌿 Creating branch ${params.branch_name}`);
      const result = await window.electronAPI?.gitCreateBranch?.({
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
    }

    case 'run_project_checks': {
      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      if (!workingDirectory) throw new Error('No workspace is open. Set a workspace or provide working_directory.');

      onStage(`🧪 Running project checks in ${workingDirectory}`);
      const result = await window.electronAPI?.runProjectChecks?.({
        working_directory: workingDirectory,
        include_lint: params.include_lint,
        include_test: params.include_test,
        include_build: params.include_build,
      });
      if (!result) return '⚠️ Project checks are not available in this environment.';
      if (!result.ok && !result.commands?.length) throw new Error(result.error ?? 'Project checks failed');
      return formatProjectChecks(result);
    }

    case 'open_folder': {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`📂 Opening folder in OS ${dirPath}`);
      const result = await window.electronAPI?.openFolderOS?.({ dirPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Opening folder failed');
      return `✅ Opened folder in system file explorer: ${dirPath}`;
    }

    case 'delete_item': {
      const { path: itemPath } = params;
      if (!itemPath?.trim()) throw new Error('Missing required param: path');

      onStage(`🗑️ Deleting ${itemPath}`);
      const result = await window.electronAPI?.deleteItem?.({ itemPath });
      if (!result?.ok) throw new Error(result?.error ?? 'Delete failed');
      return `✅ Successfully deleted: ${itemPath}`;
    }

    case 'start_local_server': {
      const { command } = params;
      if (!command?.trim()) throw new Error('Missing required param: command');

      const workingDirectory = resolveWorkingDirectory(params.working_directory);
      onStage(`🚀 Starting server: ${command}`);
      const result = await window.electronAPI?.spawnPty?.({
        command,
        cwd: workingDirectory,
      });

      if (!result?.ok) throw new Error(result?.error ?? 'Background process failed to start');
      return `[TERMINAL:${result.pid}]\n\n*Background process started with PID ${result.pid}. Output is streaming to the embedded terminal above. You may proceed.*`;
    }

    default:
      throw new Error(`TerminalExecutor: unknown tool "${toolName}"`);
  }
}
