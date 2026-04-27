export const TERMINAL_TOOLS = [
  {
    name: 'inspect_workspace',
    description:
      'Inspect a local workspace and summarize its stack, scripts, frameworks, tests, CI, env files, and infrastructure signals. Use this early for dev, QA, or DevOps tasks.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute workspace path. Defaults to the currently opened workspace.',
      },
    },
  },
  {
    name: 'search_workspace',
    description:
      'Search across a local workspace for a code pattern, function name, config key, or error string, returning file paths and line snippets.',
    category: 'terminal',
    parameters: {
      query: {
        type: 'string',
        required: !0,
        description: 'Substring or regex-like query to search for.',
      },
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute workspace path. Defaults to the currently opened workspace.',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum number of matches to return (default: 40).',
      },
    },
  },
  {
    name: 'find_file_by_name',
    description:
      'Find files in a local workspace by filename (case-insensitive substring match). Use this to locate a file when you do not know its exact directory path.',
    category: 'terminal',
    parameters: {
      name: {
        type: 'string',
        required: !0,
        description: 'The filename or partial filename to search for.',
      },
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute workspace path. Defaults to the currently opened workspace.',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum number of matches to return (default: 40).',
      },
    },
  },
  {
    name: 'run_shell_command',
    description:
      'Execute a short-lived shell command and return stdout/stderr. Use for builds, git, scripts, or diagnostics. For high-risk commands, set allow_risky only if the user explicitly asked for it.',
    category: 'terminal',
    parameters: {
      command: { type: 'string', required: !0, description: 'Shell command to execute.' },
      working_directory: {
        type: 'string',
        required: !1,
        description:
          'Absolute path to run the command in. Defaults to the opened workspace when available.',
      },
      timeout_seconds: {
        type: 'number',
        required: !1,
        description:
          'Max execution time in seconds (default: 60, max: 300). Use a higher value for slow operations like npm install, cargo build, or pip install.',
      },
      allow_risky: {
        type: 'boolean',
        required: !1,
        description: 'Set true only when the user explicitly requested a high-risk command.',
      },
    },
  },
  {
    name: 'assess_shell_command',
    description:
      'Assess a shell command for risk before running it. Useful for DevOps actions, destructive git commands, and infrastructure changes.',
    category: 'terminal',
    parameters: {
      command: { type: 'string', required: !0, description: 'Shell command to assess.' },
    },
  },
  {
    name: 'read_local_file',
    description: 'Read the contents of any local text file up to 512 KB.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      max_lines: {
        type: 'number',
        required: !1,
        description: 'Maximum lines to return (default: 200, max: 2000).',
      },
    },
  },
  {
    name: 'extract_file_text',
    description:
      'Extract readable text from a local document such as PDF, DOCX, XLSX, XLSM, PPTX, RTF, or plain text files. Use this when the user gives you a document instead of source code.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the local file to extract text from.',
      },
    },
  },
  {
    name: 'read_file_chunk',
    description:
      'Read a specific line range from a local file. Prefer this for large files or focused code review.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based line number to start from.',
      },
      line_count: {
        type: 'number',
        required: !1,
        description: 'How many lines to return (default: 120, max: 500).',
      },
    },
  },
  {
    name: 'read_multiple_local_files',
    description:
      'Read several local text files in one call. Useful when comparing related files before editing.',
    category: 'terminal',
    parameters: {
      paths: {
        type: 'string',
        required: !0,
        description: 'Comma-separated absolute file paths to read.',
      },
      max_lines_per_file: {
        type: 'number',
        required: !1,
        description: 'Maximum lines to return per file (default: 180, max: 1000).',
      },
    },
  },
  {
    name: 'list_directory',
    description: 'List files and folders at a given path, with file sizes.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute directory path to list.' },
    },
  },
  {
    name: 'list_directory_tree',
    description:
      'Show a shallow recursive tree of a directory. Use this to understand project layout before searching or editing.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute directory path to inspect.' },
      max_depth: {
        type: 'number',
        required: !1,
        description: 'Maximum recursion depth (default: 3, max: 6).',
      },
      max_entries: {
        type: 'number',
        required: !1,
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
        required: !0,
        description: 'Absolute path where the file should be written.',
      },
      content: { type: 'string', required: !0, description: 'Content to write to the file.' },
      append: {
        type: 'boolean',
        required: !1,
        description: 'Set true to append instead of overwrite.',
      },
    },
  },
  {
    name: 'apply_file_patch',
    description:
      'Patch a local file by replacing exact text. Use this for targeted edits instead of rewriting entire files.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file to patch.' },
      search: { type: 'string', required: !0, description: 'Exact text to search for.' },
      replace: { type: 'string', required: !0, description: 'Replacement text.' },
      replace_all: {
        type: 'boolean',
        required: !1,
        description: 'Set true to replace every occurrence.',
      },
    },
  },
  {
    name: 'replace_lines_in_file',
    description:
      'Replace an exact line range in a local text file. Prefer this for surgical edits when you know the affected lines.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file to edit.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based start line of the range to replace.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based end line of the range to replace.',
      },
      replacement: {
        type: 'string',
        required: !0,
        description:
          'Replacement text for the specified line range. Use an empty string to delete the range.',
      },
    },
  },
  {
    name: 'insert_into_file',
    description:
      'Insert text into a local file at the start, end, a line number, or before or after an anchor string.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file to edit.' },
      content: {
        type: 'string',
        required: !0,
        description: 'Text to insert. Include surrounding newlines when needed.',
      },
      position: {
        type: 'string',
        required: !1,
        description:
          'Insert position: start, end, before, or after. Defaults to end, or after when anchor is provided.',
      },
      line_number: {
        type: 'number',
        required: !1,
        description: 'Optional 1-based line number to insert before or after.',
      },
      anchor: {
        type: 'string',
        required: !1,
        description: 'Optional exact text anchor to insert before or after.',
      },
    },
  },
  {
    name: 'create_folder',
    description:
      'Create a new directory at the specified path. Creates parent directories if needed.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the new directory.' },
    },
  },
  {
    name: 'copy_item',
    description: 'Copy a local file or directory to a new path.',
    category: 'terminal',
    parameters: {
      source_path: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the source file or directory.',
      },
      destination_path: { type: 'string', required: !0, description: 'Absolute destination path.' },
      overwrite: {
        type: 'boolean',
        required: !1,
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
        required: !0,
        description: 'Absolute path to the source file or directory.',
      },
      destination_path: { type: 'string', required: !0, description: 'Absolute destination path.' },
      overwrite: {
        type: 'boolean',
        required: !1,
        description: 'Set true to overwrite an existing destination.',
      },
    },
  },
  {
    name: 'git_status',
    description:
      'Get local git status for the current workspace, including branch and changed files.',
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'git_diff',
    description:
      'Get the local git diff for the current workspace. Useful before code review, summaries, or QA.',
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      staged: {
        type: 'boolean',
        required: !1,
        description: 'Set true to show the staged diff instead of the working tree diff.',
      },
    },
  },
  {
    name: 'git_create_branch',
    description: 'Create a local git branch, optionally checking it out immediately.',
    category: 'terminal',
    parameters: {
      branch_name: { type: 'string', required: !0, description: 'Name of the new branch.' },
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      checkout: {
        type: 'boolean',
        required: !1,
        description: 'Set true to create and check out the branch immediately (default: true).',
      },
    },
  },
  {
    name: 'run_project_checks',
    description:
      "Run detected lint, test, and build commands for the current workspace. This is the agent's main QA tool for local projects.",
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute workspace path. Defaults to the opened workspace.',
      },
      include_lint: {
        type: 'boolean',
        required: !1,
        description: 'Set false to skip lint commands.',
      },
      include_test: { type: 'boolean', required: !1, description: 'Set false to skip tests.' },
      include_build: {
        type: 'boolean',
        required: !1,
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
        required: !0,
        description: 'Absolute path to the directory to open.',
      },
    },
  },
  {
    name: 'start_local_server',
    description:
      'Start a long-running background process like a dev server or watcher. The process is shown in an embedded terminal inside chat. The host waits after spawn (default ~15s, up to 60s): if the process exits during that window (e.g. EADDRINUSE after compile), the tool fails with captured output instead of claiming success.',
    category: 'terminal',
    parameters: {
      command: { type: 'string', required: !0, description: 'The command to start the server.' },
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute path to run the command in. Defaults to the opened workspace.',
      },
      settle_ms: {
        type: 'number',
        required: !1,
        description:
          'How long to wait (ms, 0–60000) after spawn for startup failures (port bind, crash after compile). Default 15000. Use 0 only if you accept no startup verification.',
      },
    },
  },
  {
    name: 'read_terminal_output',
    description:
      'Read the buffered stdout/stderr output of a running background process (started with start_local_server). Use this after start_local_server to verify the server started correctly, check for errors, or confirm a URL. Poll with increasing delays (5 s → 10 s → 15 s → 30 s → 60 s → 90 s) — up to ~3 minutes total — until you see the expected output or the process exits. Compilation steps can take several minutes; be patient. Returns up to 64 KB of the most recent output.',
    category: 'terminal',
    parameters: {
      pid: {
        type: 'string',
        required: !0,
        description: 'The PID string returned by start_local_server.',
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
        required: !0,
        description: 'Absolute path to the file or directory to delete.',
      },
    },
  },
  {
    name: 'get_file_metadata',
    description:
      'Get rich metadata about a local file: byte size, line count, word count, character count, last-modified timestamp, file extension, and detected programming language.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
    },
  },
  {
    name: 'search_in_file',
    description:
      'Search for a string or regex pattern within a single file, returning each matched line number, the matched line, and surrounding context lines. More focused than search_workspace when you already know which file to look in.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: { type: 'string', required: !0, description: 'Search string or regex pattern.' },
      regex: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to treat pattern as a JavaScript regex (default: false — plain string).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      context_lines: {
        type: 'number',
        required: !1,
        description: 'Number of lines of context to show above and below each match (default: 2).',
      },
      max_matches: {
        type: 'number',
        required: !1,
        description: 'Stop after this many matches (default: 50).',
      },
    },
  },
  {
    name: 'read_file_around_line',
    description:
      'Read a symmetrical window of lines centered on a specific line number. Ideal for quickly reviewing context around a known error, breakpoint, or search hit.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      line: { type: 'number', required: !0, description: '1-based center line number.' },
      radius: {
        type: 'number',
        required: !1,
        description: 'Lines to include above and below the center line (default: 15).',
      },
    },
  },
  {
    name: 'count_occurrences',
    description:
      'Count how many times a string or regex pattern appears in a file and show a compact summary with the line numbers of each hit.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: { type: 'string', required: !0, description: 'String or regex pattern to count.' },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'get_file_structure',
    description:
      'Extract a structural outline of a code file — functions, classes, arrow functions, imports/exports, and TODO/FIXME comments — with their line numbers. Works best on JS/TS/JSX/TSX/Python/Java files.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the code file.' },
    },
  },
  {
    name: 'diff_two_files',
    description:
      'Show a unified-style line diff between two local files. Useful for comparing the original and modified version of a file, or any two text files.',
    category: 'terminal',
    parameters: {
      path_a: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the first (original / left) file.',
      },
      path_b: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the second (modified / right) file.',
      },
      context_lines: {
        type: 'number',
        required: !1,
        description: 'Lines of unchanged context to show around each change block (default: 3).',
      },
    },
  },
  {
    name: 'delete_lines',
    description:
      'Delete a range of lines from a file. All other content is preserved. Use when you need to remove a block without replacing it.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line to delete.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line to delete (inclusive).',
      },
    },
  },
  {
    name: 'move_lines',
    description:
      'Move a contiguous range of lines to a different position within the same file. The block is cut from its original position and inserted before the target line.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the block to move.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the block to move (inclusive).',
      },
      target_line: {
        type: 'number',
        required: !0,
        description: '1-based line number to insert the block before (in the original file).',
      },
    },
  },
  {
    name: 'duplicate_lines',
    description:
      'Duplicate a range of lines, inserting the exact copy immediately below the original block.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to duplicate.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range to duplicate (inclusive).',
      },
    },
  },
  {
    name: 'sort_lines_in_range',
    description:
      'Alphabetically sort the lines within a specified range of a file. Whitespace outside the range is untouched.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to sort.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range to sort (inclusive).',
      },
      descending: {
        type: 'boolean',
        required: !1,
        description: 'Set true to sort in Z→A descending order (default: ascending A→Z).',
      },
      trim_before_sort: {
        type: 'boolean',
        required: !1,
        description: 'Set true to ignore leading whitespace when comparing lines.',
      },
    },
  },
  {
    name: 'indent_lines',
    description:
      'Add or remove indentation on a range of lines. Positive amount indents; negative dedents. Preserves lines that would go below zero indentation.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line to indent/dedent.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line to indent/dedent (inclusive).',
      },
      amount: {
        type: 'number',
        required: !1,
        description: 'Spaces to add (positive) or remove (negative). Default: 2.',
      },
      use_tabs: {
        type: 'boolean',
        required: !1,
        description: 'Set true to use one tab character instead of spaces.',
      },
    },
  },
  {
    name: 'wrap_lines',
    description:
      'Prepend and/or append a fixed string to every line in a range. Useful for bulk-commenting code, adding quotes, HTML tags, or log prefixes.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      prefix: {
        type: 'string',
        required: !1,
        description: 'String to prepend to each line (e.g. "// " to comment out JS).',
      },
      suffix: { type: 'string', required: !1, description: 'String to append to each line.' },
      skip_empty_lines: {
        type: 'boolean',
        required: !1,
        description: 'Set true to leave blank lines untouched (default: false).',
      },
    },
  },
  {
    name: 'find_replace_regex',
    description:
      'Perform a regex-powered find-and-replace across an entire file. Supports capture groups ($1, $2…) in the replacement string. More powerful than apply_file_patch for pattern-based refactoring.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'JavaScript regex pattern to search for (do not include / delimiters).',
      },
      replacement: {
        type: 'string',
        required: !0,
        description:
          'Replacement string. Use $1, $2 for capture groups. Use empty string to delete matches.',
      },
      flags: {
        type: 'string',
        required: !1,
        description:
          'Regex flags string (default: "gm"). Combine: g = global, m = multiline, i = ignore case, s = dot-all.',
      },
    },
  },
  {
    name: 'batch_replace',
    description:
      'Apply multiple find-and-replace pairs to a file in one call, executed sequentially. Perfect for symbol renames, import path updates, or multi-token refactoring.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      replacements: {
        type: 'string',
        required: !0,
        description:
          'JSON array of {search, replace} objects. Example: [{"search":"oldName","replace":"newName"},{"search":"oldPath","replace":"newPath"}]',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to treat every search string as a regex pattern (default: false — plain string).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'insert_at_marker',
    description:
      'Insert a block of content immediately before or after a specific comment marker in a file (e.g. // @inject, \x3c!-- insert here --\x3e, # @slot). Great for codegen workflows and template slots.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      marker: {
        type: 'string',
        required: !0,
        description: 'Exact marker text to locate (searched as a plain substring).',
      },
      content: {
        type: 'string',
        required: !0,
        description: 'Content to insert. Include your own newlines as needed.',
      },
      position: {
        type: 'string',
        required: !1,
        description: '"before" or "after" the marker line (default: "after").',
      },
      all_occurrences: {
        type: 'boolean',
        required: !1,
        description: 'Set true to insert at every occurrence of the marker (default: first only).',
      },
    },
  },
  {
    name: 'backup_file',
    description:
      'Create a timestamped backup copy of a file before making risky changes. Backup is named <filename>.YYYYMMDD_HHMMSS.bak and saved alongside the original (or in a specified directory).',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file to back up.' },
      backup_dir: {
        type: 'string',
        required: !1,
        description:
          'Directory to store the backup. Defaults to the same directory as the source file.',
      },
    },
  },
  {
    name: 'extract_lines_to_file',
    description:
      'Extract a range of lines from a source file and save them to a new file. The source file is not modified.',
    category: 'terminal',
    parameters: {
      source_path: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the source file.',
      },
      output_path: {
        type: 'string',
        required: !0,
        description: 'Absolute path for the new output file.',
      },
      start_line: { type: 'number', required: !0, description: '1-based first line to extract.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line to extract (inclusive).',
      },
    },
  },
  {
    name: 'merge_files',
    description:
      "Concatenate two or more local files into a single output file. Optionally insert a separator string between each file's content.",
    category: 'terminal',
    parameters: {
      source_paths: {
        type: 'string',
        required: !0,
        description: 'Comma-separated absolute paths of files to merge, in order.',
      },
      output_path: {
        type: 'string',
        required: !0,
        description: 'Absolute path for the merged output file.',
      },
      separator: {
        type: 'string',
        required: !1,
        description:
          "Text to insert between each file's content (default: single blank line). Use \\n for literal newlines.",
      },
    },
  },
  {
    name: 'trim_file_whitespace',
    description:
      'Remove trailing whitespace from every line in a file and ensure the file ends with exactly one newline. Non-destructive to line content.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
    },
  },
  {
    name: 'normalize_file',
    description:
      'Fully normalize a text file: convert Windows CRLF → LF, strip UTF-8 BOM, remove trailing whitespace on every line, and ensure a single trailing newline. Safe to run on any source file before committing.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the file to normalize.',
      },
    },
  },
  {
    name: 'find_files_by_content',
    description:
      "Search across all files in a workspace directory for files whose content matches a string or regex. Returns matching file paths and the specific lines that matched. Broader than search_in_file — use this when you don't know which file contains something.",
    category: 'terminal',
    parameters: {
      directory: {
        type: 'string',
        required: !0,
        description: 'Absolute path of the directory to scan recursively.',
      },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern to search for inside file contents.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false — plain string).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      file_glob: {
        type: 'string',
        required: !1,
        description:
          'Comma-separated extensions to restrict the scan, e.g. "js,ts,jsx" (default: all text files).',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum number of matching files to return (default: 30).',
      },
    },
  },
  {
    name: 'find_between_markers',
    description:
      'Extract all text between a start marker and an end marker inside a file. Useful for reading template slots, config blocks, or fenced code regions.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_marker: {
        type: 'string',
        required: !0,
        description: 'Text that marks the beginning of the block (inclusive by default).',
      },
      end_marker: {
        type: 'string',
        required: !0,
        description: 'Text that marks the end of the block (inclusive by default).',
      },
      inclusive: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to exclude the marker lines from the returned content (default: true).',
      },
      occurrence: {
        type: 'number',
        required: !1,
        description:
          'Which occurrence to return when markers appear multiple times (1-based, default: 1).',
      },
    },
  },
  {
    name: 'find_duplicate_lines',
    description:
      'Scan a file (or a line range within it) for duplicate lines and report them with their line numbers. Useful for catching repeated imports, duplicate keys, or accidental copy-paste.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line of the range to scan (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line of the range to scan (default: end of file).',
      },
      ignore_blank: {
        type: 'boolean',
        required: !1,
        description: 'Set true to exclude blank lines from the duplicate check (default: true).',
      },
      trim_before_compare: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to ignore leading/trailing whitespace when comparing lines (default: true).',
      },
    },
  },
  {
    name: 'find_todos',
    description:
      'Scan a workspace directory for all TODO, FIXME, HACK, NOTE, and XXX comment tags across all source files. Returns a grouped list with file paths and line numbers.',
    category: 'terminal',
    parameters: {
      directory: {
        type: 'string',
        required: !0,
        description: 'Absolute path of the directory to scan.',
      },
      tags: {
        type: 'string',
        required: !1,
        description: 'Comma-separated tag names to look for (default: "TODO,FIXME,HACK,NOTE,XXX").',
      },
      file_glob: {
        type: 'string',
        required: !1,
        description: 'Comma-separated file extensions to restrict the scan, e.g. "js,ts,py".',
      },
    },
  },
  {
    name: 'get_line_numbers_matching',
    description:
      'Return only the line numbers (and optionally the line text) for every line in a file that matches a pattern. Lightweight alternative to search_in_file when you just need line numbers for a follow-up edit.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern to match against.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      include_text: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to include the matched line text alongside each line number (default: true).',
      },
    },
  },
  {
    name: 'comment_out_lines',
    description:
      'Add single-line comment markers to a range of lines, auto-detected from the file extension (// for JS/TS/Java, # for Python/Shell, -- for SQL, \x3c!-- --\x3e for HTML). Skips lines that are already commented.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line to comment out.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line to comment out (inclusive).',
      },
      style: {
        type: 'string',
        required: !1,
        description:
          'Override the auto-detected comment style: "//", "#", "--", "/* */", or "\x3c!-- --\x3e".',
      },
    },
  },
  {
    name: 'uncomment_lines',
    description:
      'Remove leading comment markers from a range of lines. Auto-detects comment style from the file extension. Leaves non-commented lines untouched.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line to uncomment.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line to uncomment (inclusive).',
      },
    },
  },
  {
    name: 'reverse_lines',
    description:
      'Reverse the order of lines within a specified range. The first line becomes the last and vice-versa. Everything outside the range is untouched.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to reverse.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range to reverse (inclusive).',
      },
    },
  },
  {
    name: 'dedup_lines',
    description:
      'Remove duplicate lines from a range (or the whole file), keeping only the first occurrence of each unique line. Optionally ignores blank lines.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line of the range (default: end of file).',
      },
      trim_before_compare: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to treat lines as equal if they differ only in leading/trailing whitespace (default: false).',
      },
      keep_blank: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to also remove all duplicate blank lines (default: true — keeps one blank line where duplicates existed).',
      },
    },
  },
  {
    name: 'remove_blank_lines',
    description:
      'Remove or collapse blank lines in a file. Can delete all blank lines, collapse multiple consecutive blanks into one, or operate only on a specified range.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      mode: {
        type: 'string',
        required: !1,
        description:
          '"collapse" to reduce multiple consecutive blanks to one (default), or "delete" to remove all blank lines.',
      },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line of the range (default: end of file).',
      },
    },
  },
  {
    name: 'join_lines',
    description:
      'Join a range of lines into a single line, separated by a configurable separator. The joined result replaces the entire range.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to join.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range to join.',
      },
      separator: {
        type: 'string',
        required: !1,
        description: 'String to place between joined lines (default: " ").',
      },
      trim_each: {
        type: 'boolean',
        required: !1,
        description: 'Set true to trim whitespace from each line before joining (default: true).',
      },
    },
  },
  {
    name: 'split_line',
    description:
      'Split a single line into multiple lines at every occurrence of a delimiter, replacing the original line with the resulting lines.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      line_number: { type: 'number', required: !0, description: '1-based line number to split.' },
      delimiter: {
        type: 'string',
        required: !0,
        description: 'String to split on (e.g. ",", ";", " && ").',
      },
      trim_parts: {
        type: 'boolean',
        required: !1,
        description: 'Set true to trim whitespace from each resulting part (default: true).',
      },
      preserve_indent: {
        type: 'boolean',
        required: !1,
        description:
          "Set true to add the original line's leading indentation to every new line (default: true).",
      },
    },
  },
  {
    name: 'rename_symbol',
    description:
      'Rename all occurrences of a symbol (variable, function, class name, etc.) in a file using whole-word matching to avoid partial replacements. Safer than plain find-replace for identifier renames.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      old_name: { type: 'string', required: !0, description: 'The exact symbol name to rename.' },
      new_name: { type: 'string', required: !0, description: 'The replacement symbol name.' },
      whole_word: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to disable whole-word boundary matching (default: true — recommended).',
      },
    },
  },
  {
    name: 'update_json_value',
    description:
      'Update the value of a key in a JSON file using a dot-notation path (e.g. "server.port", "scripts.build"). Preserves all other content and indentation style.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the JSON file.' },
      key_path: {
        type: 'string',
        required: !0,
        description:
          'Dot-notation path to the key to update (e.g. "version", "scripts.start", "dependencies.react").',
      },
      value: {
        type: 'string',
        required: !0,
        description:
          'New value as a JSON literal string. Strings must be quoted: \'"hello"\'. Numbers/booleans unquoted: 3000, true.',
      },
      create_if_missing: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to create the key (and any intermediate objects) if it does not exist (default: false).',
      },
    },
  },
  {
    name: 'multi_file_replace',
    description:
      'Apply the same find-and-replace operation across multiple files in one call. Ideal for project-wide renames, import path migrations, or updating a version string everywhere.',
    category: 'terminal',
    parameters: {
      paths: {
        type: 'string',
        required: !0,
        description: 'Comma-separated absolute file paths to apply the replacement to.',
      },
      search: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern to search for.',
      },
      replace: {
        type: 'string',
        required: !0,
        description: 'Replacement string. Supports $1, $2 capture groups when regex is true.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat search as a regex pattern (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'append_to_matching_lines',
    description:
      'Find every line in a file matching a pattern and append (or prepend) a string to it. Useful for adding semicolons, trailing commas, log suffixes, or decorators to specific lines.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      match_pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern. Lines matching this will be modified.',
      },
      text: {
        type: 'string',
        required: !0,
        description: 'Text to append or prepend to each matching line.',
      },
      mode: {
        type: 'string',
        required: !1,
        description:
          '"append" to add text at the end of the line, "prepend" to add at the start (default: "append").',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat match_pattern as a regex (default: false).',
      },
      skip_already_present: {
        type: 'boolean',
        required: !1,
        description: 'Set true to skip lines that already contain the text to add (default: true).',
      },
    },
  },
  {
    name: 'replace_in_range',
    description:
      'Run a find-and-replace but scoped to a specific line range within a file. All text outside the range is left completely untouched. More precise than apply_file_patch for range-bounded edits.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the region to search within.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the region to search within (inclusive).',
      },
      search: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern to search for (only within the specified range).',
      },
      replace: { type: 'string', required: !0, description: 'Replacement string.' },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat search as a regex (default: false).',
      },
      replace_all: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to replace only the first occurrence within the range (default: true).',
      },
    },
  },
  {
    name: 'swap_line_ranges',
    description:
      'Swap two non-overlapping blocks of lines within the same file. Block A and Block B exchange positions. Useful for reordering functions, CSS rules, or config sections.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      a_start: { type: 'number', required: !0, description: '1-based first line of block A.' },
      a_end: {
        type: 'number',
        required: !0,
        description: '1-based last line of block A (inclusive).',
      },
      b_start: { type: 'number', required: !0, description: '1-based first line of block B.' },
      b_end: {
        type: 'number',
        required: !0,
        description: '1-based last line of block B (inclusive). Block B must come after Block A.',
      },
    },
  },
  {
    name: 'replace_between_markers',
    description:
      'Replace all content between a start and end marker with new content. The markers themselves can be preserved or replaced. Great for updating generated code regions, changelog blocks, or template slots.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_marker: {
        type: 'string',
        required: !0,
        description:
          'The exact line or substring that marks the beginning of the replaceable region.',
      },
      end_marker: {
        type: 'string',
        required: !0,
        description: 'The exact line or substring that marks the end of the replaceable region.',
      },
      new_content: {
        type: 'string',
        required: !0,
        description: 'Replacement content to place between the markers.',
      },
      preserve_markers: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to also replace the marker lines themselves (default: true — markers are kept).',
      },
      occurrence: {
        type: 'number',
        required: !1,
        description:
          'Which occurrence to replace when markers appear multiple times (1-based, default: 1).',
      },
    },
  },
  {
    name: 'convert_indentation',
    description:
      "Convert a file's indentation from spaces to tabs or tabs to spaces. Detects the dominant indent size automatically, or use a specified size.",
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      to: {
        type: 'string',
        required: !0,
        description: '"tabs" to convert spaces → tabs, or "spaces" to convert tabs → spaces.',
      },
      spaces_per_tab: {
        type: 'number',
        required: !1,
        description:
          'Number of spaces that represent one tab level (default: auto-detect, fallback 2).',
      },
    },
  },
  {
    name: 'trace_symbol',
    description:
      "Find every definition, import/export, and call site of a named symbol (function, class, variable, type) across the entire workspace. Gives the AI a complete map of where something is declared vs. where it is used — the fastest way to understand a symbol's role in the codebase.",
    category: 'terminal',
    parameters: {
      symbol: {
        type: 'string',
        required: !0,
        description:
          'The exact symbol name to trace (e.g. "useAuth", "UserService", "MAX_RETRIES").',
      },
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'profile_file_complexity',
    description:
      'Analyze a source file for complexity signals: function count and lengths, maximum nesting depth, TODO density, and a composite complexity score. Instantly tells the AI which functions are risky, which are too long, and where to focus code review.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the source file.' },
      long_function_threshold: {
        type: 'number',
        required: !1,
        description: 'Lines above which a function is flagged as "long" (default: 40).',
      },
    },
  },
  {
    name: 'map_imports',
    description:
      'Show a structured, categorized map of everything a file imports: internal (relative) modules, third-party packages (grouped by package), and stdlib/built-ins. Instantly tells the AI what a file depends on and from where.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the source file.' },
    },
  },
  {
    name: 'find_dead_exports',
    description:
      'Find exports in a file that are never imported anywhere else in the workspace. Identifies dead code, unused utilities, and stale public APIs in one call.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the file to check exports in.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to search for usages. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'compare_json_files',
    description:
      'Deep semantic diff of two JSON files using dot-notation key paths. Shows exactly which keys were added, removed, or changed — far more useful than a line-level diff for config files, package.json, or API response fixtures.',
    category: 'terminal',
    parameters: {
      path_a: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the first (original / left) JSON file.',
      },
      path_b: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the second (modified / right) JSON file.',
      },
    },
  },
  {
    name: 'extract_env_vars',
    description:
      'Scan a workspace for every environment variable reference (process.env.X, import.meta.env.X, os.getenv, etc.) and return a deduplicated list with file usage counts plus a ready-to-use .env template. Instantly tells the AI what configuration a project needs.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'get_call_graph',
    description:
      'Build a call graph for a single source file showing which functions call which other functions within the file, and which functions are entry points (not called by anyone else). Gives the AI an immediate mental model of internal execution flow.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the source file.' },
    },
  },
  {
    name: 'audit_dependencies',
    description:
      "Cross-reference a project's declared dependencies (package.json or requirements.txt) against actual imports used in the code. Surfaces packages that are declared but never imported (dead deps) and imports that are used but never declared (missing deps).",
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'smart_grep',
    description:
      'Multi-condition grep with AND / OR / NOT logic. Find lines that contain ALL of must_contain patterns, ANY of any_of patterns, and NONE of must_not_contain patterns. Works on a single file or across the whole workspace. More powerful than search_workspace for complex pattern combinations.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a single file to search in.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to search across all files. Used if path is not given.',
      },
      must_contain: {
        type: 'array',
        required: !1,
        description: 'Array of strings that must ALL be present on the line (AND logic).',
      },
      must_not_contain: {
        type: 'array',
        required: !1,
        description: 'Array of strings — lines containing any of these are excluded (NOT logic).',
      },
      any_of: {
        type: 'array',
        required: !1,
        description: 'Array of strings — at least one must be present on the line (OR logic).',
      },
    },
  },
  {
    name: 'snapshot_workspace',
    description:
      'Generate a single dense intelligence snapshot of the entire workspace: file/directory counts, language breakdown with visual histogram, detected stack, likely entry points, test file count, git branch and dirty status, and available scripts. The best first tool to call when starting any task on an unfamiliar codebase.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'filter_lines',
    description:
      'Keep only the lines in a file that match a pattern, deleting all non-matching lines. The inverse of filter_out_lines. Use for extracting log entries, filtering CSV rows, or isolating relevant code sections.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern. Only lines matching this are kept.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a JavaScript regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'filter_out_lines',
    description:
      'Delete every line in a file that matches a pattern, keeping all non-matching lines. The inverse of filter_lines. Use for stripping debug logs, removing blank lines matching a rule, or pruning unwanted entries.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern. Lines matching this are deleted.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a JavaScript regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'insert_line_at_pattern',
    description:
      'Insert a block of content immediately before or after every line that matches a pattern. Useful for injecting imports after a specific line, adding blank separators between blocks, or inserting debug statements near every function call.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern. Insertion happens at each matching line.',
      },
      content: {
        type: 'string',
        required: !0,
        description: 'Text to insert. Include newlines as needed.',
      },
      position: {
        type: 'string',
        required: !1,
        description: '"before" or "after" the matching line (default: "after").',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      all_occurrences: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to only insert at the first matching line (default: true — all matches).',
      },
    },
  },
  {
    name: 'replace_single_line',
    description:
      'Replace the entire content of exactly one line, identified by its 1-based line number, with new text. More precise than apply_file_patch when you know the exact line number.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      line_number: {
        type: 'number',
        required: !0,
        description: '1-based number of the line to replace.',
      },
      replacement: {
        type: 'string',
        required: !0,
        description: 'New content for the line (without trailing newline).',
      },
    },
  },
  {
    name: 'swap_two_lines',
    description:
      'Exchange the content of exactly two lines, identified by their 1-based line numbers. Useful for quickly reordering declarations, CSS rules, or import statements without moving a whole block.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      line_a: {
        type: 'number',
        required: !0,
        description: '1-based number of the first line to swap.',
      },
      line_b: {
        type: 'number',
        required: !0,
        description: '1-based number of the second line to swap.',
      },
    },
  },
  {
    name: 'add_file_header',
    description:
      'Prepend a block of text (license banner, shebang line, auto-generated notice, module docstring, etc.) to the very top of a file. Idempotent by default — skips if the header is already present.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      content: { type: 'string', required: !0, description: 'Header text to prepend.' },
      separator: {
        type: 'string',
        required: !1,
        description: 'String inserted between the header and existing content (default: "\\n").',
      },
      skip_if_present: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to always prepend even if the header already exists (default: true).',
      },
    },
  },
  {
    name: 'add_file_footer',
    description:
      'Append a block of text (closing comment, export statement, trailing config, etc.) to the very bottom of a file. Idempotent by default.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      content: { type: 'string', required: !0, description: 'Footer text to append.' },
      separator: {
        type: 'string',
        required: !1,
        description: 'String inserted between existing content and the footer (default: "\\n").',
      },
      skip_if_present: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to always append even if the footer already exists (default: true).',
      },
    },
  },
  {
    name: 'strip_comments',
    description:
      'Remove all full-line comment lines from a file. Comment syntax is auto-detected from the file extension (// for JS/TS, # for Python/Shell, -- for SQL, \x3c!-- --\x3e for HTML/XML). Lines that are code followed by an inline comment are left intact.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      keep_blank_lines: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to replace each removed comment line with a blank line, preserving line numbers (default: false — lines are fully deleted).',
      },
    },
  },
  {
    name: 'truncate_file',
    description:
      'Cut a file down to a maximum number of lines by discarding excess lines from the end (or from the beginning). Leaves the file unchanged if it is already within the limit.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      max_lines: { type: 'number', required: !0, description: 'Maximum number of lines to keep.' },
      from_end: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to keep the last max_lines instead of the first (default: false — keeps from the top).',
      },
    },
  },
  {
    name: 'extract_unique_lines',
    description:
      'Read a file and write only its unique lines (in original order) to a new output file. Duplicate lines are silently dropped. The source file is not modified. Useful for deduplicating word lists, CSV rows, or log lines.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the source file.' },
      output_path: {
        type: 'string',
        required: !0,
        description: 'Absolute path for the deduplicated output file.',
      },
      trim_before_compare: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to treat lines as equal when they differ only in leading/trailing whitespace (default: false).',
      },
      ignore_blank: {
        type: 'boolean',
        required: !1,
        description: 'Set true to keep only one blank line in the output (default: true).',
      },
    },
  },
  {
    name: 'pad_lines',
    description:
      'Extend each line in a range to a minimum character width by adding a pad character on the left, right, or both sides (center). Useful for formatting table columns, aligning code columns, or constructing fixed-width output.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      width: {
        type: 'number',
        required: !0,
        description: 'Minimum total character width each line should reach.',
      },
      align: {
        type: 'string',
        required: !1,
        description: '"left" (default), "right", or "center" — which side to add padding to.',
      },
      pad_char: {
        type: 'string',
        required: !1,
        description: 'Single character to use as padding (default: space).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description: 'Set true to leave blank lines untouched (default: false).',
      },
    },
  },
  {
    name: 'align_assignments',
    description:
      'Vertically align assignment operators (=, :, =>, or any separator) within a line range by padding the left-hand side of each line. Makes config blocks, destructuring, and variable declarations visually aligned.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to align.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      separator: {
        type: 'string',
        required: !1,
        description:
          'The operator/character to align on (default: "="). Common values: ":", "=>", ":".',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description: 'Set true to leave blank lines untouched (default: true).',
      },
    },
  },
  {
    name: 'quote_lines',
    description:
      'Wrap every line in a range with opening and closing quote characters. Useful for converting a list of bare values into a JSON string array, CSV field, or SQL list. Existing occurrences of the quote character inside a line are backslash-escaped by default.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      quote_char: {
        type: 'string',
        required: !1,
        description:
          "Quote character to use on both sides when open and close are the same (default: '\"').",
      },
      open_quote: {
        type: 'string',
        required: !1,
        description: 'Opening quote/bracket if different from closing (e.g. "[").',
      },
      close_quote: {
        type: 'string',
        required: !1,
        description: 'Closing quote/bracket (e.g. "]").',
      },
      escape_existing: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to skip escaping existing occurrences of the quote character (default: true).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description: 'Set true to leave blank lines unquoted (default: true).',
      },
    },
  },
  {
    name: 'uppercase_lines',
    description:
      'Convert every character in a range of lines to UPPERCASE. Useful for formatting headings, SQL keywords, enum values, or constant declarations.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
    },
  },
  {
    name: 'lowercase_lines',
    description:
      'Convert every character in a range of lines to lowercase. Useful for normalizing imports, fixing accidentally capped lines, or preparing text for case-insensitive comparison.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
    },
  },
  {
    name: 'collapse_whitespace',
    description:
      'Reduce every run of consecutive whitespace characters inside each line to a single space. Leading indentation is preserved by default. Operates on the entire file or a specified line range.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line of the range (default: end of file).',
      },
      preserve_indent: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to also collapse leading whitespace/indentation (default: true — indentation is kept).',
      },
    },
  },
  {
    name: 'replace_char',
    description:
      'Replace every occurrence of a specific character (or short string) with another character throughout a file or within a specified line range. Simpler and faster than find_replace_regex for single-character substitutions such as tabs ↔ pipes, commas ↔ semicolons, or smart quotes ↔ straight quotes.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      from_char: {
        type: 'string',
        required: !0,
        description: 'The character or short string to find.',
      },
      to_char: {
        type: 'string',
        required: !0,
        description: 'The replacement character or string. Use "" to delete all occurrences.',
      },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line of the range (default: end of file).',
      },
    },
  },
  {
    name: 'split_file_at_pattern',
    description:
      'Split a single file into two separate output files at the line matching a pattern. The matching line can be included in part A, part B, or excluded entirely. The source file is not modified.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the source file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern identifying the split line.',
      },
      output_path_a: {
        type: 'string',
        required: !0,
        description: 'Absolute path for the first part (content before the split line).',
      },
      output_path_b: {
        type: 'string',
        required: !0,
        description: 'Absolute path for the second part (content after the split line).',
      },
      match_goes_to: {
        type: 'string',
        required: !1,
        description:
          'Where the matching line itself goes: "a" (default) → included in part A, "b" → included in part B, "none" → excluded from both.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      occurrence: {
        type: 'number',
        required: !1,
        description:
          'Which occurrence to split at when the pattern appears multiple times (1-based, default: 1).',
      },
    },
  },
  {
    name: 'rotate_lines',
    description:
      'Rotate a block of lines within a file by N positions. "down" moves the first N lines to the bottom of the block; "up" moves the last N lines to the top. Think of it like a circular buffer shift for a range.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the block to rotate.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the block (inclusive).',
      },
      count: { type: 'number', required: !0, description: 'Number of positions to rotate.' },
      direction: {
        type: 'string',
        required: !1,
        description:
          '"down" (default) — first N lines move to end; "up" — last N lines move to front.',
      },
    },
  },
  {
    name: 'count_lines_in_range',
    description:
      'Count lines in a file or a specific line range, broken down into total, blank, non-blank, word count, and character count. Optionally also counts how many lines in the range match a given pattern. Lighter than get_file_metadata when you just need line statistics for a subsection.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line of the range (default: end of file).',
      },
      pattern: {
        type: 'string',
        required: !1,
        description:
          'Optional pattern — if provided, also reports how many lines in the range match.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
    },
  },
  {
    name: 'find_largest_files',
    description:
      'List the N largest files in a directory tree, sorted by size. Instantly surfaces bloated assets, accidentally committed binaries, or runaway log files.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Root directory to scan. Defaults to opened workspace.',
      },
      limit: {
        type: 'number',
        required: !1,
        description: 'How many files to return (default: 20).',
      },
      extensions: {
        type: 'string',
        required: !1,
        description: 'Comma-separated extensions to restrict the scan, e.g. "js,ts,json".',
      },
      max_depth: {
        type: 'number',
        required: !1,
        description: 'Maximum directory depth to recurse into (default: 6).',
      },
    },
  },
  {
    name: 'find_files_by_extension',
    description:
      'List every file matching one or more extensions in a directory tree, grouped by extension. Faster than find_file_by_name when you want all files of a given type.',
    category: 'terminal',
    parameters: {
      extensions: {
        type: 'string',
        required: !0,
        description: 'Comma-separated file extensions to find, e.g. "ts,tsx,js".',
      },
      path: {
        type: 'string',
        required: !1,
        description: 'Root directory to scan. Defaults to opened workspace.',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum files to return (default: 200).',
      },
      max_depth: {
        type: 'number',
        required: !1,
        description: 'Maximum directory depth to recurse (default: 8).',
      },
    },
  },
  {
    name: 'find_empty_files',
    description:
      'Locate zero-byte files and optionally whitespace-only files in a directory tree. Catches accidental empty creates, broken codegen output, or placeholder stubs.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Root directory to scan. Defaults to opened workspace.',
      },
      include_whitespace_only: {
        type: 'boolean',
        required: !1,
        description: 'Set true to also report files that contain only whitespace (default: true).',
      },
    },
  },
  {
    name: 'find_long_lines',
    description:
      'Find every line in a file that exceeds a character-width threshold. Essential for enforcing line-length lint rules before they fail in CI.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      threshold: {
        type: 'number',
        required: !1,
        description: 'Minimum line length to flag (default: 100 characters).',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum number of long lines to return (default: 100).',
      },
    },
  },
  {
    name: 'find_console_statements',
    description:
      'Locate every console.log / print / debugger / logger call left in source files. Prevents debug noise from reaching production. Works on a single file or across the workspace.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a single file to scan.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to scan across all files. Used when path is not provided.',
      },
      patterns: {
        type: 'string',
        required: !1,
        description:
          'Comma-separated regex patterns to treat as debug statements (overrides defaults).',
      },
    },
  },
  {
    name: 'find_hardcoded_values',
    description:
      'Surface magic numbers, hardcoded URLs, and string literals that should be constants or config. Reports each with the line number and surrounding context.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file to scan.' },
      find_numbers: {
        type: 'boolean',
        required: !1,
        description: 'Set false to skip magic number detection (default: true).',
      },
      find_strings: {
        type: 'boolean',
        required: !1,
        description: 'Set false to skip string literal detection (default: true).',
      },
      find_urls: {
        type: 'boolean',
        required: !1,
        description: 'Set false to skip URL detection (default: true).',
      },
      min_magic_number: {
        type: 'number',
        required: !1,
        description: 'Only flag numbers ≥ this value (default: 3, avoids flagging 0/1/2).',
      },
    },
  },
  {
    name: 'find_imports_of',
    description:
      'Find every file in the workspace that imports a specific module or package. Answers "what depends on X?" — the reverse of map_imports.',
    category: 'terminal',
    parameters: {
      module: {
        type: 'string',
        required: !0,
        description: 'Module or package name to search for (e.g. "react", "./utils", "lodash").',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to opened workspace.',
      },
    },
  },
  {
    name: 'find_files_without_pattern',
    description:
      'Return all source files in a directory that do NOT contain a given pattern. Finds files missing required license headers, use-strict directives, specific imports, or boilerplate.',
    category: 'terminal',
    parameters: {
      directory: {
        type: 'string',
        required: !0,
        description: 'Absolute path of the directory to scan.',
      },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String pattern that should be present. Files lacking it are returned.',
      },
      extensions: {
        type: 'string',
        required: !1,
        description:
          'Comma-separated extensions to check (default: "js,ts,jsx,tsx,py,rb,go,java,cs,php,rs").',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum number of non-matching files to return (default: 50).',
      },
    },
  },
  {
    name: 'find_nth_occurrence',
    description:
      'Find the exact position of the Nth occurrence of a pattern in a file with surrounding context. Use when you need to navigate to a specific instance of a repeated construct.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern to search for.',
      },
      n: {
        type: 'number',
        required: !1,
        description: 'Which occurrence to locate (1-based, default: 1 = first).',
      },
      context_lines: {
        type: 'number',
        required: !1,
        description: 'Lines of context to show above and below the match (default: 10).',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'find_all_urls',
    description:
      'Extract every URL from a file or workspace, grouped by domain. Useful for auditing external dependencies, broken links, or hardcoded endpoints.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a single file to scan.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to scan all files. Used when path is not provided.',
      },
      schemes: {
        type: 'string',
        required: !1,
        description: 'Comma-separated URL schemes to look for (default: "http,https").',
      },
      show_locations: {
        type: 'boolean',
        required: !1,
        description: 'Set false to omit file:line locations for each URL (default: true).',
      },
    },
  },
  {
    name: 'find_commented_code_blocks',
    description:
      'Detect consecutive runs of commented-out code lines (≥ N lines), distinguishing actual code from prose documentation. Surfaces dead code candidates for removal.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      min_block_size: {
        type: 'number',
        required: !1,
        description: 'Minimum consecutive commented-code lines to flag as a block (default: 3).',
      },
    },
  },
  {
    name: 'find_similar_lines',
    description:
      'Detect near-duplicate lines in a file using trigram similarity. Catches copy-paste errors, redundant switch cases, and accidental duplication that exact-dupe detection misses.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      similarity_threshold: {
        type: 'number',
        required: !1,
        description: 'Minimum similarity ratio 0–1 to flag a pair (default: 0.85 = 85% similar).',
      },
      min_length: {
        type: 'number',
        required: !1,
        description: 'Minimum character length for a line to be considered (default: 20).',
      },
    },
  },
  {
    name: 'find_functions_over_length',
    description:
      'Workspace-wide scan for functions that exceed a line-count threshold. Surfaces complex, hard-to-test functions across the whole project in one call.',
    category: 'terminal',
    parameters: {
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to opened workspace.',
      },
      threshold: {
        type: 'number',
        required: !1,
        description: 'Line count above which a function is flagged (default: 50).',
      },
      extensions: {
        type: 'string',
        required: !1,
        description:
          'Comma-separated file extensions to scan (default: "js,ts,jsx,tsx,py,java,cs,go,rb").',
      },
    },
  },
  {
    name: 'find_unclosed_markers',
    description:
      'Scan a file for start markers (e.g. "BEGIN", "\x3c!-- start --\x3e", "@region") that have no matching end marker. Catches unbalanced template slots, open code regions, or stray comment blocks.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_marker: {
        type: 'string',
        required: !0,
        description: 'Text that marks the opening of a block (plain substring).',
      },
      end_marker: {
        type: 'string',
        required: !0,
        description: 'Text that marks the closing of a block (plain substring).',
      },
    },
  },
  {
    name: 'find_pattern_near_pattern',
    description:
      'Find lines where pattern A appears within N lines of pattern B. Detects co-occurrences like "useEffect near setState", "try near setTimeout", or "TODO near a specific function call".',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern_a: { type: 'string', required: !0, description: 'First pattern to find.' },
      pattern_b: {
        type: 'string',
        required: !0,
        description: 'Second pattern that must appear near pattern A.',
      },
      proximity: {
        type: 'number',
        required: !1,
        description: 'Maximum number of lines apart the two patterns may be (default: 5).',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat both patterns as regexes (default: false).',
      },
    },
  },
  {
    name: 'find_all_string_literals',
    description:
      'Extract every unique string literal (single-quoted, double-quoted, or template) from a file, grouped by quote style. Use for finding all user-visible text, i18n keys, error messages, or hardcoded values.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      min_length: {
        type: 'number',
        required: !1,
        description: 'Minimum string length to include (default: 2).',
      },
      max_length: {
        type: 'number',
        required: !1,
        description: 'Maximum string length to include (default: 200).',
      },
      deduplicate: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to include all occurrences rather than unique values (default: true).',
      },
    },
  },
  {
    name: 'find_lines_by_length_range',
    description:
      'Return all lines in a file whose character count falls within [min_length, max_length]. Useful for finding short stub lines, detecting minified code, or isolating lines of a specific structural width.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      min_length: {
        type: 'number',
        required: !1,
        description: 'Minimum character length (inclusive). Omit for no lower bound.',
      },
      max_length: {
        type: 'number',
        required: !1,
        description: 'Maximum character length (inclusive). Omit for no upper bound.',
      },
      skip_blank: {
        type: 'boolean',
        required: !1,
        description: 'Set false to include blank lines in the results (default: true — skipped).',
      },
      max_results: {
        type: 'number',
        required: !1,
        description: 'Maximum matching lines to return (default: 200).',
      },
    },
  },
  {
    name: 'find_first_match',
    description:
      'Find the very first occurrence of a pattern in a file and show generous surrounding context. Ideal for a quick "where does X begin?" — faster than search_in_file when you only care about the first hit.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: { type: 'string', required: !0, description: 'String or regex pattern to find.' },
      context_before: {
        type: 'number',
        required: !1,
        description: 'Lines to show before the match (default: 10).',
      },
      context_after: {
        type: 'number',
        required: !1,
        description: 'Lines to show after the match (default: 20).',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'find_multiline_pattern',
    description:
      'Search for a regex pattern that spans multiple lines using dot-all mode. Finds multi-line function signatures, JSX blocks, SQL clauses, or any construct a single-line search would miss.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'JavaScript regex pattern (may include \\n to match newlines explicitly).',
      },
      flags: {
        type: 'string',
        required: !1,
        description: 'Regex flags (default: "gis" — global, case-insensitive, dot-all).',
      },
      context_lines: {
        type: 'number',
        required: !1,
        description: 'Extra lines of context to show around each match (default: 3).',
      },
      max_matches: {
        type: 'number',
        required: !1,
        description: 'Maximum number of matches to return (default: 20).',
      },
    },
  },
  {
    name: 'find_symbol_definitions',
    description:
      'Find only the definition sites of a named symbol (function, class, const, type, etc.) across the workspace — filtering out call sites and imports. Faster than trace_symbol when you just need to jump to the declaration.',
    category: 'terminal',
    parameters: {
      symbol: {
        type: 'string',
        required: !0,
        description: 'Exact symbol name to find definitions for.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to opened workspace.',
      },
      language: {
        type: 'string',
        required: !1,
        description:
          'Hint the language to narrow patterns: "js", "ts", "python", "java", etc. (default: auto-detect).',
      },
    },
  },
  {
    name: 'replace_nth_occurrence',
    description:
      'Replace only the Nth occurrence of a pattern in a file, leaving all other occurrences untouched. Essential when a symbol repeats many times but only one specific instance should change (e.g. the 3rd call to a function, the 2nd import alias).',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: { type: 'string', required: !0, description: 'String or regex pattern to find.' },
      replacement: { type: 'string', required: !0, description: 'Replacement text.' },
      n: {
        type: 'number',
        required: !1,
        description: 'Which occurrence to replace (1-based, default: 1).',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'enclose_range',
    description:
      'Wrap a line range by inserting a custom opening line before it and/or a closing line after it. Perfect for wrapping code in try { } catch { }, if ( ) { }, JSDoc blocks, XML tags, or any structural container — without modifying the enclosed content.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to enclose.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      opening: {
        type: 'string',
        required: !1,
        description: 'Line to insert before the range (e.g. "try {").',
      },
      closing: {
        type: 'string',
        required: !1,
        description: 'Line to insert after the range (e.g. "} catch (e) { throw e; }").',
      },
      indent_body: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to also indent the enclosed lines by indent_amount spaces (default: false).',
      },
      indent_amount: {
        type: 'number',
        required: !1,
        description: 'Spaces to add to enclosed lines when indent_body is true (default: 2).',
      },
    },
  },
  {
    name: 'add_import_statement',
    description:
      'Insert an import/from/require line into a file. By default places it after the last existing import statement, skips silently if an identical line already exists, and works with ES6 imports, Python from-imports, and CommonJS require().',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      statement: {
        type: 'string',
        required: !0,
        description: 'The complete import line to add (e.g. \'import { useState } from "react"\').',
      },
      position: {
        type: 'string',
        required: !1,
        description:
          'Where to insert: "auto" (after last import, default), "top" (line 1), or "bottom" (end of file).',
      },
      skip_if_present: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to add even if an identical line exists (default: true — skips duplicates).',
      },
    },
  },
  {
    name: 'remove_import_statement',
    description:
      'Delete every import/require line in a file that references a specific module name. Handles default imports, named imports, namespace imports, and CommonJS require().',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      module: {
        type: 'string',
        required: !0,
        description: 'Module name to remove imports of (e.g. "react", "./utils", "lodash").',
      },
    },
  },
  {
    name: 'sort_imports',
    description:
      'Alphabetically sort all import/require statements at the top of a file. Optionally groups external package imports before relative path imports (the most common convention).',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      group_by_type: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to sort all imports together without external/internal grouping (default: true — external packages first, then relative imports).',
      },
      descending: {
        type: 'boolean',
        required: !1,
        description: 'Set true to sort Z→A (default: A→Z).',
      },
    },
  },
  {
    name: 'indent_to_level',
    description:
      'Set the absolute indentation of every line in a range to exactly N levels, overwriting existing indentation completely. Unlike indent_lines (which adds or removes relative to current indent), this sets a precise level regardless of what is already there.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      level: {
        type: 'number',
        required: !0,
        description:
          'Absolute indentation level to set (0 = no indent, 1 = one unit, 2 = two units, …).',
      },
      spaces_per_level: {
        type: 'number',
        required: !1,
        description: 'Spaces per indentation level when not using tabs (default: 2).',
      },
      use_tabs: {
        type: 'boolean',
        required: !1,
        description: 'Set true to use tab characters instead of spaces (default: false).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to also indent blank lines (default: true — blank lines are left untouched).',
      },
    },
  },
  {
    name: 'apply_line_template',
    description:
      'Transform every line in a range through a template string containing the `{line}` placeholder, which is replaced with the original line content. Enables powerful single-call transforms: wrapping lines in function calls, HTML tags, JSON strings, SQL values, log statements, and more.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      template: {
        type: 'string',
        required: !0,
        description:
          "Template string with `{line}` as placeholder (e.g. 'console.log(\"{line}\")', '<li>{line}</li>', '\"{line}\",').",
      },
      trim_line: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to trim whitespace from each line before substituting into the template (default: false).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description: 'Set true to leave blank lines untouched (default: true).',
      },
    },
  },
  {
    name: 'conditional_replace',
    description:
      'Replace a pattern only on lines that also satisfy a guard condition. More precise than find_replace_regex when you want to replace `foo` with `bar` exclusively on lines that contain `async`, or swap a value only inside a specific block. The guard can be inverted to target lines that do NOT match.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      guard_pattern: {
        type: 'string',
        required: !0,
        description: 'Pattern that a line must match for the replacement to apply.',
      },
      search: {
        type: 'string',
        required: !0,
        description: 'Pattern to find and replace (within qualifying lines only).',
      },
      replace: { type: 'string', required: !0, description: 'Replacement string.' },
      invert_guard: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to apply replacement on lines that do NOT match the guard (default: false).',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat both patterns as regexes (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      replace_all: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to replace only the first occurrence per qualifying line (default: true).',
      },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line to consider (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line to consider (default: end of file).',
      },
    },
  },
  {
    name: 'delete_nth_occurrence',
    description:
      'Remove only the Nth occurrence of a pattern from a file, keeping all other occurrences intact. Can delete the matched text in-line (default) or delete the entire line that contains it.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: { type: 'string', required: !0, description: 'String or regex pattern to find.' },
      n: {
        type: 'number',
        required: !1,
        description: 'Which occurrence to delete (1-based, default: 1).',
      },
      delete_whole_line: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to delete the entire line containing the Nth match, not just the matched text (default: false).',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'set_line_endings',
    description:
      'Convert all line endings in a file to a specific style: LF (Unix/macOS), CRLF (Windows), or CR (legacy Mac). More targeted than normalize_file, which also strips BOM and trims whitespace.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      style: {
        type: 'string',
        required: !0,
        description: 'Line ending style: "lf" (\\n), "crlf" (\\r\\n), or "cr" (\\r).',
      },
    },
  },
  {
    name: 'strip_line_prefix',
    description:
      'Remove a fixed prefix string from the beginning of every line in a range. Useful for un-quoting lines, removing list markers like "- " or "1. ", stripping log prefixes like "[INFO] ", or reversing an earlier wrap_lines or add_file_header operation.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      prefix: {
        type: 'string',
        required: !0,
        description: 'Exact prefix string to remove from the start of each line.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to treat prefix as a regex anchored to the start of each line (default: false — plain string).',
      },
      skip_if_absent: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to throw an error if any line lacks the prefix (default: true — silently skips lines without it).',
      },
    },
  },
  {
    name: 'number_lines_in_range',
    description:
      'Prefix each line in a range with a sequential number. Configurable start number, separator, and zero-padding width. Useful for generating numbered lists, adding enumerated labels, or producing reference output before review.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to number.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      start_number: {
        type: 'number',
        required: !1,
        description: 'Number to assign to the first line (default: 1).',
      },
      separator: {
        type: 'string',
        required: !1,
        description: 'String placed between the number and the line content (default: ". ").',
      },
      pad_width: {
        type: 'number',
        required: !1,
        description:
          'Zero-pad numbers to this width (default: auto — just wide enough for the largest number).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description: 'Set true to skip blank lines (they still consume a number) (default: false).',
      },
    },
  },
  {
    name: 'bulk_line_insert',
    description:
      'Insert the same content block at multiple specific line numbers in a single call. Avoids repetitive sequential calls to insert_into_file when you need to inject a separator, a blank line, or a debug statement at many known positions.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      line_numbers: {
        type: 'string',
        required: !0,
        description:
          'Comma-separated 1-based line numbers where content should be inserted (e.g. "10,25,42").',
      },
      content: {
        type: 'string',
        required: !0,
        description: 'Text to insert at each position. Include newlines as needed.',
      },
      position: {
        type: 'string',
        required: !1,
        description:
          '"before" to insert before each target line, "after" to insert after it (default: "before").',
      },
      deduplicate: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to allow duplicate line numbers (default: true — each unique position is visited once).',
      },
    },
  },
  {
    name: 'invert_boolean_values',
    description:
      'Toggle boolean-like literals in a line range: true↔false, yes↔no, on↔off, enabled↔disabled (and their capitalized variants). Preserves the original casing style of each value. Useful for flipping feature flags, test expectations, or config toggles in bulk.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      pairs: {
        type: 'string',
        required: !1,
        description:
          'JSON array of [from, to] pairs to override default boolean pairs, e.g. \'[["active","inactive"],["open","closed"]]\'.',
      },
      include_numeric: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to also flip 0↔1 (default: false — avoids touching port numbers and other integers).',
      },
    },
  },
  {
    name: 'move_section_to_marker',
    description:
      'Cut all content between a start marker and end marker, then paste it at a destination marker — atomically, in a single file write. Great for reorganising config sections, reordering class methods, or shuffling documentation blocks without manual cut-and-paste.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_marker: {
        type: 'string',
        required: !0,
        description: 'Text marking the beginning of the section to move.',
      },
      end_marker: {
        type: 'string',
        required: !0,
        description: 'Text marking the end of the section to move.',
      },
      destination_marker: {
        type: 'string',
        required: !0,
        description: 'Text of the marker where the section should be pasted.',
      },
      destination_position: {
        type: 'string',
        required: !1,
        description: '"before" or "after" the destination marker line (default: "after").',
      },
      preserve_markers: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to also move the start/end marker lines themselves (default: true — only content between markers is moved).',
      },
    },
  },
  {
    name: 'repeat_lines',
    description:
      'Duplicate each individual line in a range N times, inserting copies immediately after the original. Unlike duplicate_lines (which copies the whole block once), this repeats every line separately. Useful for generating repeated test data, expanding templates, or creating stub arrays.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      count: {
        type: 'number',
        required: !0,
        description: 'How many copies to insert after each line (max: 20).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description: 'Set true to skip blank lines — they will not be repeated (default: false).',
      },
    },
  },
  {
    name: 'surround_with_block_comment',
    description:
      'Wrap a line range with the appropriate block comment delimiters for the file type (/* */ for JS/CSS/Java, \x3c!-- --\x3e for HTML/XML, {# #} for Nunjucks, """ for Python, etc.). An optional label can be appended to both delimiters to create named regions.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to comment.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      label: {
        type: 'string',
        required: !1,
        description:
          'Optional label appended to both delimiters to create named regions (e.g. "SECTION: Auth").',
      },
      open_delimiter: {
        type: 'string',
        required: !1,
        description: 'Override the auto-detected opening delimiter (e.g. "/*").',
      },
      close_delimiter: {
        type: 'string',
        required: !1,
        description: 'Override the auto-detected closing delimiter (e.g. "*/")',
      },
    },
  },
  {
    name: 'copy_range_to_position',
    description:
      'Copy a line range and insert the copy at a different position in the same file without removing the original. Unlike duplicate_lines (inserts immediately after the block) and move_lines (removes source), this places a copy at any arbitrary target line while leaving the source intact.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: {
        type: 'number',
        required: !0,
        description: '1-based first line of the range to copy.',
      },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range to copy (inclusive).',
      },
      target_line: {
        type: 'number',
        required: !0,
        description: '1-based line number in the original file to insert the copy near.',
      },
      position: {
        type: 'string',
        required: !1,
        description:
          '"before" to insert before the target line, "after" to insert after it (default: "before").',
      },
    },
  },
  {
    name: 'overwrite_matching_lines',
    description:
      'Replace the entire content of every line matching a pattern with a fixed replacement string. Unlike find_replace_regex (which swaps only the matched portion), this discards the whole line and substitutes it completely. Useful for resetting placeholder lines, blanking matched lines, or normalising repeated stubs.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      pattern: {
        type: 'string',
        required: !0,
        description: 'String or regex pattern. Every matching line is fully replaced.',
      },
      replacement: {
        type: 'string',
        required: !0,
        description:
          'New content to substitute for every matching line. Use "" to blank the lines.',
      },
      regex: {
        type: 'boolean',
        required: !1,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: !1,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line to consider (default: 1).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description: '1-based last line to consider (default: end of file).',
      },
    },
  },
  {
    name: 'remove_trailing_chars',
    description:
      'Strip specific trailing characters or strings (commas, semicolons, colons, periods, brackets, etc.) from the end of every line in a range. Useful for fixing trailing commas after refactoring, cleaning up list literals, or normalising CSV/TSV output before further processing.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      start_line: { type: 'number', required: !0, description: '1-based first line of the range.' },
      end_line: {
        type: 'number',
        required: !0,
        description: '1-based last line of the range (inclusive).',
      },
      chars: {
        type: 'string',
        required: !0,
        description:
          'The character or string to remove from the end of each line (e.g. ",", ";", ".", "],").',
      },
      greedy: {
        type: 'boolean',
        required: !1,
        description:
          'Set true to strip ALL consecutive trailing occurrences of chars, not just one (default: false).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: !1,
        description:
          'Set false to also process blank lines (default: true — blank lines are skipped).',
      },
    },
  },
  {
    name: 'get_git_log',
    description:
      'Fetch recent git commit history with author, relative timestamp, and commit message. Gives the AI immediate temporal context: what changed recently, who made the changes, and whether a bug correlates to a specific commit. Optionally scoped to a single file.',
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      limit: {
        type: 'number',
        required: !1,
        description: 'Maximum number of commits to return (default: 20).',
      },
      file_path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a specific file to show history for (default: entire repo).',
      },
      branch: {
        type: 'string',
        required: !1,
        description: 'Branch name to show history from (default: current branch).',
      },
    },
  },
  {
    name: 'get_git_blame',
    description:
      'Show the author and commit date for every line (or a line range) of a file using git blame. Lets the AI identify who owns specific code, when it was last changed, and whether a bug is from legacy or recent work — without reading the full commit log.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      start_line: {
        type: 'number',
        required: !1,
        description: '1-based first line to blame (default: entire file).',
      },
      end_line: {
        type: 'number',
        required: !1,
        description:
          '1-based last line to blame (default: 30 lines from start_line if start_line is given).',
      },
    },
  },
  {
    name: 'find_circular_dependencies',
    description:
      'Detect circular import chains in a JavaScript/TypeScript workspace by building a directed import graph and running DFS cycle detection. Circular dependencies cause subtle runtime initialization bugs and module loading failures that are nearly impossible to diagnose without this tool.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
      extensions: {
        type: 'string',
        required: !1,
        description: 'Comma-separated file extensions to analyze (default: "js,ts,jsx,tsx").',
      },
    },
  },
  {
    name: 'find_test_coverage_gaps',
    description:
      'Find source files that have no corresponding test file anywhere in the workspace. Gives the AI an instant picture of which modules are untested before writing, refactoring, or debugging code — preventing changes to unprotected code without warning.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
      extensions: {
        type: 'string',
        required: !1,
        description: 'Source file extensions to check (default: "js,ts,jsx,tsx,py").',
      },
      test_patterns: {
        type: 'string',
        required: !1,
        description:
          'Comma-separated substrings that identify test files (default: ".test.,.spec.,_test.,test_").',
      },
    },
  },
  {
    name: 'find_api_endpoints',
    description:
      'Detect and list all HTTP route definitions across the workspace — Express, Fastify, FastAPI, Flask, Django, Rails, Next.js API routes, Hono, and similar frameworks. Instantly maps the entire API surface with HTTP verb, path, and source location, without reading every route file.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'find_error_handling_gaps',
    description:
      'Find async functions, await expressions, Promise chains, and fetch/axios calls that are NOT wrapped in try/catch or .catch(). Missing error handling is a top cause of silent production failures. Works on a single file or across the whole workspace.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a single file to scan.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to scan across all files. Used when path is not given.',
      },
    },
  },
  {
    name: 'get_dependency_graph',
    description:
      'Build a file-level import graph and compute fan-in (how many files import each file) and fan-out (how many files each file imports). High fan-in means a core module that many depend on — risky to change. High fan-out means a potential god file. Isolated files with no connections may be dead code. Essential intelligence before any refactoring.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
      extensions: {
        type: 'string',
        required: !1,
        description: 'Comma-separated file extensions to include (default: "js,ts,jsx,tsx").',
      },
      max_files: {
        type: 'number',
        required: !1,
        description: 'Maximum number of files to analyze (default: 100).',
      },
    },
  },
  {
    name: 'find_security_patterns',
    description:
      'Scan a workspace for common security anti-patterns: hardcoded passwords and API keys, eval() usage, SQL injection vectors, disabled TLS verification (rejectUnauthorized: false, verify=False), dangerouslySetInnerHTML, open redirects, and insecure randomness. Surface-level scan — not a substitute for a full SAST tool, but catches the obvious red flags instantly.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'get_recently_modified_files',
    description:
      "List files modified most recently, using git log (preferred) or filesystem mtime as fallback. Instantly tells the AI where recent work happened — the single most important signal for debugging a fresh regression, doing code review, or understanding what's currently in flux.",
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
      limit: {
        type: 'number',
        required: !1,
        description: 'Maximum number of files to return (default: 20).',
      },
      days: {
        type: 'number',
        required: !1,
        description: 'How many days back to look (default: 7).',
      },
      extensions: {
        type: 'string',
        required: !1,
        description:
          'Comma-separated extensions to restrict results, e.g. "ts,tsx" (default: all).',
      },
    },
  },
  {
    name: 'find_naming_inconsistencies',
    description:
      'Detect files where multiple naming conventions coexist (camelCase, snake_case, PascalCase, UPPER_SNAKE, kebab-case). Mixed conventions are a reliable signal of multi-author code or rushed refactors — and a frequent source of bugs when the AI needs to follow the "house style".',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a single file to scan.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to scan across all files. Used when path is not given.',
      },
    },
  },
  {
    name: 'get_config_files',
    description:
      'Locate and summarize every configuration file in a workspace: package.json (with key fields), tsconfig, ESLint, Prettier, Jest/Vitest, Vite/Webpack, Babel, Docker, CI/CD pipelines, .env files, and more. Gives the AI a complete picture of project tooling in a single call, avoiding the need to manually hunt for each config.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'find_async_patterns',
    description:
      'Map all async usage patterns in a file or workspace: async/await, Promise chains (.then/.catch/.finally), Promise.all/race/allSettled, new Promise(), setTimeout/setInterval, EventEmitter, and callback-style patterns. Essential before making any changes involving concurrency, timing, or data flow.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a single file to scan.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to scan across all files. Used when path is not given.',
      },
    },
  },
  {
    name: 'map_component_tree',
    description:
      'Build a React/Vue component hierarchy by analysing JSX/TSX imports and render patterns. Shows which components are composed inside which parents, which are leaf nodes, and which are root entry points. The fastest way to understand the UI architecture before making structural changes to any component.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
      entry_file: {
        type: 'string',
        required: !1,
        description:
          'Partial filename to use as the tree root (e.g. "App.tsx"). Default: auto-detect.',
      },
    },
  },
  {
    name: 'count_code_by_author',
    description:
      'Use git blame to compute per-author line counts across the workspace, showing what percentage of the codebase each contributor wrote. Identifies bus-factor risks (one person owns 70%+ of lines), code ownership boundaries, and who to consult before changing a module.',
    category: 'terminal',
    parameters: {
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      max_files: {
        type: 'number',
        required: !1,
        description: 'Maximum number of tracked files to analyze (default: 50).',
      },
    },
  },
  {
    name: 'find_feature_flags',
    description:
      'Detect feature flag / feature toggle patterns across the codebase — LaunchDarkly, Unleash, Flagsmith, custom flag maps, and environment-variable gates. Lists all known flag names with their usage frequency and source locations. Lets the AI understand which code paths are conditionally enabled before making changes to flagged features.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'get_function_call_frequency',
    description:
      'Count how often each function defined in a file is called across the workspace. High-frequency functions are hot paths — changes there have wide blast radius. Zero-frequency internal functions are dead code candidates. Gives the AI the call-frequency signal needed to prioritise safely and avoid breaking widely-used utilities.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !0,
        description: 'Absolute path to the file whose functions you want to measure.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to search for calls. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'summarize_file_changes',
    description:
      'Summarize recent git commits for a specific file: lines added/removed, functions touched, and a preview of the actual diff. Gives the AI immediate commit-level context — what changed, when, and how much — without wading through raw git output. Essential for debugging regressions and understanding change history.',
    category: 'terminal',
    parameters: {
      path: { type: 'string', required: !0, description: 'Absolute path to the file.' },
      working_directory: {
        type: 'string',
        required: !1,
        description: 'Absolute repo path. Defaults to the opened workspace.',
      },
      commits: {
        type: 'number',
        required: !1,
        description: 'Number of recent commits to summarize (default: 1).',
      },
    },
  },
  {
    name: 'find_performance_patterns',
    description:
      'Scan for common performance anti-patterns: awaits inside loops (N+1 query risk), synchronous fs/exec in async contexts, JSON.parse in tight loops, heavy work in React render/useEffect, missing memoization signals, SELECT * queries, busy-wait polling, and array allocations inside render. Works on a single file or across the workspace.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Absolute path to a single file to scan.',
      },
      workspace_path: {
        type: 'string',
        required: !1,
        description: 'Workspace root to scan across all files. Used when path is not given.',
      },
    },
  },
  {
    name: 'get_workspace_health_score',
    description:
      'Compute a 0–100 health score for the workspace across six dimensions: test coverage ratio, debug log cleanliness, absence of hardcoded secrets, TODO debt, file size discipline, and git cleanliness. Returns a grade (A–F), per-dimension breakdown, and actionable summary. The single best "state of the codebase" tool to run before starting significant work.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
  {
    name: 'get_architecture_overview',
    description:
      'Produce a complete architectural overview of the workspace: detected architectural pattern (Layered MVC, Clean Architecture, Feature-based, SPA, SSR, etc.), tech stack, identified layers with their directory locations, data flow direction, entry points, and AI-specific guidance on where key concerns live. The best first tool to call when starting work on an unfamiliar codebase or before making any architectural decision.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: !1,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },
];
