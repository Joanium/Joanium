export const TERMINAL_TOOLS = [
  {
    name: 'inspect_workspace',
    description: 'Inspect a local workspace and summarize its stack, scripts, frameworks, tests, CI, env files, and infrastructure signals. Use this early for dev, QA, or DevOps tasks.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: false,
        description: 'Absolute workspace path. Defaults to the currently opened workspace.',
      },
    },
  },
  {
    name: 'search_workspace',
    description: 'Search across a local workspace for a code pattern, function name, config key, or error string, returning file paths and line snippets.',
    category: 'terminal',
    parameters: {
      query: {
        type: 'string',
        required: true,
        description: 'Substring or regex-like query to search for.',
      },
      path: {
        type: 'string',
        required: false,
        description: 'Absolute workspace path. Defaults to the currently opened workspace.',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Maximum number of matches to return (default: 40).',
      },
    },
  },
  {
    name: 'find_file_by_name',
    description: 'Find files in a local workspace by filename (case-insensitive substring match). Use this to locate a file when you do not know its exact directory path.',
    category: 'terminal',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'The filename or partial filename to search for.',
      },
      path: {
        type: 'string',
        required: false,
        description: 'Absolute workspace path. Defaults to the currently opened workspace.',
      },
      max_results: {
        type: 'number',
        required: false,
        description: 'Maximum number of matches to return (default: 40).',
      },
    },
  },
  {
    name: 'run_shell_command',
    description: 'Execute a short-lived shell command and return stdout/stderr. Use for builds, git, scripts, or diagnostics. For high-risk commands, set allow_risky only if the user explicitly asked for it.',
    category: 'terminal',
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: 'Shell command to execute.',
      },
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute path to run the command in. Defaults to the opened workspace when available.',
      },
      timeout_seconds: {
        type: 'number',
        required: false,
        description: 'Max execution time in seconds (default: 30, max: 120).',
      },
      allow_risky: {
        type: 'boolean',
        required: false,
        description: 'Set true only when the user explicitly requested a high-risk command.',
      },
    },
  },
  {
    name: 'assess_shell_command',
    description: 'Assess a shell command for risk before running it. Useful for DevOps actions, destructive git commands, and infrastructure changes.',
    category: 'terminal',
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: 'Shell command to assess.',
      },
    },
  },
  {
    name: 'read_local_file',
    description: 'Read the contents of any local text file up to 512 KB.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      max_lines: {
        type: 'number',
        required: false,
        description: 'Maximum lines to return (default: 200, max: 2000).',
      },
    },
  },
  {
    name: 'extract_file_text',
    description: 'Extract readable text from a local document such as PDF, DOCX, XLSX, XLS, ODS, PPTX, RTF, or plain text files. Use this when the user gives you a document instead of source code.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the local file to extract text from.',
      },
    },
  },
  {
    name: 'read_file_chunk',
    description: 'Read a specific line range from a local file. Prefer this for large files or focused code review.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based line number to start from.',
      },
      line_count: {
        type: 'number',
        required: false,
        description: 'How many lines to return (default: 120, max: 500).',
      },
    },
  },
  {
    name: 'read_multiple_local_files',
    description: 'Read several local text files in one call. Useful when comparing related files before editing.',
    category: 'terminal',
    parameters: {
      paths: {
        type: 'string',
        required: true,
        description: 'Comma-separated absolute file paths to read.',
      },
      max_lines_per_file: {
        type: 'number',
        required: false,
        description: 'Maximum lines to return per file (default: 180, max: 1000).',
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
        description: 'Absolute directory path to list.',
      },
    },
  },
  {
    name: 'list_directory_tree',
    description: 'Show a shallow recursive tree of a directory. Use this to understand project layout before searching or editing.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute directory path to inspect.',
      },
      max_depth: {
        type: 'number',
        required: false,
        description: 'Maximum recursion depth (default: 3, max: 6).',
      },
      max_entries: {
        type: 'number',
        required: false,
        description: 'Maximum files and folders to include (default: 200, max: 500).',
      },
    },
  },
  {
    name: 'write_file',
    description: 'Write or append content to a local file.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path where the file should be written.',
      },
      content: {
        type: 'string',
        required: true,
        description: 'Content to write to the file.',
      },
      append: {
        type: 'boolean',
        required: false,
        description: 'Set true to append instead of overwrite.',
      },
    },
  },
  {
    name: 'apply_file_patch',
    description: 'Patch a local file by replacing exact text. Use this for targeted edits instead of rewriting entire files.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file to patch.',
      },
      search: {
        type: 'string',
        required: true,
        description: 'Exact text to search for.',
      },
      replace: {
        type: 'string',
        required: true,
        description: 'Replacement text.',
      },
      replace_all: {
        type: 'boolean',
        required: false,
        description: 'Set true to replace every occurrence.',
      },
    },
  },
  {
    name: 'replace_lines_in_file',
    description: 'Replace an exact line range in a local text file. Prefer this for surgical edits when you know the affected lines.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file to edit.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based start line of the range to replace.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based end line of the range to replace.',
      },
      replacement: {
        type: 'string',
        required: true,
        description: 'Replacement text for the specified line range. Use an empty string to delete the range.',
      },
    },
  },
  {
    name: 'insert_into_file',
    description: 'Insert text into a local file at the start, end, a line number, or before or after an anchor string.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file to edit.',
      },
      content: {
        type: 'string',
        required: true,
        description: 'Text to insert. Include surrounding newlines when needed.',
      },
      position: {
        type: 'string',
        required: false,
        description: 'Insert position: start, end, before, or after. Defaults to end, or after when anchor is provided.',
      },
      line_number: {
        type: 'number',
        required: false,
        description: 'Optional 1-based line number to insert before or after.',
      },
      anchor: {
        type: 'string',
        required: false,
        description: 'Optional exact text anchor to insert before or after.',
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
        description: 'Absolute path to the new directory.',
      },
    },
  },
  {
    name: 'copy_item',
    description: 'Copy a local file or directory to a new path.',
    category: 'terminal',
    parameters: {
      source_path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the source file or directory.',
      },
      destination_path: {
        type: 'string',
        required: true,
        description: 'Absolute destination path.',
      },
      overwrite: {
        type: 'boolean',
        required: false,
        description: 'Set true to overwrite an existing destination.',
      },
    },
  },
  {
    name: 'move_item',
    description: 'Move or rename a local file or directory.',
    category: 'terminal',
    parameters: {
      source_path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the source file or directory.',
      },
      destination_path: {
        type: 'string',
        required: true,
        description: 'Absolute destination path.',
      },
      overwrite: {
        type: 'boolean',
        required: false,
        description: 'Set true to overwrite an existing destination.',
      },
    },
  },
  {
    name: 'git_status',
    description: 'Get local git status for the current workspace, including branch and changed files.',
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'git_diff',
    description: 'Get the local git diff for the current workspace. Useful before code review, summaries, or QA.',
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      staged: {
        type: 'boolean',
        required: false,
        description: 'Set true to show the staged diff instead of the working tree diff.',
      },
    },
  },
  {
    name: 'git_create_branch',
    description: 'Create a local git branch, optionally checking it out immediately.',
    category: 'terminal',
    parameters: {
      branch_name: {
        type: 'string',
        required: true,
        description: 'Name of the new branch.',
      },
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      checkout: {
        type: 'boolean',
        required: false,
        description: 'Set true to create and check out the branch immediately (default: true).',
      },
    },
  },
  {
    name: 'run_project_checks',
    description: 'Run detected lint, test, and build commands for the current workspace. This is the agent’s main QA tool for local projects.',
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute workspace path. Defaults to the opened workspace.',
      },
      include_lint: {
        type: 'boolean',
        required: false,
        description: 'Set false to skip lint commands.',
      },
      include_test: {
        type: 'boolean',
        required: false,
        description: 'Set false to skip tests.',
      },
      include_build: {
        type: 'boolean',
        required: false,
        description: 'Set false to skip build commands.',
      },
    },
  },
  {
    name: 'open_folder',
    description: 'Open a folder natively in the host OS file explorer.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the directory to open.',
      },
    },
  },
  {
    name: 'start_local_server',
    description: 'Start a long-running background process like a dev server or watcher. The process is shown in an embedded terminal inside chat.',
    category: 'terminal',
    parameters: {
      command: {
        type: 'string',
        required: true,
        description: 'The command to start the server.',
      },
      working_directory: {
        type: 'string',
        required: false,
        description: 'Absolute path to run the command in. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'delete_item',
    description: 'Permanently delete a file or directory. Use carefully.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file or directory to delete.',
      },
    },
  },
];
