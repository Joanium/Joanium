import { GithubAPI, parseCommaList, requireGithubCredentials } from './Common.js';

const SOURCE_EXTS = new Set([
  'js', 'ts', 'jsx', 'tsx', 'mjs', 'cjs',
  'py', 'rb', 'go', 'rs', 'java', 'kt', 'swift',
  'c', 'cpp', 'h', 'hpp', 'cs',
  'vue', 'svelte', 'astro',
  'css', 'scss', 'less',
  'html', 'ejs', 'hbs',
  'json', 'yaml', 'yml', 'toml',
  'sh', 'bash', 'zsh',
  'md', 'mdx',
  'sql', 'graphql', 'gql',
  'env', 'dockerfile', 'makefile',
]);

const ALWAYS_LOAD = new Set([
  'package.json', 'package-lock.json', 'yarn.lock',
  'README.md', 'readme.md',
  'Dockerfile', 'docker-compose.yml', 'docker-compose.yaml',
  '.env.example', 'Makefile', 'Justfile',
  'pyproject.toml', 'setup.py', 'requirements.txt',
  'Cargo.toml', 'go.mod',
  'tsconfig.json', 'jsconfig.json', 'vite.config.js', 'vite.config.ts',
  'webpack.config.js', 'rollup.config.js',
  '.eslintrc.js', '.prettierrc',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', '.nuxt',
  '__pycache__', '.pytest_cache', 'venv', '.venv', 'env',
  'coverage', '.nyc_output', '.cache', 'tmp', 'temp',
  'vendor', 'target', 'bin', 'obj', '.gradle',
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
  const ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : filename.toLowerCase();

  if (parts.some(part => SKIP_DIRS.has(part))) return -1;

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
  ].filter(Boolean).join('\n');
}

export async function executeGithubChatTool(ctx, toolName, params = {}) {
  const credentials = requireGithubCredentials(ctx);

  switch (toolName) {
    case 'github_list_repos': {
      const repos = await GithubAPI.getRepos(credentials);
      const lines = repos.slice(0, 20).map(repo => (
        `- ${repo.full_name}: ${repo.description || 'No description'} [${repo.language || 'unknown'}] * ${repo.stargazers_count}`
      )).join('\n');
      return `User has ${repos.length} repositories (showing top 20):\n\n${lines}`;
    }

    case 'github_get_issues': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const issues = await GithubAPI.getIssues(credentials, owner, repo, params.state || 'open');
      if (!issues.length) return `No ${params.state || 'open'} issues in ${owner}/${repo}.`;
      return `${issues.length} issue(s) in ${owner}/${repo}:\n\n${issues.map(issue => `#${issue.number}: ${issue.title} (by ${issue.user?.login || 'unknown'})`).join('\n')}`;
    }

    case 'github_get_pull_requests': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const prs = await GithubAPI.getPullRequests(credentials, owner, repo, params.state || 'open');
      if (!prs.length) return `No ${params.state || 'open'} pull requests in ${owner}/${repo}.`;
      return `${prs.length} pull request(s) in ${owner}/${repo}:\n\n${prs.map(pr => `#${pr.number}: ${pr.title} (by ${pr.user?.login || 'unknown'})`).join('\n')}`;
    }

    case 'github_get_file': {
      const { owner, repo, filePath } = params;
      if (!owner || !repo || !filePath) {
        throw new Error('Missing required params: owner, repo, filePath');
      }
      const file = await GithubAPI.getFileContent(credentials, owner, repo, filePath);
      const preview = file.content.length > 4000
        ? `${file.content.slice(0, 4000)}\n...(truncated)`
        : file.content;
      return `Contents of ${file.path} from ${owner}/${repo}:\n\n\`\`\`\n${preview}\n\`\`\``;
    }

    case 'github_get_file_tree': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const tree = await GithubAPI.getRepoTree(credentials, owner, repo, params.branch || '');
      const blobs = (tree?.tree || []).filter(item => item.type === 'blob');
      return `File tree of ${owner}/${repo} (${blobs.length} files):\n\n${blobs.slice(0, 100).map(item => item.path).join('\n')}`;
    }

    case 'github_get_notifications': {
      const notifications = await GithubAPI.getNotifications(credentials);
      if (!notifications.length) return 'No unread GitHub notifications.';
      return `${notifications.length} unread notification(s):\n\n${notifications.slice(0, 10).map((item, index) => `${index + 1}. ${item.subject?.title} in ${item.repository?.full_name}`).join('\n')}`;
    }

    case 'github_get_commits': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const commits = await GithubAPI.getCommits(credentials, owner, repo);
      if (!commits.length) return `No commits found in ${owner}/${repo}.`;
      return `Recent commits in ${owner}/${repo}:\n\n${commits.slice(0, 15).map((commit, index) => {
        const sha = commit.sha?.slice(0, 7) || 'unknown';
        const message = String(commit.commit?.message || '').split('\n')[0].slice(0, 80);
        const author = commit.commit?.author?.name || commit.author?.login || 'unknown';
        const date = commit.commit?.author?.date ? formatDate(commit.commit.author.date) : '';
        return `${index + 1}. \`${sha}\` ${message}\n   by ${author}${date ? ` on ${date}` : ''}`;
      }).join('\n\n')}`;
    }

    case 'github_create_issue': {
      const { owner, repo, title, body = '', labels } = params;
      if (!owner || !repo || !title) {
        throw new Error('Missing required params: owner, repo, title');
      }
      const issue = await GithubAPI.createIssue(credentials, owner, repo, title, body, parseCommaList(labels));
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
      return [`Issue #${issue_number} closed in ${owner}/${repo}`, `Title: ${issue.title}`, `URL: ${issue.html_url}`].join('\n');
    }

    case 'github_reopen_issue': {
      const { owner, repo, issue_number } = params;
      if (!owner || !repo || !issue_number) {
        throw new Error('Missing required params: owner, repo, issue_number');
      }
      const issue = await GithubAPI.reopenIssue(credentials, owner, repo, Number(issue_number));
      return [`Issue #${issue_number} reopened in ${owner}/${repo}`, `Title: ${issue.title}`, `URL: ${issue.html_url}`].join('\n');
    }

    case 'github_comment_on_issue': {
      const { owner, repo, issue_number, body } = params;
      if (!owner || !repo || !issue_number || !body) {
        throw new Error('Missing required params: owner, repo, issue_number, body');
      }
      const comment = await GithubAPI.addIssueComment(credentials, owner, repo, Number(issue_number), body);
      return [`Comment posted on ${owner}/${repo}#${issue_number}`, `URL: ${comment?.html_url || `https://github.com/${owner}/${repo}/issues/${issue_number}`}`].join('\n');
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
      return `Releases for ${owner}/${repo}:\n\n${releases.map((release, index) => {
        const published = formatDate(release.published_at);
        const tag = release.tag_name || 'untagged';
        const name = release.name || tag;
        const notes = String(release.body || '').split('\n')[0].slice(0, 80);
        return [
          `${index + 1}. ${name} (${tag})${release.prerelease ? ' [pre-release]' : ''} - ${published}`,
          notes ? `   ${notes}` : '',
          `   ${release.html_url}`,
        ].filter(Boolean).join('\n');
      }).join('\n\n')}`;
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
      const gist = await GithubAPI.createGist(credentials, description, { [filename]: { content } }, Boolean(isPublic));
      return [`Gist created`, '', filename, `Visibility: ${isPublic ? 'Public' : 'Secret'}`, `URL: ${gist?.html_url || 'https://gist.github.com'}`].join('\n');
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
      const pr = await GithubAPI.createPR(credentials, owner, repo, { title, head, base, body, draft: Boolean(draft) });
      return [`Pull request created in ${owner}/${repo}`, '', `#${pr.number}: ${pr.title}`, `${head} -> ${base}`, `Status: ${draft ? 'Draft' : 'Open'}`, `URL: ${pr.html_url}`].join('\n');
    }

    case 'github_merge_pull_request': {
      const { owner, repo, pr_number, merge_method = 'merge', commit_title = '' } = params;
      requirePullRequest(owner, repo, pr_number);
      const result = await GithubAPI.mergePR(credentials, owner, repo, Number(pr_number), merge_method, commit_title);
      return [`PR #${pr_number} merged in ${owner}/${repo}`, `Strategy: ${merge_method}`, result.sha ? `Merge SHA: ${result.sha.slice(0, 7)}` : '', result.message ? `Message: ${result.message}` : ''].filter(Boolean).join('\n');
    }

    case 'github_close_pull_request': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const pr = await GithubAPI.closePR(credentials, owner, repo, Number(pr_number));
      return [`PR #${pr_number} closed in ${owner}/${repo}`, `Title: ${pr.title}`, `URL: ${pr.html_url}`].join('\n');
    }

    case 'github_add_labels': {
      const { owner, repo, issue_number, labels } = params;
      if (!owner || !repo || !issue_number || !labels) {
        throw new Error('Missing required params: owner, repo, issue_number, labels');
      }
      const parsedLabels = parseCommaList(labels);
      const applied = await GithubAPI.addLabels(credentials, owner, repo, Number(issue_number), parsedLabels);
      const appliedNames = (applied || []).map(item => item.name || item).join(', ');
      return [`Labels added to ${owner}/${repo}#${issue_number}`, `Applied: ${appliedNames || parsedLabels.join(', ')}`].join('\n');
    }

    case 'github_add_assignees': {
      const { owner, repo, issue_number, assignees } = params;
      if (!owner || !repo || !issue_number || !assignees) {
        throw new Error('Missing required params: owner, repo, issue_number, assignees');
      }
      const parsedAssignees = parseCommaList(assignees);
      await GithubAPI.addAssignees(credentials, owner, repo, Number(issue_number), parsedAssignees);
      return [`Assignees added to ${owner}/${repo}#${issue_number}`, `Assigned: ${parsedAssignees.map(value => `@${value}`).join(', ')}`].join('\n');
    }

    case 'github_trigger_workflow': {
      const { owner, repo, workflow_id, ref = 'main', inputs } = params;
      if (!owner || !repo || !workflow_id) {
        throw new Error('Missing required params: owner, repo, workflow_id');
      }
      const parsedInputs = parseWorkflowInputs(inputs);
      await GithubAPI.triggerWorkflow(credentials, owner, repo, workflow_id, ref, parsedInputs);
      return [`Workflow dispatched`, `Workflow: ${workflow_id}`, `Repo: ${owner}/${repo}`, `Ref: ${ref}`, Object.keys(parsedInputs).length ? `Inputs: ${JSON.stringify(parsedInputs)}` : '', 'The run should appear in the Actions tab shortly.'].filter(Boolean).join('\n');
    }

    case 'github_get_latest_workflow_run': {
      const { owner, repo, workflow_id, branch = '' } = params;
      if (!owner || !repo || !workflow_id) {
        throw new Error('Missing required params: owner, repo, workflow_id');
      }
      const run = await GithubAPI.getLatestWorkflowRun(credentials, owner, repo, workflow_id, branch);
      if (!run) return `No runs found for workflow ${workflow_id} in ${owner}/${repo}.`;
      const conclusion = run.conclusion || 'in progress';
      return [`Latest run for ${workflow_id} in ${owner}/${repo}`, '', `Run #${run.run_number || '?'} - ${run.name || workflow_id}`, `Status: ${run.status} / Conclusion: ${conclusion}`, `Branch: ${run.head_branch || branch || 'unknown'}`, `Started: ${formatDateTime(run.created_at)}`, `URL: ${run.html_url || `https://github.com/${owner}/${repo}/actions`}`].join('\n');
    }

    case 'github_get_latest_release': {
      const { owner, repo } = params;
      requireRepo(owner, repo);
      const release = await GithubAPI.getLatestRelease(credentials, owner, repo);
      if (!release) return `No releases found for ${owner}/${repo}.`;
      const notes = String(release.body || '').trim().slice(0, 300);
      return [`Latest release: ${release.name || release.tag_name} (${release.tag_name})`, `Published: ${formatDate(release.published_at)}`, `Status: ${release.prerelease ? 'Pre-release' : 'Stable'}`, notes ? `\nRelease notes:\n${notes}${String(release.body || '').length > 300 ? '\n...(truncated)' : ''}` : '', `\nURL: ${release.html_url}`].filter(Boolean).join('\n');
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
      return [`You have ${notifications.length} unread GitHub notification${notifications.length === 1 ? '' : 's'}`, '', 'By repository:', ...repoLines].join('\n');
    }

    case 'github_load_repo_context': {
      const { owner, repo, focus_paths, max_files = 20 } = params;
      requireRepo(owner, repo);

      const limit = Math.min(Number(max_files) || 20, 40);
      const focusList = parseCommaList(focus_paths);
      const tree = await GithubAPI.getRepoTree(credentials, owner, repo, '');
      const allFiles = (tree?.tree || []).filter(item => item.type === 'blob');

      const candidates = focusList.length
        ? allFiles.filter(item => focusList.some(prefix => item.path.startsWith(prefix)))
        : allFiles;

      const selectedFiles = (candidates.length ? candidates : allFiles)
        .map(item => ({ path: item.path, score: scoreFile(item.path) }))
        .filter(item => item.score >= 0)
        .sort((left, right) => right.score - left.score)
        .slice(0, limit);

      const loaded = [];
      let totalChars = 0;
      for (const file of selectedFiles) {
        const result = await GithubAPI.getFileContent(credentials, owner, repo, file.path).catch(() => null);
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
        .filter(item => !SKIP_DIRS.has(item.path.split('/')[0]))
        .slice(0, 300)
        .map(item => item.path);

      return [
        `# Repository: ${owner}/${repo}`,
        '',
        `## File Tree (${allFiles.length} total files, showing up to 300)` ,
        '```',
        treeLines.join('\n'),
        '```',
        '',
        `## Loaded Files (${loaded.length})`,
        '',
        ...loaded.flatMap(file => [
          `### ${file.path}`,
          '```',
          file.content,
          '```',
          '',
        ]),
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
      return [`Search results for ${query} in ${owner}/${repo}:`, `Found ${result.total_count || items.length} match${items.length === 1 ? '' : 'es'}`, '', ...items.slice(0, 20).map((item, index) => {
        const snippets = (item.text_matches || [])
          .slice(0, 2)
          .map(match => `  > ${String(match.fragment || '').replace(/\n/g, ' ').slice(0, 120)}`)
          .join('\n');
        return [`${index + 1}. ${item.path}`, snippets].filter(Boolean).join('\n');
      })].join('\n');
    }

    case 'github_get_pr_diff': {
      const { owner, repo, pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const diff = await GithubAPI.getPRDiff(credentials, owner, repo, Number(pr_number));
      if (!String(diff).trim()) {
        return `PR #${pr_number} in ${owner}/${repo} has no diff.`;
      }
      const truncated = diff.length > MAX_DIFF_CHARS
        ? `${diff.slice(0, MAX_DIFF_CHARS)}\n\n...(diff truncated - showing first ${MAX_DIFF_CHARS} chars of ${diff.length} total)`
        : diff;
      return [`Diff for ${owner}/${repo} PR #${pr_number}:`, '', '```diff', truncated, '```'].join('\n');
    }

    case 'github_review_pr': {
      const { owner, repo, pr_number, body, verdict, inline_comments } = params;
      requirePullRequest(owner, repo, pr_number);
      if (!String(body || '').trim()) {
        throw new Error('Missing required param: body');
      }
      const event = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].includes(String(verdict || '').toUpperCase())
        ? String(verdict).toUpperCase()
        : 'COMMENT';
      const review = await GithubAPI.createPRReview(credentials, owner, repo, Number(pr_number), {
        body,
        event,
        comments: parseInlineComments(inline_comments),
      });
      return [`Review posted on ${owner}/${repo} PR #${pr_number}`, `Verdict: ${event}`, `Review ID: ${review?.id || '-'}`, `View: ${review?.html_url || `https://github.com/${owner}/${repo}/pull/${pr_number}`}`].join('\n');
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
        pr.body ? `Description:\n${pr.body.slice(0, 1000)}${pr.body.length > 1000 ? '...' : ''}` : '(no description)',
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
        lines.push(...checkRuns.slice(0, 15).map(run => `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}`));
        lines.push('');
      }
      if (statuses.length) {
        lines.push('Commit statuses:');
        lines.push(...statuses.slice(0, 15).map(status => `- ${status.context || 'status'}: ${status.state}${status.description ? ` - ${status.description}` : ''}`));
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
      if (!comments.length) return `No inline review comments found for ${owner}/${repo} PR #${pr_number}.`;
      return [`Inline review comments for ${owner}/${repo} PR #${pr_number}:`, '', ...comments.slice(0, 25).map((comment, index) => `${index + 1}. ${comment.path}:${comment.line || comment.original_line || '?'}\n   ${comment.user?.login ? `@${comment.user.login}` : 'Reviewer'}: ${String(comment.body || '').replace(/\s+/g, ' ').trim()}`)].join('\n');
    }

    case 'github_get_workflow_runs': {
      const { owner, repo, branch = '', event = '', per_page = 20 } = params;
      requireRepo(owner, repo);
      const result = await GithubAPI.getWorkflowRuns(credentials, owner, repo, { branch, event, perPage: Number(per_page) || 20 });
      const runs = result.workflow_runs || [];
      if (!runs.length) {
        const filters = [branch ? `branch=${branch}` : '', event ? `event=${event}` : ''].filter(Boolean).join(', ');
        return `No workflow runs found for ${owner}/${repo}${filters ? ` (${filters})` : ''}.`;
      }
      return [`Workflow runs for ${owner}/${repo} (${result.total_count || runs.length} total):`, '', ...runs.slice(0, 20).map(run => `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} [${run.event}] (${run.head_branch || 'unknown branch'})`)].join('\n');
    }

    default:
      throw new Error(`Unknown GitHub tool: ${toolName}`);
  }
}

export default executeGithubChatTool;
