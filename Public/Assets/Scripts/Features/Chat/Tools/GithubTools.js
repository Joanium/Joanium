export const GITHUB_TOOLS = [
  {
    name: 'github_list_repos',
    description: "List the user's GitHub repositories.",
    category: 'github',
    parameters: {},
  },
  {
    name: 'github_get_issues',
    description: 'Get open issues for a GitHub repository.',
    category: 'github',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub username or organization' },
      repo: { type: 'string', required: true, description: 'Repository name' },
    },
  },
  {
    name: 'github_get_pull_requests',
    description: 'Get open pull requests for a GitHub repository.',
    category: 'github',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub username or organization' },
      repo: { type: 'string', required: true, description: 'Repository name' },
    },
  },
  {
    name: 'github_get_file',
    description: 'Load the contents of a specific file from a GitHub repository.',
    category: 'github',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub username or organization' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      filePath: { type: 'string', required: true, description: 'Path to the file within the repo (e.g. "src/index.js")' },
    },
  },
  {
    name: 'github_get_file_tree',
    description: 'Get the full file/folder structure of a GitHub repository.',
    category: 'github',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub username or organization' },
      repo: { type: 'string', required: true, description: 'Repository name' },
    },
  },
  {
    name: 'github_get_notifications',
    description: 'Get unread GitHub notifications for the user.',
    category: 'github',
    parameters: {},
  },
];