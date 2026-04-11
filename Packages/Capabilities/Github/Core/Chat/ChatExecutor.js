import { GithubAPI, parseCommaList, requireGithubCredentials } from '../Shared/Common.js';

const SOURCE_EXTS = new Set([
  'js',
  'ts',
  'jsx',
  'tsx',
  'mjs',
  'cjs',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'cpp',
  'h',
  'hpp',
  'cs',
  'vue',
  'svelte',
  'astro',
  'css',
  'scss',
  'less',
  'html',
  'ejs',
  'hbs',
  'json',
  'yaml',
  'yml',
  'toml',
  'sh',
  'bash',
  'zsh',
  'md',
  'mdx',
  'sql',
  'graphql',
  'gql',
  'env',
  'dockerfile',
  'makefile',
]);

const ALWAYS_LOAD = new Set([
  'package.json',
  'package-lock.json',
  'yarn.lock',
  'README.md',
  'readme.md',
  'Dockerfile',
  'docker-compose.yml',
  'docker-compose.yaml',
  '.env.example',
  'Makefile',
  'Justfile',
  'pyproject.toml',
  'setup.py',
  'requirements.txt',
  'Cargo.toml',
  'go.mod',
  'tsconfig.json',
  'jsconfig.json',
  'vite.config.js',
  'vite.config.ts',
  'webpack.config.js',
  'rollup.config.js',
  '.eslintrc.js',
  '.prettierrc',
]);

const SKIP_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  '.next',
  '.nuxt',
  '__pycache__',
  '.pytest_cache',
  'venv',
  '.venv',
  'env',
  'coverage',
  '.nyc_output',
  '.cache',
  'tmp',
  'temp',
  'vendor',
  'target',
  'bin',
  'obj',
  '.gradle',
]);

const MAX_DIFF_CHARS = 28_000;
const MAX_FILE_CHARS = 8_000;
const MAX_TOTAL_CHARS = 80_000;

function requireRepo(owner, repo) {
  if (!owner || !repo) {
    throw new Error('Missing required params: owner, repo');
  }
}

function requirePullRequest(owner, repo, prNumber) {
  requireRepo(owner, repo);
  if (!prNumber) {
    throw new Error('Missing required params: owner, repo, pr_number');
  }
}

function formatDate(value) {
  if (!value) return 'unknown date';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return String(value);
  }
}

function formatDateTime(value) {
  if (!value) return 'unknown';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function mimeSafeString(value, fallback = 'unknown') {
  return value == null || value === '' ? fallback : String(value);
}

function scoreFile(filePath) {
  const parts = filePath.split('/');
  const filename = parts[parts.length - 1];
  const ext = filename.includes('.')
    ? filename.split('.').pop().toLowerCase()
    : filename.toLowerCase();

  if (parts.some((part) => SKIP_DIRS.has(part))) return -1;

  let score = 0;
  if (ALWAYS_LOAD.has(filename)) score += 100;
  if (SOURCE_EXTS.has(ext)) score += 30;
  else if (!ALWAYS_LOAD.has(filename)) return -1;

  score -= Math.max(0, parts.length - 4) * 2;
  if (/\.(test|spec)\.|__tests__|\/tests?\//.test(filePath)) score -= 10;
  if (/^(index|main|app|server|entry)\.\w+$/.test(filename)) score += 20;
  if (/config|setup|bootstrap|init/.test(filename.toLowerCase())) score += 10;

  return score;
}

function parseInlineComments(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function parseWorkflowInputs(value) {
  if (!value) return {};
  if (typeof value === 'object' && !Array.isArray(value)) return value;

  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function summarizeRepoStats(owner, repo, stats = {}) {
  return [
    `Repository: ${stats.fullName ?? `${owner}/${repo}`}`,
    '',
    `Stars: ${Number(stats.stars ?? 0).toLocaleString()}`,
    `Forks: ${Number(stats.forks ?? 0).toLocaleString()}`,
    `Watchers: ${Number(stats.watchers ?? 0).toLocaleString()}`,
    `Open issues: ${Number(stats.openIssues ?? 0).toLocaleString()}`,
    `Default branch: ${mimeSafeString(stats.defaultBranch)}`,
    stats.language ? `Primary language: ${stats.language}` : '',
    stats.description ? `\n${stats.description}` : '',
    stats.url ? `\nURL: ${stats.url}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function executeGithubChatTool(ctx, toolName, params = {}) {
  const credentials = requireGithubCredentials(ctx);

  switch (toolName) {
    case 'github_list_repos': {
      const repos = await GithubAPI.getRepos(credentials);
      const lines = repos
        .slice(0, 20)
        .map(
          (repo) =>
            `- ${repo.full_name}: ${repo.description || 'No description'} [${repo.language || 'unknown'}] * ${repo.stargazers_count}`,
        )
        .join('\n');
      return `User has ${repos.length} repositories (showing top 20):\n\n${lines}`;
    }

    case 'github_get_issues': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const issues = await GithubAPI.getIssues(credentials, owner, repo, params.state || 'open');
      if (!issues.length) return `No ${params.state || 'open'} issues in ${owner}/${repo}.`;
      return `${issues.length} issue(s) in ${owner}/${repo}:\n\n${issues.map((issue) => `#${issue.number}: ${issue.title} (by ${issue.user?.login || 'unknown'})`).join('\n')}`;
    }

    case 'github_get_pull_requests': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const prs = await GithubAPI.getPullRequests(credentials, owner, repo, params.state || 'open');
      if (!prs.length) return `No ${params.state || 'open'} pull requests in ${owner}/${repo}.`;
      return `${prs.length} pull request(s) in ${owner}/${repo}:\n\n${prs.map((pr) => `#${pr.number}: ${pr.title} (by ${pr.user?.login || 'unknown'})`).join('\n')}`;
    }

    case 'github_get_file': {
      const { owner, repo, filePath } = params;
      if (!owner || !repo || !filePath) {
        throw new Error('Missing required params: owner, repo, filePath');
      }
      const file = await GithubAPI.getFileContent(credentials, owner, repo, filePath);
      const preview =
        file.content.length > 4000
          ? `${file.content.slice(0, 4000)}\n...(truncated)`
          : file.content;
      return `Contents of ${file.path} from ${owner}/${repo}:\n\n\`\`\`\n${preview}\n\`\`\``;
    }

    case 'github_get_file_tree': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const tree = await GithubAPI.getRepoTree(credentials, owner, repo, params.branch || '');
      const blobs = (tree?.tree || []).filter((item) => item.type === 'blob');
      return `File tree of ${owner}/${repo} (${blobs.length} files):\n\n${blobs
        .slice(0, 100)
        .map((item) => item.path)
        .join('\n')}`;
    }

    case 'github_get_notifications': {
      const notifications = await GithubAPI.getNotifications(credentials);
      if (!notifications.length) return 'No unread GitHub notifications.';
      return `${notifications.length} unread notification(s):\n\n${notifications
        .slice(0, 10)
        .map(
          (item, index) => `${index + 1}. ${item.subject?.title} in ${item.repository?.full_name}`,
        )
        .join('\n')}`;
    }

    case 'github_get_commits': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const commits = await GithubAPI.getCommits(credentials, owner, repo);
      if (!commits.length) return `No commits found in ${owner}/${repo}.`;
      return `Recent commits in ${owner}/${repo}:\n\n${commits
        .slice(0, 15)
        .map((commit, index) => {
          const sha = commit.sha?.slice(0, 7) || 'unknown';
          const message = String(commit.commit?.message || '')
            .split('\n')[0]
            .slice(0, 80);
          const author = commit.commit?.author?.name || commit.author?.login || 'unknown';
          const date = commit.commit?.author?.date ? formatDate(commit.commit.author.date) : '';
          return `${index + 1}. \`${sha}\` ${message}\n   by ${author}${date ? ` on ${date}` : ''}`;
        })
        .join('\n\n')}`;
    }

    case 'github_create_issue': {
      const { owner, repo, title, body = '', labels } = params;
      if (!owner || !repo || !title) {
        throw new Error('Missing required params: owner, repo, title');
      }
      const issue = await GithubAPI.createIssue(
        credentials,
        owner,
        repo,
        title,
        body,
        parseCommaList(labels),
      );
      return [
        `Issue created in ${owner}/${repo}`,
        '',
        `#${issue.number}: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    }

    case 'github_close_issue': {
      const { owner, repo, issue_number } = params;
      if (!owner || !repo || !issue_number) {
        throw new Error('Missing required params: owner, repo, issue_number');
      }
      const issue = await GithubAPI.closeIssue(credentials, owner, repo, Number(issue_number));
      return [
        `Issue #${issue_number} closed in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    }

    case 'github_reopen_issue': {
      const { owner, repo, issue_number } = params;
      if (!owner || !repo || !issue_number) {
        throw new Error('Missing required params: owner, repo, issue_number');
      }
      const issue = await GithubAPI.reopenIssue(credentials, owner, repo, Number(issue_number));
      return [
        `Issue #${issue_number} reopened in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    }

    case 'github_comment_on_issue': {
      const { owner, repo, issue_number, body } = params;
      if (!owner || !repo || !issue_number || !body) {
        throw new Error('Missing required params: owner, repo, issue_number, body');
      }
      const comment = await GithubAPI.addIssueComment(
        credentials,
        owner,
        repo,
        Number(issue_number),
        body,
      );
      return [
        `Comment posted on ${owner}/${repo}#${issue_number}`,
        `URL: ${comment?.html_url || `https://github.com/${owner}/${repo}/issues/${issue_number}`}`,
      ].join('\n');
    }

    case 'github_list_branches': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const branches = await GithubAPI.getBranches(credentials, owner, repo);
      if (!branches.length) return `No branches found in ${owner}/${repo}.`;
      return `${branches.length} branch(es) in ${owner}/${repo}:\n\n${branches.map((branch, index) => `${index + 1}. \`${branch.name}\`${branch.commit?.sha ? ` (${branch.commit.sha.slice(0, 7)})` : ''}${branch.protected ? ' [protected]' : ''}`).join('\n')}`;
    }

    case 'github_get_releases': {
      const { owner, repo, count = 5 } = params;
      requireRepo(owner, repo);
      const limit = Math.min(Math.max(1, Number(count) || 5), 20);
      const releases = await GithubAPI.getReleases(credentials, owner, repo, limit);
      if (!releases.length) return `No releases found in ${owner}/${repo}.`;
      return `Releases for ${owner}/${repo}:\n\n${releases
        .map((release, index) => {
          const published = formatDate(release.published_at);
          const tag = release.tag_name || 'untagged';
          const name = release.name || tag;
          const notes = String(release.body || '')
            .split('\n')[0]
            .slice(0, 80);
          return [
            `${index + 1}. ${name} (${tag})${release.prerelease ? ' [pre-release]' : ''} - ${published}`,
            notes ? `   ${notes}` : '',
            `   ${release.html_url}`,
          ]
            .filter(Boolean)
            .join('\n');
        })
        .join('\n\n')}`;
    }

    case 'github_star_repo': {
      const { owner, repo, action = 'star' } = params;
      requireRepo(owner, repo);
      const shouldUnstar = String(action).toLowerCase() === 'unstar';
      if (shouldUnstar) await GithubAPI.unstarRepo(credentials, owner, repo);
      else await GithubAPI.starRepo(credentials, owner, repo);
      return `${shouldUnstar ? 'Unstarred' : 'Starred'} ${owner}/${repo} successfully.`;
    }

    case 'github_create_gist': {
      const { description = '', filename, content, public: isPublic = false } = params;
      if (!filename || !content) throw new Error('Missing required params: filename, content');
      const gist = await GithubAPI.createGist(
        credentials,
        description,
        { [filename]: { content } },
        Boolean(isPublic),
      );
      return [
        `Gist created`,
        '',
        filename,
        `Visibility: ${isPublic ? 'Public' : 'Secret'}`,
        `URL: ${gist?.html_url || 'https://gist.github.com'}`,
      ].join('\n');
    }

    case 'github_mark_notifications_read': {
      await GithubAPI.markAllNotificationsRead(credentials);
      return 'All GitHub notifications marked as read.';
    }

    case 'github_get_repo_stats': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const stats = await GithubAPI.getRepoStats(credentials, owner, repo);
      return summarizeRepoStats(owner, repo, stats);
    }

    case 'github_create_pull_request': {
      const { owner, repo, title, head, base, body = '', draft = false } = params;
      if (!owner || !repo || !title || !head || !base) {
        throw new Error('Missing required params: owner, repo, title, head, base');
      }
      const pr = await GithubAPI.createPR(credentials, owner, repo, {
        title,
        head,
        base,
        body,
        draft: Boolean(draft),
      });
      return [
        `Pull request created in ${owner}/${repo}`,
        '',
        `#${pr.number}: ${pr.title}`,
        `${head} -> ${base}`,
        `Status: ${draft ? 'Draft' : 'Open'}`,
        `URL: ${pr.html_url}`,
      ].join('\n');
    }

    case 'github_merge_pull_request': {
      const { owner, repo, pr_number, merge_method = 'merge', commit_title = '' } = params;
      requirePullRequest(owner, repo, pr_number);
      const result = await GithubAPI.mergePR(
        credentials,
        owner,
        repo,
        Number(pr_number),
        merge_method,
        commit_title,
      );
      return [
        `PR #${pr_number} merged in ${owner}/${repo}`,
        `Strategy: ${merge_method}`,
        result.sha ? `Merge SHA: ${result.sha.slice(0, 7)}` : '',
        result.message ? `Message: ${result.message}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_close_pull_request': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const pr = await GithubAPI.closePR(credentials, owner, repo, Number(pr_number));
      return [
        `PR #${pr_number} closed in ${owner}/${repo}`,
        `Title: ${pr.title}`,
        `URL: ${pr.html_url}`,
      ].join('\n');
    }

    case 'github_add_labels': {
      const { owner, repo, issue_number, labels } = params;
      if (!owner || !repo || !issue_number || !labels) {
        throw new Error('Missing required params: owner, repo, issue_number, labels');
      }
      const parsedLabels = parseCommaList(labels);
      const applied = await GithubAPI.addLabels(
        credentials,
        owner,
        repo,
        Number(issue_number),
        parsedLabels,
      );
      const appliedNames = (applied || []).map((item) => item.name || item).join(', ');
      return [
        `Labels added to ${owner}/${repo}#${issue_number}`,
        `Applied: ${appliedNames || parsedLabels.join(', ')}`,
      ].join('\n');
    }

    case 'github_add_assignees': {
      const { owner, repo, issue_number, assignees } = params;
      if (!owner || !repo || !issue_number || !assignees) {
        throw new Error('Missing required params: owner, repo, issue_number, assignees');
      }
      const parsedAssignees = parseCommaList(assignees);
      await GithubAPI.addAssignees(credentials, owner, repo, Number(issue_number), parsedAssignees);
      return [
        `Assignees added to ${owner}/${repo}#${issue_number}`,
        `Assigned: ${parsedAssignees.map((value) => `@${value}`).join(', ')}`,
      ].join('\n');
    }

    case 'github_trigger_workflow': {
      const { owner, repo, workflow_id, ref = 'main', inputs } = params;
      if (!owner || !repo || !workflow_id) {
        throw new Error('Missing required params: owner, repo, workflow_id');
      }
      const parsedInputs = parseWorkflowInputs(inputs);
      await GithubAPI.triggerWorkflow(credentials, owner, repo, workflow_id, ref, parsedInputs);
      return [
        `Workflow dispatched`,
        `Workflow: ${workflow_id}`,
        `Repo: ${owner}/${repo}`,
        `Ref: ${ref}`,
        Object.keys(parsedInputs).length ? `Inputs: ${JSON.stringify(parsedInputs)}` : '',
        'The run should appear in the Actions tab shortly.',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_latest_workflow_run': {
      const { owner, repo, workflow_id, branch = '' } = params;
      if (!owner || !repo || !workflow_id) {
        throw new Error('Missing required params: owner, repo, workflow_id');
      }
      const run = await GithubAPI.getLatestWorkflowRun(
        credentials,
        owner,
        repo,
        workflow_id,
        branch,
      );
      if (!run) return `No runs found for workflow ${workflow_id} in ${owner}/${repo}.`;
      const conclusion = run.conclusion || 'in progress';
      return [
        `Latest run for ${workflow_id} in ${owner}/${repo}`,
        '',
        `Run #${run.run_number || '?'} - ${run.name || workflow_id}`,
        `Status: ${run.status} / Conclusion: ${conclusion}`,
        `Branch: ${run.head_branch || branch || 'unknown'}`,
        `Started: ${formatDateTime(run.created_at)}`,
        `URL: ${run.html_url || `https://github.com/${owner}/${repo}/actions`}`,
      ].join('\n');
    }

    case 'github_get_latest_release': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const release = await GithubAPI.getLatestRelease(credentials, owner, repo);
      if (!release) return `No releases found for ${owner}/${repo}.`;
      const notes = String(release.body || '')
        .trim()
        .slice(0, 300);
      return [
        `Latest release: ${release.name || release.tag_name} (${release.tag_name})`,
        `Published: ${formatDate(release.published_at)}`,
        `Status: ${release.prerelease ? 'Pre-release' : 'Stable'}`,
        notes
          ? `\nRelease notes:\n${notes}${String(release.body || '').length > 300 ? '\n...(truncated)' : ''}`
          : '',
        `\nURL: ${release.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_notification_count': {
      const notifications = await GithubAPI.getNotifications(credentials);
      if (!notifications.length) return 'No unread GitHub notifications.';
      const countsByRepo = notifications.reduce((result, item) => {
        const repoName = item.repository?.full_name || 'unknown';
        result[repoName] = (result[repoName] || 0) + 1;
        return result;
      }, {});
      const repoLines = Object.entries(countsByRepo)
        .sort((left, right) => right[1] - left[1])
        .slice(0, 10)
        .map(([name, count]) => `- ${name}: ${count}`);
      return [
        `You have ${notifications.length} unread GitHub notification${notifications.length === 1 ? '' : 's'}`,
        '',
        'By repository:',
        ...repoLines,
      ].join('\n');
    }

    case 'github_load_repo_context': {
      const { owner, repo, focus_paths, max_files = 20 } = params;
      requireRepo(owner, repo);

      const limit = Math.min(Number(max_files) || 20, 40);
      const focusList = parseCommaList(focus_paths);
      const tree = await GithubAPI.getRepoTree(credentials, owner, repo, '');
      const allFiles = (tree?.tree || []).filter((item) => item.type === 'blob');

      const candidates = focusList.length
        ? allFiles.filter((item) => focusList.some((prefix) => item.path.startsWith(prefix)))
        : allFiles;

      const selectedFiles = (candidates.length ? candidates : allFiles)
        .map((item) => ({ path: item.path, score: scoreFile(item.path) }))
        .filter((item) => item.score >= 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

      const loaded = [];
      let totalChars = 0;
      for (const file of selectedFiles) {
        const result = await GithubAPI.getFileContent(credentials, owner, repo, file.path).catch(
          () => null,
        );
        if (!result?.content) continue;
        let content = result.content;
        if (content.length > MAX_FILE_CHARS) {
          content = `${content.slice(0, MAX_FILE_CHARS)}\n...(truncated)`;
        }
        if (totalChars + content.length > MAX_TOTAL_CHARS) break;
        loaded.push({ path: file.path, content });
        totalChars += content.length;
      }

      const treeLines = allFiles
        .filter((item) => !SKIP_DIRS.has(item.path.split('/')[0]))
        .slice(0, 300)
        .map((item) => item.path);

      return [
        `# Repository: ${owner}/${repo}`,
        '',
        `## File Tree (${allFiles.length} total files, showing up to 300)`,
        '```',
        treeLines.join('\n'),
        '```',
        '',
        `## Loaded Files (${loaded.length})`,
        '',
        ...loaded.flatMap((file) => [`### ${file.path}`, '```', file.content, '```', '']),
      ].join('\n');
    }

    case 'github_search_code': {
      const { owner, repo, query } = params;
      if (!owner || !repo || !query) {
        throw new Error('Missing required params: owner, repo, query');
      }
      const result = await GithubAPI.searchCode(credentials, query, `${owner}/${repo}`);
      const items = result.items || [];
      if (!items.length) return `No results for ${query} in ${owner}/${repo}.`;
      return [
        `Search results for ${query} in ${owner}/${repo}:`,
        `Found ${result.total_count || items.length} match${items.length === 1 ? '' : 'es'}`,
        '',
        ...items.slice(0, 20).map((item, index) => {
          const snippets = (item.text_matches || [])
            .slice(0, 2)
            .map(
              (match) =>
                `  > ${String(match.fragment || '')
                  .replace(/\n/g, ' ')
                  .slice(0, 120)}`,
            )
            .join('\n');
          return [`${index + 1}. ${item.path}`, snippets].filter(Boolean).join('\n');
        }),
      ].join('\n');
    }

    case 'github_get_pr_diff': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const diff = await GithubAPI.getPRDiff(credentials, owner, repo, Number(pr_number));
      if (!String(diff).trim()) {
        return `PR #${pr_number} in ${owner}/${repo} has no diff.`;
      }
      const truncated =
        diff.length > MAX_DIFF_CHARS
          ? `${diff.slice(0, MAX_DIFF_CHARS)}\n\n...(diff truncated - showing first ${MAX_DIFF_CHARS} chars of ${diff.length} total)`
          : diff;
      return [`Diff for ${owner}/${repo} PR #${pr_number}:`, '', '```diff', truncated, '```'].join(
        '\n',
      );
    }

    case 'github_review_pr': {
      const { owner, repo, pr_number, body, verdict, inline_comments } = params;
      requirePullRequest(owner, repo, pr_number);
      if (!String(body || '').trim()) {
        throw new Error('Missing required param: body');
      }
      const event = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].includes(
        String(verdict || '').toUpperCase(),
      )
        ? String(verdict).toUpperCase()
        : 'COMMENT';
      const review = await GithubAPI.createPRReview(credentials, owner, repo, Number(pr_number), {
        body,
        event,
        comments: parseInlineComments(inline_comments),
      });
      return [
        `Review posted on ${owner}/${repo} PR #${pr_number}`,
        `Verdict: ${event}`,
        `Review ID: ${review?.id || '-'}`,
        `View: ${review?.html_url || `https://github.com/${owner}/${repo}/pull/${pr_number}`}`,
      ].join('\n');
    }

    case 'github_get_pr_details': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const pr = await GithubAPI.getPRDetails(credentials, owner, repo, Number(pr_number));
      return [
        `PR #${pr.number}: ${pr.title}`,
        `Author: @${pr.user?.login || 'unknown'}`,
        `Branch: ${pr.head?.ref || 'unknown'} -> ${pr.base?.ref || 'unknown'}`,
        `State: ${pr.state} | Mergeable: ${pr.mergeable ?? 'unknown'}`,
        `Commits: ${pr.commits} | Changed files: ${pr.changed_files}`,
        `+${pr.additions} -${pr.deletions}`,
        '',
        pr.body
          ? `Description:\n${pr.body.slice(0, 1000)}${pr.body.length > 1000 ? '...' : ''}`
          : '(no description)',
        '',
        `URL: ${pr.html_url}`,
      ].join('\n');
    }

    case 'github_get_pr_checks': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const checks = await GithubAPI.getPRChecks(credentials, owner, repo, Number(pr_number));
      const checkRuns = checks.checkRuns || [];
      const statuses = checks.statuses || [];
      const lines = [
        `Checks for ${owner}/${repo} PR #${pr_number}`,
        `Head SHA: ${checks.sha || 'unknown'}`,
        `Combined status: ${checks.state || 'unknown'}`,
        '',
      ];
      if (checkRuns.length) {
        lines.push('Check runs:');
        lines.push(
          ...checkRuns
            .slice(0, 15)
            .map(
              (run) =>
                `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}`,
            ),
        );
        lines.push('');
      }
      if (statuses.length) {
        lines.push('Commit statuses:');
        lines.push(
          ...statuses
            .slice(0, 15)
            .map(
              (status) =>
                `- ${status.context || 'status'}: ${status.state}${status.description ? ` - ${status.description}` : ''}`,
            ),
        );
      }
      if (!checkRuns.length && !statuses.length) {
        lines.push('No CI checks or commit statuses were returned.');
      }
      return lines.join('\n');
    }

    case 'github_get_pr_comments': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const comments = await GithubAPI.getPRComments(credentials, owner, repo, Number(pr_number));
      if (!comments.length)
        return `No inline review comments found for ${owner}/${repo} PR #${pr_number}.`;
      return [
        `Inline review comments for ${owner}/${repo} PR #${pr_number}:`,
        '',
        ...comments.slice(0, 25).map(
          (comment, index) =>
            `${index + 1}. ${comment.path}:${comment.line || comment.original_line || '?'}\n   ${comment.user?.login ? `@${comment.user.login}` : 'Reviewer'}: ${String(
              comment.body || '',
            )
              .replace(/\s+/g, ' ')
              .trim()}`,
        ),
      ].join('\n');
    }

    case 'github_get_workflow_runs': {
      const { owner, repo, branch = '', event = '', per_page = 20 } = params;
      requireRepo(owner, repo);
      const result = await GithubAPI.getWorkflowRuns(credentials, owner, repo, {
        branch,
        event,
        perPage: Number(per_page) || 20,
      });
      const runs = result.workflow_runs || [];
      if (!runs.length) {
        const filters = [branch ? `branch=${branch}` : '', event ? `event=${event}` : '']
          .filter(Boolean)
          .join(', ');
        return `No workflow runs found for ${owner}/${repo}${filters ? ` (${filters})` : ''}.`;
      }
      return [
        `Workflow runs for ${owner}/${repo} (${result.total_count || runs.length} total):`,
        '',
        ...runs
          .slice(0, 20)
          .map(
            (run) =>
              `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} [${run.event}] (${run.head_branch || 'unknown branch'})`,
          ),
      ].join('\n');
    }

    case 'github_get_readme': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const file = await GithubAPI.getReadme(credentials, owner, repo);
      const preview =
        file.content.length > 6000
          ? `${file.content.slice(0, 6000)}\n...(truncated)`
          : file.content;
      return `README for ${owner}/${repo}:\n\n${preview}`;
    }

    case 'github_get_issue_details': {
      const { owner, repo, issue_number } = params;
      if (!owner || !repo || !issue_number) {
        throw new Error('Missing required params: owner, repo, issue_number');
      }
      const issue = await GithubAPI.getIssueDetails(credentials, owner, repo, Number(issue_number));
      const labelNames = (issue.labels || []).map((l) => l.name).join(', ') || 'none';
      const assigneeNames = (issue.assignees || []).map((a) => `@${a.login}`).join(', ') || 'none';
      return [
        `Issue #${issue.number}: ${issue.title}`,
        `State: ${issue.state}`,
        `Author: @${issue.user?.login || 'unknown'}`,
        `Labels: ${labelNames}`,
        `Assignees: ${assigneeNames}`,
        issue.milestone ? `Milestone: ${issue.milestone.title}` : '',
        `Created: ${formatDate(issue.created_at)} | Updated: ${formatDate(issue.updated_at)}`,
        '',
        issue.body
          ? `Description:\n${issue.body.slice(0, 1500)}${issue.body.length > 1500 ? '\n...(truncated)' : ''}`
          : '(no description)',
        '',
        `URL: ${issue.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_update_issue': {
      const { owner, repo, issue_number, title, body, state, labels, assignees } = params;
      if (!owner || !repo || !issue_number) {
        throw new Error('Missing required params: owner, repo, issue_number');
      }
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (body !== undefined) updates.body = body;
      if (state !== undefined) updates.state = state;
      if (labels !== undefined) updates.labels = parseCommaList(labels);
      if (assignees !== undefined) updates.assignees = parseCommaList(assignees);
      if (!Object.keys(updates).length) {
        throw new Error('At least one field to update must be provided.');
      }
      const issue = await GithubAPI.updateIssue(
        credentials,
        owner,
        repo,
        Number(issue_number),
        updates,
      );
      return [
        `Issue #${issue.number} updated in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `State: ${issue.state}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    }

    case 'github_get_contributors': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const contributors = await GithubAPI.getContributors(credentials, owner, repo);
      if (!contributors.length) return `No contributors found for ${owner}/${repo}.`;
      return [
        `Top contributors for ${owner}/${repo}:`,
        '',
        ...contributors
          .slice(0, 20)
          .map(
            (c, i) =>
              `${i + 1}. @${c.login} — ${c.contributions.toLocaleString()} commit${c.contributions === 1 ? '' : 's'}`,
          ),
      ].join('\n');
    }

    case 'github_get_languages': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const langs = await GithubAPI.getLanguages(credentials, owner, repo);
      const entries = Object.entries(langs);
      if (!entries.length) return `No language data available for ${owner}/${repo}.`;
      const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
      return [
        `Language breakdown for ${owner}/${repo}:`,
        '',
        ...entries
          .sort(([, a], [, b]) => b - a)
          .map(([lang, bytes]) => {
            const pct = ((bytes / total) * 100).toFixed(1);
            return `${lang}: ${pct}%`;
          }),
      ].join('\n');
    }

    case 'github_get_topics': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getTopics(credentials, owner, repo);
      const topics = data.names || [];
      if (!topics.length) return `${owner}/${repo} has no topics set.`;
      return `Topics for ${owner}/${repo}:\n\n${topics.map((t) => `• ${t}`).join('\n')}`;
    }

    case 'github_get_milestones': {
      const { owner, repo, state = 'open' } = params;
      requireRepo(owner, repo);
      const milestones = await GithubAPI.getMilestones(credentials, owner, repo, state);
      if (!milestones.length) return `No ${state} milestones in ${owner}/${repo}.`;
      return [
        `Milestones for ${owner}/${repo} (${state}):`,
        '',
        ...milestones.map((m, i) => {
          const due = m.due_on ? ` | Due: ${formatDate(m.due_on)}` : '';
          const progress =
            m.closed_issues + m.open_issues > 0
              ? ` | ${m.closed_issues}/${m.closed_issues + m.open_issues} closed`
              : '';
          return `${i + 1}. #${m.number} ${m.title}${due}${progress}`;
        }),
      ].join('\n');
    }

    case 'github_create_milestone': {
      const { owner, repo, title, description = '', due_on = '' } = params;
      if (!owner || !repo || !title) {
        throw new Error('Missing required params: owner, repo, title');
      }
      const milestone = await GithubAPI.createMilestone(
        credentials,
        owner,
        repo,
        title,
        description,
        due_on,
      );
      return [
        `Milestone created in ${owner}/${repo}`,
        `#${milestone.number}: ${milestone.title}`,
        milestone.due_on ? `Due: ${formatDate(milestone.due_on)}` : '',
        `URL: ${milestone.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_create_branch': {
      const { owner, repo, branch_name, sha } = params;
      if (!owner || !repo || !branch_name || !sha) {
        throw new Error('Missing required params: owner, repo, branch_name, sha');
      }
      await GithubAPI.createBranch(credentials, owner, repo, branch_name, sha);
      return [
        `Branch created in ${owner}/${repo}`,
        `Name: ${branch_name}`,
        `From SHA: ${sha.slice(0, 7)}`,
      ].join('\n');
    }

    case 'github_delete_branch': {
      const { owner, repo, branch_name } = params;
      if (!owner || !repo || !branch_name) {
        throw new Error('Missing required params: owner, repo, branch_name');
      }
      await GithubAPI.deleteBranch(credentials, owner, repo, branch_name);
      return `Branch "${branch_name}" deleted from ${owner}/${repo}.`;
    }

    case 'github_get_forks': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const forks = await GithubAPI.getForks(credentials, owner, repo);
      if (!forks.length) return `${owner}/${repo} has no forks.`;
      return [
        `Forks of ${owner}/${repo} (${forks.length} shown):`,
        '',
        ...forks
          .slice(0, 20)
          .map(
            (f, i) =>
              `${i + 1}. ${f.full_name} by @${f.owner?.login || 'unknown'} — ★${f.stargazers_count}`,
          ),
      ].join('\n');
    }

    case 'github_get_stargazers': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const stargazers = await GithubAPI.getStargazers(credentials, owner, repo);
      if (!stargazers.length) return `${owner}/${repo} has no stargazers yet.`;
      return [
        `Stargazers for ${owner}/${repo} (showing up to 30):`,
        '',
        ...stargazers.slice(0, 30).map((u, i) => `${i + 1}. @${u.login}`),
      ].join('\n');
    }

    case 'github_get_collaborators': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const collaborators = await GithubAPI.getCollaborators(credentials, owner, repo);
      if (!collaborators.length) return `No collaborators found for ${owner}/${repo}.`;
      return [
        `Collaborators on ${owner}/${repo}:`,
        '',
        ...collaborators.map((c, i) => {
          const role =
            c.role_name || c.permissions?.admin ? 'admin' : c.permissions?.push ? 'write' : 'read';
          return `${i + 1}. @${c.login} (${role})`;
        }),
      ].join('\n');
    }

    case 'github_compare_branches': {
      const { owner, repo, base, head } = params;
      if (!owner || !repo || !base || !head) {
        throw new Error('Missing required params: owner, repo, base, head');
      }
      const cmp = await GithubAPI.compareBranches(credentials, owner, repo, base, head);
      const files = (cmp.files || []).slice(0, 20);
      return [
        `Comparing ${base}...${head} in ${owner}/${repo}`,
        `Status: ${cmp.status}`,
        `Ahead by ${cmp.ahead_by} commit(s) | Behind by ${cmp.behind_by} commit(s)`,
        `Total commits: ${cmp.total_commits}`,
        '',
        files.length
          ? `Changed files (${cmp.files?.length ?? 0} total, showing ${files.length}):`
          : '',
        ...files.map(
          (f) => `  ${f.status.padEnd(8)} ${f.filename}  (+${f.additions} -${f.deletions})`,
        ),
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_gists': {
      const gists = await GithubAPI.getGists(credentials);
      if (!gists.length) return 'No gists found.';
      return [
        `Your Gists (${gists.length} shown):`,
        '',
        ...gists.slice(0, 20).map((g, i) => {
          const files = Object.keys(g.files).join(', ');
          const visibility = g.public ? 'public' : 'secret';
          return `${i + 1}. [${visibility}] ${g.description || files} — ${formatDate(g.updated_at)}\n   ${g.html_url}`;
        }),
      ].join('\n');
    }

    case 'github_get_traffic_views': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const traffic = await GithubAPI.getTrafficViews(credentials, owner, repo);
      const recent = (traffic.views || []).slice(-7);
      return [
        `Traffic views for ${owner}/${repo} (last 14 days):`,
        `Total views: ${traffic.count?.toLocaleString() ?? 0} | Unique visitors: ${traffic.uniques?.toLocaleString() ?? 0}`,
        '',
        recent.length ? 'Daily breakdown (last 7 days):' : '',
        ...recent.map((v) => `  ${formatDate(v.timestamp)}: ${v.count} views, ${v.uniques} unique`),
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_request_reviewers': {
      const { owner, repo, pr_number, reviewers = '', team_reviewers = '' } = params;
      requirePullRequest(owner, repo, pr_number);
      const parsedReviewers = parseCommaList(reviewers);
      const parsedTeamReviewers = parseCommaList(team_reviewers);
      if (!parsedReviewers.length && !parsedTeamReviewers.length) {
        throw new Error('At least one reviewer or team_reviewer is required.');
      }
      await GithubAPI.requestReviewers(
        credentials,
        owner,
        repo,
        Number(pr_number),
        parsedReviewers,
        parsedTeamReviewers,
      );
      const who = [
        ...parsedReviewers.map((r) => `@${r}`),
        ...parsedTeamReviewers.map((t) => `team:${t}`),
      ].join(', ');
      return `Reviewers requested on ${owner}/${repo} PR #${pr_number}: ${who}`;
    }

    case 'github_get_pr_files': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const files = await GithubAPI.getPRFiles(credentials, owner, repo, Number(pr_number));
      if (!files.length) return `PR #${pr_number} in ${owner}/${repo} has no file changes.`;
      const additions = files.reduce((s, f) => s + f.additions, 0);
      const deletions = files.reduce((s, f) => s + f.deletions, 0);
      return [
        `Files changed in ${owner}/${repo} PR #${pr_number} (${files.length} files, +${additions} -${deletions}):`,
        '',
        ...files
          .slice(0, 50)
          .map((f) => `  ${f.status.padEnd(8)} ${f.filename}  (+${f.additions} -${f.deletions})`),
        files.length > 50 ? `  ...and ${files.length - 50} more` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_list_pr_reviews': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const reviews = await GithubAPI.listPRReviews(credentials, owner, repo, Number(pr_number));
      if (!reviews.length) return `No reviews found for ${owner}/${repo} PR #${pr_number}.`;
      return [
        `Reviews on ${owner}/${repo} PR #${pr_number}:`,
        '',
        ...reviews.map((r, i) => {
          const verdict = r.state || 'COMMENTED';
          const body = String(r.body || '')
            .trim()
            .slice(0, 200);
          return [
            `${i + 1}. @${r.user?.login || 'unknown'} — ${verdict} (${formatDate(r.submitted_at)})`,
            body ? `   ${body}${r.body?.length > 200 ? '...' : ''}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        }),
      ].join('\n');
    }

    case 'github_get_user_info': {
      const { username } = params;
      if (!username) throw new Error('Missing required param: username');
      const user = await GithubAPI.getUserInfo(credentials, username);
      return [
        `GitHub User: @${user.login}`,
        user.name ? `Name: ${user.name}` : '',
        user.bio ? `Bio: ${user.bio}` : '',
        user.company ? `Company: ${user.company}` : '',
        user.location ? `Location: ${user.location}` : '',
        user.blog ? `Website: ${user.blog}` : '',
        `Public repos: ${user.public_repos} | Followers: ${user.followers} | Following: ${user.following}`,
        `Member since: ${formatDate(user.created_at)}`,
        `URL: ${user.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_search_repos': {
      const { query, count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GithubAPI.searchRepos(
        credentials,
        query,
        Math.min(Number(count) || 20, 50),
      );
      const items = result.items || [];
      if (!items.length) return `No repositories found for "${query}".`;
      return [
        `Repository search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
        '',
        ...items
          .slice(0, 20)
          .map(
            (repo, i) =>
              `${i + 1}. ${repo.full_name} ★${repo.stargazers_count} [${repo.language || 'unknown'}]\n   ${repo.description || 'No description'}\n   ${repo.html_url}`,
          ),
      ].join('\n');
    }

    case 'github_search_issues': {
      const { query, count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GithubAPI.searchIssues(
        credentials,
        query,
        Math.min(Number(count) || 20, 50),
      );
      const items = result.items || [];
      if (!items.length) return `No issues or PRs found for "${query}".`;
      return [
        `Issue search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
        '',
        ...items.slice(0, 20).map((issue, i) => {
          const type = issue.pull_request ? 'PR' : 'Issue';
          const repo =
            issue.repository_url?.replace('https://api.github.com/repos/', '') ?? 'unknown';
          return `${i + 1}. [${type}] #${issue.number} ${issue.title}\n   ${repo} — ${issue.state} — by @${issue.user?.login ?? 'unknown'}\n   ${issue.html_url}`;
        }),
      ].join('\n');
    }

    case 'github_get_issue_comments': {
      const { owner, repo, issue_number, count = 30 } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const comments = await GithubAPI.getIssueComments(
        credentials,
        owner,
        repo,
        Number(issue_number),
        Math.min(Number(count) || 30, 100),
      );
      if (!comments.length) return `No comments on ${owner}/${repo}#${issue_number}.`;
      return [
        `Comments on ${owner}/${repo}#${issue_number} (${comments.length} shown):`,
        '',
        ...comments.map((c, i) => {
          const body = String(c.body || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 300);
          return `${i + 1}. @${c.user?.login ?? 'unknown'} — ${formatDate(c.created_at)}\n   ${body}${(c.body?.length ?? 0) > 300 ? '...' : ''}`;
        }),
      ].join('\n');
    }

    case 'github_get_commit_details': {
      const { owner, repo, sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const commit = await GithubAPI.getCommitDetails(credentials, owner, repo, sha);
      const files = (commit.files || []).slice(0, 20);
      return [
        `Commit ${commit.sha?.slice(0, 7) ?? sha} in ${owner}/${repo}`,
        `Author: ${commit.commit?.author?.name ?? 'unknown'} <${commit.commit?.author?.email ?? ''}>`,
        `Date: ${formatDateTime(commit.commit?.author?.date)}`,
        '',
        `Message:\n${commit.commit?.message ?? ''}`,
        '',
        `Stats: +${commit.stats?.additions ?? 0} -${commit.stats?.deletions ?? 0} in ${commit.stats?.total ?? 0} change(s) across ${commit.files?.length ?? 0} file(s)`,
        files.length
          ? `\nFiles changed:\n${files.map((f) => `  ${f.status.padEnd(8)} ${f.filename}  (+${f.additions} -${f.deletions})`).join('\n')}`
          : '',
        commit.html_url ? `\nURL: ${commit.html_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_tags': {
      const { owner, repo, count = 20 } = params;
      requireRepo(owner, repo);
      const tags = await GithubAPI.getTags(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 20, 100),
      );
      if (!tags.length) return `No tags found in ${owner}/${repo}.`;
      return [
        `Tags for ${owner}/${repo} (${tags.length} shown):`,
        '',
        ...tags.map((tag, i) => `${i + 1}. ${tag.name}  ${tag.commit?.sha?.slice(0, 7) ?? ''}`),
      ].join('\n');
    }

    case 'github_create_release': {
      const {
        owner,
        repo,
        tag_name,
        name = '',
        body = '',
        draft = false,
        prerelease = false,
        target_commitish = '',
      } = params;
      if (!owner || !repo || !tag_name)
        throw new Error('Missing required params: owner, repo, tag_name');
      const release = await GithubAPI.createRelease(credentials, owner, repo, {
        tagName: tag_name,
        name,
        body,
        draft: Boolean(draft),
        prerelease: Boolean(prerelease),
        targetCommitish: target_commitish,
      });
      return [
        `Release created in ${owner}/${repo}`,
        `Tag: ${release.tag_name}`,
        `Name: ${release.name || release.tag_name}`,
        `Status: ${release.draft ? 'Draft' : release.prerelease ? 'Pre-release' : 'Published'}`,
        `URL: ${release.html_url}`,
      ].join('\n');
    }

    case 'github_fork_repo': {
      const { owner, repo, organization = '' } = params;
      requireRepo(owner, repo);
      const fork = await GithubAPI.forkRepo(credentials, owner, repo, organization);
      return [
        `Fork created from ${owner}/${repo}`,
        `Fork: ${fork.full_name}`,
        `URL: ${fork.html_url}`,
        `(GitHub forks asynchronously — the repo may take a few seconds to be ready.)`,
      ].join('\n');
    }

    case 'github_update_pull_request': {
      const { owner, repo, pr_number, title, body, state, base } = params;
      requirePullRequest(owner, repo, pr_number);
      const updates = {};
      if (title !== undefined) updates.title = title;
      if (body !== undefined) updates.body = body;
      if (state !== undefined) updates.state = state;
      if (base !== undefined) updates.base = base;
      if (!Object.keys(updates).length)
        throw new Error('At least one field to update must be provided.');
      const pr = await GithubAPI.updatePullRequest(
        credentials,
        owner,
        repo,
        Number(pr_number),
        updates,
      );
      return [
        `PR #${pr.number} updated in ${owner}/${repo}`,
        `Title: ${pr.title}`,
        `State: ${pr.state}`,
        `Branch: ${pr.head?.ref} -> ${pr.base?.ref}`,
        `URL: ${pr.html_url}`,
      ].join('\n');
    }

    case 'github_get_labels': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const labels = await GithubAPI.getLabels(credentials, owner, repo);
      if (!labels.length) return `No labels found in ${owner}/${repo}.`;
      return [
        `Labels in ${owner}/${repo} (${labels.length}):`,
        '',
        ...labels.map(
          (l, i) => `${i + 1}. #${l.color}  ${l.name}${l.description ? ` — ${l.description}` : ''}`,
        ),
      ].join('\n');
    }

    case 'github_create_label': {
      const { owner, repo, name, color, description = '' } = params;
      if (!owner || !repo || !name || !color)
        throw new Error('Missing required params: owner, repo, name, color');
      const label = await GithubAPI.createLabel(credentials, owner, repo, name, color, description);
      return [
        `Label created in ${owner}/${repo}`,
        `Name: ${label.name}`,
        `Color: #${label.color}`,
        label.description ? `Description: ${label.description}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_delete_label': {
      const { owner, repo, name } = params;
      if (!owner || !repo || !name) throw new Error('Missing required params: owner, repo, name');
      await GithubAPI.deleteLabel(credentials, owner, repo, name);
      return `Label "${name}" deleted from ${owner}/${repo}.`;
    }

    case 'github_search_users': {
      const { query, count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GithubAPI.searchUsers(
        credentials,
        query,
        Math.min(Number(count) || 20, 50),
      );
      const items = result.items || [];
      if (!items.length) return `No users found for "${query}".`;
      return [
        `User search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
        '',
        ...items.slice(0, 20).map((u, i) => `${i + 1}. @${u.login} [${u.type}]  ${u.html_url}`),
      ].join('\n');
    }

    case 'github_get_user_starred': {
      const { username, count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const repos = await GithubAPI.getUserStarred(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      if (!repos.length)
        return `@${username} has not starred any repositories (or the list is private).`;
      return [
        `Repositories starred by @${username} (${repos.length} shown):`,
        '',
        ...repos
          .slice(0, 30)
          .map(
            (r, i) =>
              `${i + 1}. ${r.full_name} ★${r.stargazers_count} [${r.language || 'unknown'}]${r.description ? `\n   ${r.description}` : ''}`,
          ),
      ].join('\n');
    }

    case 'github_get_file_commits': {
      const { owner, repo, file_path, count = 15 } = params;
      if (!owner || !repo || !file_path)
        throw new Error('Missing required params: owner, repo, file_path');
      const commits = await GithubAPI.getFileCommits(
        credentials,
        owner,
        repo,
        file_path,
        Math.min(Number(count) || 15, 50),
      );
      if (!commits.length) return `No commits found for "${file_path}" in ${owner}/${repo}.`;
      return [
        `Commits touching ${file_path} in ${owner}/${repo} (${commits.length} shown):`,
        '',
        ...commits.map((c, i) => {
          const sha = c.sha?.slice(0, 7) ?? '?';
          const msg = String(c.commit?.message ?? '')
            .split('\n')[0]
            .slice(0, 80);
          const author = c.commit?.author?.name ?? c.author?.login ?? 'unknown';
          const date = formatDate(c.commit?.author?.date);
          return `${i + 1}. \`${sha}\` ${msg}\n   by ${author} on ${date}`;
        }),
      ].join('\n');
    }

    case 'github_lock_issue': {
      const { owner, repo, issue_number, lock_reason = '' } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const validReasons = ['off-topic', 'too heated', 'resolved', 'spam'];
      const reason = validReasons.includes(lock_reason) ? lock_reason : '';
      await GithubAPI.lockIssue(credentials, owner, repo, Number(issue_number), reason);
      return `Issue/PR #${issue_number} in ${owner}/${repo} has been locked${reason ? ` (reason: ${reason})` : ''}.`;
    }

    case 'github_unlock_issue': {
      const { owner, repo, issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      await GithubAPI.unlockIssue(credentials, owner, repo, Number(issue_number));
      return `Issue/PR #${issue_number} in ${owner}/${repo} has been unlocked.`;
    }

    case 'github_get_deployments': {
      const { owner, repo, count = 20 } = params;
      requireRepo(owner, repo);
      const deployments = await GithubAPI.getDeployments(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 20, 100),
      );
      if (!deployments.length) return `No deployments found for ${owner}/${repo}.`;
      return [
        `Deployments for ${owner}/${repo} (${deployments.length} shown):`,
        '',
        ...deployments
          .slice(0, 20)
          .map(
            (d, i) =>
              `${i + 1}. #${d.id}  env: ${d.environment}  ref: ${d.ref}  by @${d.creator?.login ?? 'unknown'}  ${formatDate(d.created_at)}`,
          ),
      ].join('\n');
    }

    case 'github_get_repo_permissions': {
      const { owner, repo, username } = params;
      if (!owner || !repo || !username)
        throw new Error('Missing required params: owner, repo, username');
      const result = await GithubAPI.getRepoPermissions(credentials, owner, repo, username);
      const perms = result.permission ?? 'none';
      const details = result.user
        ? [
            `Name: ${result.user.name || result.user.login}`,
            `Email: ${result.user.email || 'private'}`,
          ]
        : [];
      return [
        `Permissions for @${username} in ${owner}/${repo}`,
        `Role: ${perms}`,
        ...details,
      ].join('\n');
    }

    case 'github_remove_labels': {
      const { owner, repo, issue_number, labels } = params;
      if (!owner || !repo || !issue_number || !labels) {
        throw new Error('Missing required params: owner, repo, issue_number, labels');
      }
      // Fetch current labels, subtract the ones to remove, then PUT the remainder
      const issue = await GithubAPI.getIssueDetails(credentials, owner, repo, Number(issue_number));
      const toRemove = new Set(parseCommaList(labels).map((l) => l.toLowerCase()));
      const remaining = (issue.labels || [])
        .map((l) => l.name)
        .filter((n) => !toRemove.has(n.toLowerCase()));
      const applied = await GithubAPI.removeLabels(
        credentials,
        owner,
        repo,
        Number(issue_number),
        remaining,
      );
      const keptNames = (applied || []).map((l) => l.name).join(', ') || 'none';
      return [
        `Labels updated on ${owner}/${repo}#${issue_number}`,
        `Removed: ${parseCommaList(labels).join(', ')}`,
        `Remaining: ${keptNames}`,
      ].join('\n');
    }

    case 'github_get_pr_requested_reviewers': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const result = await GithubAPI.getPRRequestedReviewers(
        credentials,
        owner,
        repo,
        Number(pr_number),
      );
      const users = (result.users || []).map((u) => `@${u.login}`);
      const teams = (result.teams || []).map((t) => `team:${t.slug}`);
      const all = [...users, ...teams];
      if (!all.length) return `No pending review requests on ${owner}/${repo} PR #${pr_number}.`;
      return [
        `Requested reviewers for ${owner}/${repo} PR #${pr_number}:`,
        '',
        ...all.map((r, i) => `${i + 1}. ${r}`),
      ].join('\n');
    }

    case 'github_get_repo_info': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const r = await GithubAPI.getRepoInfo(credentials, owner, repo);
      return [
        `Repository: ${r.full_name}`,
        r.description ? `Description: ${r.description}` : '',
        `Stars: ${r.stargazers_count} | Forks: ${r.forks_count} | Watchers: ${r.watchers_count}`,
        `Open issues: ${r.open_issues_count} | Default branch: ${r.default_branch}`,
        `Language: ${r.language ?? 'unknown'}`,
        `Visibility: ${r.visibility} | Fork: ${r.fork}`,
        `Created: ${formatDate(r.created_at)} | Updated: ${formatDate(r.updated_at)}`,
        `License: ${r.license?.name ?? 'none'}`,
        `URL: ${r.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_org_repos': {
      const { org, count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const repos = await GithubAPI.getOrgRepos(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      if (!repos.length) return `No repositories found for org "${org}".`;
      return [
        `Repositories for ${org} (${repos.length} shown):`,
        '',
        ...repos.map(
          (r, i) =>
            `${i + 1}. ${r.name} [${r.language ?? 'unknown'}] ★${r.stargazers_count}${r.description ? ` — ${r.description}` : ''}`,
        ),
      ].join('\n');
    }

    case 'github_watch_repo': {
      const { owner, repo, action = 'watch' } = params;
      requireRepo(owner, repo);
      const unwatch = String(action).toLowerCase() === 'unwatch';
      await GithubAPI.watchRepo(credentials, owner, repo, !unwatch);
      return `${unwatch ? 'Unwatched' : 'Now watching'} ${owner}/${repo}.`;
    }

    case 'github_get_user_events': {
      const { username, count = 20 } = params;
      if (!username) throw new Error('Missing required param: username');
      const events = await GithubAPI.getUserEvents(
        credentials,
        username,
        Math.min(Number(count) || 20, 100),
      );
      if (!events.length) return `No public events found for @${username}.`;
      return [
        `Recent public events for @${username} (${events.length} shown):`,
        '',
        ...events.slice(0, 20).map((e, i) => {
          const repo = e.repo?.name ?? 'unknown';
          const date = formatDate(e.created_at);
          return `${i + 1}. [${e.type}] ${repo} — ${date}`;
        }),
      ].join('\n');
    }

    case 'github_get_repo_environments': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getRepoEnvironments(credentials, owner, repo);
      const envs = data.environments ?? [];
      if (!envs.length) return `No deployment environments found for ${owner}/${repo}.`;
      return [
        `Environments for ${owner}/${repo} (${envs.length}):`,
        '',
        ...envs.map((e, i) => {
          const updated = formatDate(e.updated_at);
          const protections = e.protection_rules?.map((r) => r.type).join(', ') || 'none';
          return `${i + 1}. ${e.name} — updated ${updated} | protection: ${protections}`;
        }),
      ].join('\n');
    }

    case 'github_list_actions_secrets': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.listActionsSecrets(credentials, owner, repo);
      const secrets = data.secrets ?? [];
      if (!secrets.length) return `No Actions secrets found in ${owner}/${repo}.`;
      return [
        `Actions secrets in ${owner}/${repo} (${secrets.length}) — names only, values are never exposed:`,
        '',
        ...secrets.map((s, i) => `${i + 1}. ${s.name} — updated ${formatDate(s.updated_at)}`),
      ].join('\n');
    }

    case 'github_get_dependabot_alerts': {
      const { owner, repo, state = 'open' } = params;
      requireRepo(owner, repo);
      const alerts = await GithubAPI.getDependabotAlerts(credentials, owner, repo, state);
      if (!alerts.length) return `No ${state} Dependabot alerts in ${owner}/${repo}.`;
      return [
        `Dependabot alerts for ${owner}/${repo} (${alerts.length} ${state}):`,
        '',
        ...alerts.slice(0, 20).map((a, i) => {
          const pkg = a.dependency?.package?.name ?? 'unknown';
          const severity = a.security_advisory?.severity ?? 'unknown';
          const summary = a.security_advisory?.summary ?? '';
          return `${i + 1}. [${severity.toUpperCase()}] ${pkg} — ${summary}`;
        }),
      ].join('\n');
    }

    case 'github_get_commits_since': {
      const { owner, repo, since, until = '', count = 20 } = params;
      requireRepo(owner, repo);
      if (!since)
        throw new Error('Missing required param: since (ISO 8601 date, e.g. 2024-01-01T00:00:00Z)');
      const commits = await GithubAPI.getCommitsSince(
        credentials,
        owner,
        repo,
        since,
        until,
        Math.min(Number(count) || 20, 100),
      );
      if (!commits.length) return `No commits found in ${owner}/${repo} since ${since}.`;
      return [
        `Commits in ${owner}/${repo} since ${since}${until ? ` until ${until}` : ''} (${commits.length} shown):`,
        '',
        ...commits.map((c, i) => {
          const sha = c.sha?.slice(0, 7) ?? '?';
          const msg = String(c.commit?.message ?? '')
            .split('\n')[0]
            .slice(0, 80);
          const author = c.commit?.author?.name ?? c.author?.login ?? 'unknown';
          const date = formatDate(c.commit?.author?.date);
          return `${i + 1}. \`${sha}\` ${msg}\n   by ${author} on ${date}`;
        }),
      ].join('\n');
    }

    case 'github_get_branch_protection': {
      const { owner, repo, branch } = params;
      if (!owner || !repo || !branch)
        throw new Error('Missing required params: owner, repo, branch');
      const p = await GithubAPI.getBranchProtection(credentials, owner, repo, branch);
      const lines = [`Branch protection for ${owner}/${repo}:${branch}`, ''];
      if (p.required_status_checks) {
        lines.push(
          `Required status checks: ${p.required_status_checks.contexts?.join(', ') || 'none (strict)'}`,
        );
      }
      if (p.required_pull_request_reviews) {
        const r = p.required_pull_request_reviews;
        lines.push(`PR reviews required: ${r.required_approving_review_count ?? 1} approver(s)`);
        if (r.dismiss_stale_reviews) lines.push('Stale reviews dismissed on push');
        if (r.require_code_owner_reviews) lines.push('Code owner review required');
      }
      lines.push(`Force push allowed: ${!p.allow_force_pushes?.enabled}`);
      lines.push(`Deletions allowed: ${!p.allow_deletions?.enabled}`);
      if (p.enforce_admins?.enabled) lines.push('Rules enforced on admins');
      return lines.join('\n');
    }

    case 'github_get_user_orgs': {
      const { username } = params;
      if (!username) throw new Error('Missing required param: username');
      const orgs = await GithubAPI.getUserOrgs(credentials, username);
      if (!orgs.length) return `@${username} is not a member of any public organizations.`;
      return [
        `Organizations for @${username} (${orgs.length}):`,
        '',
        ...orgs.map((o, i) => `${i + 1}. ${o.login}${o.description ? ` — ${o.description}` : ''}`),
      ].join('\n');
    }

    case 'github_get_traffic_clones': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getTrafficClones(credentials, owner, repo);
      const recent = (data.clones ?? []).slice(-7);
      return [
        `Clone traffic for ${owner}/${repo} (last 14 days):`,
        `Total clones: ${data.count ?? 0} | Unique cloners: ${data.uniques ?? 0}`,
        '',
        recent.length ? 'Daily breakdown (last 7 days):' : '',
        ...recent.map(
          (c) => `  ${formatDate(c.timestamp)}: ${c.count} clones, ${c.uniques} unique`,
        ),
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_community_profile': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getCommunityProfile(credentials, owner, repo);
      const files = data.files ?? {};
      const checks = [
        ['README', !!files.readme],
        ['License', !!files.license],
        ['Code of conduct', !!files.code_of_conduct],
        ['Contributing', !!files.contributing],
        ['Issue template', !!files.issue_template],
        ['PR template', !!files.pull_request_template],
      ];
      return [
        `Community profile for ${owner}/${repo}`,
        `Health score: ${data.health_percentage ?? 'n/a'}%`,
        '',
        ...checks.map(([name, present]) => `${present ? '✓' : '✗'} ${name}`),
        data.description ? `\nDescription: ${data.description}` : '',
        data.documentation ? `Docs: ${data.documentation}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_repo_webhooks': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const hooks = await GithubAPI.getRepoWebhooks(credentials, owner, repo);
      if (!hooks.length) return `No webhooks configured for ${owner}/${repo}.`;
      return [
        `Webhooks for ${owner}/${repo} (${hooks.length}):`,
        '',
        ...hooks.map((h, i) => {
          const events = (h.events ?? []).join(', ') || 'none';
          const active = h.active ? 'active' : 'inactive';
          return `${i + 1}. ${h.config?.url ?? 'no url'} [${active}]\n   Events: ${events}`;
        }),
      ].join('\n');
    }

    case 'github_get_org_members': {
      const { org, count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const members = await GithubAPI.getOrgMembers(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      if (!members.length) return `No public members found for org "${org}".`;
      return [
        `Members of ${org} (${members.length} shown):`,
        '',
        ...members.map((m, i) => `${i + 1}. @${m.login} — ${m.html_url}`),
      ].join('\n');
    }

    case 'github_list_org_teams': {
      const { org, count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const teams = await GithubAPI.listOrgTeams(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      if (!teams.length) return `No teams found in org "${org}".`;
      return [
        `Teams in ${org} (${teams.length}):`,
        '',
        ...teams.map(
          (t, i) =>
            `${i + 1}. ${t.name} (${t.slug}) — ${t.members_count ?? '?'} members, ${t.repos_count ?? '?'} repos${t.description ? `\n   ${t.description}` : ''}`,
        ),
      ].join('\n');
    }

    case 'github_get_team_members': {
      const { org, team_slug, count = 30 } = params;
      if (!org || !team_slug) throw new Error('Missing required params: org, team_slug');
      const members = await GithubAPI.getTeamMembers(
        credentials,
        org,
        team_slug,
        Math.min(Number(count) || 30, 100),
      );
      if (!members.length) return `No members found in team "${team_slug}" of org "${org}".`;
      return [
        `Members of ${org}/${team_slug} (${members.length}):`,
        '',
        ...members.map((m, i) => `${i + 1}. @${m.login}`),
      ].join('\n');
    }

    case 'github_get_issue_reactions': {
      const { owner, repo, issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const reactions = await GithubAPI.getIssueReactions(
        credentials,
        owner,
        repo,
        Number(issue_number),
      );
      if (!reactions.length) return `No reactions on ${owner}/${repo}#${issue_number}.`;
      const counts = reactions.reduce((acc, r) => {
        acc[r.content] = (acc[r.content] ?? 0) + 1;
        return acc;
      }, {});
      const emojiMap = {
        '+1': '👍',
        '-1': '👎',
        laugh: '😄',
        hooray: '🎉',
        confused: '😕',
        heart: '❤️',
        rocket: '🚀',
        eyes: '👀',
      };
      return [
        `Reactions on ${owner}/${repo}#${issue_number} (${reactions.length} total):`,
        '',
        ...Object.entries(counts).map(([k, v]) => `${emojiMap[k] ?? k}  ${v}`),
      ].join('\n');
    }

    case 'github_get_repo_license': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getRepoLicense(credentials, owner, repo);
      const license = data.license ?? {};
      const preview = data.content
        ? Buffer.from(data.content.replace(/\n/g, ''), 'base64').toString('utf-8').slice(0, 500)
        : '';
      return [
        `License for ${owner}/${repo}`,
        `Name: ${license.name ?? 'unknown'}`,
        `SPDX ID: ${license.spdx_id ?? 'n/a'}`,
        license.url ? `Info: ${license.url}` : '',
        preview ? `\nPreview:\n${preview}${preview.length === 500 ? '...(truncated)' : ''}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_code_frequency': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const weeks = await GithubAPI.getCodeFrequency(credentials, owner, repo);
      if (!weeks?.length)
        return `No code frequency data available for ${owner}/${repo} yet. GitHub may still be computing it.`;
      const recent = weeks.slice(-8);
      return [
        `Code frequency for ${owner}/${repo} (last ${recent.length} weeks):`,
        `Format: week — additions / deletions`,
        '',
        ...recent.map(
          ([ts, additions, deletions]) =>
            `  ${formatDate(new Date(ts * 1000))}  +${additions} / ${deletions}`,
        ),
      ].join('\n');
    }

    case 'github_get_contributor_stats': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const stats = await GithubAPI.getContributorStats(credentials, owner, repo);
      if (!stats?.length)
        return `No contributor stats available for ${owner}/${repo} yet. GitHub may still be computing it.`;
      const sorted = [...stats].sort((a, b) => b.total - a.total);
      return [
        `Contributor stats for ${owner}/${repo} (${sorted.length} contributors):`,
        '',
        ...sorted.slice(0, 15).map((c, i) => {
          const additions = c.weeks?.reduce((s, w) => s + w.a, 0) ?? 0;
          const deletions = c.weeks?.reduce((s, w) => s + w.d, 0) ?? 0;
          return `${i + 1}. @${c.author?.login ?? 'unknown'} — ${c.total} commits  +${additions} -${deletions}`;
        }),
      ].join('\n');
    }

    case 'github_get_commit_activity': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const weeks = await GithubAPI.getCommitActivity(credentials, owner, repo);
      if (!weeks?.length)
        return `No commit activity data yet for ${owner}/${repo}. GitHub may still be computing it.`;
      const recent = weeks.slice(-8);
      const total = recent.reduce((s, w) => s + w.total, 0);
      return [
        `Commit activity for ${owner}/${repo} (last ${recent.length} weeks, ${total} commits):`,
        '',
        ...recent.map((w) => {
          const bar = '█'.repeat(Math.min(w.total, 20));
          return `  ${formatDate(new Date(w.week * 1000))}  ${String(w.total).padStart(3)} ${bar}`;
        }),
      ].join('\n');
    }

    case 'github_get_punch_card': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getPunchCard(credentials, owner, repo);
      if (!data?.length) return `No punch card data available for ${owner}/${repo}.`;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      // Find peak
      const peak = [...data].sort((a, b) => b[2] - a[2])[0];
      // Aggregate by day
      const byDay = days.map((name, d) => {
        const total = data.filter(([day]) => day === d).reduce((s, [, , c]) => s + c, 0);
        return `  ${name}: ${total} commits`;
      });
      return [
        `Commit punch card for ${owner}/${repo}:`,
        `Peak time: ${days[peak[0]]} at ${peak[1]}:00 (${peak[2]} commits)`,
        '',
        'Commits by day of week:',
        ...byDay,
      ].join('\n');
    }

    case 'github_get_repo_subscription': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getRepoSubscription(credentials, owner, repo);
      return [
        `Subscription status for ${owner}/${repo}:`,
        `Subscribed: ${data.subscribed ?? false}`,
        `Ignored: ${data.ignored ?? false}`,
        `Reason: ${data.reason ?? 'n/a'}`,
        data.created_at ? `Since: ${formatDate(data.created_at)}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_user_followers': {
      const { username, count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const followers = await GithubAPI.getUserFollowers(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      if (!followers.length) return `@${username} has no public followers.`;
      return [
        `Followers of @${username} (${followers.length} shown):`,
        '',
        ...followers.map((u, i) => `${i + 1}. @${u.login}`),
      ].join('\n');
    }

    case 'github_get_user_following': {
      const { username, count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const following = await GithubAPI.getUserFollowing(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      if (!following.length) return `@${username} is not following anyone (or list is private).`;
      return [
        `@${username} is following (${following.length} shown):`,
        '',
        ...following.map((u, i) => `${i + 1}. @${u.login}`),
      ].join('\n');
    }

    case 'github_get_user_gists': {
      const { username, count = 20 } = params;
      if (!username) throw new Error('Missing required param: username');
      const gists = await GithubAPI.getUserGists(
        credentials,
        username,
        Math.min(Number(count) || 20, 100),
      );
      if (!gists.length) return `No public gists found for @${username}.`;
      return [
        `Gists by @${username} (${gists.length} shown):`,
        '',
        ...gists.map((g, i) => {
          const files = Object.keys(g.files).join(', ');
          return `${i + 1}. ${g.description || files || 'untitled'} [${g.public ? 'public' : 'secret'}]\n   ${g.html_url}`;
        }),
      ].join('\n');
    }

    case 'github_get_gist_details': {
      const { gist_id } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const g = await GithubAPI.getGistDetails(credentials, gist_id);
      const files = Object.values(g.files ?? {});
      const preview = files[0]
        ? `\nFirst file (${files[0].filename}):\n${(files[0].content ?? '').slice(0, 500)}${(files[0].content?.length ?? 0) > 500 ? '\n...(truncated)' : ''}`
        : '';
      return [
        `Gist: ${g.description || gist_id}`,
        `Owner: @${g.owner?.login ?? 'unknown'}`,
        `Visibility: ${g.public ? 'public' : 'secret'}`,
        `Files (${files.length}): ${files.map((f) => f.filename).join(', ')}`,
        `Created: ${formatDate(g.created_at)} | Updated: ${formatDate(g.updated_at)}`,
        `Forks: ${g.forks?.length ?? 0} | Comments: ${g.comments ?? 0}`,
        `URL: ${g.html_url}`,
        preview,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_pr_commits': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const commits = await GithubAPI.getPRCommits(credentials, owner, repo, Number(pr_number));
      if (!commits.length) return `No commits found in ${owner}/${repo} PR #${pr_number}.`;
      return [
        `Commits in ${owner}/${repo} PR #${pr_number} (${commits.length}):`,
        '',
        ...commits.map((c, i) => {
          const sha = c.sha?.slice(0, 7) ?? '?';
          const msg = String(c.commit?.message ?? '')
            .split('\n')[0]
            .slice(0, 80);
          const author = c.commit?.author?.name ?? c.author?.login ?? 'unknown';
          return `${i + 1}. \`${sha}\` ${msg}\n   by ${author}`;
        }),
      ].join('\n');
    }

    case 'github_get_commit_statuses': {
      const { owner, repo, ref } = params;
      if (!owner || !repo || !ref) throw new Error('Missing required params: owner, repo, ref');
      const statuses = await GithubAPI.getCommitStatuses(credentials, owner, repo, ref);
      if (!statuses.length) return `No commit statuses found for ${ref} in ${owner}/${repo}.`;
      return [
        `Commit statuses for ${ref} in ${owner}/${repo} (${statuses.length}):`,
        '',
        ...statuses.map(
          (s, i) =>
            `${i + 1}. [${s.state}] ${s.context ?? 'unknown'}\n   ${s.description ?? ''}\n   ${s.target_url ?? ''}`,
        ),
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_repo_pages': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const p = await GithubAPI.getRepoPages(credentials, owner, repo);
      return [
        `GitHub Pages for ${owner}/${repo}:`,
        `Status: ${p.status ?? 'unknown'}`,
        `URL: ${p.html_url ?? 'not set'}`,
        `Custom domain: ${p.cname ?? 'none'}`,
        `HTTPS enforced: ${p.https_enforced ?? false}`,
        p.source ? `Source: ${p.source.branch} / ${p.source.path ?? '/'}` : '',
        p.build_type ? `Build type: ${p.build_type}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_org_info': {
      const { org } = params;
      if (!org) throw new Error('Missing required param: org');
      const o = await GithubAPI.getOrgInfo(credentials, org);
      return [
        `Organization: ${o.login}`,
        o.name ? `Name: ${o.name}` : '',
        o.description ? `Description: ${o.description}` : '',
        o.email ? `Email: ${o.email}` : '',
        o.blog ? `Website: ${o.blog}` : '',
        o.location ? `Location: ${o.location}` : '',
        `Public repos: ${o.public_repos} | Members: ${o.public_members ?? '?'}`,
        `Followers: ${o.followers}`,
        `Created: ${formatDate(o.created_at)}`,
        `URL: ${o.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_search_commits': {
      const { query, count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GithubAPI.searchCommits(
        credentials,
        query,
        Math.min(Number(count) || 20, 50),
      );
      const items = result.items ?? [];
      if (!items.length) return `No commits found for query "${query}".`;
      return [
        `Commit search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
        '',
        ...items.slice(0, 20).map((c, i) => {
          const sha = c.sha?.slice(0, 7) ?? '?';
          const msg = String(c.commit?.message ?? '')
            .split('\n')[0]
            .slice(0, 80);
          const author = c.commit?.author?.name ?? c.author?.login ?? 'unknown';
          const repo = c.repository?.full_name ?? 'unknown';
          return `${i + 1}. \`${sha}\` ${msg}\n   by ${author} in ${repo}`;
        }),
      ].join('\n');
    }

    case 'github_get_deployment_statuses': {
      const { owner, repo, deployment_id } = params;
      if (!owner || !repo || !deployment_id)
        throw new Error('Missing required params: owner, repo, deployment_id');
      const statuses = await GithubAPI.getDeploymentStatuses(
        credentials,
        owner,
        repo,
        deployment_id,
      );
      if (!statuses.length)
        return `No statuses found for deployment #${deployment_id} in ${owner}/${repo}.`;
      return [
        `Statuses for deployment #${deployment_id} in ${owner}/${repo}:`,
        '',
        ...statuses.map(
          (s, i) =>
            `${i + 1}. [${s.state}] ${s.environment ?? 'unknown env'} — ${formatDateTime(s.created_at)}\n   ${s.description ?? ''}${s.log_url ? `\n   Logs: ${s.log_url}` : ''}`,
        ),
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_repo_invitations': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const invites = await GithubAPI.getRepoInvitations(credentials, owner, repo);
      if (!invites.length) return `No pending invitations for ${owner}/${repo}.`;
      return [
        `Pending invitations for ${owner}/${repo} (${invites.length}):`,
        '',
        ...invites.map(
          (inv, i) =>
            `${i + 1}. @${inv.invitee?.login ?? 'unknown'} — ${inv.permissions} — invited by @${inv.inviter?.login ?? 'unknown'} on ${formatDate(inv.created_at)}`,
        ),
      ].join('\n');
    }

    case 'github_get_rate_limit': {
      const data = await GithubAPI.getRateLimit(credentials);
      const core = data.resources?.core ?? {};
      const search = data.resources?.search ?? {};
      const graphql = data.resources?.graphql ?? {};
      const formatReset = (ts) => (ts ? new Date(ts * 1000).toLocaleTimeString() : 'n/a');
      return [
        'GitHub API Rate Limits:',
        '',
        `Core:    ${core.remaining ?? '?'} / ${core.limit ?? '?'} remaining — resets at ${formatReset(core.reset)}`,
        `Search:  ${search.remaining ?? '?'} / ${search.limit ?? '?'} remaining — resets at ${formatReset(search.reset)}`,
        `GraphQL: ${graphql.remaining ?? '?'} / ${graphql.limit ?? '?'} remaining — resets at ${formatReset(graphql.reset)}`,
      ].join('\n');
    }

    case 'github_list_workflows': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.listWorkflows(credentials, owner, repo);
      const workflows = data.workflows ?? [];
      if (!workflows.length) return `No workflows found in ${owner}/${repo}.`;
      return [
        `Workflows in ${owner}/${repo} (${workflows.length}):`,
        '',
        ...workflows.map(
          (w, i) => `${i + 1}. ${w.name} [${w.state}]\n   File: ${w.path}\n   ID: ${w.id}`,
        ),
      ].join('\n');
    }

    case 'github_get_workflow_details': {
      const { owner, repo, workflow_id } = params;
      if (!owner || !repo || !workflow_id)
        throw new Error('Missing required params: owner, repo, workflow_id');
      const w = await GithubAPI.getWorkflowDetails(credentials, owner, repo, workflow_id);
      return [
        `Workflow: ${w.name}`,
        `ID: ${w.id}`,
        `File: ${w.path}`,
        `State: ${w.state}`,
        `Created: ${formatDate(w.created_at)} | Updated: ${formatDate(w.updated_at)}`,
        `URL: ${w.html_url}`,
        `Badge: ${w.badge_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_actions_runners': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getActionsRunners(credentials, owner, repo);
      const runners = data.runners ?? [];
      if (!runners.length) return `No self-hosted runners found in ${owner}/${repo}.`;
      return [
        `Self-hosted runners in ${owner}/${repo} (${runners.length}):`,
        '',
        ...runners.map((r, i) => {
          const labels = r.labels?.map((l) => l.name).join(', ') || 'none';
          return `${i + 1}. ${r.name} [${r.status}] — OS: ${r.os ?? 'unknown'} | Labels: ${labels}`;
        }),
      ].join('\n');
    }

    case 'github_get_actions_variables': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getActionsVariables(credentials, owner, repo);
      const vars = data.variables ?? [];
      if (!vars.length) return `No Actions variables found in ${owner}/${repo}.`;
      return [
        `Actions variables in ${owner}/${repo} (${vars.length}):`,
        '',
        ...vars.map(
          (v, i) => `${i + 1}. ${v.name} = ${v.value}\n   Updated: ${formatDate(v.updated_at)}`,
        ),
      ].join('\n');
    }

    case 'github_get_actions_cache': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getActionsCache(credentials, owner, repo);
      const caches = data.actions_caches ?? [];
      if (!caches.length) return `No Actions cache entries found in ${owner}/${repo}.`;
      const totalBytes = caches.reduce((s, c) => s + (c.size_in_bytes ?? 0), 0);
      const totalMB = (totalBytes / 1_000_000).toFixed(1);
      return [
        `Actions cache for ${owner}/${repo} (${caches.length} entries, ${totalMB} MB total):`,
        '',
        ...caches.slice(0, 20).map((c, i) => {
          const size = ((c.size_in_bytes ?? 0) / 1_000_000).toFixed(2);
          return `${i + 1}. ${c.key}\n   Branch: ${c.ref ?? 'unknown'} | ${size} MB | Last used: ${formatDate(c.last_accessed_at)}`;
        }),
      ].join('\n');
    }

    case 'github_get_team_repos': {
      const { org, team_slug, count = 30 } = params;
      if (!org || !team_slug) throw new Error('Missing required params: org, team_slug');
      const repos = await GithubAPI.getTeamRepos(
        credentials,
        org,
        team_slug,
        Math.min(Number(count) || 30, 100),
      );
      if (!repos.length) return `No repositories found for team "${team_slug}" in org "${org}".`;
      return [
        `Repos accessible to ${org}/${team_slug} (${repos.length}):`,
        '',
        ...repos.map((r, i) => {
          const perms = Object.entries(r.permissions ?? {})
            .filter(([, v]) => v)
            .map(([k]) => k)
            .join(', ');
          return `${i + 1}. ${r.full_name} [${r.language ?? 'unknown'}] — permissions: ${perms || 'none'}`;
        }),
      ].join('\n');
    }

    case 'github_get_user_repos': {
      const { username, count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const repos = await GithubAPI.getUserRepos(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      if (!repos.length) return `No public repositories found for @${username}.`;
      return [
        `Repositories for @${username} (${repos.length} shown):`,
        '',
        ...repos.map(
          (r, i) =>
            `${i + 1}. ${r.name} [${r.language ?? 'unknown'}] ★${r.stargazers_count}${r.description ? ` — ${r.description}` : ''}`,
        ),
      ].join('\n');
    }

    case 'github_get_issue_timeline': {
      const { owner, repo, issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const events = await GithubAPI.getIssueTimeline(
        credentials,
        owner,
        repo,
        Number(issue_number),
      );
      if (!events.length) return `No timeline events found for ${owner}/${repo}#${issue_number}.`;
      return [
        `Timeline for ${owner}/${repo}#${issue_number} (${events.length} events):`,
        '',
        ...events.slice(0, 25).map((e, i) => {
          const actor = e.actor?.login ?? e.user?.login ?? 'unknown';
          const date = formatDate(e.created_at ?? e.submitted_at);
          const detail = e.label?.name
            ? `label: ${e.label.name}`
            : e.rename
              ? `renamed: "${e.rename.from}" → "${e.rename.to}"`
              : e.body
                ? String(e.body).slice(0, 80)
                : '';
          return `${i + 1}. [${e.event}] @${actor} ${date}${detail ? `\n   ${detail}` : ''}`;
        }),
      ].join('\n');
    }

    case 'github_get_org_secrets': {
      const { org } = params;
      if (!org) throw new Error('Missing required param: org');
      const data = await GithubAPI.getOrgSecrets(credentials, org);
      const secrets = data.secrets ?? [];
      if (!secrets.length) return `No org-level Actions secrets found in "${org}".`;
      return [
        `Org-level Actions secrets for ${org} (${secrets.length}) — names only:`,
        '',
        ...secrets.map(
          (s, i) =>
            `${i + 1}. ${s.name} — visibility: ${s.visibility} | updated: ${formatDate(s.updated_at)}`,
        ),
      ].join('\n');
    }

    case 'github_get_single_comment': {
      const { owner, repo, comment_id } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      const c = await GithubAPI.getSingleComment(credentials, owner, repo, comment_id);
      return [
        `Comment #${c.id} on ${owner}/${repo}`,
        `Author: @${c.user?.login ?? 'unknown'}`,
        `Created: ${formatDate(c.created_at)} | Updated: ${formatDate(c.updated_at)}`,
        `URL: ${c.html_url}`,
        '',
        c.body ?? '(empty)',
      ].join('\n');
    }

    case 'github_get_security_advisories': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const advisories = await GithubAPI.getRepoSecurityAdvisories(credentials, owner, repo);
      if (!advisories.length) return `No security advisories found for ${owner}/${repo}.`;
      return [
        `Security advisories for ${owner}/${repo} (${advisories.length}):`,
        '',
        ...advisories.map((a, i) => {
          const severity = a.severity ?? 'unknown';
          const state = a.state ?? 'unknown';
          const cvss = a.cvss?.score ? ` | CVSS: ${a.cvss.score}` : '';
          return `${i + 1}. [${severity.toUpperCase()}] ${a.summary ?? 'no summary'}\n   State: ${state}${cvss} | Published: ${formatDate(a.published_at)}`;
        }),
      ].join('\n');
    }

    case 'github_get_pr_review_details': {
      const { owner, repo, pr_number, review_id } = params;
      if (!owner || !repo || !pr_number || !review_id)
        throw new Error('Missing required params: owner, repo, pr_number, review_id');
      const r = await GithubAPI.getPRReviewDetails(
        credentials,
        owner,
        repo,
        Number(pr_number),
        review_id,
      );
      return [
        `Review #${r.id} on ${owner}/${repo} PR #${pr_number}`,
        `Reviewer: @${r.user?.login ?? 'unknown'}`,
        `State: ${r.state}`,
        `Submitted: ${formatDate(r.submitted_at)}`,
        `URL: ${r.html_url}`,
        '',
        r.body
          ? `Body:\n${r.body.slice(0, 1000)}${r.body.length > 1000 ? '\n...(truncated)' : ''}`
          : '(no body)',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_org_variables': {
      const { org } = params;
      if (!org) throw new Error('Missing required param: org');
      const data = await GithubAPI.getOrgVariables(credentials, org);
      const vars = data.variables ?? [];
      if (!vars.length) return `No org-level Actions variables found in "${org}".`;
      return [
        `Org-level Actions variables for ${org} (${vars.length}):`,
        '',
        ...vars.map(
          (v, i) =>
            `${i + 1}. ${v.name} = ${v.value}\n   Visibility: ${v.visibility} | Updated: ${formatDate(v.updated_at)}`,
        ),
      ].join('\n');
    }

    case 'github_get_repo_autolinks': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const links = await GithubAPI.getRepoAutolinks(credentials, owner, repo);
      if (!links.length) return `No autolinks configured for ${owner}/${repo}.`;
      return [
        `Autolinks for ${owner}/${repo} (${links.length}):`,
        '',
        ...links.map(
          (l, i) =>
            `${i + 1}. Key prefix: ${l.key_prefix}\n   URL template: ${l.url_template}\n   Alphanumeric: ${l.is_alphanumeric}`,
        ),
      ].join('\n');
    }

    case 'github_get_check_run_details': {
      const { owner, repo, check_run_id } = params;
      if (!owner || !repo || !check_run_id)
        throw new Error('Missing required params: owner, repo, check_run_id');
      const c = await GithubAPI.getCheckRunDetails(credentials, owner, repo, check_run_id);
      const steps =
        c.output?.annotations_count != null ? `Annotations: ${c.output.annotations_count}` : '';
      return [
        `Check run: ${c.name}`,
        `ID: ${c.id}`,
        `Status: ${c.status} | Conclusion: ${c.conclusion ?? 'pending'}`,
        `Started: ${formatDateTime(c.started_at)} | Completed: ${formatDateTime(c.completed_at)}`,
        steps,
        c.output?.title ? `Title: ${c.output.title}` : '',
        c.output?.summary ? `Summary: ${c.output.summary.slice(0, 300)}` : '',
        `URL: ${c.html_url}`,
        c.details_url ? `Details: ${c.details_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_create_repo': {
      const { name, description = '', private: isPrivate = false, auto_init = false } = params;
      if (!name) throw new Error('Missing required param: name');
      const repo = await GithubAPI.createRepo(credentials, {
        name,
        description,
        private: Boolean(isPrivate),
        autoInit: Boolean(auto_init),
      });
      return [
        `Repository created: ${repo.full_name}`,
        `Visibility: ${repo.private ? 'Private' : 'Public'}`,
        repo.description ? `Description: ${repo.description}` : '',
        `URL: ${repo.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_update_repo': {
      const {
        owner,
        repo,
        description,
        homepage,
        private: isPrivate,
        default_branch,
        has_issues,
        has_wiki,
        has_projects,
      } = params;
      requireRepo(owner, repo);
      const payload = {};
      if (description !== undefined) payload.description = description;
      if (homepage !== undefined) payload.homepage = homepage;
      if (isPrivate !== undefined) payload.private = Boolean(isPrivate);
      if (default_branch !== undefined) payload.default_branch = default_branch;
      if (has_issues !== undefined) payload.has_issues = Boolean(has_issues);
      if (has_wiki !== undefined) payload.has_wiki = Boolean(has_wiki);
      if (has_projects !== undefined) payload.has_projects = Boolean(has_projects);
      if (!Object.keys(payload).length)
        throw new Error('At least one field to update must be provided.');
      const updated = await GithubAPI.updateRepo(credentials, owner, repo, payload);
      return [
        `Repository updated: ${updated.full_name}`,
        `Visibility: ${updated.private ? 'Private' : 'Public'}`,
        updated.description ? `Description: ${updated.description}` : '',
        `URL: ${updated.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_delete_repo': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      await GithubAPI.deleteRepo(credentials, owner, repo);
      return `Repository ${owner}/${repo} has been permanently deleted.`;
    }

    case 'github_get_repo_contents': {
      const { owner, repo, path = '', ref = '' } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getRepoContents(credentials, owner, repo, path, ref);
      if (Array.isArray(data)) {
        return [
          `Contents of ${owner}/${repo}${path ? `/${path}` : ''}${ref ? ` @ ${ref}` : ''} (${data.length} items):`,
          '',
          ...data.map(
            (item) =>
              `${item.type === 'dir' ? '📁' : '📄'} ${item.name}${item.type === 'file' ? `  (${item.size} bytes)` : ''}`,
          ),
        ].join('\n');
      }
      return [
        `File: ${data.path}`,
        `Size: ${data.size} bytes`,
        `SHA: ${data.sha}`,
        `URL: ${data.html_url}`,
      ].join('\n');
    }

    case 'github_create_or_update_file': {
      const { owner, repo, file_path, message, content, sha = '', branch = '' } = params;
      if (!owner || !repo || !file_path || !message || !content) {
        throw new Error('Missing required params: owner, repo, file_path, message, content');
      }
      const result = await GithubAPI.createOrUpdateFile(credentials, owner, repo, file_path, {
        message,
        content,
        sha,
        branch,
      });
      const action = result.content ? (sha ? 'updated' : 'created') : 'processed';
      return [
        `File ${action}: ${file_path} in ${owner}/${repo}`,
        `Commit: ${result.commit?.sha?.slice(0, 7) ?? '?'}`,
        `Message: ${message}`,
        branch ? `Branch: ${branch}` : '',
        `URL: ${result.content?.html_url ?? `https://github.com/${owner}/${repo}/blob/main/${file_path}`}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_delete_file': {
      const { owner, repo, file_path, message, sha, branch = '' } = params;
      if (!owner || !repo || !file_path || !message || !sha) {
        throw new Error('Missing required params: owner, repo, file_path, message, sha');
      }
      const result = await GithubAPI.deleteFile(credentials, owner, repo, file_path, {
        message,
        sha,
        branch,
      });
      return [
        `File deleted: ${file_path} from ${owner}/${repo}`,
        `Commit: ${result.commit?.sha?.slice(0, 7) ?? '?'}`,
        `Message: ${message}`,
        branch ? `Branch: ${branch}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_commit_comments': {
      const { owner, repo, sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const comments = await GithubAPI.getCommitComments(credentials, owner, repo, sha);
      if (!comments.length) return `No comments on commit ${sha.slice(0, 7)} in ${owner}/${repo}.`;
      return [
        `Comments on ${owner}/${repo}@${sha.slice(0, 7)} (${comments.length}):`,
        '',
        ...comments.map((c, i) => {
          const body = String(c.body || '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 200);
          return `${i + 1}. @${c.user?.login ?? 'unknown'} — ${formatDate(c.created_at)}${c.path ? `\n   File: ${c.path}` : ''}\n   ${body}`;
        }),
      ].join('\n');
    }

    case 'github_create_commit_comment': {
      const { owner, repo, sha, body, path = '', position } = params;
      if (!owner || !repo || !sha || !body)
        throw new Error('Missing required params: owner, repo, sha, body');
      const comment = await GithubAPI.createCommitComment(
        credentials,
        owner,
        repo,
        sha,
        body,
        path,
        position ?? null,
      );
      return [
        `Comment posted on ${owner}/${repo}@${sha.slice(0, 7)}`,
        path ? `File: ${path}` : '',
        `URL: ${comment?.html_url ?? `https://github.com/${owner}/${repo}/commit/${sha}`}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_dismiss_pr_review': {
      const { owner, repo, pr_number, review_id, message } = params;
      if (!owner || !repo || !pr_number || !review_id || !message) {
        throw new Error('Missing required params: owner, repo, pr_number, review_id, message');
      }
      const review = await GithubAPI.dismissPRReview(
        credentials,
        owner,
        repo,
        Number(pr_number),
        review_id,
        message,
      );
      return [
        `Review #${review_id} dismissed on ${owner}/${repo} PR #${pr_number}`,
        `State: ${review.state}`,
        `Dismissal message: ${message}`,
      ].join('\n');
    }

    case 'github_cancel_workflow_run': {
      const { owner, repo, run_id } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      await GithubAPI.cancelWorkflowRun(credentials, owner, repo, run_id);
      return `Workflow run #${run_id} in ${owner}/${repo} has been cancelled.`;
    }

    case 'github_rerun_workflow_run': {
      const { owner, repo, run_id } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      await GithubAPI.rerunWorkflowRun(credentials, owner, repo, run_id);
      return `Workflow run #${run_id} in ${owner}/${repo} has been queued for re-run.`;
    }

    case 'github_list_workflow_run_artifacts': {
      const { owner, repo, run_id, count = 20 } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      const data = await GithubAPI.listWorkflowRunArtifacts(
        credentials,
        owner,
        repo,
        run_id,
        Math.min(Number(count) || 20, 100),
      );
      const artifacts = data.artifacts ?? [];
      if (!artifacts.length)
        return `No artifacts found for workflow run #${run_id} in ${owner}/${repo}.`;
      return [
        `Artifacts for workflow run #${run_id} in ${owner}/${repo} (${artifacts.length}):`,
        '',
        ...artifacts.map((a, i) => {
          const size = ((a.size_in_bytes ?? 0) / 1_000_000).toFixed(2);
          const expired = a.expired ? ' [EXPIRED]' : '';
          return `${i + 1}. ${a.name}${expired}  ${size} MB  expires: ${formatDate(a.expires_at)}`;
        }),
      ].join('\n');
    }

    case 'github_check_if_starred': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const starred = await GithubAPI.checkIfStarred(credentials, owner, repo);
      return `${owner}/${repo} is ${starred ? '⭐ starred' : 'not starred'} by you.`;
    }

    case 'github_follow_user': {
      const { username } = params;
      if (!username) throw new Error('Missing required param: username');
      await GithubAPI.followUser(credentials, username);
      return `You are now following @${username}.`;
    }

    case 'github_unfollow_user': {
      const { username } = params;
      if (!username) throw new Error('Missing required param: username');
      await GithubAPI.unfollowUser(credentials, username);
      return `You have unfollowed @${username}.`;
    }

    case 'github_get_issue_events': {
      const { owner, repo, issue_number, count = 30 } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const events = await GithubAPI.getIssueEvents(
        credentials,
        owner,
        repo,
        Number(issue_number),
        Math.min(Number(count) || 30, 100),
      );
      if (!events.length) return `No events found for ${owner}/${repo}#${issue_number}.`;
      return [
        `Events for ${owner}/${repo}#${issue_number} (${events.length}):`,
        '',
        ...events.map((e, i) => {
          const actor = e.actor?.login ?? 'unknown';
          const date = formatDate(e.created_at);
          const detail = e.label?.name
            ? `  label: "${e.label.name}"`
            : e.assignee?.login
              ? `  assignee: @${e.assignee.login}`
              : e.milestone?.title
                ? `  milestone: ${e.milestone.title}`
                : '';
          return `${i + 1}. [${e.event}] @${actor} — ${date}${detail}`;
        }),
      ].join('\n');
    }

    case 'github_update_gist': {
      const { gist_id, description, files } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const parsedFiles = typeof files === 'string' ? JSON.parse(files) : files;
      const gist = await GithubAPI.updateGist(credentials, gist_id, {
        description,
        files: parsedFiles,
      });
      return [
        `Gist updated: ${gist.description || gist_id}`,
        `Files: ${Object.keys(gist.files ?? {}).join(', ')}`,
        `Updated: ${formatDate(gist.updated_at)}`,
        `URL: ${gist.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_delete_gist': {
      const { gist_id } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      await GithubAPI.deleteGist(credentials, gist_id);
      return `Gist ${gist_id} has been deleted.`;
    }

    case 'github_transfer_issue': {
      const { owner, repo, issue_number, new_owner } = params;
      if (!owner || !repo || !issue_number || !new_owner) {
        throw new Error('Missing required params: owner, repo, issue_number, new_owner');
      }
      const issue = await GithubAPI.transferIssue(
        credentials,
        owner,
        repo,
        Number(issue_number),
        new_owner,
      );
      return [
        `Issue #${issue_number} transferred from ${owner}/${repo}`,
        `New location: ${issue.repository?.full_name ?? new_owner}#${issue.number}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_replace_topics': {
      const { owner, repo, topics } = params;
      requireRepo(owner, repo);
      const names =
        typeof topics === 'string'
          ? topics
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : (topics ?? []);
      const result = await GithubAPI.replaceTopics(credentials, owner, repo, names);
      return [
        `Topics updated for ${owner}/${repo}`,
        `Topics: ${(result.names ?? []).join(', ') || '(none)'}`,
      ].join('\n');
    }

    case 'github_get_authenticated_user': {
      const user = await GithubAPI.getUser(credentials);
      return [
        `Authenticated GitHub User: @${user.login}`,
        user.name ? `Name: ${user.name}` : '',
        user.email ? `Email: ${user.email}` : '',
        user.bio ? `Bio: ${user.bio}` : '',
        user.company ? `Company: ${user.company}` : '',
        user.location ? `Location: ${user.location}` : '',
        user.blog ? `Website: ${user.blog}` : '',
        `Public repos: ${user.public_repos} | Private repos: ${user.total_private_repos ?? '?'}`,
        `Followers: ${user.followers} | Following: ${user.following}`,
        `Plan: ${user.plan?.name ?? 'unknown'}`,
        `Member since: ${formatDate(user.created_at)}`,
        `URL: ${user.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_update_comment': {
      const { owner, repo, comment_id, body } = params;
      if (!owner || !repo || !comment_id || !body)
        throw new Error('Missing required params: owner, repo, comment_id, body');
      const comment = await GithubAPI.updateIssueComment(
        credentials,
        owner,
        repo,
        comment_id,
        body,
      );
      return [
        `Comment #${comment_id} updated in ${owner}/${repo}`,
        `URL: ${comment?.html_url ?? `https://github.com/${owner}/${repo}`}`,
      ].join('\n');
    }

    case 'github_delete_comment': {
      const { owner, repo, comment_id } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      await GithubAPI.deleteIssueComment(credentials, owner, repo, comment_id);
      return `Comment #${comment_id} deleted from ${owner}/${repo}.`;
    }

    case 'github_add_reaction_to_issue': {
      const { owner, repo, issue_number, content } = params;
      if (!owner || !repo || !issue_number || !content)
        throw new Error('Missing required params: owner, repo, issue_number, content');
      const validReactions = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
      if (!validReactions.includes(content))
        throw new Error(`content must be one of: ${validReactions.join(', ')}`);
      const reaction = await GithubAPI.addReactionToIssue(
        credentials,
        owner,
        repo,
        Number(issue_number),
        content,
      );
      const emojiMap = {
        '+1': '👍',
        '-1': '👎',
        laugh: '😄',
        hooray: '🎉',
        confused: '😕',
        heart: '❤️',
        rocket: '🚀',
        eyes: '👀',
      };
      return `Reaction ${emojiMap[content] ?? content} added to ${owner}/${repo}#${issue_number} (reaction ID: ${reaction.id}).`;
    }

    case 'github_add_reaction_to_comment': {
      const { owner, repo, comment_id, content } = params;
      if (!owner || !repo || !comment_id || !content)
        throw new Error('Missing required params: owner, repo, comment_id, content');
      const validReactions = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
      if (!validReactions.includes(content))
        throw new Error(`content must be one of: ${validReactions.join(', ')}`);
      const reaction = await GithubAPI.addReactionToComment(
        credentials,
        owner,
        repo,
        comment_id,
        content,
      );
      const emojiMap = {
        '+1': '👍',
        '-1': '👎',
        laugh: '😄',
        hooray: '🎉',
        confused: '😕',
        heart: '❤️',
        rocket: '🚀',
        eyes: '👀',
      };
      return `Reaction ${emojiMap[content] ?? content} added to comment #${comment_id} in ${owner}/${repo} (reaction ID: ${reaction.id}).`;
    }

    case 'github_get_code_scanning_alerts': {
      const { owner, repo, state = 'open' } = params;
      requireRepo(owner, repo);
      const alerts = await GithubAPI.getCodeScanningAlerts(credentials, owner, repo, state);
      if (!alerts.length) return `No ${state} code scanning alerts in ${owner}/${repo}.`;
      return [
        `Code scanning alerts for ${owner}/${repo} (${alerts.length} ${state}):`,
        '',
        ...alerts.slice(0, 20).map((a, i) => {
          const severity = a.rule?.severity ?? 'unknown';
          const rule = a.rule?.id ?? 'unknown';
          const desc = a.rule?.description ?? a.rule?.name ?? '';
          const ref = a.most_recent_instance?.ref ?? '';
          return `${i + 1}. [${severity.toUpperCase()}] ${rule}\n   ${desc}${ref ? `\n   Ref: ${ref}` : ''}`;
        }),
      ].join('\n');
    }

    case 'github_get_secret_scanning_alerts': {
      const { owner, repo, state = 'open' } = params;
      requireRepo(owner, repo);
      const alerts = await GithubAPI.getSecretScanningAlerts(credentials, owner, repo, state);
      if (!alerts.length) return `No ${state} secret scanning alerts in ${owner}/${repo}.`;
      return [
        `Secret scanning alerts for ${owner}/${repo} (${alerts.length} ${state}):`,
        '',
        ...alerts.slice(0, 20).map((a, i) => {
          const type = a.secret_type_display_name ?? a.secret_type ?? 'unknown';
          const validity = a.validity ?? 'unknown';
          return `${i + 1}. [${a.state}] ${type}\n   Validity: ${validity} | Created: ${formatDate(a.created_at)}`;
        }),
      ].join('\n');
    }

    case 'github_delete_workflow_run': {
      const { owner, repo, run_id } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      await GithubAPI.deleteWorkflowRun(credentials, owner, repo, run_id);
      return `Workflow run #${run_id} deleted from ${owner}/${repo}.`;
    }

    case 'github_get_workflow_run_jobs': {
      const { owner, repo, run_id, filter = 'latest' } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      const data = await GithubAPI.getWorkflowRunJobs(credentials, owner, repo, run_id, filter);
      const jobs = data.jobs ?? [];
      if (!jobs.length) return `No jobs found for workflow run #${run_id} in ${owner}/${repo}.`;
      return [
        `Jobs for workflow run #${run_id} in ${owner}/${repo} (${jobs.length}):`,
        '',
        ...jobs.map((job, i) => {
          const steps = (job.steps ?? [])
            .slice(0, 5)
            .map(
              (s) =>
                `    ${s.number}. ${s.name}: ${s.status}${s.conclusion ? ` / ${s.conclusion}` : ''}`,
            )
            .join('\n');
          return [
            `${i + 1}. ${job.name}`,
            `   Status: ${job.status}${job.conclusion ? ` / ${job.conclusion}` : ''} | Runner: ${job.runner_name ?? 'unknown'}`,
            `   Started: ${formatDateTime(job.started_at)} | Completed: ${formatDateTime(job.completed_at)}`,
            steps ? `   Steps:\n${steps}` : '',
            `   URL: ${job.html_url}`,
          ]
            .filter(Boolean)
            .join('\n');
        }),
      ].join('\n');
    }

    case 'github_check_team_membership': {
      const { org, team_slug, username } = params;
      if (!org || !team_slug || !username)
        throw new Error('Missing required params: org, team_slug, username');
      const result = await GithubAPI.checkTeamMembership(credentials, org, team_slug, username);
      return [
        `Team membership for @${username} in ${org}/${team_slug}:`,
        `Role: ${result.role ?? 'unknown'}`,
        `State: ${result.state ?? 'unknown'}`,
      ].join('\n');
    }

    case 'github_list_gist_comments': {
      const { gist_id, count = 30 } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const comments = await GithubAPI.listGistComments(
        credentials,
        gist_id,
        Math.min(Number(count) || 30, 100),
      );
      if (!comments.length) return `No comments on gist ${gist_id}.`;
      return [
        `Comments on gist ${gist_id} (${comments.length}):`,
        '',
        ...comments.map((c, i) => {
          const body = String(c.body || '')
            .trim()
            .slice(0, 300);
          return `${i + 1}. @${c.user?.login ?? 'unknown'} — ${formatDate(c.created_at)}\n   ${body}${(c.body?.length ?? 0) > 300 ? '...' : ''}`;
        }),
      ].join('\n');
    }

    case 'github_create_gist_comment': {
      const { gist_id, body } = params;
      if (!gist_id || !body) throw new Error('Missing required params: gist_id, body');
      const comment = await GithubAPI.createGistComment(credentials, gist_id, body);
      return [
        `Comment posted on gist ${gist_id}`,
        `Comment ID: ${comment.id}`,
        `URL: ${comment.url ?? `https://gist.github.com/${gist_id}`}`,
      ].join('\n');
    }

    case 'github_get_repo_actions_permissions': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getRepoActionsPermissions(credentials, owner, repo);
      return [
        `Actions permissions for ${owner}/${repo}:`,
        `Enabled: ${data.enabled ?? false}`,
        `Allowed actions: ${data.allowed_actions ?? 'unknown'}`,
        data.selected_actions_url ? `Selected actions URL: ${data.selected_actions_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_org_webhooks': {
      const { org } = params;
      if (!org) throw new Error('Missing required param: org');
      const hooks = await GithubAPI.getOrgWebhooks(credentials, org);
      if (!hooks.length) return `No webhooks configured for org "${org}".`;
      return [
        `Webhooks for org ${org} (${hooks.length}):`,
        '',
        ...hooks.map((h, i) => {
          const events = (h.events ?? []).join(', ') || 'none';
          const active = h.active ? 'active' : 'inactive';
          return `${i + 1}. ${h.config?.url ?? 'no url'} [${active}]\n   Events: ${events}\n   Created: ${formatDate(h.created_at)}`;
        }),
      ].join('\n');
    }

    case 'github_list_user_repo_invitations': {
      const invitations = await GithubAPI.listUserRepoInvitations(credentials);
      if (!invitations.length) return 'No pending repository invitations.';
      return [
        `Pending repository invitations (${invitations.length}):`,
        '',
        ...invitations.map((inv, i) => {
          const repo = inv.repository?.full_name ?? 'unknown';
          const inviter = inv.inviter?.login ?? 'unknown';
          return `${i + 1}. ${repo} — ${inv.permissions} — from @${inviter} on ${formatDate(inv.created_at)}\n   ID: ${inv.id}`;
        }),
      ].join('\n');
    }

    case 'github_accept_repo_invitation': {
      const { invitation_id } = params;
      if (!invitation_id) throw new Error('Missing required param: invitation_id');
      await GithubAPI.acceptRepoInvitation(credentials, invitation_id);
      return `Repository invitation #${invitation_id} accepted.`;
    }

    case 'github_decline_repo_invitation': {
      const { invitation_id } = params;
      if (!invitation_id) throw new Error('Missing required param: invitation_id');
      await GithubAPI.declineRepoInvitation(credentials, invitation_id);
      return `Repository invitation #${invitation_id} declined.`;
    }

    case 'github_get_user_public_keys': {
      const { username } = params;
      if (!username) throw new Error('Missing required param: username');
      const keys = await GithubAPI.getUserPublicKeys(credentials, username);
      if (!keys.length) return `@${username} has no public SSH keys.`;
      return [
        `Public SSH keys for @${username} (${keys.length}):`,
        '',
        ...keys.map((k, i) => `${i + 1}. ID: ${k.id}\n   ${String(k.key).slice(0, 60)}...`),
      ].join('\n');
    }

    case 'github_star_gist': {
      const { gist_id, action = 'star' } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const shouldUnstar = String(action).toLowerCase() === 'unstar';
      if (shouldUnstar) await GithubAPI.unstarGist(credentials, gist_id);
      else await GithubAPI.starGist(credentials, gist_id);
      return `Gist ${gist_id} ${shouldUnstar ? 'unstarred' : 'starred'} successfully.`;
    }

    case 'github_check_gist_starred': {
      const { gist_id } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const starred = await GithubAPI.checkGistStarred(credentials, gist_id);
      return `Gist ${gist_id} is ${starred ? '⭐ starred' : 'not starred'} by you.`;
    }

    case 'github_get_traffic_referrers': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const referrers = await GithubAPI.getTrafficReferrers(credentials, owner, repo);
      if (!referrers?.length) return `No referrer data available for ${owner}/${repo}.`;
      return [
        `Top referrers to ${owner}/${repo} (last 14 days):`,
        '',
        ...referrers.map(
          (r, i) => `${i + 1}. ${r.referrer}  —  ${r.count} views, ${r.uniques} unique`,
        ),
      ].join('\n');
    }

    case 'github_get_traffic_paths': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const paths = await GithubAPI.getTrafficPaths(credentials, owner, repo);
      if (!paths?.length) return `No popular path data available for ${owner}/${repo}.`;
      return [
        `Popular content paths in ${owner}/${repo} (last 14 days):`,
        '',
        ...paths.map(
          (p, i) =>
            `${i + 1}. ${p.path}\n   Title: ${p.title || 'n/a'}  —  ${p.count} views, ${p.uniques} unique`,
        ),
      ].join('\n');
    }

    case 'github_list_git_refs': {
      const { owner, repo, namespace = '' } = params;
      requireRepo(owner, repo);
      const refs = await GithubAPI.listGitRefs(credentials, owner, repo, namespace);
      if (!refs?.length)
        return `No git refs found in ${owner}/${repo}${namespace ? ` (${namespace})` : ''}.`;
      return [
        `Git refs in ${owner}/${repo}${namespace ? ` (${namespace})` : ''} — ${refs.length} found:`,
        '',
        ...refs
          .slice(0, 50)
          .map(
            (r, i) =>
              `${i + 1}. ${r.ref}  —  ${r.object?.sha?.slice(0, 7) ?? '?'} [${r.object?.type ?? '?'}]`,
          ),
        refs.length > 50 ? `  ...and ${refs.length - 50} more` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_git_ref': {
      const { owner, repo, ref } = params;
      if (!owner || !repo || !ref) throw new Error('Missing required params: owner, repo, ref');
      const data = await GithubAPI.getGitRef(credentials, owner, repo, ref);
      return [
        `Git ref in ${owner}/${repo}:`,
        `Ref:  ${data.ref}`,
        `Type: ${data.object?.type ?? 'unknown'}`,
        `SHA:  ${data.object?.sha ?? 'unknown'}`,
        data.object?.url ? `URL:  ${data.object.url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_list_commit_pull_requests': {
      const { owner, repo, sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const prs = await GithubAPI.listCommitPullRequests(credentials, owner, repo, sha);
      if (!prs?.length)
        return `No pull requests found associated with commit ${sha.slice(0, 7)} in ${owner}/${repo}.`;
      return [
        `Pull requests containing commit ${sha.slice(0, 7)} in ${owner}/${repo}:`,
        '',
        ...prs.map(
          (pr, i) =>
            `${i + 1}. #${pr.number} ${pr.title}  [${pr.state}]  by @${pr.user?.login ?? 'unknown'}\n   ${pr.html_url}`,
        ),
      ].join('\n');
    }

    case 'github_update_milestone': {
      const { owner, repo, milestone_number, title, description, state, due_on } = params;
      if (!owner || !repo || !milestone_number)
        throw new Error('Missing required params: owner, repo, milestone_number');
      const payload = {};
      if (title !== undefined) payload.title = title;
      if (description !== undefined) payload.description = description;
      if (state !== undefined) payload.state = state;
      if (due_on !== undefined) payload.due_on = due_on;
      if (!Object.keys(payload).length)
        throw new Error('At least one field to update must be provided.');
      const milestone = await GithubAPI.updateMilestone(
        credentials,
        owner,
        repo,
        Number(milestone_number),
        payload,
      );
      return [
        `Milestone #${milestone.number} updated in ${owner}/${repo}`,
        `Title: ${milestone.title}`,
        `State: ${milestone.state}`,
        milestone.due_on ? `Due: ${formatDate(milestone.due_on)}` : '',
        `URL: ${milestone.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_delete_milestone': {
      const { owner, repo, milestone_number } = params;
      if (!owner || !repo || !milestone_number)
        throw new Error('Missing required params: owner, repo, milestone_number');
      await GithubAPI.deleteMilestone(credentials, owner, repo, Number(milestone_number));
      return `Milestone #${milestone_number} deleted from ${owner}/${repo}.`;
    }

    case 'github_enable_vulnerability_alerts': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      await GithubAPI.enableVulnerabilityAlerts(credentials, owner, repo);
      return `Dependabot vulnerability alerts enabled for ${owner}/${repo}.`;
    }

    case 'github_disable_vulnerability_alerts': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      await GithubAPI.disableVulnerabilityAlerts(credentials, owner, repo);
      return `Dependabot vulnerability alerts disabled for ${owner}/${repo}.`;
    }

    case 'github_check_vulnerability_alerts': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const enabled = await GithubAPI.checkVulnerabilityAlerts(credentials, owner, repo);
      return `Dependabot vulnerability alerts are ${enabled ? '✓ enabled' : '✗ disabled'} for ${owner}/${repo}.`;
    }

    case 'github_create_repo_webhook': {
      const {
        owner,
        repo,
        url,
        events,
        content_type = 'json',
        secret = '',
        active = true,
      } = params;
      if (!owner || !repo || !url) throw new Error('Missing required params: owner, repo, url');
      const parsedEvents = parseCommaList(events || 'push');
      const hook = await GithubAPI.createRepoWebhook(credentials, owner, repo, {
        url,
        events: parsedEvents,
        contentType: content_type,
        secret,
        active: Boolean(active),
      });
      return [
        `Webhook created for ${owner}/${repo}`,
        `ID: ${hook.id}`,
        `URL: ${hook.config?.url}`,
        `Events: ${(hook.events ?? []).join(', ')}`,
        `Active: ${hook.active}`,
        `Created: ${formatDate(hook.created_at)}`,
      ].join('\n');
    }

    case 'github_delete_repo_webhook': {
      const { owner, repo, hook_id } = params;
      if (!owner || !repo || !hook_id)
        throw new Error('Missing required params: owner, repo, hook_id');
      await GithubAPI.deleteRepoWebhook(credentials, owner, repo, hook_id);
      return `Webhook #${hook_id} deleted from ${owner}/${repo}.`;
    }

    case 'github_list_check_suites': {
      const { owner, repo, ref } = params;
      if (!owner || !repo || !ref) throw new Error('Missing required params: owner, repo, ref');
      const data = await GithubAPI.listCheckSuites(credentials, owner, repo, ref);
      const suites = data.check_suites ?? [];
      if (!suites.length) return `No check suites found for ref "${ref}" in ${owner}/${repo}.`;
      return [
        `Check suites for ${ref} in ${owner}/${repo} (${data.total_count ?? suites.length} total):`,
        '',
        ...suites.slice(0, 20).map((s, i) => {
          const app = s.app?.name ?? 'unknown';
          const conclusion = s.conclusion ?? 'pending';
          return `${i + 1}. [${s.status} / ${conclusion}]  ${app}  — ID: ${s.id}\n   Branch: ${s.head_branch ?? 'unknown'}  SHA: ${s.head_sha?.slice(0, 7) ?? '?'}`;
        }),
      ].join('\n');
    }

    case 'github_rerequest_check_suite': {
      const { owner, repo, check_suite_id } = params;
      if (!owner || !repo || !check_suite_id)
        throw new Error('Missing required params: owner, repo, check_suite_id');
      await GithubAPI.rerequestCheckSuite(credentials, owner, repo, check_suite_id);
      return `Check suite #${check_suite_id} in ${owner}/${repo} has been re-requested.`;
    }

    case 'github_list_gist_forks': {
      const { gist_id, count = 20 } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const forks = await GithubAPI.listGistForks(
        credentials,
        gist_id,
        Math.min(Number(count) || 20, 100),
      );
      if (!forks.length) return `Gist ${gist_id} has no forks.`;
      return [
        `Forks of gist ${gist_id} (${forks.length} shown):`,
        '',
        ...forks.map(
          (f, i) =>
            `${i + 1}. @${f.user?.login ?? 'unknown'}  —  forked ${formatDate(f.created_at)}\n   ${f.html_url ?? f.url ?? ''}`,
        ),
      ].join('\n');
    }

    case 'github_fork_gist': {
      const { gist_id } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const fork = await GithubAPI.forkGist(credentials, gist_id);
      return [
        `Gist ${gist_id} forked successfully`,
        `New gist ID: ${fork.id}`,
        `URL: ${fork.html_url}`,
        `Owner: @${fork.owner?.login ?? 'unknown'}`,
      ].join('\n');
    }

    case 'github_get_workflow_run_usage': {
      const { owner, repo, run_id } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      const usage = await GithubAPI.getWorkflowRunUsage(credentials, owner, repo, run_id);
      const ms = usage.run_duration_ms ?? 0;
      const minutes = Math.floor(ms / 60000);
      const seconds = Math.floor((ms % 60000) / 1000);
      const billable = usage.billable ?? {};
      const billableLines = Object.entries(billable).map(([os, data]) => {
        const osMins = Math.floor((data.total_ms ?? 0) / 60000);
        return `  ${os}: ${osMins} min (${data.jobs ?? 0} job${data.jobs === 1 ? '' : 's'})`;
      });
      return [
        `Workflow run #${run_id} usage in ${owner}/${repo}:`,
        `Total duration: ${minutes}m ${seconds}s`,
        billableLines.length ? '\nBillable time by OS:' : '',
        ...billableLines,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_add_collaborator': {
      const { owner, repo, username, permission = 'push' } = params;
      if (!owner || !repo || !username)
        throw new Error('Missing required params: owner, repo, username');
      const validPerms = ['pull', 'triage', 'push', 'maintain', 'admin'];
      const perm = validPerms.includes(permission) ? permission : 'push';
      const result = await GithubAPI.addCollaborator(credentials, owner, repo, username, perm);
      // 201 = invitation sent, 204 = already a collaborator (result will be null)
      if (!result) {
        return `@${username} is already a collaborator on ${owner}/${repo}.`;
      }
      return [
        `Collaboration invitation sent to @${username} for ${owner}/${repo}`,
        `Permission: ${perm}`,
        result.html_url ? `Invitation URL: ${result.html_url}` : '',
        result.id ? `Invitation ID: ${result.id}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_remove_collaborator': {
      const { owner, repo, username } = params;
      if (!owner || !repo || !username)
        throw new Error('Missing required params: owner, repo, username');
      await GithubAPI.removeCollaborator(credentials, owner, repo, username);
      return `@${username} has been removed as a collaborator from ${owner}/${repo}.`;
    }

    case 'github_set_issue_milestone': {
      const { owner, repo, issue_number, milestone_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const milestoneVal = milestone_number != null ? Number(milestone_number) : null;
      const issue = await GithubAPI.setIssueMilestone(
        credentials,
        owner,
        repo,
        Number(issue_number),
        milestoneVal,
      );
      const milestoneName = issue.milestone?.title ?? 'none';
      return [
        `Milestone updated on ${owner}/${repo}#${issue_number}`,
        `Issue: ${issue.title}`,
        `Milestone: ${milestoneName}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    }

    case 'github_get_assignable_users': {
      const { owner, repo, count = 30 } = params;
      requireRepo(owner, repo);
      const users = await GithubAPI.getAssignableUsers(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 30, 100),
      );
      if (!users.length) return `No assignable users found in ${owner}/${repo}.`;
      return [
        `Assignable users in ${owner}/${repo} (${users.length}):`,
        '',
        ...users.map((u, i) => `${i + 1}. @${u.login}`),
      ].join('\n');
    }

    case 'github_check_user_assignable': {
      const { owner, repo, assignee } = params;
      if (!owner || !repo || !assignee)
        throw new Error('Missing required params: owner, repo, assignee');
      const can = await GithubAPI.checkUserAssignable(credentials, owner, repo, assignee);
      return `@${assignee} ${can ? 'can ✓' : 'cannot ✗'} be assigned to issues in ${owner}/${repo}.`;
    }

    case 'github_transfer_repo': {
      const { owner, repo, new_owner } = params;
      if (!owner || !repo || !new_owner)
        throw new Error('Missing required params: owner, repo, new_owner');
      const result = await GithubAPI.transferRepo(credentials, owner, repo, new_owner);
      return [
        `Repository transfer initiated`,
        `From: ${owner}/${repo}`,
        `To:   ${new_owner}/${repo}`,
        `Note: The transfer may take a few seconds. The new URL will be https://github.com/${new_owner}/${repo}`,
        result.html_url ? `URL: ${result.html_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_archive_repo': {
      const { owner, repo, archive = true } = params;
      requireRepo(owner, repo);
      const shouldArchive = String(archive) !== 'false' && archive !== false;
      const updated = await GithubAPI.archiveRepo(credentials, owner, repo, shouldArchive);
      return [
        `Repository ${shouldArchive ? 'archived' : 'unarchived'}: ${updated.full_name}`,
        `Archived: ${updated.archived}`,
        `URL: ${updated.html_url}`,
      ].join('\n');
    }

    case 'github_generate_release_notes': {
      const { owner, repo, tag_name, previous_tag_name = '', target_commitish = '' } = params;
      if (!owner || !repo || !tag_name)
        throw new Error('Missing required params: owner, repo, tag_name');
      const notes = await GithubAPI.generateReleaseNotes(
        credentials,
        owner,
        repo,
        tag_name,
        previous_tag_name,
        target_commitish,
      );
      return [
        `Generated release notes for ${owner}/${repo} @ ${tag_name}`,
        previous_tag_name ? `Since: ${previous_tag_name}` : '',
        '',
        `Name: ${notes.name}`,
        '',
        `Body:\n${notes.body}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_check_suite': {
      const { owner, repo, check_suite_id } = params;
      if (!owner || !repo || !check_suite_id)
        throw new Error('Missing required params: owner, repo, check_suite_id');
      const suite = await GithubAPI.getCheckSuite(credentials, owner, repo, check_suite_id);
      const app = suite.app?.name ?? 'unknown';
      const conclusion = suite.conclusion ?? 'pending';
      return [
        `Check Suite #${suite.id} in ${owner}/${repo}`,
        `App: ${app}`,
        `Status: ${suite.status} / Conclusion: ${conclusion}`,
        `Branch: ${suite.head_branch ?? 'unknown'}`,
        `SHA: ${suite.head_sha?.slice(0, 7) ?? '?'}`,
        `Rerequestable: ${suite.rerequestable ?? false}`,
        `Runs rerunnable: ${suite.runs_rerequestable ?? false}`,
        suite.url ? `URL: ${suite.url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_list_repo_events': {
      const { owner, repo, count = 20 } = params;
      requireRepo(owner, repo);
      const events = await GithubAPI.listRepoEvents(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 20, 100),
      );
      if (!events.length) return `No public events found for ${owner}/${repo}.`;
      return [
        `Recent public events for ${owner}/${repo} (${events.length} shown):`,
        '',
        ...events.map((e, i) => {
          const actor = e.actor?.login ?? 'unknown';
          const date = formatDate(e.created_at);
          return `${i + 1}. [${e.type}] @${actor} — ${date}`;
        }),
      ].join('\n');
    }

    case 'github_get_stargazers_with_dates': {
      const { owner, repo, count = 30 } = params;
      requireRepo(owner, repo);
      const stargazers = await GithubAPI.getStargazersWithDates(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 30, 100),
      );
      if (!stargazers.length) return `${owner}/${repo} has no stargazers yet.`;
      return [
        `Stargazers with dates for ${owner}/${repo} (${stargazers.length} shown):`,
        '',
        ...stargazers.map((s, i) => {
          const user = s.user?.login ?? s.login ?? 'unknown';
          const date = s.starred_at ? formatDate(s.starred_at) : 'unknown date';
          return `${i + 1}. @${user} — starred ${date}`;
        }),
      ].join('\n');
    }

    case 'github_list_comment_reactions': {
      const { owner, repo, comment_id, count = 30 } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      const reactions = await GithubAPI.listCommentReactions(
        credentials,
        owner,
        repo,
        comment_id,
        Math.min(Number(count) || 30, 100),
      );
      if (!reactions.length) return `No reactions on comment #${comment_id} in ${owner}/${repo}.`;
      const counts = reactions.reduce((acc, r) => {
        acc[r.content] = (acc[r.content] ?? 0) + 1;
        return acc;
      }, {});
      const emojiMap = {
        '+1': '👍',
        '-1': '👎',
        laugh: '😄',
        hooray: '🎉',
        confused: '😕',
        heart: '❤️',
        rocket: '🚀',
        eyes: '👀',
      };
      return [
        `Reactions on comment #${comment_id} in ${owner}/${repo} (${reactions.length} total):`,
        '',
        ...Object.entries(counts).map(([k, v]) => `${emojiMap[k] ?? k}  ${v}`),
      ].join('\n');
    }

    case 'github_get_git_commit': {
      const { owner, repo, sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const c = await GithubAPI.getGitCommitObject(credentials, owner, repo, sha);
      const parents = (c.parents ?? []).map((p) => p.sha?.slice(0, 7)).join(', ') || 'none';
      return [
        `Git commit object: ${c.sha?.slice(0, 7) ?? sha}`,
        `Tree: ${c.tree?.sha ?? 'unknown'}`,
        `Parents: ${parents}`,
        `Message: ${(c.message ?? '').split('\n')[0]}`,
        `Author: ${c.author?.name ?? 'unknown'} <${c.author?.email ?? ''}> on ${formatDateTime(c.author?.date)}`,
        `Committer: ${c.committer?.name ?? 'unknown'} on ${formatDateTime(c.committer?.date)}`,
        c.verification?.verified !== undefined
          ? `Signature verified: ${c.verification.verified}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_check_user_following': {
      const { username } = params;
      if (!username) throw new Error('Missing required param: username');
      const isFollowing = await GithubAPI.checkUserFollowing(credentials, username);
      return `You ${isFollowing ? 'are ✓ following' : 'are ✗ not following'} @${username}.`;
    }

    case 'github_get_git_tree': {
      const { owner, repo, sha, recursive = false } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const tree = await GithubAPI.getGitTreeObject(
        credentials,
        owner,
        repo,
        sha,
        Boolean(recursive),
      );
      const items = tree.tree ?? [];
      return [
        `Git tree object ${sha.slice(0, 7)} in ${owner}/${repo} (${items.length} entries):`,
        `Truncated: ${tree.truncated ?? false}`,
        '',
        ...items.slice(0, 50).map((item) => {
          const type = item.type === 'tree' ? '📁' : '📄';
          return `${type} ${item.path}  [${item.mode}]  sha: ${item.sha?.slice(0, 7) ?? '?'}`;
        }),
        items.length > 50 ? `  ...and ${items.length - 50} more entries` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_git_blob': {
      const { owner, repo, sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const blob = await GithubAPI.getGitBlob(credentials, owner, repo, sha);
      let preview = '';
      if (blob.content && blob.encoding === 'base64') {
        try {
          const decoded = Buffer.from(blob.content.replace(/\n/g, ''), 'base64').toString('utf-8');
          preview = decoded.slice(0, 500);
          if (decoded.length > 500) preview += '\n...(truncated)';
        } catch {
          preview = '(binary content, cannot preview)';
        }
      }
      return [
        `Git blob ${sha.slice(0, 7)} in ${owner}/${repo}`,
        `Size: ${blob.size ?? 0} bytes`,
        `Encoding: ${blob.encoding ?? 'unknown'}`,
        preview ? `\nContent preview:\n${preview}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_github_meta': {
      const meta = await GithubAPI.getGitHubMeta();
      return [
        'GitHub Meta Information:',
        '',
        `Verifiable password auth: ${meta.verifiable_password_authentication ?? false}`,
        meta.installed_version ? `Installed version: ${meta.installed_version}` : '',
        '',
        'IP ranges (showing first entries per category):',
        meta.hooks?.length
          ? `Hooks:       ${meta.hooks.slice(0, 3).join(', ')}${meta.hooks.length > 3 ? ` (+${meta.hooks.length - 3} more)` : ''}`
          : '',
        meta.git?.length
          ? `Git:         ${meta.git.slice(0, 3).join(', ')}${meta.git.length > 3 ? ` (+${meta.git.length - 3} more)` : ''}`
          : '',
        meta.api?.length
          ? `API:         ${meta.api.slice(0, 3).join(', ')}${meta.api.length > 3 ? ` (+${meta.api.length - 3} more)` : ''}`
          : '',
        meta.actions?.length
          ? `Actions:     ${meta.actions.slice(0, 3).join(', ')}${meta.actions.length > 3 ? ` (+${meta.actions.length - 3} more)` : ''}`
          : '',
        meta.dependabot?.length
          ? `Dependabot:  ${meta.dependabot.slice(0, 3).join(', ')}${meta.dependabot.length > 3 ? ` (+${meta.dependabot.length - 3} more)` : ''}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_codeowners_errors': {
      const { owner, repo, ref = '' } = params;
      requireRepo(owner, repo);
      const data = await GithubAPI.getCodeownersErrors(credentials, owner, repo, ref);
      const errors = data.errors ?? [];
      if (!errors.length)
        return `No CODEOWNERS errors found in ${owner}/${repo}${ref ? ` @ ${ref}` : ''}.`;
      return [
        `CODEOWNERS errors in ${owner}/${repo}${ref ? ` @ ${ref}` : ''} (${errors.length}):`,
        '',
        ...errors.map((e, i) => {
          return [
            `${i + 1}. [${e.kind}] Line ${e.line ?? '?'} in ${e.path ?? 'CODEOWNERS'}`,
            e.message ? `   ${e.message}` : '',
            e.suggestion ? `   Suggestion: ${e.suggestion}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        }),
      ].join('\n');
    }

    case 'github_remove_assignees': {
      const { owner, repo, issue_number, assignees } = params;
      if (!owner || !repo || !issue_number || !assignees)
        throw new Error('Missing required params: owner, repo, issue_number, assignees');
      const parsed = assignees
        .split(',')
        .map((a) => a.trim())
        .filter(Boolean);
      await GithubAPI.removeAssignees(credentials, owner, repo, Number(issue_number), parsed);
      return [
        `Assignees removed from ${owner}/${repo}#${issue_number}`,
        `Removed: ${parsed.map((a) => `@${a}`).join(', ')}`,
      ].join('\n');
    }

    case 'github_get_readme_at_path': {
      const { owner, repo, dir_path = '', ref = '' } = params;
      requireRepo(owner, repo);
      const file = await GithubAPI.getReadmeAtPath(credentials, owner, repo, dir_path, ref);
      let content = '';
      if (file.content && file.encoding === 'base64') {
        content = Buffer.from(file.content.replace(/\n/g, ''), 'base64').toString('utf-8');
      }
      const preview = content.length > 4000 ? `${content.slice(0, 4000)}\n...(truncated)` : content;
      return [
        `README at ${dir_path || '/'} in ${owner}/${repo}${ref ? ` @ ${ref}` : ''}:`,
        `File: ${file.path}`,
        '',
        preview || '(empty)',
      ].join('\n');
    }

    case 'github_create_tag': {
      const {
        owner,
        repo,
        tag,
        message,
        object,
        type = 'commit',
        tagger_name,
        tagger_email,
      } = params;
      if (!owner || !repo || !tag || !message || !object)
        throw new Error('Missing required params: owner, repo, tag, message, object');
      const tagger =
        tagger_name && tagger_email
          ? { name: tagger_name, email: tagger_email, date: new Date().toISOString() }
          : undefined;
      const result = await GithubAPI.createTag(credentials, owner, repo, {
        tag,
        message,
        object,
        type,
        tagger,
      });
      return [
        `Annotated tag created in ${owner}/${repo}`,
        `Tag: ${result.tag}`,
        `SHA: ${result.sha?.slice(0, 7) ?? '?'}`,
        `Object: ${result.object?.sha?.slice(0, 7) ?? object.slice(0, 7)} (${result.object?.type ?? type})`,
        `Message: ${result.message}`,
        `Note: Create a refs/tags/${tag} ref pointing to this tag object SHA to make the tag appear in the UI.`,
      ].join('\n');
    }

    case 'github_delete_reaction': {
      const { owner, repo, issue_number, reaction_id } = params;
      if (!owner || !repo || !issue_number || !reaction_id)
        throw new Error('Missing required params: owner, repo, issue_number, reaction_id');
      await GithubAPI.deleteReaction(credentials, owner, repo, Number(issue_number), reaction_id);
      return `Reaction #${reaction_id} removed from ${owner}/${repo}#${issue_number}.`;
    }

    case 'github_get_latest_pages_build': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const build = await GithubAPI.getLatestPagesBuild(credentials, owner, repo);
      return [
        `Latest GitHub Pages build for ${owner}/${repo}:`,
        `Status: ${build.status ?? 'unknown'}`,
        `Duration: ${build.duration != null ? `${(build.duration / 1000).toFixed(1)}s` : 'unknown'}`,
        build.error?.message ? `Error: ${build.error.message}` : '',
        `Pushed by: @${build.pusher?.login ?? 'unknown'}`,
        `Created: ${formatDateTime(build.created_at)}`,
        `Updated: ${formatDateTime(build.updated_at)}`,
        `URL: ${build.url ?? 'n/a'}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_user_packages': {
      const { username, package_type = '', count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const packages = await GithubAPI.getUserPackages(
        credentials,
        username,
        package_type,
        Math.min(Number(count) || 30, 100),
      );
      if (!packages.length)
        return `No packages found for @${username}${package_type ? ` (type: ${package_type})` : ''}.`;
      return [
        `Packages for @${username} (${packages.length} shown):`,
        '',
        ...packages.map((pkg, i) => {
          const updated = formatDate(pkg.updated_at);
          return `${i + 1}. ${pkg.name}  [${pkg.package_type}]  visibility: ${pkg.visibility ?? 'unknown'}  updated: ${updated}`;
        }),
      ].join('\n');
    }

    case 'github_get_package_versions': {
      const { username, package_type, package_name, count = 20 } = params;
      if (!username || !package_type || !package_name)
        throw new Error('Missing required params: username, package_type, package_name');
      const versions = await GithubAPI.getPackageVersions(
        credentials,
        username,
        package_type,
        package_name,
        Math.min(Number(count) || 20, 100),
      );
      if (!versions.length)
        return `No versions found for package "${package_name}" (${package_type}) owned by @${username}.`;
      return [
        `Versions of ${package_type}/${package_name} by @${username} (${versions.length} shown):`,
        '',
        ...versions.map((v, i) => {
          const tags =
            ((v.metadata?.container?.tags ?? v.metadata?.npm?.name) ? [v.metadata.npm?.tag] : [])
              .filter(Boolean)
              .join(', ') || 'untagged';
          return `${i + 1}. v${v.name ?? v.id}  id: ${v.id}  created: ${formatDate(v.created_at)}`;
        }),
      ].join('\n');
    }

    case 'github_create_deployment': {
      const {
        owner,
        repo,
        ref,
        task = 'deploy',
        environment = 'production',
        description = '',
        payload = '',
      } = params;
      if (!owner || !repo || !ref) throw new Error('Missing required params: owner, repo, ref');
      const deployment = await GithubAPI.createDeployment(credentials, owner, repo, {
        ref,
        task,
        autoMerge: false,
        description,
        environment,
        payload,
      });
      return [
        `Deployment created in ${owner}/${repo}`,
        `ID: ${deployment.id}`,
        `Ref: ${deployment.ref}`,
        `Task: ${deployment.task}`,
        `Environment: ${deployment.environment}`,
        description ? `Description: ${description}` : '',
        `Created: ${formatDateTime(deployment.created_at)}`,
        `Statuses URL: ${deployment.statuses_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_create_deployment_status': {
      const {
        owner,
        repo,
        deployment_id,
        state,
        log_url = '',
        description = '',
        environment = '',
        environment_url = '',
      } = params;
      if (!owner || !repo || !deployment_id || !state)
        throw new Error('Missing required params: owner, repo, deployment_id, state');
      const validStates = [
        'error',
        'failure',
        'inactive',
        'in_progress',
        'queued',
        'pending',
        'success',
      ];
      if (!validStates.includes(state))
        throw new Error(`state must be one of: ${validStates.join(', ')}`);
      const status = await GithubAPI.createDeploymentStatus(
        credentials,
        owner,
        repo,
        deployment_id,
        {
          state,
          logUrl: log_url,
          description,
          environment,
          environmentUrl: environment_url,
        },
      );
      return [
        `Deployment status posted on ${owner}/${repo} deployment #${deployment_id}`,
        `State: ${status.state}`,
        status.environment ? `Environment: ${status.environment}` : '',
        status.description ? `Description: ${status.description}` : '',
        status.log_url ? `Logs: ${status.log_url}` : '',
        status.environment_url ? `App URL: ${status.environment_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_trigger_repo_dispatch': {
      const { owner, repo, event_type, client_payload } = params;
      if (!owner || !repo || !event_type)
        throw new Error('Missing required params: owner, repo, event_type');
      let payload = {};
      if (client_payload) {
        try {
          payload = JSON.parse(client_payload);
        } catch {
          /* use empty */
        }
      }
      await GithubAPI.triggerRepoDispatch(credentials, owner, repo, event_type, payload);
      return [
        `repository_dispatch event triggered on ${owner}/${repo}`,
        `Event type: ${event_type}`,
        Object.keys(payload).length ? `Payload: ${JSON.stringify(payload)}` : '',
        'Workflows listening for this event will be queued shortly.',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_get_git_tag_object': {
      const { owner, repo, tag_sha } = params;
      if (!owner || !repo || !tag_sha)
        throw new Error('Missing required params: owner, repo, tag_sha');
      const tag = await GithubAPI.getGitTagObject(credentials, owner, repo, tag_sha);
      return [
        `Annotated tag object in ${owner}/${repo}:`,
        `Tag name: ${tag.tag}`,
        `SHA: ${tag.sha?.slice(0, 7) ?? tag_sha.slice(0, 7)}`,
        `Object: ${tag.object?.sha?.slice(0, 7) ?? '?'} (${tag.object?.type ?? '?'})`,
        `Tagger: ${tag.tagger?.name ?? 'unknown'} <${tag.tagger?.email ?? ''}> on ${formatDate(tag.tagger?.date)}`,
        `Message:\n${(tag.message ?? '').trim()}`,
        tag.verification?.verified !== undefined
          ? `Signature verified: ${tag.verification.verified}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_list_check_run_annotations': {
      const { owner, repo, check_run_id, count = 50 } = params;
      if (!owner || !repo || !check_run_id)
        throw new Error('Missing required params: owner, repo, check_run_id');
      const annotations = await GithubAPI.listCheckRunAnnotations(
        credentials,
        owner,
        repo,
        check_run_id,
        Math.min(Number(count) || 50, 100),
      );
      if (!annotations.length)
        return `No annotations found for check run #${check_run_id} in ${owner}/${repo}.`;
      return [
        `Annotations for check run #${check_run_id} in ${owner}/${repo} (${annotations.length}):`,
        '',
        ...annotations.map((a, i) => {
          const loc = `${a.path}:${a.start_line ?? '?'}${a.end_line && a.end_line !== a.start_line ? `-${a.end_line}` : ''}`;
          return [
            `${i + 1}. [${a.annotation_level?.toUpperCase() ?? 'NOTICE'}] ${loc}`,
            a.title ? `   ${a.title}` : '',
            a.message ? `   ${a.message}` : '',
            a.raw_details ? `   Details: ${a.raw_details.slice(0, 100)}` : '',
          ]
            .filter(Boolean)
            .join('\n');
        }),
      ].join('\n');
    }

    case 'github_get_combined_status': {
      const { owner, repo, ref } = params;
      if (!owner || !repo || !ref) throw new Error('Missing required params: owner, repo, ref');
      const data = await GithubAPI.getCombinedStatus(credentials, owner, repo, ref);
      const statuses = data.statuses ?? [];
      return [
        `Combined commit status for ${ref} in ${owner}/${repo}:`,
        `Overall state: ${data.state ?? 'unknown'}`,
        `SHA: ${data.sha?.slice(0, 7) ?? '?'}`,
        `Total checks: ${data.total_count ?? statuses.length}`,
        '',
        statuses.length ? 'Individual statuses:' : 'No individual statuses.',
        ...statuses
          .slice(0, 20)
          .map(
            (s, i) =>
              `${i + 1}. [${s.state}] ${s.context ?? 'status'}${s.description ? ` — ${s.description}` : ''}`,
          ),
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_list_matching_refs': {
      const { owner, repo, ref_pattern } = params;
      if (!owner || !repo || !ref_pattern)
        throw new Error('Missing required params: owner, repo, ref_pattern');
      const refs = await GithubAPI.listMatchingRefs(credentials, owner, repo, ref_pattern);
      if (!refs?.length) return `No refs matching "${ref_pattern}" in ${owner}/${repo}.`;
      return [
        `Refs matching "${ref_pattern}" in ${owner}/${repo} (${refs.length}):`,
        '',
        ...refs.map(
          (r, i) =>
            `${i + 1}. ${r.ref}  →  ${r.object?.sha?.slice(0, 7) ?? '?'} [${r.object?.type ?? '?'}]`,
        ),
      ].join('\n');
    }

    case 'github_update_git_ref': {
      const { owner, repo, ref, sha, force = false } = params;
      if (!owner || !repo || !ref || !sha)
        throw new Error('Missing required params: owner, repo, ref, sha');
      const updated = await GithubAPI.updateGitRef(
        credentials,
        owner,
        repo,
        ref,
        sha,
        Boolean(force),
      );
      return [
        `Git ref updated in ${owner}/${repo}`,
        `Ref: ${updated.ref}`,
        `SHA: ${updated.object?.sha?.slice(0, 7) ?? sha.slice(0, 7)}`,
        `Type: ${updated.object?.type ?? 'unknown'}`,
        force ? 'Note: Force update was used.' : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_create_git_ref': {
      const { owner, repo, ref, sha } = params;
      if (!owner || !repo || !ref || !sha)
        throw new Error('Missing required params: owner, repo, ref, sha');
      const created = await GithubAPI.createGitRef(credentials, owner, repo, ref, sha);
      return [
        `Git ref created in ${owner}/${repo}`,
        `Ref: ${created.ref}`,
        `SHA: ${created.object?.sha?.slice(0, 7) ?? sha.slice(0, 7)}`,
        `Type: ${created.object?.type ?? 'unknown'}`,
      ].join('\n');
    }

    case 'github_list_repo_review_comments': {
      const { owner, repo, sort = 'created', direction = 'desc', count = 30 } = params;
      requireRepo(owner, repo);
      const comments = await GithubAPI.listRepoReviewComments(
        credentials,
        owner,
        repo,
        sort,
        direction,
        Math.min(Number(count) || 30, 100),
      );
      if (!comments.length) return `No pull request review comments found in ${owner}/${repo}.`;
      return [
        `PR review comments in ${owner}/${repo} (${comments.length} shown, sorted by ${sort} ${direction}):`,
        '',
        ...comments.map((c, i) => {
          const body = String(c.body ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 150);
          return [
            `${i + 1}. @${c.user?.login ?? 'unknown'} on PR #${c.pull_request_url?.split('/').pop() ?? '?'} — ${formatDate(c.created_at)}`,
            `   ${c.path}:${c.line ?? c.original_line ?? '?'}`,
            `   ${body}${(c.body?.length ?? 0) > 150 ? '...' : ''}`,
          ].join('\n');
        }),
      ].join('\n');
    }

    case 'github_get_pr_review_comment': {
      const { owner, repo, comment_id } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      const c = await GithubAPI.getPRReviewComment(credentials, owner, repo, comment_id);
      return [
        `PR review comment #${c.id} in ${owner}/${repo}`,
        `Author: @${c.user?.login ?? 'unknown'}`,
        `File: ${c.path}:${c.line ?? c.original_line ?? '?'}`,
        `PR: ${c.pull_request_url?.split('/').pop() ?? '?'}`,
        `Created: ${formatDate(c.created_at)} | Updated: ${formatDate(c.updated_at)}`,
        `URL: ${c.html_url}`,
        '',
        c.body ?? '(empty)',
      ].join('\n');
    }

    case 'github_update_pr_review_comment': {
      const { owner, repo, comment_id, body } = params;
      if (!owner || !repo || !comment_id || !body)
        throw new Error('Missing required params: owner, repo, comment_id, body');
      const c = await GithubAPI.updatePRReviewComment(credentials, owner, repo, comment_id, body);
      return [
        `PR review comment #${comment_id} updated in ${owner}/${repo}`,
        `URL: ${c?.html_url ?? `https://github.com/${owner}/${repo}`}`,
      ].join('\n');
    }

    case 'github_delete_pr_review_comment': {
      const { owner, repo, comment_id } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      await GithubAPI.deletePRReviewComment(credentials, owner, repo, comment_id);
      return `PR review comment #${comment_id} deleted from ${owner}/${repo}.`;
    }

    case 'github_list_commit_branches': {
      const { owner, repo, sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const branches = await GithubAPI.listCommitBranches(credentials, owner, repo, sha);
      if (!branches?.length)
        return `Commit ${sha.slice(0, 7)} is not the HEAD of any branch in ${owner}/${repo}.`;
      return [
        `Branches where ${sha.slice(0, 7)} is HEAD in ${owner}/${repo} (${branches.length}):`,
        '',
        ...branches.map((b, i) => `${i + 1}. ${b.name}${b.protected ? ' [protected]' : ''}`),
      ].join('\n');
    }

    case 'github_get_org_actions_permissions': {
      const { org } = params;
      if (!org) throw new Error('Missing required param: org');
      const data = await GithubAPI.getOrgActionsPermissions(credentials, org);
      return [
        `GitHub Actions permissions for org ${org}:`,
        `Enabled repositories: ${data.enabled_repositories ?? 'unknown'}`,
        `Allowed actions: ${data.allowed_actions ?? 'unknown'}`,
        data.selected_actions_url ? `Selected actions URL: ${data.selected_actions_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_list_org_blocked_users': {
      const { org, count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const users = await GithubAPI.listOrgBlockedUsers(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      if (!users.length) return `No blocked users found for org "${org}".`;
      return [
        `Blocked users in org ${org} (${users.length}):`,
        '',
        ...users.map((u, i) => `${i + 1}. @${u.login}`),
      ].join('\n');
    }

    case 'github_get_repo_archive_link': {
      const { owner, repo, format = 'zipball', ref = '' } = params;
      requireRepo(owner, repo);
      const validFormats = ['zipball', 'tarball'];
      const fmt = validFormats.includes(format) ? format : 'zipball';
      const result = await GithubAPI.getRepoArchiveLink(credentials, owner, repo, fmt, ref);
      return [
        `Archive download link for ${owner}/${repo}:`,
        `Format: ${result.format} (.${fmt === 'zipball' ? 'zip' : 'tar.gz'})`,
        `Ref: ${result.ref}`,
        result.url
          ? `URL: ${result.url}`
          : 'Note: Redirect URL not captured — use the GitHub web UI or make a GET request with your token to the API endpoint directly.',
      ].join('\n');
    }

    case 'github_get_readme_html': {
      const { owner, repo, ref = '' } = params;
      requireRepo(owner, repo);
      const html = await GithubAPI.getReadmeHtml(credentials, owner, repo, ref);
      const preview = html.length > 3000 ? `${html.slice(0, 3000)}\n...(truncated)` : html;
      return [
        `Rendered README HTML for ${owner}/${repo}${ref ? ` @ ${ref}` : ''}:`,
        '',
        preview,
      ].join('\n');
    }

    case 'github_get_gitignore_templates': {
      const templates = await GithubAPI.getGitignoreTemplates(credentials);
      if (!templates?.length) return 'No .gitignore templates found.';
      return [
        `Available .gitignore templates (${templates.length} total):`,
        '',
        templates.join(', '),
        '',
        'Use github_get_gitignore_template with any name above to fetch its content.',
      ].join('\n');
    }

    case 'github_get_gitignore_template': {
      const { name } = params;
      if (!name) throw new Error('Missing required param: name');
      const tmpl = await GithubAPI.getGitignoreTemplate(credentials, name);
      const preview =
        (tmpl.source ?? '').length > 3000
          ? `${tmpl.source.slice(0, 3000)}\n...(truncated)`
          : (tmpl.source ?? '');
      return [`.gitignore template: ${tmpl.name}`, '', preview || '(empty)'].join('\n');
    }

    case 'github_list_licenses': {
      const licenses = await GithubAPI.listLicenses(credentials);
      if (!licenses?.length) return 'No license templates found.';
      return [
        `Available license templates (${licenses.length}):`,
        '',
        ...licenses.map((l, i) => `${i + 1}. ${l.spdx_id.padEnd(20)} ${l.name}`),
        '',
        'Use github_get_license with the spdx_id to fetch full text.',
      ].join('\n');
    }

    case 'github_get_license': {
      const { license_key } = params;
      if (!license_key) throw new Error('Missing required param: license_key');
      const lic = await GithubAPI.getLicense(credentials, license_key);
      const body = (lic.body ?? '').slice(0, 1500);
      const truncated = (lic.body ?? '').length > 1500;
      return [
        `License: ${lic.name} (${lic.spdx_id})`,
        `Category: ${lic.category ?? 'unknown'}`,
        `FSF approved: ${lic.featured ?? false} | OSI approved: ${lic.key !== undefined}`,
        lic.html_url ? `Info: ${lic.html_url}` : '',
        '',
        'License text:',
        body + (truncated ? '\n...(truncated)' : ''),
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_render_markdown': {
      const { text, mode = 'markdown', context = '' } = params;
      if (!text) throw new Error('Missing required param: text');
      const html = await GithubAPI.renderMarkdown(credentials, text, mode, context);
      const preview = html.length > 3000 ? `${html.slice(0, 3000)}\n...(truncated)` : html;
      return [`Rendered markdown (mode: ${mode}):`, '', preview].join('\n');
    }

    case 'github_get_emojis': {
      const emojis = await GithubAPI.getEmojis(credentials);
      const entries = Object.entries(emojis);
      if (!entries.length) return 'No emoji data returned.';
      // Group into a readable sample — full list is 1800+ entries
      const sample = entries.slice(0, 50);
      return [
        `GitHub emoji map (${entries.length} total emojis). Showing first 50:`,
        '',
        sample.map(([name]) => `:${name}:`).join('  '),
        '',
        'Each name maps to an image URL. Use the emoji name wrapped in colons in GitHub markdown.',
      ].join('\n');
    }

    case 'github_get_notification_thread': {
      const { thread_id } = params;
      if (!thread_id) throw new Error('Missing required param: thread_id');
      const t = await GithubAPI.getNotificationThread(credentials, thread_id);
      return [
        `Notification thread #${thread_id}:`,
        `Reason: ${t.reason}`,
        `Subject: ${t.subject?.title ?? 'unknown'} [${t.subject?.type ?? '?'}]`,
        `Repository: ${t.repository?.full_name ?? 'unknown'}`,
        `Unread: ${t.unread}`,
        `Updated: ${formatDateTime(t.updated_at)}`,
        t.subject?.url
          ? `URL: ${t.subject.url.replace('api.github.com/repos', 'github.com').replace('/pulls/', '/pull/').replace('/issues/', '/issues/')}`
          : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_mark_thread_read': {
      const { thread_id } = params;
      if (!thread_id) throw new Error('Missing required param: thread_id');
      await GithubAPI.markThreadRead(credentials, thread_id);
      return `Notification thread #${thread_id} marked as read.`;
    }

    case 'github_get_thread_subscription': {
      const { thread_id } = params;
      if (!thread_id) throw new Error('Missing required param: thread_id');
      const sub = await GithubAPI.getThreadSubscription(credentials, thread_id);
      return [
        `Subscription for notification thread #${thread_id}:`,
        `Subscribed: ${sub.subscribed ?? false}`,
        `Ignored: ${sub.ignored ?? false}`,
        `Reason: ${sub.reason ?? 'none'}`,
        sub.created_at ? `Since: ${formatDate(sub.created_at)}` : '',
        sub.url ? `Thread URL: ${sub.url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_set_thread_subscription': {
      const { thread_id, subscribed = true, ignored = false } = params;
      if (!thread_id) throw new Error('Missing required param: thread_id');
      const sub = await GithubAPI.setThreadSubscription(
        credentials,
        thread_id,
        Boolean(subscribed),
        Boolean(ignored),
      );
      return [
        `Thread #${thread_id} subscription updated:`,
        `Subscribed: ${sub.subscribed}`,
        `Ignored: ${sub.ignored}`,
        `Reason: ${sub.reason ?? 'manual'}`,
      ].join('\n');
    }

    case 'github_list_repo_notifications': {
      const { owner, repo, unread_only = true, count = 20 } = params;
      requireRepo(owner, repo);
      const notifications = await GithubAPI.listRepoNotifications(
        credentials,
        owner,
        repo,
        Boolean(unread_only),
        Math.min(Number(count) || 20, 100),
      );
      if (!notifications.length)
        return `No ${Boolean(unread_only) ? 'unread ' : ''}notifications for ${owner}/${repo}.`;
      return [
        `Notifications for ${owner}/${repo} (${notifications.length} shown):`,
        '',
        ...notifications.map((n, i) => {
          const type = n.subject?.type ?? '?';
          const title = n.subject?.title ?? 'unknown';
          const updated = formatDate(n.updated_at);
          return `${i + 1}. [${type}] ${title}\n   Reason: ${n.reason} | Updated: ${updated} | Unread: ${n.unread}`;
        }),
      ].join('\n');
    }

    case 'github_mark_repo_notifications_read': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      await GithubAPI.markRepoNotificationsRead(credentials, owner, repo);
      return `All notifications for ${owner}/${repo} marked as read.`;
    }

    case 'github_get_pending_org_invitations': {
      const { org, count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const invitations = await GithubAPI.getPendingOrgInvitations(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      if (!invitations.length) return `No pending invitations for org "${org}".`;
      return [
        `Pending org invitations for ${org} (${invitations.length}):`,
        '',
        ...invitations.map((inv, i) => {
          const who = inv.login ? `@${inv.login}` : (inv.email ?? 'unknown');
          const inviter = inv.inviter?.login ?? 'unknown';
          const role = inv.role ?? 'unknown';
          const created = formatDate(inv.created_at);
          return `${i + 1}. ${who}  role: ${role}  invited by @${inviter}  on ${created}`;
        }),
      ].join('\n');
    }

    case 'github_list_org_runners': {
      const { org, count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const data = await GithubAPI.listOrgRunners(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      const runners = data.runners ?? [];
      if (!runners.length) return `No self-hosted runners found for org "${org}".`;
      return [
        `Self-hosted runners for org ${org} (${runners.length}):`,
        '',
        ...runners.map((r, i) => {
          const labels = (r.labels ?? []).map((l) => l.name).join(', ') || 'none';
          return `${i + 1}. ${r.name}  [${r.status}]  OS: ${r.os ?? 'unknown'}  Labels: ${labels}`;
        }),
      ].join('\n');
    }

    case 'github_search_topics': {
      const { query, count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GithubAPI.searchTopics(
        credentials,
        query,
        Math.min(Number(count) || 20, 50),
      );
      const items = result.items ?? [];
      if (!items.length) return `No topics found for "${query}".`;
      return [
        `Topic search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
        '',
        ...items.slice(0, 20).map((t, i) => {
          const featured = t.featured ? ' ⭐' : '';
          const curated = t.curated ? ' [curated]' : '';
          return [
            `${i + 1}. ${t.name}${featured}${curated}`,
            t.short_description ? `   ${t.short_description}` : '',
            `   Repos: ${(t.repository_count ?? 0).toLocaleString()}`,
          ]
            .filter(Boolean)
            .join('\n');
        }),
      ].join('\n');
    }

    case 'github_get_runner_applications': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const apps = await GithubAPI.getRunnerApplications(credentials, owner, repo);
      if (!apps?.length) return `No runner application downloads found for ${owner}/${repo}.`;
      return [
        `Self-hosted runner downloads for ${owner}/${repo}:`,
        '',
        ...apps.map(
          (a, i) =>
            `${i + 1}. ${a.os}-${a.architecture}  v${a.download_url?.match(/v[\d.]+/)?.[0] ?? '?'}\n   ${a.download_url}`,
        ),
      ].join('\n');
    }

    case 'github_list_pr_review_comment_reactions': {
      const { owner, repo, comment_id, count = 30 } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      const reactions = await GithubAPI.listPRReviewCommentReactions(
        credentials,
        owner,
        repo,
        comment_id,
        Math.min(Number(count) || 30, 100),
      );
      if (!reactions.length)
        return `No reactions on PR review comment #${comment_id} in ${owner}/${repo}.`;
      const counts = reactions.reduce((acc, r) => {
        acc[r.content] = (acc[r.content] ?? 0) + 1;
        return acc;
      }, {});
      const emojiMap = {
        '+1': '👍',
        '-1': '👎',
        laugh: '😄',
        hooray: '🎉',
        confused: '😕',
        heart: '❤️',
        rocket: '🚀',
        eyes: '👀',
      };
      return [
        `Reactions on PR review comment #${comment_id} in ${owner}/${repo} (${reactions.length} total):`,
        '',
        ...Object.entries(counts).map(([k, v]) => `${emojiMap[k] ?? k}  ${v}`),
      ].join('\n');
    }

    case 'github_add_pr_review_comment_reaction': {
      const { owner, repo, comment_id, content } = params;
      if (!owner || !repo || !comment_id || !content)
        throw new Error('Missing required params: owner, repo, comment_id, content');
      const valid = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
      if (!valid.includes(content)) throw new Error(`content must be one of: ${valid.join(', ')}`);
      const reaction = await GithubAPI.addPRReviewCommentReaction(
        credentials,
        owner,
        repo,
        comment_id,
        content,
      );
      const emojiMap = {
        '+1': '👍',
        '-1': '👎',
        laugh: '😄',
        hooray: '🎉',
        confused: '😕',
        heart: '❤️',
        rocket: '🚀',
        eyes: '👀',
      };
      return `Reaction ${emojiMap[content] ?? content} added to PR review comment #${comment_id} in ${owner}/${repo} (reaction ID: ${reaction.id}).`;
    }

    case 'github_get_commit_comment': {
      const { owner, repo, comment_id } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      const c = await GithubAPI.getCommitComment(credentials, owner, repo, comment_id);
      return [
        `Commit comment #${c.id} in ${owner}/${repo}`,
        `Author: @${c.user?.login ?? 'unknown'}`,
        c.path ? `File: ${c.path}${c.line != null ? `:${c.line}` : ''}` : 'General commit comment',
        `Commit: ${c.commit_id?.slice(0, 7) ?? 'unknown'}`,
        `Created: ${formatDate(c.created_at)} | Updated: ${formatDate(c.updated_at)}`,
        `URL: ${c.html_url}`,
        '',
        c.body ?? '(empty)',
      ]
        .filter(Boolean)
        .join('\n');
    }

    case 'github_list_all_commit_comments': {
      const { owner, repo, count = 30 } = params;
      requireRepo(owner, repo);
      const comments = await GithubAPI.listAllCommitComments(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 30, 100),
      );
      if (!comments.length) return `No commit comments found in ${owner}/${repo}.`;
      return [
        `Commit comments in ${owner}/${repo} (${comments.length} shown):`,
        '',
        ...comments.map((c, i) => {
          const body = String(c.body ?? '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 120);
          const commit = c.commit_id?.slice(0, 7) ?? '?';
          return [
            `${i + 1}. @${c.user?.login ?? 'unknown'} on \`${commit}\` — ${formatDate(c.created_at)}`,
            c.path ? `   File: ${c.path}` : '',
            `   ${body}${(c.body?.length ?? 0) > 120 ? '...' : ''}`,
          ]
            .filter(Boolean)
            .join('\n');
        }),
      ].join('\n');
    }

    default:
      throw new Error(`Unknown GitHub tool: ${toolName}`);
  }
}

export default executeGithubChatTool;
