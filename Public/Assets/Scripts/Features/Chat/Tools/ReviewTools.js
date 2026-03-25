export const REVIEW_TOOLS = [
  {
    name: 'github_get_pr_diff',
    description: 'Get the full unified diff of a GitHub pull request — all changed files with line-by-line diffs. Use this before reviewing to understand exactly what changed.',
    category: 'github_review',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      pr_number: { type: 'number', required: true, description: 'Pull request number' },
    },
  },
  {
    name: 'github_review_pr',
    description: 'Post an AI-generated code review on a GitHub pull request. Can approve, request changes, or leave a neutral comment. Optionally attach inline comments to specific lines.',
    category: 'github_review',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      pr_number: { type: 'number', required: true, description: 'Pull request number' },
      body: { type: 'string', required: true, description: 'The overall review body (markdown supported). Summarise findings, key issues, and praise.' },
      verdict: { type: 'string', required: false, description: '"APPROVE", "REQUEST_CHANGES", or "COMMENT" (default). Only approve if the code is genuinely ready to merge.' },
      inline_comments: {
        type: 'string',
        required: false,
        description: 'JSON array of inline comments: [{"path":"src/foo.js","line":42,"body":"Consider using..."}]. Keep to the most important issues only.',
      },
    },
  },
  {
    name: 'github_get_pr_details',
    description: 'Get details of a pull request: title, description, author, branch, base, mergeable status, labels, and linked issues.',
    category: 'github_review',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      pr_number: { type: 'number', required: true, description: 'Pull request number' },
    },
  },
  {
    name: 'github_get_pr_checks',
    description: 'Get CI/check status for a pull request, including check runs and commit statuses for the latest head SHA.',
    category: 'github_review',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      pr_number: { type: 'number', required: true, description: 'Pull request number' },
    },
  },
  {
    name: 'github_get_pr_comments',
    description: 'Load inline pull-request review comments for a PR so the agent can see prior review feedback and discussion hotspots.',
    category: 'github_review',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      pr_number: { type: 'number', required: true, description: 'Pull request number' },
    },
  },
  {
    name: 'github_get_workflow_runs',
    description: 'List recent GitHub Actions workflow runs for a repository or branch. Useful for CI/CD and deployment debugging.',
    category: 'github_review',
    parameters: {
      owner: { type: 'string', required: true, description: 'GitHub owner / org' },
      repo: { type: 'string', required: true, description: 'Repository name' },
      branch: { type: 'string', required: false, description: 'Optional branch name to filter runs' },
      event: { type: 'string', required: false, description: 'Optional GitHub event filter (push, pull_request, workflow_dispatch, etc.)' },
      per_page: { type: 'number', required: false, description: 'Maximum number of runs to return (default: 20)' },
    },
  },
];
