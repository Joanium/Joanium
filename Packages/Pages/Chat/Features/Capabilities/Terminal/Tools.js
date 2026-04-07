export const TERMINAL_TOOLS = [
  {
    name: 'inspect_workspace',
    description:
      'Inspect a local workspace and summarize its stack, scripts, frameworks, tests, CI, env files, and infrastructure signals. Use this early for dev, QA, or DevOps tasks.',
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
    description:
      'Search across a local workspace for a code pattern, function name, config key, or error string, returning file paths and line snippets.',
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
    description:
      'Find files in a local workspace by filename (case-insensitive substring match). Use this to locate a file when you do not know its exact directory path.',
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
    description:
      'Execute a short-lived shell command and return stdout/stderr. Use for builds, git, scripts, or diagnostics. For high-risk commands, set allow_risky only if the user explicitly asked for it.',
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
        description:
          'Absolute path to run the command in. Defaults to the opened workspace when available.',
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
    description:
      'Assess a shell command for risk before running it. Useful for DevOps actions, destructive git commands, and infrastructure changes.',
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
    description:
      'Extract readable text from a local document such as PDF, DOCX, XLSX, XLSM, PPTX, RTF, or plain text files. Use this when the user gives you a document instead of source code.',
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
    description:
      'Read a specific line range from a local file. Prefer this for large files or focused code review.',
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
    description:
      'Read several local text files in one call. Useful when comparing related files before editing.',
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
    description:
      'Show a shallow recursive tree of a directory. Use this to understand project layout before searching or editing.',
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
    description:
      'Patch a local file by replacing exact text. Use this for targeted edits instead of rewriting entire files.',
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
    description:
      'Replace an exact line range in a local text file. Prefer this for surgical edits when you know the affected lines.',
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
        description:
          'Insert position: start, end, before, or after. Defaults to end, or after when anchor is provided.',
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
    description:
      'Create a new directory at the specified path. Creates parent directories if needed.',
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
    description:
      'Get local git status for the current workspace, including branch and changed files.',
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
    description:
      'Get the local git diff for the current workspace. Useful before code review, summaries, or QA.',
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
    description:
      "Run detected lint, test, and build commands for the current workspace. This is the agent's main QA tool for local projects.",
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
    description:
      'Start a long-running background process like a dev server or watcher. The process is shown in an embedded terminal inside chat. The host waits after spawn (default ~15s, up to 60s): if the process exits during that window (e.g. EADDRINUSE after compile), the tool fails with captured output instead of claiming success.',
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
      settle_ms: {
        type: 'number',
        required: false,
        description:
          'How long to wait (ms, 0–60000) after spawn for startup failures (port bind, crash after compile). Default 15000. Use 0 only if you accept no startup verification.',
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
  {
    name: 'get_file_metadata',
    description:
      'Get rich metadata about a local file: byte size, line count, word count, character count, last-modified timestamp, file extension, and detected programming language.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
    },
  },
  {
    name: 'search_in_file',
    description:
      'Search for a string or regex pattern within a single file, returning each matched line number, the matched line, and surrounding context lines. More focused than search_workspace when you already know which file to look in.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'Search string or regex pattern.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description:
          'Set true to treat pattern as a JavaScript regex (default: false — plain string).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      context_lines: {
        type: 'number',
        required: false,
        description: 'Number of lines of context to show above and below each match (default: 2).',
      },
      max_matches: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      line: {
        type: 'number',
        required: true,
        description: '1-based center line number.',
      },
      radius: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern to count.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the code file.',
      },
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
        required: true,
        description: 'Absolute path to the first (original / left) file.',
      },
      path_b: {
        type: 'string',
        required: true,
        description: 'Absolute path to the second (modified / right) file.',
      },
      context_lines: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line to delete.',
      },
      end_line: {
        type: 'number',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the block to move.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the block to move (inclusive).',
      },
      target_line: {
        type: 'number',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range to duplicate.',
      },
      end_line: {
        type: 'number',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range to sort.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the range to sort (inclusive).',
      },
      descending: {
        type: 'boolean',
        required: false,
        description: 'Set true to sort in Z→A descending order (default: ascending A→Z).',
      },
      trim_before_sort: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line to indent/dedent.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line to indent/dedent (inclusive).',
      },
      amount: {
        type: 'number',
        required: false,
        description: 'Spaces to add (positive) or remove (negative). Default: 2.',
      },
      use_tabs: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the range (inclusive).',
      },
      prefix: {
        type: 'string',
        required: false,
        description: 'String to prepend to each line (e.g. "// " to comment out JS).',
      },
      suffix: {
        type: 'string',
        required: false,
        description: 'String to append to each line.',
      },
      skip_empty_lines: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'JavaScript regex pattern to search for (do not include / delimiters).',
      },
      replacement: {
        type: 'string',
        required: true,
        description:
          'Replacement string. Use $1, $2 for capture groups. Use empty string to delete matches.',
      },
      flags: {
        type: 'string',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      replacements: {
        type: 'string',
        required: true,
        description:
          'JSON array of {search, replace} objects. Example: [{"search":"oldName","replace":"newName"},{"search":"oldPath","replace":"newPath"}]',
      },
      regex: {
        type: 'boolean',
        required: false,
        description:
          'Set true to treat every search string as a regex pattern (default: false — plain string).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
        description: 'Set true for case-sensitive matching (default: false).',
      },
    },
  },
  {
    name: 'insert_at_marker',
    description:
      'Insert a block of content immediately before or after a specific comment marker in a file (e.g. // @inject, <!-- insert here -->, # @slot). Great for codegen workflows and template slots.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      marker: {
        type: 'string',
        required: true,
        description: 'Exact marker text to locate (searched as a plain substring).',
      },
      content: {
        type: 'string',
        required: true,
        description: 'Content to insert. Include your own newlines as needed.',
      },
      position: {
        type: 'string',
        required: false,
        description: '"before" or "after" the marker line (default: "after").',
      },
      all_occurrences: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file to back up.',
      },
      backup_dir: {
        type: 'string',
        required: false,
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
        required: true,
        description: 'Absolute path to the source file.',
      },
      output_path: {
        type: 'string',
        required: true,
        description: 'Absolute path for the new output file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line to extract.',
      },
      end_line: {
        type: 'number',
        required: true,
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
        required: true,
        description: 'Comma-separated absolute paths of files to merge, in order.',
      },
      output_path: {
        type: 'string',
        required: true,
        description: 'Absolute path for the merged output file.',
      },
      separator: {
        type: 'string',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
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
        required: true,
        description: 'Absolute path to the file to normalize.',
      },
    },
  },
  // ─────────────────────────────────────────────────────────────────────────────
  // NEW TOOLS ADDENDUM — paste these objects into the TERMINAL_TOOLS array
  // in Tools.js (after the last closing brace of the existing tools list)
  // ─────────────────────────────────────────────────────────────────────────────

  // ── FINDING & SCANNING ───────────────────────────────────────────────────────

  {
    name: 'find_files_by_content',
    description:
      "Search across all files in a workspace directory for files whose content matches a string or regex. Returns matching file paths and the specific lines that matched. Broader than search_in_file — use this when you don't know which file contains something.",
    category: 'terminal',
    parameters: {
      directory: {
        type: 'string',
        required: true,
        description: 'Absolute path of the directory to scan recursively.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern to search for inside file contents.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a regex (default: false — plain string).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      file_glob: {
        type: 'string',
        required: false,
        description:
          'Comma-separated extensions to restrict the scan, e.g. "js,ts,jsx" (default: all text files).',
      },
      max_results: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_marker: {
        type: 'string',
        required: true,
        description: 'Text that marks the beginning of the block (inclusive by default).',
      },
      end_marker: {
        type: 'string',
        required: true,
        description: 'Text that marks the end of the block (inclusive by default).',
      },
      inclusive: {
        type: 'boolean',
        required: false,
        description:
          'Set false to exclude the marker lines from the returned content (default: true).',
      },
      occurrence: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: false,
        description: '1-based first line of the range to scan (default: 1).',
      },
      end_line: {
        type: 'number',
        required: false,
        description: '1-based last line of the range to scan (default: end of file).',
      },
      ignore_blank: {
        type: 'boolean',
        required: false,
        description: 'Set true to exclude blank lines from the duplicate check (default: true).',
      },
      trim_before_compare: {
        type: 'boolean',
        required: false,
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
        required: true,
        description: 'Absolute path of the directory to scan.',
      },
      tags: {
        type: 'string',
        required: false,
        description: 'Comma-separated tag names to look for (default: "TODO,FIXME,HACK,NOTE,XXX").',
      },
      file_glob: {
        type: 'string',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern to match against.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      include_text: {
        type: 'boolean',
        required: false,
        description:
          'Set true to include the matched line text alongside each line number (default: true).',
      },
    },
  },

  // ── ADVANCED LINE / BLOCK EDITING ────────────────────────────────────────────

  {
    name: 'comment_out_lines',
    description:
      'Add single-line comment markers to a range of lines, auto-detected from the file extension (// for JS/TS/Java, # for Python/Shell, -- for SQL, <!-- --> for HTML). Skips lines that are already commented.',
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
        description: '1-based first line to comment out.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line to comment out (inclusive).',
      },
      style: {
        type: 'string',
        required: false,
        description:
          'Override the auto-detected comment style: "//", "#", "--", "/* */", or "<!-- -->".',
      },
    },
  },

  {
    name: 'uncomment_lines',
    description:
      'Remove leading comment markers from a range of lines. Auto-detects comment style from the file extension. Leaves non-commented lines untouched.',
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
        description: '1-based first line to uncomment.',
      },
      end_line: {
        type: 'number',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range to reverse.',
      },
      end_line: {
        type: 'number',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: false,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: false,
        description: '1-based last line of the range (default: end of file).',
      },
      trim_before_compare: {
        type: 'boolean',
        required: false,
        description:
          'Set true to treat lines as equal if they differ only in leading/trailing whitespace (default: false).',
      },
      keep_blank: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      mode: {
        type: 'string',
        required: false,
        description:
          '"collapse" to reduce multiple consecutive blanks to one (default), or "delete" to remove all blank lines.',
      },
      start_line: {
        type: 'number',
        required: false,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range to join.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the range to join.',
      },
      separator: {
        type: 'string',
        required: false,
        description: 'String to place between joined lines (default: " ").',
      },
      trim_each: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      line_number: {
        type: 'number',
        required: true,
        description: '1-based line number to split.',
      },
      delimiter: {
        type: 'string',
        required: true,
        description: 'String to split on (e.g. ",", ";", " && ").',
      },
      trim_parts: {
        type: 'boolean',
        required: false,
        description: 'Set true to trim whitespace from each resulting part (default: true).',
      },
      preserve_indent: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      old_name: {
        type: 'string',
        required: true,
        description: 'The exact symbol name to rename.',
      },
      new_name: {
        type: 'string',
        required: true,
        description: 'The replacement symbol name.',
      },
      whole_word: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the JSON file.',
      },
      key_path: {
        type: 'string',
        required: true,
        description:
          'Dot-notation path to the key to update (e.g. "version", "scripts.start", "dependencies.react").',
      },
      value: {
        type: 'string',
        required: true,
        description:
          'New value as a JSON literal string. Strings must be quoted: \'"hello"\'. Numbers/booleans unquoted: 3000, true.',
      },
      create_if_missing: {
        type: 'boolean',
        required: false,
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
        required: true,
        description: 'Comma-separated absolute file paths to apply the replacement to.',
      },
      search: {
        type: 'string',
        required: true,
        description: 'String or regex pattern to search for.',
      },
      replace: {
        type: 'string',
        required: true,
        description: 'Replacement string. Supports $1, $2 capture groups when regex is true.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat search as a regex pattern (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      match_pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern. Lines matching this will be modified.',
      },
      text: {
        type: 'string',
        required: true,
        description: 'Text to append or prepend to each matching line.',
      },
      mode: {
        type: 'string',
        required: false,
        description:
          '"append" to add text at the end of the line, "prepend" to add at the start (default: "append").',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat match_pattern as a regex (default: false).',
      },
      skip_already_present: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the region to search within.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the region to search within (inclusive).',
      },
      search: {
        type: 'string',
        required: true,
        description: 'String or regex pattern to search for (only within the specified range).',
      },
      replace: {
        type: 'string',
        required: true,
        description: 'Replacement string.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat search as a regex (default: false).',
      },
      replace_all: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      a_start: {
        type: 'number',
        required: true,
        description: '1-based first line of block A.',
      },
      a_end: {
        type: 'number',
        required: true,
        description: '1-based last line of block A (inclusive).',
      },
      b_start: {
        type: 'number',
        required: true,
        description: '1-based first line of block B.',
      },
      b_end: {
        type: 'number',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_marker: {
        type: 'string',
        required: true,
        description:
          'The exact line or substring that marks the beginning of the replaceable region.',
      },
      end_marker: {
        type: 'string',
        required: true,
        description: 'The exact line or substring that marks the end of the replaceable region.',
      },
      new_content: {
        type: 'string',
        required: true,
        description: 'Replacement content to place between the markers.',
      },
      preserve_markers: {
        type: 'boolean',
        required: false,
        description:
          'Set false to also replace the marker lines themselves (default: true — markers are kept).',
      },
      occurrence: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      to: {
        type: 'string',
        required: true,
        description: '"tabs" to convert spaces → tabs, or "spaces" to convert tabs → spaces.',
      },
      spaces_per_tab: {
        type: 'number',
        required: false,
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
        required: true,
        description:
          'The exact symbol name to trace (e.g. "useAuth", "UserService", "MAX_RETRIES").',
      },
      path: {
        type: 'string',
        required: false,
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
      path: { type: 'string', required: true, description: 'Absolute path to the source file.' },
      long_function_threshold: {
        type: 'number',
        required: false,
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
      path: { type: 'string', required: true, description: 'Absolute path to the source file.' },
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
        required: true,
        description: 'Absolute path to the file to check exports in.',
      },
      workspace_path: {
        type: 'string',
        required: false,
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
        required: true,
        description: 'Absolute path to the first (original / left) JSON file.',
      },
      path_b: {
        type: 'string',
        required: true,
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
        required: false,
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
      path: { type: 'string', required: true, description: 'Absolute path to the source file.' },
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
        required: false,
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
        required: false,
        description: 'Absolute path to a single file to search in.',
      },
      workspace_path: {
        type: 'string',
        required: false,
        description: 'Workspace root to search across all files. Used if path is not given.',
      },
      must_contain: {
        type: 'array',
        required: false,
        description: 'Array of strings that must ALL be present on the line (AND logic).',
      },
      must_not_contain: {
        type: 'array',
        required: false,
        description: 'Array of strings — lines containing any of these are excluded (NOT logic).',
      },
      any_of: {
        type: 'array',
        required: false,
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
        required: false,
        description: 'Workspace root path. Defaults to the opened workspace.',
      },
    },
  },

  // ─────────────────────────────────────────────────────────────────────────────
  // NEW TOOLS — TOOLS.JS ADDITIONS
  // Paste these 20 objects into the TERMINAL_TOOLS array in Tools.js,
  // after the last existing entry (snapshot_workspace).
  // ─────────────────────────────────────────────────────────────────────────────

  // ── FILTER & PATTERN-BASED EDITING ──────────────────────────────────────────

  {
    name: 'filter_lines',
    description:
      'Keep only the lines in a file that match a pattern, deleting all non-matching lines. The inverse of filter_out_lines. Use for extracting log entries, filtering CSV rows, or isolating relevant code sections.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern. Only lines matching this are kept.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a JavaScript regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern. Lines matching this are deleted.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a JavaScript regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern. Insertion happens at each matching line.',
      },
      content: {
        type: 'string',
        required: true,
        description: 'Text to insert. Include newlines as needed.',
      },
      position: {
        type: 'string',
        required: false,
        description: '"before" or "after" the matching line (default: "after").',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      all_occurrences: {
        type: 'boolean',
        required: false,
        description:
          'Set false to only insert at the first matching line (default: true — all matches).',
      },
    },
  },

  // ── PRECISE LINE EDITING ─────────────────────────────────────────────────────

  {
    name: 'replace_single_line',
    description:
      'Replace the entire content of exactly one line, identified by its 1-based line number, with new text. More precise than apply_file_patch when you know the exact line number.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      line_number: {
        type: 'number',
        required: true,
        description: '1-based number of the line to replace.',
      },
      replacement: {
        type: 'string',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      line_a: {
        type: 'number',
        required: true,
        description: '1-based number of the first line to swap.',
      },
      line_b: {
        type: 'number',
        required: true,
        description: '1-based number of the second line to swap.',
      },
    },
  },

  // ── FILE-LEVEL STRUCTURAL EDITING ────────────────────────────────────────────

  {
    name: 'add_file_header',
    description:
      'Prepend a block of text (license banner, shebang line, auto-generated notice, module docstring, etc.) to the very top of a file. Idempotent by default — skips if the header is already present.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      content: {
        type: 'string',
        required: true,
        description: 'Header text to prepend.',
      },
      separator: {
        type: 'string',
        required: false,
        description: 'String inserted between the header and existing content (default: "\\n").',
      },
      skip_if_present: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      content: {
        type: 'string',
        required: true,
        description: 'Footer text to append.',
      },
      separator: {
        type: 'string',
        required: false,
        description: 'String inserted between existing content and the footer (default: "\\n").',
      },
      skip_if_present: {
        type: 'boolean',
        required: false,
        description:
          'Set false to always append even if the footer already exists (default: true).',
      },
    },
  },

  {
    name: 'strip_comments',
    description:
      'Remove all full-line comment lines from a file. Comment syntax is auto-detected from the file extension (// for JS/TS, # for Python/Shell, -- for SQL, <!-- --> for HTML/XML). Lines that are code followed by an inline comment are left intact.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      keep_blank_lines: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      max_lines: {
        type: 'number',
        required: true,
        description: 'Maximum number of lines to keep.',
      },
      from_end: {
        type: 'boolean',
        required: false,
        description:
          'Set true to keep the last max_lines instead of the first (default: false — keeps from the top).',
      },
    },
  },

  // ── OUTPUT / TRANSFORM TOOLS ─────────────────────────────────────────────────

  {
    name: 'extract_unique_lines',
    description:
      'Read a file and write only its unique lines (in original order) to a new output file. Duplicate lines are silently dropped. The source file is not modified. Useful for deduplicating word lists, CSV rows, or log lines.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the source file.',
      },
      output_path: {
        type: 'string',
        required: true,
        description: 'Absolute path for the deduplicated output file.',
      },
      trim_before_compare: {
        type: 'boolean',
        required: false,
        description:
          'Set true to treat lines as equal when they differ only in leading/trailing whitespace (default: false).',
      },
      ignore_blank: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the range (inclusive).',
      },
      width: {
        type: 'number',
        required: true,
        description: 'Minimum total character width each line should reach.',
      },
      align: {
        type: 'string',
        required: false,
        description: '"left" (default), "right", or "center" — which side to add padding to.',
      },
      pad_char: {
        type: 'string',
        required: false,
        description: 'Single character to use as padding (default: space).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range to align.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the range (inclusive).',
      },
      separator: {
        type: 'string',
        required: false,
        description:
          'The operator/character to align on (default: "="). Common values: ":", "=>", ":".',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the range (inclusive).',
      },
      quote_char: {
        type: 'string',
        required: false,
        description:
          "Quote character to use on both sides when open and close are the same (default: '\"').",
      },
      open_quote: {
        type: 'string',
        required: false,
        description: 'Opening quote/bracket if different from closing (e.g. "[").',
      },
      close_quote: {
        type: 'string',
        required: false,
        description: 'Closing quote/bracket (e.g. "]").',
      },
      escape_existing: {
        type: 'boolean',
        required: false,
        description:
          'Set false to skip escaping existing occurrences of the quote character (default: true).',
      },
      skip_blank_lines: {
        type: 'boolean',
        required: false,
        description: 'Set true to leave blank lines unquoted (default: true).',
      },
    },
  },

  // ── CASE TRANSFORMATION ──────────────────────────────────────────────────────

  {
    name: 'uppercase_lines',
    description:
      'Convert every character in a range of lines to UPPERCASE. Useful for formatting headings, SQL keywords, enum values, or constant declarations.',
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
        description: '1-based first line of the range.',
      },
      end_line: {
        type: 'number',
        required: true,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the range.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the range (inclusive).',
      },
    },
  },

  // ── WHITESPACE & CHARACTER TOOLS ─────────────────────────────────────────────

  {
    name: 'collapse_whitespace',
    description:
      'Reduce every run of consecutive whitespace characters inside each line to a single space. Leading indentation is preserved by default. Operates on the entire file or a specified line range.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: false,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: false,
        description: '1-based last line of the range (default: end of file).',
      },
      preserve_indent: {
        type: 'boolean',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      from_char: {
        type: 'string',
        required: true,
        description: 'The character or short string to find.',
      },
      to_char: {
        type: 'string',
        required: true,
        description: 'The replacement character or string. Use "" to delete all occurrences.',
      },
      start_line: {
        type: 'number',
        required: false,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: false,
        description: '1-based last line of the range (default: end of file).',
      },
    },
  },

  // ── FILE SPLITTING & ROTATING ────────────────────────────────────────────────

  {
    name: 'split_file_at_pattern',
    description:
      'Split a single file into two separate output files at the line matching a pattern. The matching line can be included in part A, part B, or excluded entirely. The source file is not modified.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the source file.',
      },
      pattern: {
        type: 'string',
        required: true,
        description: 'String or regex pattern identifying the split line.',
      },
      output_path_a: {
        type: 'string',
        required: true,
        description: 'Absolute path for the first part (content before the split line).',
      },
      output_path_b: {
        type: 'string',
        required: true,
        description: 'Absolute path for the second part (content after the split line).',
      },
      match_goes_to: {
        type: 'string',
        required: false,
        description:
          'Where the matching line itself goes: "a" (default) → included in part A, "b" → included in part B, "none" → excluded from both.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
      case_sensitive: {
        type: 'boolean',
        required: false,
        description: 'Set true for case-sensitive matching (default: false).',
      },
      occurrence: {
        type: 'number',
        required: false,
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
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: true,
        description: '1-based first line of the block to rotate.',
      },
      end_line: {
        type: 'number',
        required: true,
        description: '1-based last line of the block (inclusive).',
      },
      count: {
        type: 'number',
        required: true,
        description: 'Number of positions to rotate.',
      },
      direction: {
        type: 'string',
        required: false,
        description:
          '"down" (default) — first N lines move to end; "up" — last N lines move to front.',
      },
    },
  },

  // ── METRICS ──────────────────────────────────────────────────────────────────

  {
    name: 'count_lines_in_range',
    description:
      'Count lines in a file or a specific line range, broken down into total, blank, non-blank, word count, and character count. Optionally also counts how many lines in the range match a given pattern. Lighter than get_file_metadata when you just need line statistics for a subsection.',
    category: 'terminal',
    parameters: {
      path: {
        type: 'string',
        required: true,
        description: 'Absolute path to the file.',
      },
      start_line: {
        type: 'number',
        required: false,
        description: '1-based first line of the range (default: 1).',
      },
      end_line: {
        type: 'number',
        required: false,
        description: '1-based last line of the range (default: end of file).',
      },
      pattern: {
        type: 'string',
        required: false,
        description:
          'Optional pattern — if provided, also reports how many lines in the range match.',
      },
      regex: {
        type: 'boolean',
        required: false,
        description: 'Set true to treat pattern as a regex (default: false).',
      },
    },
  },
];
