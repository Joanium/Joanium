// openworld — Features/Chat/Tools/TerminalTools.js
export const TERMINAL_TOOLS = [
  {
    name: 'run_shell_command',
    description: 'Execute a shell command on the local machine and return stdout/stderr. Ideal for: running scripts, git operations, npm/pip commands, file manipulation, checking processes, compiling code. Output is streamed back so the AI can reason about results and chain commands.',
    category: 'terminal',
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: 'Shell command to execute. Multi-line scripts are supported with semicolons or &&. Examples: "ls -la ~/projects", "git log --oneline -10", "npm test 2>&1 | head -50"',
      },
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute path to run the command in. Defaults to home directory.',
      },
      timeout_seconds: {
        type: 'number',
        required: false,
        description: 'Max execution time in seconds (default: 30, max: 120). Use higher values for build/install commands.',
      },
    },
  },
  {
    name: 'read_local_file',
    description: 'Read the contents of any local file. Supports source code, logs, configs, markdown, JSON, CSV — any text file up to 512 KB.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file (e.g. "/Users/joel/project/src/index.js" or "~/notes.md")',
      },
      max_lines: {
        type: 'number',
        required: false,
        description: 'Maximum lines to return (default: 200, max: 2000)',
      },
    },
  },
  {
    name: 'list_directory',
    description: 'List files and folders at a given path, with file sizes.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute directory path to list (e.g. "/Users/joel/projects/myapp")',
      },
    },
  },
  {
    name: 'write_file',
    description: 'Write or append content to a local file. Use to save AI-generated code, configs, notes, or any text output.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path where the file should be written',
      },
      content: {
        type: 'string',
        required: true,
        description: 'Content to write to the file',
      },
      append: {
        type: 'string',
        required: false,
        description: 'Set to "true" to append instead of overwrite',
      },
    },
  },
];
