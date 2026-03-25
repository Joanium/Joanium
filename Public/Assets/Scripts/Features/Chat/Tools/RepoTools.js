export const REPO_TOOLS = [
  {
    name: 'github_load_repo_context',
    description: 'Load an entire GitHub repository into context for deep codebase understanding. Fetches the file tree and the content of the most important source files. Ask questions like "how does auth work?", "where is X handled?", "what does this function do?" across the whole codebase.',
    category: 'github_repo',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      focus_paths: {
        type: 'string',
        required: false,
        description: 'Comma-separated path prefixes to focus on (e.g. "src/auth,src/api"). Loads all matching files. If omitted, auto-selects the most important files.',
      },
      max_files: {
        type: 'number',
        required: false,
        description: 'Maximum number of files to load content for (default: 20, max: 40)',
      },
    },
  },
  {
    name: 'github_search_code',
    description: 'Search for a function, class, variable, or pattern across a GitHub repository. Returns matching file names and line snippets.',
    category: 'github_repo',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      query: { type: 'string', required: true, description: 'Search query (e.g. "function handleAuth", "class UserService", "TODO:"' },
    },
  },
];
