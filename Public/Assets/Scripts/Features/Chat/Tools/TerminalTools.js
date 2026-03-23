// openworld — Features/Chat/Tools/TerminalTools.js
export const TERMINAL_TOOLS = [
  {
    name: 'run_shell_command',
    description: 'Execute a short-lived shell command and return stdout/stderr. Ideal for scripts, git, file manipulation, compiling. WARNING: DO NOT use this for long-running servers or it will timeout! DO NOT use "start cmd" or spawn external windows. For servers/watchers, YOU MUST use start_local_server instead.',
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
  {
    name: 'create_folder',
    description: 'Create a new directory at the specified path. Creates parent directories if needed.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the new directory',
      },
    },
  },
  {
    name: 'open_folder',
    description: 'Open a folder natively in the host OS file explorer (Finder, Windows Explorer). Use this when the user asks to "open the folder".',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the directory to open',
      },
    },
  },
  {
    name: 'start_local_server',
    description: 'Start a long-running background process (like npm start, python servers, or watch tasks). This embeds an interactive terminal in the chat UI so the user can see live logs and interact with it.',
    category: 'terminal',
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: 'The command to start the server (e.g. "npm run dev", "node server.js")',
      },
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute path to run the command in.',
      },
    },
  },
  {
    name: 'delete_item',
    description: 'Permanently delete a file or directory. WARNING: Destructive operation. Ensure the path is exactly what you intend to delete.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file or directory to be deleted.',
      },
    },
  },
];
