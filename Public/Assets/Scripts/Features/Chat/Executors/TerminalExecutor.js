// openworld — Features/Chat/Executors/TerminalExecutor.js
// Bridges the AI's tool calls to the local filesystem and shell via Electron IPC.

const HANDLED = new Set(['run_shell_command', 'read_local_file', 'list_directory', 'write_file']);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => {}) {
  switch (toolName) {

    case 'run_shell_command': {
      const { command, working_directory, timeout_seconds = 30 } = params;
      if (!command?.trim()) throw new Error('Missing required param: command');

      onStage(`💻 Running: \`${command.slice(0, 80)}${command.length > 80 ? '…' : ''}\``);

      const result = await window.electronAPI?.runShellCommand?.({
        command,
        cwd: working_directory,
        timeout: timeout_seconds * 1000,
      });

      if (!result) return '⚠️ Shell command execution is not available in this environment.';
      if (!result.ok && result.error) return `Error: ${result.error}`;

      const parts = [];
      if (result.cwd) parts.push(`Working directory: ${result.cwd}`);

      if (result.timedOut) {
        parts.push(`⏰ Command timed out after ${timeout_seconds}s`);
      }
      if (result.stdout?.trim()) {
        parts.push(`STDOUT:\n\`\`\`\n${result.stdout.trim()}\n\`\`\``);
      }
      if (result.stderr?.trim()) {
        parts.push(`STDERR:\n\`\`\`\n${result.stderr.trim()}\n\`\`\``);
      }
      if (result.exitCode !== 0) {
        parts.push(`Exit code: ${result.exitCode}`);
      }
      if (!result.stdout?.trim() && !result.stderr?.trim()) {
        parts.push('(no output)');
      }

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

      if (!result) return '⚠️ File reading is not available in this environment.';
      if (!result.ok) return `Error reading file: ${result.error}`;

      return [
        `File: ${result.path}`,
        `Size: ${(result.sizeBytes / 1024).toFixed(1)} KB | Lines: ${result.totalLines}`,
        '```',
        result.content,
        '```',
      ].join('\n');
    }

    case 'list_directory': {
      const { path: dirPath } = params;
      if (!dirPath?.trim()) throw new Error('Missing required param: path');

      onStage(`📁 Listing ${dirPath}`);

      const result = await window.electronAPI?.listDirectory?.({ dirPath });

      if (!result) return '⚠️ Directory listing is not available in this environment.';
      if (!result.ok) return `Error: ${result.error}`;

      const lines = result.entries.map(e => {
        const icon = e.type === 'dir' ? '📁' : '📄';
        const size = e.size != null ? ` (${e.size < 1024 ? e.size + ' B' : (e.size / 1024).toFixed(1) + ' KB'})` : '';
        return `${icon} ${e.name}${e.type === 'dir' ? '/' : ''}${size}`;
      });

      return [
        `Directory: ${result.path}`,
        `${result.count} item${result.count !== 1 ? 's' : ''}:`,
        '',
        ...lines,
      ].join('\n');
    }

    case 'write_file': {
      const { path: filePath, content, append } = params;
      if (!filePath?.trim()) throw new Error('Missing required param: path');
      if (content == null)   throw new Error('Missing required param: content');

      const isAppend = append === 'true' || append === true;
      onStage(`✍️ ${isAppend ? 'Appending to' : 'Writing'} ${filePath}`);

      const result = await window.electronAPI?.writeAIFile?.({
        filePath,
        content,
        append: isAppend,
      });

      if (!result) return '⚠️ File writing is not available in this environment.';
      if (!result.ok) return `Error writing file: ${result.error}`;

      return `✅ File ${isAppend ? 'appended' : 'written'}: ${result.path} (${result.bytes} bytes)`;
    }

    default:
      throw new Error(`TerminalExecutor: unknown tool "${toolName}"`);
  }
}
