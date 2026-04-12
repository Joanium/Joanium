import { GitlabAPI, parseCommaList, requireGitlabCredentials } from '../Shared/Common.js';
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
  ]),
  ALWAYS_LOAD = new Set([
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
  ]),
  SKIP_DIRS = new Set([
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
function requireRepo(owner, repo) {
  if (!owner || !repo) throw new Error('Missing required params: owner, repo');
}
function requirePullRequest(owner, repo, prNumber) {
  if ((requireRepo(owner, repo), !prNumber))
    throw new Error('Missing required params: owner, repo, pr_number');
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
  return null == value || '' === value ? fallback : String(value);
}
function scoreFile(filePath) {
  const parts = filePath.split('/'),
    filename = parts[parts.length - 1],
    ext = filename.includes('.') ? filename.split('.').pop().toLowerCase() : filename.toLowerCase();
  if (parts.some((part) => SKIP_DIRS.has(part))) return -1;
  let score = 0;
  if ((ALWAYS_LOAD.has(filename) && (score += 100), SOURCE_EXTS.has(ext))) score += 30;
  else if (!ALWAYS_LOAD.has(filename)) return -1;
  return (
    (score -= 2 * Math.max(0, parts.length - 4)),
    /\.(test|spec)\.|__tests__|\/tests?\//.test(filePath) && (score -= 10),
    /^(index|main|app|server|entry)\.\w+$/.test(filename) && (score += 20),
    /config|setup|bootstrap|init/.test(filename.toLowerCase()) && (score += 10),
    score
  );
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
export async function executeGitlabChatTool(ctx, toolName, params = {}) {
  const credentials = requireGitlabCredentials(ctx);
  switch (toolName) {
    case 'gitlab_list_repos': {
      const repos = await GitlabAPI.getRepos(credentials),
        lines = repos
          .slice(0, 20)
          .map(
            (repo) =>
              `- ${repo.full_name}: ${repo.description || 'No description'} [${repo.language || 'unknown'}] * ${repo.stargazers_count}`,
          )
          .join('\n');
      return `User has ${repos.length} repositories (showing top 20):\n\n${lines}`;
    }
    case 'gitlab_get_issues': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const issues = await GitlabAPI.getIssues(credentials, owner, repo, params.state || 'open');
      return issues.length
        ? `${issues.length} issue(s) in ${owner}/${repo}:\n\n${issues.map((issue) => `#${issue.number}: ${issue.title} (by ${issue.user?.login || 'unknown'})`).join('\n')}`
        : `No ${params.state || 'open'} issues in ${owner}/${repo}.`;
    }
    case 'gitlab_get_pull_requests': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const prs = await GitlabAPI.getPullRequests(credentials, owner, repo, params.state || 'open');
      return prs.length
        ? `${prs.length} merge request(s) in ${owner}/${repo}:\n\n${prs.map((pr) => `!${pr.number}: ${pr.title} (by ${pr.user?.login || 'unknown'})`).join('\n')}`
        : `No ${params.state || 'open'} merge requests in ${owner}/${repo}.`;
    }
    case 'gitlab_get_file': {
      const { owner: owner, repo: repo, filePath: filePath } = params;
      if (!owner || !repo || !filePath)
        throw new Error('Missing required params: owner, repo, filePath');
      const file = await GitlabAPI.getFileContent(credentials, owner, repo, filePath),
        preview =
          file.content.length > 4e3
            ? `${file.content.slice(0, 4e3)}\n...(truncated)`
            : file.content;
      return `Contents of ${file.path} from ${owner}/${repo}:\n\n\`\`\`\n${preview}\n\`\`\``;
    }
    case 'gitlab_get_file_tree': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const tree = await GitlabAPI.getRepoTree(credentials, owner, repo, params.branch || ''),
        blobs = (tree?.tree || []).filter((item) => 'blob' === item.type);
      return `File tree of ${owner}/${repo} (${blobs.length} files):\n\n${blobs
        .slice(0, 100)
        .map((item) => item.path)
        .join('\n')}`;
    }
    case 'gitlab_get_notifications': {
      const notifications = await GitlabAPI.getNotifications(credentials);
      return notifications.length
        ? `${notifications.length} pending todo(s):\n\n${notifications
            .slice(0, 10)
            .map(
              (item, index) =>
                `${index + 1}. ${item.subject?.title} in ${item.repository?.full_name}`,
            )
            .join('\n')}`
        : 'No pending GitLab todos/notifications.';
    }
    case 'gitlab_get_commits': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const commits = await GitlabAPI.getCommits(credentials, owner, repo);
      return commits.length
        ? `Recent commits in ${owner}/${repo}:\n\n${commits
            .slice(0, 15)
            .map((commit, index) => {
              const sha = commit.sha?.slice(0, 7) || 'unknown',
                message = String(commit.commit?.message || '')
                  .split('\n')[0]
                  .slice(0, 80),
                author = commit.commit?.author?.name || commit.author?.login || 'unknown',
                date = commit.commit?.author?.date ? formatDate(commit.commit.author.date) : '';
              return `${index + 1}. \`${sha}\` ${message}\n   by ${author}${date ? ` on ${date}` : ''}`;
            })
            .join('\n\n')}`
        : `No commits found in ${owner}/${repo}.`;
    }
    case 'gitlab_create_issue': {
      const { owner: owner, repo: repo, title: title, body: body = '', labels: labels } = params;
      if (!owner || !repo || !title) throw new Error('Missing required params: owner, repo, title');
      const issue = await GitlabAPI.createIssue(
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
    case 'gitlab_close_issue': {
      const { owner: owner, repo: repo, issue_number: issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const issue = await GitlabAPI.closeIssue(credentials, owner, repo, Number(issue_number));
      return [
        `Issue #${issue_number} closed in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    }
    case 'gitlab_reopen_issue': {
      const { owner: owner, repo: repo, issue_number: issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const issue = await GitlabAPI.reopenIssue(credentials, owner, repo, Number(issue_number));
      return [
        `Issue #${issue_number} reopened in ${owner}/${repo}`,
        `Title: ${issue.title}`,
        `URL: ${issue.html_url}`,
      ].join('\n');
    }
    case 'gitlab_comment_on_issue': {
      const { owner: owner, repo: repo, issue_number: issue_number, body: body } = params;
      if (!(owner && repo && issue_number && body))
        throw new Error('Missing required params: owner, repo, issue_number, body');
      const comment = await GitlabAPI.addIssueComment(
        credentials,
        owner,
        repo,
        Number(issue_number),
        body,
      );
      return [
        `Comment posted on ${owner}/${repo}#${issue_number}`,
        `URL: ${comment?.html_url || `https://gitlab.com/${owner}/${repo}/-/issues/${issue_number}`}`,
      ].join('\n');
    }
    case 'gitlab_list_branches': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const branches = await GitlabAPI.getBranches(credentials, owner, repo);
      return branches.length
        ? `${branches.length} branch(es) in ${owner}/${repo}:\n\n${branches.map((branch, index) => `${index + 1}. \`${branch.name}\`${branch.commit?.sha ? ` (${branch.commit.sha.slice(0, 7)})` : ''}${branch.protected ? ' [protected]' : ''}`).join('\n')}`
        : `No branches found in ${owner}/${repo}.`;
    }
    case 'gitlab_get_releases': {
      const { owner: owner, repo: repo, count: count = 5 } = params;
      requireRepo(owner, repo);
      const limit = Math.min(Math.max(1, Number(count) || 5), 20),
        releases = await GitlabAPI.getReleases(credentials, owner, repo, limit);
      return releases.length
        ? `Releases for ${owner}/${repo}:\n\n${releases
            .map((release, index) => {
              const published = formatDate(release.published_at),
                tag = release.tag_name || 'untagged',
                name = release.name || tag,
                notes = String(release.body || '')
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
            .join('\n\n')}`
        : `No releases found in ${owner}/${repo}.`;
    }
    case 'gitlab_star_repo': {
      const { owner: owner, repo: repo, action: action = 'star' } = params;
      requireRepo(owner, repo);
      const shouldUnstar = 'unstar' === String(action).toLowerCase();
      return (
        shouldUnstar
          ? await GitlabAPI.unstarRepo(credentials, owner, repo)
          : await GitlabAPI.starRepo(credentials, owner, repo),
        `${shouldUnstar ? 'Unstarred' : 'Starred'} ${owner}/${repo} successfully.`
      );
    }
    case 'gitlab_create_gist': {
      const {
        description: description = '',
        filename: filename,
        content: content,
        public: isPublic = !1,
      } = params;
      if (!filename || !content) throw new Error('Missing required params: filename, content');
      const gist = await GitlabAPI.createGist(
        credentials,
        description,
        { [filename]: { content: content } },
        Boolean(isPublic),
      );
      return [
        'Snippet created',
        '',
        filename,
        'Visibility: ' + (isPublic ? 'Public' : 'Private'),
        `URL: ${gist?.html_url || 'https://gitlab.com/dashboard/snippets'}`,
      ].join('\n');
    }
    case 'gitlab_mark_notifications_read':
      return (
        await GitlabAPI.markAllNotificationsRead(credentials),
        'All GitLab todos marked as done.'
      );
    case 'gitlab_get_repo_stats': {
      const { owner: owner, repo: repo } = params;
      return (
        requireRepo(owner, repo),
        (function (owner, repo, stats = {}) {
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
        })(owner, repo, await GitlabAPI.getRepoStats(credentials, owner, repo))
      );
    }
    case 'gitlab_create_pull_request': {
      const {
        owner: owner,
        repo: repo,
        title: title,
        head: head,
        base: base,
        body: body = '',
        draft: draft = !1,
      } = params;
      if (!(owner && repo && title && head && base))
        throw new Error('Missing required params: owner, repo, title, head, base');
      const pr = await GitlabAPI.createPR(credentials, owner, repo, {
        title: title,
        head: head,
        base: base,
        body: body,
        draft: Boolean(draft),
      });
      return [
        `Merge request created in ${owner}/${repo}`,
        '',
        `!${pr.number}: ${pr.title}`,
        `${head} -> ${base}`,
        'Status: ' + (draft ? 'Draft' : 'Open'),
        `URL: ${pr.html_url}`,
      ].join('\n');
    }
    case 'gitlab_merge_pull_request': {
      const {
        owner: owner,
        repo: repo,
        pr_number: pr_number,
        merge_method: merge_method = 'merge',
        commit_title: commit_title = '',
      } = params;
      requirePullRequest(owner, repo, pr_number);
      const result = await GitlabAPI.mergePR(
        credentials,
        owner,
        repo,
        Number(pr_number),
        merge_method,
        commit_title,
      );
      return [
        `MR !${pr_number} merged in ${owner}/${repo}`,
        `Strategy: ${merge_method}`,
        result?.sha ? `Merge SHA: ${result.sha.slice(0, 7)}` : '',
        result?.message ? `Message: ${result.message}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_close_pull_request': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const pr = await GitlabAPI.closePR(credentials, owner, repo, Number(pr_number));
      return [
        `MR !${pr_number} closed in ${owner}/${repo}`,
        `Title: ${pr.title}`,
        `URL: ${pr.html_url}`,
      ].join('\n');
    }
    case 'gitlab_add_labels': {
      const { owner: owner, repo: repo, issue_number: issue_number, labels: labels } = params;
      if (!(owner && repo && issue_number && labels))
        throw new Error('Missing required params: owner, repo, issue_number, labels');
      const parsedLabels = parseCommaList(labels);
      return [
        `Labels added to ${owner}/${repo}#${issue_number}`,
        `Applied: ${((await GitlabAPI.addLabels(credentials, owner, repo, Number(issue_number), parsedLabels)) || []).map((item) => item.name || item).join(', ') || parsedLabels.join(', ')}`,
      ].join('\n');
    }
    case 'gitlab_add_assignees': {
      const { owner: owner, repo: repo, issue_number: issue_number, assignees: assignees } = params;
      if (!(owner && repo && issue_number && assignees))
        throw new Error('Missing required params: owner, repo, issue_number, assignees');
      const parsedAssignees = parseCommaList(assignees);
      return (
        await GitlabAPI.addAssignees(
          credentials,
          owner,
          repo,
          Number(issue_number),
          parsedAssignees,
        ),
        [
          `Assignees added to ${owner}/${repo}#${issue_number}`,
          `Assigned: ${parsedAssignees.map((value) => `@${value}`).join(', ')}`,
        ].join('\n')
      );
    }
    case 'gitlab_trigger_workflow': {
      const {
        owner: owner,
        repo: repo,
        workflow_id: workflow_id,
        ref: ref = 'main',
        inputs: inputs,
      } = params;
      if (!owner || !repo || !workflow_id)
        throw new Error('Missing required params: owner, repo, workflow_id');
      const parsedInputs = (function (value) {
        if (!value) return {};
        if ('object' == typeof value && !Array.isArray(value)) return value;
        try {
          const parsed = JSON.parse(String(value));
          return parsed && 'object' == typeof parsed && !Array.isArray(parsed) ? parsed : {};
        } catch {
          return {};
        }
      })(inputs);
      return (
        await GitlabAPI.triggerWorkflow(credentials, owner, repo, workflow_id, ref, parsedInputs),
        [
          'Pipeline dispatched',
          `Workflow: ${workflow_id}`,
          `Repo: ${owner}/${repo}`,
          `Ref: ${ref}`,
          Object.keys(parsedInputs).length ? `Inputs: ${JSON.stringify(parsedInputs)}` : '',
          'The run should appear in the CI/CD pipelines tab shortly.',
        ]
          .filter(Boolean)
          .join('\n')
      );
    }
    case 'gitlab_get_latest_workflow_run': {
      const { owner: owner, repo: repo, workflow_id: workflow_id, branch: branch = '' } = params;
      if (!owner || !repo || !workflow_id)
        throw new Error('Missing required params: owner, repo, workflow_id');
      const run = await GitlabAPI.getLatestWorkflowRun(
        credentials,
        owner,
        repo,
        workflow_id,
        branch,
      );
      if (!run) return `No runs found for pipeline ${workflow_id} in ${owner}/${repo}.`;
      const conclusion = run.conclusion || 'in progress';
      return [
        `Latest run for ${workflow_id} in ${owner}/${repo}`,
        '',
        `Run #${run.run_number || '?'} - ${run.name || workflow_id}`,
        `Status: ${run.status} / Conclusion: ${conclusion}`,
        `Branch: ${run.head_branch || branch || 'unknown'}`,
        `Started: ${formatDateTime(run.created_at)}`,
        `URL: ${run.html_url || `https://gitlab.com/${owner}/${repo}/-/pipelines`}`,
      ].join('\n');
    }
    case 'gitlab_get_latest_release': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const release = await GitlabAPI.getLatestRelease(credentials, owner, repo);
      if (!release) return `No releases found for ${owner}/${repo}.`;
      const notes = String(release.body || '')
        .trim()
        .slice(0, 300);
      return [
        `Latest release: ${release.name || release.tag_name} (${release.tag_name})`,
        `Published: ${formatDate(release.published_at)}`,
        'Status: ' + (release.prerelease ? 'Pre-release' : 'Stable'),
        notes
          ? `\nRelease notes:\n${notes}${String(release.body || '').length > 300 ? '\n...(truncated)' : ''}`
          : '',
        `\nURL: ${release.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_notification_count': {
      const notifications = await GitlabAPI.getNotifications(credentials);
      if (!notifications.length) return 'No pending GitLab todos/notifications.';
      const countsByRepo = notifications.reduce((result, item) => {
          const repoName = item.repository?.full_name || 'unknown';
          return ((result[repoName] = (result[repoName] || 0) + 1), result);
        }, {}),
        repoLines = Object.entries(countsByRepo)
          .sort((left, right) => right[1] - left[1])
          .slice(0, 10)
          .map(([name, count]) => `- ${name}: ${count}`);
      return [
        `You have ${notifications.length} pending GitLab todo${1 === notifications.length ? '' : 's'}`,
        '',
        'By repository:',
        ...repoLines,
      ].join('\n');
    }
    case 'gitlab_load_repo_context': {
      const {
        owner: owner,
        repo: repo,
        focus_paths: focus_paths,
        max_files: max_files = 20,
      } = params;
      requireRepo(owner, repo);
      const limit = Math.min(Number(max_files) || 20, 40),
        focusList = parseCommaList(focus_paths),
        tree = await GitlabAPI.getRepoTree(credentials, owner, repo, ''),
        allFiles = (tree?.tree || []).filter((item) => 'blob' === item.type),
        candidates = focusList.length
          ? allFiles.filter((item) => focusList.some((prefix) => item.path.startsWith(prefix)))
          : allFiles,
        selectedFiles = (candidates.length ? candidates : allFiles)
          .map((item) => ({ path: item.path, score: scoreFile(item.path) }))
          .filter((item) => item.score >= 0)
          .sort((left, right) => right.score - left.score)
          .slice(0, limit),
        loaded = [];
      let totalChars = 0;
      for (const file of selectedFiles) {
        const result = await GitlabAPI.getFileContent(credentials, owner, repo, file.path).catch(
          () => null,
        );
        if (!result?.content) continue;
        let content = result.content;
        if (
          (content.length > 8e3 && (content = `${content.slice(0, 8e3)}\n...(truncated)`),
          totalChars + content.length > 8e4)
        )
          break;
        (loaded.push({ path: file.path, content: content }), (totalChars += content.length));
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
    case 'gitlab_search_code': {
      const { owner: owner, repo: repo, query: query } = params;
      if (!owner || !repo || !query) throw new Error('Missing required params: owner, repo, query');
      const result = await GitlabAPI.searchCode(credentials, query, `${owner}/${repo}`),
        items = result.items || [];
      return items.length
        ? [
            `Search results for ${query} in ${owner}/${repo}:`,
            `Found ${result.total_count || items.length} match${1 === items.length ? '' : 'es'}`,
            '',
            ...items
              .slice(0, 20)
              .map((item, index) => `${index + 1}. ${item.path || item.filename || 'unknown'}`),
          ].join('\n')
        : `No results for ${query} in ${owner}/${repo}.`;
    }
    case 'gitlab_get_pr_diff': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const diff = await GitlabAPI.getPRDiff(credentials, owner, repo, Number(pr_number));
      return String(diff).trim()
        ? [
            `Diff for ${owner}/${repo} MR !${pr_number}:`,
            '',
            '```diff',
            diff.length > 28e3
              ? `${diff.slice(0, 28e3)}\n\n...(diff truncated - showing first 28000 chars of ${diff.length} total)`
              : diff,
            '```',
          ].join('\n')
        : `MR !${pr_number} in ${owner}/${repo} has no diff.`;
    }
    case 'gitlab_review_pr': {
      const {
        owner: owner,
        repo: repo,
        pr_number: pr_number,
        body: body,
        verdict: verdict,
        inline_comments: inline_comments,
      } = params;
      if ((requirePullRequest(owner, repo, pr_number), !String(body || '').trim()))
        throw new Error('Missing required param: body');
      const event = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].includes(
          String(verdict || '').toUpperCase(),
        )
          ? String(verdict).toUpperCase()
          : 'COMMENT',
        review = await GitlabAPI.createPRReview(credentials, owner, repo, Number(pr_number), {
          body: body,
          event: event,
          comments: parseInlineComments(inline_comments),
        });
      return [
        `Review posted on ${owner}/${repo} MR !${pr_number}`,
        `Verdict: ${event}`,
        `Review ID: ${review?.id || '-'}`,
        `View: ${review?.html_url || `https://gitlab.com/${owner}/${repo}/-/merge_requests/${pr_number}`}`,
      ].join('\n');
    }
    case 'gitlab_get_pr_details': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const pr = await GitlabAPI.getPRDetails(credentials, owner, repo, Number(pr_number));
      return [
        `MR !${pr.number}: ${pr.title}`,
        `Author: @${pr.user?.login || 'unknown'}`,
        `Branch: ${pr.head?.ref || 'unknown'} -> ${pr.base?.ref || 'unknown'}`,
        `State: ${pr.state} | Mergeable: ${pr.mergeable ?? 'unknown'}`,
        `Commits: ${pr.commits} | Changed files: ${pr.changed_files}`,
        `+${pr.additions} -${pr.deletions}`,
        '',
        pr.body
          ? `Description:\n${pr.body.slice(0, 1e3)}${pr.body.length > 1e3 ? '...' : ''}`
          : '(no description)',
        '',
        `URL: ${pr.html_url}`,
      ].join('\n');
    }
    case 'gitlab_get_pr_checks': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const checks = await GitlabAPI.getPRChecks(credentials, owner, repo, Number(pr_number)),
        checkRuns = checks.checkRuns || [],
        statuses = checks.statuses || [],
        lines = [
          `CI checks for ${owner}/${repo} MR !${pr_number}`,
          `Head SHA: ${checks.sha || 'unknown'}`,
          `Combined status: ${checks.state || 'unknown'}`,
          '',
        ];
      return (
        checkRuns.length &&
          (lines.push('Pipeline jobs:'),
          lines.push(
            ...checkRuns
              .slice(0, 15)
              .map(
                (run) =>
                  `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}`,
              ),
          ),
          lines.push('')),
        statuses.length &&
          (lines.push('Commit statuses:'),
          lines.push(
            ...statuses
              .slice(0, 15)
              .map(
                (status) =>
                  `- ${status.context || 'status'}: ${status.state}${status.description ? ` - ${status.description}` : ''}`,
              ),
          )),
        checkRuns.length ||
          statuses.length ||
          lines.push('No CI checks or commit statuses were returned.'),
        lines.join('\n')
      );
    }
    case 'gitlab_get_pr_comments': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const comments = await GitlabAPI.getPRComments(credentials, owner, repo, Number(pr_number));
      return comments.length
        ? [
            `Inline review comments for ${owner}/${repo} MR !${pr_number}:`,
            '',
            ...comments.slice(0, 25).map(
              (comment, index) =>
                `${index + 1}. ${comment.path}:${comment.line || comment.original_line || '?'}\n   ${comment.user?.login ? `@${comment.user.login}` : 'Reviewer'}: ${String(
                  comment.body || '',
                )
                  .replace(/\s+/g, ' ')
                  .trim()}`,
            ),
          ].join('\n')
        : `No inline review comments found for ${owner}/${repo} MR !${pr_number}.`;
    }
    case 'gitlab_get_workflow_runs': {
      const {
        owner: owner,
        repo: repo,
        branch: branch = '',
        event: event = '',
        per_page: per_page = 20,
      } = params;
      requireRepo(owner, repo);
      const result = await GitlabAPI.getWorkflowRuns(credentials, owner, repo, {
          branch: branch,
          event: event,
          perPage: Number(per_page) || 20,
        }),
        runs = result.workflow_runs || [];
      if (!runs.length) {
        const filters = [branch ? `branch=${branch}` : '', event ? `event=${event}` : '']
          .filter(Boolean)
          .join(', ');
        return `No pipeline runs found for ${owner}/${repo}${filters ? ` (${filters})` : ''}.`;
      }
      return [
        `Pipeline runs for ${owner}/${repo} (${result.total_count || runs.length} total):`,
        '',
        ...runs
          .slice(0, 20)
          .map(
            (run) =>
              `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} [${run.event}] (${run.head_branch || 'unknown branch'})`,
          ),
      ].join('\n');
    }
    case 'gitlab_get_readme': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const file = await GitlabAPI.getReadme(credentials, owner, repo);
      return `README for ${owner}/${repo}:\n\n${file.content.length > 6e3 ? `${file.content.slice(0, 6e3)}\n...(truncated)` : file.content}`;
    }
    case 'gitlab_get_issue_details': {
      const { owner: owner, repo: repo, issue_number: issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const issue = await GitlabAPI.getIssueDetails(credentials, owner, repo, Number(issue_number)),
        labelNames = (issue.labels || []).map((l) => l.name).join(', ') || 'none',
        assigneeNames = (issue.assignees || []).map((a) => `@${a.login}`).join(', ') || 'none';
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
    case 'gitlab_update_issue': {
      const {
        owner: owner,
        repo: repo,
        issue_number: issue_number,
        title: title,
        body: body,
        state: state,
        labels: labels,
        assignees: assignees,
      } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const updates = {};
      if (
        (void 0 !== title && (updates.title = title),
        void 0 !== body && (updates.body = body),
        void 0 !== state && (updates.state = state),
        void 0 !== labels && (updates.labels = parseCommaList(labels)),
        void 0 !== assignees && (updates.assignees = parseCommaList(assignees)),
        !Object.keys(updates).length)
      )
        throw new Error('At least one field to update must be provided.');
      const issue = await GitlabAPI.updateIssue(
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
    case 'gitlab_get_contributors': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const contributors = await GitlabAPI.getContributors(credentials, owner, repo);
      return contributors.length
        ? [
            `Top contributors for ${owner}/${repo}:`,
            '',
            ...contributors
              .slice(0, 20)
              .map(
                (c, i) =>
                  `${i + 1}. @${c.login} — ${c.contributions.toLocaleString()} commit${1 === c.contributions ? '' : 's'}`,
              ),
          ].join('\n')
        : `No contributors found for ${owner}/${repo}.`;
    }
    case 'gitlab_get_languages': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const langs = await GitlabAPI.getLanguages(credentials, owner, repo),
        entries = Object.entries(langs);
      if (!entries.length) return `No language data available for ${owner}/${repo}.`;
      const total = entries.reduce((sum, [, bytes]) => sum + bytes, 0);
      return [
        `Language breakdown for ${owner}/${repo}:`,
        '',
        ...entries
          .sort(([, a], [, b]) => b - a)
          .map(([lang, bytes]) => `${lang}: ${((bytes / total) * 100).toFixed(1)}%`),
      ].join('\n');
    }
    case 'gitlab_get_topics': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const topics = (await GitlabAPI.getTopics(credentials, owner, repo)).names || [];
      return topics.length
        ? `Topics for ${owner}/${repo}:\n\n${topics.map((t) => `• ${t}`).join('\n')}`
        : `${owner}/${repo} has no topics set.`;
    }
    case 'gitlab_get_milestones': {
      const { owner: owner, repo: repo, state: state = 'open' } = params;
      requireRepo(owner, repo);
      const milestones = await GitlabAPI.getMilestones(credentials, owner, repo, state);
      return milestones.length
        ? [
            `Milestones for ${owner}/${repo} (${state}):`,
            '',
            ...milestones.map((m, i) => {
              const due = m.due_on ? ` | Due: ${formatDate(m.due_on)}` : '',
                progress =
                  m.closed_issues + m.open_issues > 0
                    ? ` | ${m.closed_issues}/${m.closed_issues + m.open_issues} closed`
                    : '';
              return `${i + 1}. #${m.number} ${m.title}${due}${progress}`;
            }),
          ].join('\n')
        : `No ${state} milestones in ${owner}/${repo}.`;
    }
    case 'gitlab_create_milestone': {
      const {
        owner: owner,
        repo: repo,
        title: title,
        description: description = '',
        due_on: due_on = '',
      } = params;
      if (!owner || !repo || !title) throw new Error('Missing required params: owner, repo, title');
      const milestone = await GitlabAPI.createMilestone(
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
    case 'gitlab_create_branch': {
      const { owner: owner, repo: repo, branch_name: branch_name, sha: sha } = params;
      if (!(owner && repo && branch_name && sha))
        throw new Error('Missing required params: owner, repo, branch_name, sha');
      return (
        await GitlabAPI.createBranch(credentials, owner, repo, branch_name, sha),
        [
          `Branch created in ${owner}/${repo}`,
          `Name: ${branch_name}`,
          `From SHA: ${sha.slice(0, 7)}`,
        ].join('\n')
      );
    }
    case 'gitlab_delete_branch': {
      const { owner: owner, repo: repo, branch_name: branch_name } = params;
      if (!owner || !repo || !branch_name)
        throw new Error('Missing required params: owner, repo, branch_name');
      return (
        await GitlabAPI.deleteBranch(credentials, owner, repo, branch_name),
        `Branch "${branch_name}" deleted from ${owner}/${repo}.`
      );
    }
    case 'gitlab_get_forks': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const forks = await GitlabAPI.getForks(credentials, owner, repo);
      return forks.length
        ? [
            `Forks of ${owner}/${repo} (${forks.length} shown):`,
            '',
            ...forks
              .slice(0, 20)
              .map(
                (f, i) =>
                  `${i + 1}. ${f.full_name} by @${f.owner?.login || 'unknown'} — ★${f.stargazers_count}`,
              ),
          ].join('\n')
        : `${owner}/${repo} has no forks.`;
    }
    case 'gitlab_get_stargazers': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const stargazers = await GitlabAPI.getStargazers(credentials, owner, repo);
      return stargazers.length
        ? [
            `Stargazers for ${owner}/${repo} (showing up to 30):`,
            '',
            ...stargazers.slice(0, 30).map((u, i) => `${i + 1}. @${u.login}`),
          ].join('\n')
        : `${owner}/${repo} has no stargazers yet.`;
    }
    case 'gitlab_get_collaborators': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const collaborators = await GitlabAPI.getCollaborators(credentials, owner, repo);
      return collaborators.length
        ? [
            `Collaborators on ${owner}/${repo}:`,
            '',
            ...collaborators.map((c, i) => {
              const role =
                c.role_name ||
                (c.permissions?.admin ? 'admin' : c.permissions?.push ? 'write' : 'read');
              return `${i + 1}. @${c.login} (${role})`;
            }),
          ].join('\n')
        : `No collaborators found for ${owner}/${repo}.`;
    }
    case 'gitlab_compare_branches': {
      const { owner: owner, repo: repo, base: base, head: head } = params;
      if (!(owner && repo && base && head))
        throw new Error('Missing required params: owner, repo, base, head');
      const cmp = await GitlabAPI.compareBranches(credentials, owner, repo, base, head),
        files = (cmp.files || []).slice(0, 20);
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
    case 'gitlab_get_gists': {
      const gists = await GitlabAPI.getGists(credentials);
      return gists.length
        ? [
            `Your Snippets (${gists.length} shown):`,
            '',
            ...gists.slice(0, 20).map((g, i) => {
              const files = Object.keys(g.files).join(', ');
              return `${i + 1}. [${g.public ? 'public' : 'private'}] ${g.description || files} — ${formatDate(g.updated_at)}\n   ${g.html_url}`;
            }),
          ].join('\n')
        : 'No snippets found.';
    }
    case 'gitlab_get_traffic_views': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const traffic = await GitlabAPI.getTrafficViews(credentials, owner, repo),
        recent = (traffic.views || []).slice(-7);
      return [
        `Traffic views for ${owner}/${repo} (last 14 days):`,
        `Total views: ${traffic.count?.toLocaleString() ?? 0} | Unique visitors: ${traffic.uniques?.toLocaleString() ?? 0}`,
        '',
        recent.length
          ? 'Daily breakdown (last 7 days):'
          : 'Note: GitLab does not expose traffic stats via the public API.',
        ...recent.map((v) => `  ${formatDate(v.timestamp)}: ${v.count} views, ${v.uniques} unique`),
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_request_reviewers': {
      const {
        owner: owner,
        repo: repo,
        pr_number: pr_number,
        reviewers: reviewers = '',
        team_reviewers: team_reviewers = '',
      } = params;
      requirePullRequest(owner, repo, pr_number);
      const parsedReviewers = parseCommaList(reviewers),
        parsedTeamReviewers = parseCommaList(team_reviewers);
      if (!parsedReviewers.length && !parsedTeamReviewers.length)
        throw new Error('At least one reviewer or team_reviewer is required.');
      return (
        await GitlabAPI.requestReviewers(
          credentials,
          owner,
          repo,
          Number(pr_number),
          parsedReviewers,
          parsedTeamReviewers,
        ),
        `Reviewers requested on ${owner}/${repo} MR !${pr_number}: ${[...parsedReviewers.map((r) => `@${r}`), ...parsedTeamReviewers.map((t) => `team:${t}`)].join(', ')}`
      );
    }
    case 'gitlab_get_pr_files': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const files = await GitlabAPI.getPRFiles(credentials, owner, repo, Number(pr_number));
      if (!files.length) return `MR !${pr_number} in ${owner}/${repo} has no file changes.`;
      const additions = files.reduce((s, f) => s + f.additions, 0),
        deletions = files.reduce((s, f) => s + f.deletions, 0);
      return [
        `Files changed in ${owner}/${repo} MR !${pr_number} (${files.length} files, +${additions} -${deletions}):`,
        '',
        ...files
          .slice(0, 50)
          .map((f) => `  ${f.status.padEnd(8)} ${f.filename}  (+${f.additions} -${f.deletions})`),
        files.length > 50 ? `  ...and ${files.length - 50} more` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_list_pr_reviews': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const reviews = await GitlabAPI.listPRReviews(credentials, owner, repo, Number(pr_number));
      return reviews.length
        ? [
            `Reviews on ${owner}/${repo} MR !${pr_number}:`,
            '',
            ...reviews.map((r, i) => {
              const verdict = r.state || 'APPROVED',
                body = String(r.body || '')
                  .trim()
                  .slice(0, 200);
              return [
                `${i + 1}. @${r.user?.login || 'unknown'} — ${verdict}${r.submitted_at ? ` (${formatDate(r.submitted_at)})` : ''}`,
                body ? `   ${body}${r.body?.length > 200 ? '...' : ''}` : '',
              ]
                .filter(Boolean)
                .join('\n');
            }),
          ].join('\n')
        : `No reviews found for ${owner}/${repo} MR !${pr_number}.`;
    }
    case 'gitlab_get_user_info': {
      const { username: username } = params;
      if (!username) throw new Error('Missing required param: username');
      const user = await GitlabAPI.getUserInfo(credentials, username);
      return [
        `GitLab User: @${user.login}`,
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
    case 'gitlab_search_repos': {
      const { query: query, count: count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GitlabAPI.searchRepos(
          credentials,
          query,
          Math.min(Number(count) || 20, 50),
        ),
        items = result.items || [];
      return items.length
        ? [
            `Repository search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
            '',
            ...items
              .slice(0, 20)
              .map(
                (repo, i) =>
                  `${i + 1}. ${repo.full_name} ★${repo.stargazers_count} [${repo.language || 'unknown'}]\n   ${repo.description || 'No description'}\n   ${repo.html_url}`,
              ),
          ].join('\n')
        : `No repositories found for "${query}".`;
    }
    case 'gitlab_search_issues': {
      const { query: query, count: count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GitlabAPI.searchIssues(
          credentials,
          query,
          Math.min(Number(count) || 20, 50),
        ),
        items = result.items || [];
      return items.length
        ? [
            `Issue search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
            '',
            ...items.slice(0, 20).map((issue, i) => {
              const repo =
                issue.repository_url?.replace('https://gitlab.com/api/v4/projects/', '') ??
                'unknown';
              return `${i + 1}. [Issue] #${issue.number} ${issue.title}\n   ${repo} — ${issue.state} — by @${issue.user?.login ?? 'unknown'}\n   ${issue.html_url}`;
            }),
          ].join('\n')
        : `No issues found for "${query}".`;
    }
    case 'gitlab_get_issue_comments': {
      const { owner: owner, repo: repo, issue_number: issue_number, count: count = 30 } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const comments = await GitlabAPI.getIssueComments(
        credentials,
        owner,
        repo,
        Number(issue_number),
        Math.min(Number(count) || 30, 100),
      );
      return comments.length
        ? [
            `Comments on ${owner}/${repo}#${issue_number} (${comments.length} shown):`,
            '',
            ...comments.map((c, i) => {
              const body = String(c.body || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 300);
              return `${i + 1}. @${c.user?.login ?? 'unknown'} — ${formatDate(c.created_at)}\n   ${body}${(c.body?.length ?? 0) > 300 ? '...' : ''}`;
            }),
          ].join('\n')
        : `No comments on ${owner}/${repo}#${issue_number}.`;
    }
    case 'gitlab_get_commit_details': {
      const { owner: owner, repo: repo, sha: sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const commit = await GitlabAPI.getCommitDetails(credentials, owner, repo, sha),
        files = (commit.files || []).slice(0, 20);
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
    case 'gitlab_get_tags': {
      const { owner: owner, repo: repo, count: count = 20 } = params;
      requireRepo(owner, repo);
      const tags = await GitlabAPI.getTags(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 20, 100),
      );
      return tags.length
        ? [
            `Tags for ${owner}/${repo} (${tags.length} shown):`,
            '',
            ...tags.map((tag, i) => `${i + 1}. ${tag.name}  ${tag.commit?.sha?.slice(0, 7) ?? ''}`),
          ].join('\n')
        : `No tags found in ${owner}/${repo}.`;
    }
    case 'gitlab_create_release': {
      const {
        owner: owner,
        repo: repo,
        tag_name: tag_name,
        name: name = '',
        body: body = '',
        draft: draft = !1,
        prerelease: prerelease = !1,
        target_commitish: target_commitish = '',
      } = params;
      if (!owner || !repo || !tag_name)
        throw new Error('Missing required params: owner, repo, tag_name');
      const release = await GitlabAPI.createRelease(credentials, owner, repo, {
        tagName: tag_name,
        name: name,
        body: body,
        draft: Boolean(draft),
        prerelease: Boolean(prerelease),
        targetCommitish: target_commitish,
      });
      return [
        `Release created in ${owner}/${repo}`,
        `Tag: ${release.tag_name}`,
        `Name: ${release.name || release.tag_name}`,
        'Status: ' + (release.draft ? 'Draft' : release.prerelease ? 'Pre-release' : 'Published'),
        `URL: ${release.html_url}`,
      ].join('\n');
    }
    case 'gitlab_fork_repo': {
      const { owner: owner, repo: repo, organization: organization = '' } = params;
      requireRepo(owner, repo);
      const fork = await GitlabAPI.forkRepo(credentials, owner, repo, organization);
      return [
        `Fork created from ${owner}/${repo}`,
        `Fork: ${fork.full_name}`,
        `URL: ${fork.html_url}`,
        '(GitLab forks asynchronously — the repo may take a few seconds to be ready.)',
      ].join('\n');
    }
    case 'gitlab_update_pull_request': {
      const {
        owner: owner,
        repo: repo,
        pr_number: pr_number,
        title: title,
        body: body,
        state: state,
        base: base,
      } = params;
      requirePullRequest(owner, repo, pr_number);
      const updates = {};
      if (
        (void 0 !== title && (updates.title = title),
        void 0 !== body && (updates.body = body),
        void 0 !== state && (updates.state = state),
        void 0 !== base && (updates.base = base),
        !Object.keys(updates).length)
      )
        throw new Error('At least one field to update must be provided.');
      const pr = await GitlabAPI.updatePullRequest(
        credentials,
        owner,
        repo,
        Number(pr_number),
        updates,
      );
      return [
        `MR !${pr.number} updated in ${owner}/${repo}`,
        `Title: ${pr.title}`,
        `State: ${pr.state}`,
        `Branch: ${pr.head?.ref} -> ${pr.base?.ref}`,
        `URL: ${pr.html_url}`,
      ].join('\n');
    }
    case 'gitlab_get_labels': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const labels = await GitlabAPI.getLabels(credentials, owner, repo);
      return labels.length
        ? [
            `Labels in ${owner}/${repo} (${labels.length}):`,
            '',
            ...labels.map(
              (l, i) =>
                `${i + 1}. #${l.color}  ${l.name}${l.description ? ` — ${l.description}` : ''}`,
            ),
          ].join('\n')
        : `No labels found in ${owner}/${repo}.`;
    }
    case 'gitlab_create_label': {
      const {
        owner: owner,
        repo: repo,
        name: name,
        color: color,
        description: description = '',
      } = params;
      if (!(owner && repo && name && color))
        throw new Error('Missing required params: owner, repo, name, color');
      const label = await GitlabAPI.createLabel(credentials, owner, repo, name, color, description);
      return [
        `Label created in ${owner}/${repo}`,
        `Name: ${label.name}`,
        `Color: #${label.color}`,
        label.description ? `Description: ${label.description}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_delete_label': {
      const { owner: owner, repo: repo, name: name } = params;
      if (!owner || !repo || !name) throw new Error('Missing required params: owner, repo, name');
      return (
        await GitlabAPI.deleteLabel(credentials, owner, repo, name),
        `Label "${name}" deleted from ${owner}/${repo}.`
      );
    }
    case 'gitlab_search_users': {
      const { query: query, count: count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GitlabAPI.searchUsers(
          credentials,
          query,
          Math.min(Number(count) || 20, 50),
        ),
        items = result.items || [];
      return items.length
        ? [
            `User search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
            '',
            ...items.slice(0, 20).map((u, i) => `${i + 1}. @${u.login} [${u.type}]  ${u.html_url}`),
          ].join('\n')
        : `No users found for "${query}".`;
    }
    case 'gitlab_get_user_starred': {
      const { username: username, count: count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const repos = await GitlabAPI.getUserStarred(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      return repos.length
        ? [
            `Repositories starred by @${username} (${repos.length} shown):`,
            '',
            ...repos
              .slice(0, 30)
              .map(
                (r, i) =>
                  `${i + 1}. ${r.full_name} ★${r.stargazers_count} [${r.language || 'unknown'}]${r.description ? `\n   ${r.description}` : ''}`,
              ),
          ].join('\n')
        : `@${username} has not starred any repositories (or the list is private).`;
    }
    case 'gitlab_get_file_commits': {
      const { owner: owner, repo: repo, file_path: file_path, count: count = 15 } = params;
      if (!owner || !repo || !file_path)
        throw new Error('Missing required params: owner, repo, file_path');
      const commits = await GitlabAPI.getFileCommits(
        credentials,
        owner,
        repo,
        file_path,
        Math.min(Number(count) || 15, 50),
      );
      return commits.length
        ? [
            `Commits touching ${file_path} in ${owner}/${repo} (${commits.length} shown):`,
            '',
            ...commits.map(
              (c, i) =>
                `${i + 1}. \`${c.sha?.slice(0, 7) ?? '?'}\` ${String(c.commit?.message ?? '')
                  .split('\n')[0]
                  .slice(
                    0,
                    80,
                  )}\n   by ${c.commit?.author?.name ?? c.author?.login ?? 'unknown'} on ${formatDate(c.commit?.author?.date)}`,
            ),
          ].join('\n')
        : `No commits found for "${file_path}" in ${owner}/${repo}.`;
    }
    case 'gitlab_lock_issue': {
      const {
        owner: owner,
        repo: repo,
        issue_number: issue_number,
        lock_reason: lock_reason = '',
      } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      return (
        await GitlabAPI.lockIssue(credentials, owner, repo, Number(issue_number), lock_reason),
        `Issue/MR #${issue_number} in ${owner}/${repo} has been locked${lock_reason ? ` (reason: ${lock_reason})` : ''}.`
      );
    }
    case 'gitlab_unlock_issue': {
      const { owner: owner, repo: repo, issue_number: issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      return (
        await GitlabAPI.unlockIssue(credentials, owner, repo, Number(issue_number)),
        `Issue/MR #${issue_number} in ${owner}/${repo} has been unlocked.`
      );
    }
    case 'gitlab_get_deployments': {
      const { owner: owner, repo: repo, count: count = 20 } = params;
      requireRepo(owner, repo);
      const deployments = await GitlabAPI.getDeployments(
        credentials,
        owner,
        repo,
        Math.min(Number(count) || 20, 100),
      );
      return deployments.length
        ? [
            `Deployments for ${owner}/${repo} (${deployments.length} shown):`,
            '',
            ...deployments
              .slice(0, 20)
              .map(
                (d, i) =>
                  `${i + 1}. #${d.id}  env: ${d.environment}  ref: ${d.ref}  by @${d.creator?.login ?? 'unknown'}  ${formatDate(d.created_at)}`,
              ),
          ].join('\n')
        : `No deployments found for ${owner}/${repo}.`;
    }
    case 'gitlab_get_repo_permissions': {
      const { owner: owner, repo: repo, username: username } = params;
      if (!owner || !repo || !username)
        throw new Error('Missing required params: owner, repo, username');
      const result = await GitlabAPI.getRepoPermissions(credentials, owner, repo, username);
      return [
        `Permissions for @${username} in ${owner}/${repo}`,
        `Role: ${result.permission ?? 'none'}`,
        ...(result.user
          ? [
              `Name: ${result.user.name || result.user.login}`,
              `Email: ${result.user.email || 'private'}`,
            ]
          : []),
      ].join('\n');
    }
    case 'gitlab_remove_labels': {
      const { owner: owner, repo: repo, issue_number: issue_number, labels: labels } = params;
      if (!(owner && repo && issue_number && labels))
        throw new Error('Missing required params: owner, repo, issue_number, labels');
      const issue = await GitlabAPI.getIssueDetails(credentials, owner, repo, Number(issue_number)),
        toRemove = new Set(parseCommaList(labels).map((l) => l.toLowerCase())),
        remaining = (issue.labels || [])
          .map((l) => l.name)
          .filter((n) => !toRemove.has(n.toLowerCase())),
        keptNames =
          (
            (await GitlabAPI.removeLabels(
              credentials,
              owner,
              repo,
              Number(issue_number),
              remaining,
            )) || []
          )
            .map((l) => l.name)
            .join(', ') || 'none';
      return [
        `Labels updated on ${owner}/${repo}#${issue_number}`,
        `Removed: ${parseCommaList(labels).join(', ')}`,
        `Remaining: ${keptNames}`,
      ].join('\n');
    }
    case 'gitlab_get_pr_requested_reviewers': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const result = await GitlabAPI.getPRRequestedReviewers(
          credentials,
          owner,
          repo,
          Number(pr_number),
        ),
        all = [
          ...(result.users || []).map((u) => `@${u.login}`),
          ...(result.teams || []).map((t) => `team:${t.slug}`),
        ];
      return all.length
        ? [
            `Requested reviewers for ${owner}/${repo} MR !${pr_number}:`,
            '',
            ...all.map((r, i) => `${i + 1}. ${r}`),
          ].join('\n')
        : `No pending review requests on ${owner}/${repo} MR !${pr_number}.`;
    }
    case 'gitlab_get_repo_info': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const r = await GitlabAPI.getRepoInfo(credentials, owner, repo);
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
    case 'gitlab_get_org_repos': {
      const { org: org, count: count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const repos = await GitlabAPI.getOrgRepos(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      return repos.length
        ? [
            `Repositories for ${org} (${repos.length} shown):`,
            '',
            ...repos.map(
              (r, i) =>
                `${i + 1}. ${r.name} [${r.language ?? 'unknown'}] ★${r.stargazers_count}${r.description ? ` — ${r.description}` : ''}`,
            ),
          ].join('\n')
        : `No repositories found for group "${org}".`;
    }
    case 'gitlab_watch_repo': {
      const { owner: owner, repo: repo, action: action = 'watch' } = params;
      requireRepo(owner, repo);
      const unwatch = 'unwatch' === String(action).toLowerCase();
      return (
        await GitlabAPI.watchRepo(credentials, owner, repo, !unwatch),
        `${unwatch ? 'Unwatched' : 'Now watching'} ${owner}/${repo}.`
      );
    }
    case 'gitlab_get_user_events': {
      const { username: username, count: count = 20 } = params;
      if (!username) throw new Error('Missing required param: username');
      const events = await GitlabAPI.getUserEvents(
        credentials,
        username,
        Math.min(Number(count) || 20, 100),
      );
      return events.length
        ? [
            `Recent public events for @${username} (${events.length} shown):`,
            '',
            ...events.slice(0, 20).map((e, i) => {
              const repo = e.repo?.name ?? 'unknown',
                date = formatDate(e.created_at);
              return `${i + 1}. [${e.type}] ${repo} — ${date}`;
            }),
          ].join('\n')
        : `No public events found for @${username}.`;
    }
    case 'gitlab_get_repo_environments': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const envs =
        (await GitlabAPI.getRepoEnvironments(credentials, owner, repo)).environments ?? [];
      return envs.length
        ? [
            `Environments for ${owner}/${repo} (${envs.length}):`,
            '',
            ...envs.map((e, i) => {
              const updated = formatDate(e.updated_at),
                protections = e.protection_rules?.map((r) => r.type).join(', ') || 'none';
              return `${i + 1}. ${e.name} — updated ${updated} | protection: ${protections}`;
            }),
          ].join('\n')
        : `No deployment environments found for ${owner}/${repo}.`;
    }
    case 'gitlab_list_actions_secrets': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const secrets = (await GitlabAPI.listActionsSecrets(credentials, owner, repo)).secrets ?? [];
      return secrets.length
        ? [
            `CI/CD variables in ${owner}/${repo} (${secrets.length}) — names only, values are never exposed:`,
            '',
            ...secrets.map(
              (s, i) =>
                `${i + 1}. ${s.name}${s.updated_at ? ` — updated ${formatDate(s.updated_at)}` : ''}`,
            ),
          ].join('\n')
        : `No CI/CD variables found in ${owner}/${repo}.`;
    }
    case 'gitlab_get_dependabot_alerts': {
      const { owner: owner, repo: repo, state: state = 'open' } = params;
      requireRepo(owner, repo);
      const alerts = await GitlabAPI.getDependabotAlerts(credentials, owner, repo, state);
      return alerts.length
        ? [
            `Vulnerability alerts for ${owner}/${repo} (${alerts.length} ${state}):`,
            '',
            ...alerts.slice(0, 20).map((a, i) => {
              const pkg = a.dependency?.package?.name ?? a.name ?? 'unknown',
                severity = a.security_advisory?.severity ?? a.severity ?? 'unknown',
                summary = a.security_advisory?.summary ?? a.description ?? '';
              return `${i + 1}. [${String(severity).toUpperCase()}] ${pkg} — ${summary}`;
            }),
          ].join('\n')
        : `No ${state} vulnerability alerts in ${owner}/${repo}.`;
    }
    case 'gitlab_get_commits_since': {
      const {
        owner: owner,
        repo: repo,
        since: since,
        until: until = '',
        count: count = 20,
      } = params;
      if ((requireRepo(owner, repo), !since))
        throw new Error('Missing required param: since (ISO 8601 date, e.g. 2024-01-01T00:00:00Z)');
      const commits = await GitlabAPI.getCommitsSince(
        credentials,
        owner,
        repo,
        since,
        until,
        Math.min(Number(count) || 20, 100),
      );
      return commits.length
        ? [
            `Commits in ${owner}/${repo} since ${since}${until ? ` until ${until}` : ''} (${commits.length} shown):`,
            '',
            ...commits.map(
              (c, i) =>
                `${i + 1}. \`${c.sha?.slice(0, 7) ?? '?'}\` ${String(c.commit?.message ?? '')
                  .split('\n')[0]
                  .slice(
                    0,
                    80,
                  )}\n   by ${c.commit?.author?.name ?? c.author?.login ?? 'unknown'} on ${formatDate(c.commit?.author?.date)}`,
            ),
          ].join('\n')
        : `No commits found in ${owner}/${repo} since ${since}.`;
    }
    case 'gitlab_get_branch_protection': {
      const { owner: owner, repo: repo, branch: branch } = params;
      if (!owner || !repo || !branch)
        throw new Error('Missing required params: owner, repo, branch');
      const p = await GitlabAPI.getBranchProtection(credentials, owner, repo, branch),
        lines = [`Branch protection for ${owner}/${repo}:${branch}`, ''];
      if (p.push_access_levels) {
        const levels = p.push_access_levels.map((l) => l.access_level_description).join(', ');
        lines.push(`Push access: ${levels}`);
      }
      if (p.merge_access_levels) {
        const levels = p.merge_access_levels.map((l) => l.access_level_description).join(', ');
        lines.push(`Merge access: ${levels}`);
      }
      return (
        lines.push(`Allow force push: ${p.allow_force_push ?? !1}`),
        lines.push(`Code owner approval: ${p.code_owner_approval_required ?? !1}`),
        lines.join('\n')
      );
    }
    case 'gitlab_get_user_orgs': {
      const { username: username } = params;
      if (!username) throw new Error('Missing required param: username');
      const orgs = await GitlabAPI.getUserOrgs(credentials, username);
      return orgs.length
        ? [
            `Groups for @${username} (${orgs.length}):`,
            '',
            ...orgs.map(
              (o, i) => `${i + 1}. ${o.login}${o.description ? ` — ${o.description}` : ''}`,
            ),
          ].join('\n')
        : `@${username} is not a member of any public groups.`;
    }
    case 'gitlab_get_traffic_clones': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const data = await GitlabAPI.getTrafficClones(credentials, owner, repo),
        recent = (data.clones ?? []).slice(-7);
      return [
        `Clone traffic for ${owner}/${repo} (last 14 days):`,
        `Total clones: ${data.count ?? 0} | Unique cloners: ${data.uniques ?? 0}`,
        '',
        recent.length
          ? 'Daily breakdown (last 7 days):'
          : 'Note: GitLab does not expose clone traffic stats via the public API.',
        ...recent.map(
          (c) => `  ${formatDate(c.timestamp)}: ${c.count} clones, ${c.uniques} unique`,
        ),
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_community_profile': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const data = await GitlabAPI.getCommunityProfile(credentials, owner, repo),
        files = data.files ?? {},
        checks = [
          ['README', !!files.readme],
          ['License', !!files.license],
          ['Code of conduct', !!files.code_of_conduct],
          ['Contributing', !!files.contributing],
          ['Issue template', !!files.issue_template],
          ['MR template', !!files.pull_request_template],
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
    case 'gitlab_get_repo_webhooks': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const hooks = await GitlabAPI.getRepoWebhooks(credentials, owner, repo);
      return hooks.length
        ? [
            `Webhooks for ${owner}/${repo} (${hooks.length}):`,
            '',
            ...hooks.map((h, i) => {
              const events = (h.events ?? []).join(', ') || 'none',
                active = h.active ? 'active' : 'inactive';
              return `${i + 1}. ${h.config?.url ?? 'no url'} [${active}]\n   Events: ${events}`;
            }),
          ].join('\n')
        : `No webhooks configured for ${owner}/${repo}.`;
    }
    case 'gitlab_get_org_members': {
      const { org: org, count: count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const members = await GitlabAPI.getOrgMembers(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      return members.length
        ? [
            `Members of ${org} (${members.length} shown):`,
            '',
            ...members.map((m, i) => `${i + 1}. @${m.login} — ${m.html_url}`),
          ].join('\n')
        : `No public members found for group "${org}".`;
    }
    case 'gitlab_list_org_teams': {
      const { org: org, count: count = 30 } = params;
      if (!org) throw new Error('Missing required param: org');
      const teams = await GitlabAPI.listOrgTeams(
        credentials,
        org,
        Math.min(Number(count) || 30, 100),
      );
      return teams.length
        ? [
            `Subgroups in ${org} (${teams.length}):`,
            '',
            ...teams.map(
              (t, i) =>
                `${i + 1}. ${t.name} (${t.slug})${t.description ? `\n   ${t.description}` : ''}`,
            ),
          ].join('\n')
        : `No subgroups found in group "${org}".`;
    }
    case 'gitlab_get_team_members': {
      const { org: org, team_slug: team_slug, count: count = 30 } = params;
      if (!org || !team_slug) throw new Error('Missing required params: org, team_slug');
      const members = await GitlabAPI.getTeamMembers(
        credentials,
        org,
        team_slug,
        Math.min(Number(count) || 30, 100),
      );
      return members.length
        ? [
            `Members of ${org}/${team_slug} (${members.length}):`,
            '',
            ...members.map((m, i) => `${i + 1}. @${m.login}`),
          ].join('\n')
        : `No members found in subgroup "${team_slug}" of group "${org}".`;
    }
    case 'gitlab_get_issue_reactions': {
      const { owner: owner, repo: repo, issue_number: issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const reactions = await GitlabAPI.getIssueReactions(
        credentials,
        owner,
        repo,
        Number(issue_number),
      );
      if (!reactions.length) return `No reactions on ${owner}/${repo}#${issue_number}.`;
      const counts = reactions.reduce(
          (acc, r) => ((acc[r.content] = (acc[r.content] ?? 0) + 1), acc),
          {},
        ),
        emojiMap = {
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
    case 'gitlab_get_repo_license': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const license = (await GitlabAPI.getRepoLicense(credentials, owner, repo)).license ?? {};
      return [
        `License for ${owner}/${repo}`,
        `Name: ${license.name ?? 'unknown'}`,
        `SPDX ID: ${license.spdx_id ?? 'n/a'}`,
        license.url ? `Info: ${license.url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_code_frequency': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const weeks = await GitlabAPI.getCodeFrequency(credentials, owner, repo);
      if (!weeks?.length) return `No code frequency data available for ${owner}/${repo}.`;
      const recent = weeks.slice(-8);
      return [
        `Code frequency for ${owner}/${repo} (last ${recent.length} weeks):`,
        'Format: week — additions / deletions',
        '',
        ...recent.map(
          ([ts, additions, deletions]) =>
            `  ${formatDate(new Date(1e3 * ts))}  +${additions} / ${deletions}`,
        ),
      ].join('\n');
    }
    case 'gitlab_get_contributor_stats': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const stats = await GitlabAPI.getContributorStats(credentials, owner, repo);
      if (!stats?.length) return `No contributor stats available for ${owner}/${repo}.`;
      const sorted = [...stats].sort((a, b) => b.total - a.total);
      return [
        `Contributor stats for ${owner}/${repo} (${sorted.length} contributors):`,
        '',
        ...sorted.slice(0, 15).map((c, i) => {
          const additions = c.weeks?.reduce((s, w) => s + w.a, 0) ?? 0,
            deletions = c.weeks?.reduce((s, w) => s + w.d, 0) ?? 0;
          return `${i + 1}. @${c.author?.login ?? 'unknown'} — ${c.total} commits  +${additions} -${deletions}`;
        }),
      ].join('\n');
    }
    case 'gitlab_get_commit_activity': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const weeks = await GitlabAPI.getCommitActivity(credentials, owner, repo);
      if (!weeks?.length) return `No commit activity data yet for ${owner}/${repo}.`;
      const recent = weeks.slice(-8),
        total = recent.reduce((s, w) => s + w.total, 0);
      return [
        `Commit activity for ${owner}/${repo} (last ${recent.length} weeks, ${total} commits):`,
        '',
        ...recent.map((w) => {
          const bar = '█'.repeat(Math.min(w.total, 20));
          return `  ${formatDate(new Date(1e3 * w.week))}  ${String(w.total).padStart(3)} ${bar}`;
        }),
      ].join('\n');
    }
    case 'gitlab_get_punch_card': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const data = await GitlabAPI.getPunchCard(credentials, owner, repo);
      if (!data?.length) return `No punch card data available for ${owner}/${repo}.`;
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
        peak = [...data].sort((a, b) => b[2] - a[2])[0],
        byDay = days.map(
          (name, d) =>
            `  ${name}: ${data.filter(([day]) => day === d).reduce((s, [, , c]) => s + c, 0)} commits`,
        );
      return [
        `Commit punch card for ${owner}/${repo}:`,
        `Peak time: ${days[peak[0]]} at ${peak[1]}:00 (${peak[2]} commits)`,
        '',
        'Commits by day of week:',
        ...byDay,
      ].join('\n');
    }
    case 'gitlab_get_repo_subscription': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const data = await GitlabAPI.getRepoSubscription(credentials, owner, repo);
      return [
        `Subscription status for ${owner}/${repo}:`,
        `Subscribed: ${data.subscribed ?? !1}`,
        `Ignored: ${data.ignored ?? !1}`,
        `Reason: ${data.reason ?? 'n/a'}`,
        data.created_at ? `Since: ${formatDate(data.created_at)}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_user_followers': {
      const { username: username, count: count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const followers = await GitlabAPI.getUserFollowers(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      return followers.length
        ? [
            `Followers of @${username} (${followers.length} shown):`,
            '',
            ...followers.map((u, i) => `${i + 1}. @${u.login}`),
          ].join('\n')
        : `@${username} has no public followers (GitLab follower lists may not be exposed via API).`;
    }
    case 'gitlab_get_user_following': {
      const { username: username, count: count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const following = await GitlabAPI.getUserFollowing(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      return following.length
        ? [
            `@${username} is following (${following.length} shown):`,
            '',
            ...following.map((u, i) => `${i + 1}. @${u.login}`),
          ].join('\n')
        : `@${username} is not following anyone (or list is private).`;
    }
    case 'gitlab_get_user_gists': {
      const { username: username, count: count = 20 } = params;
      if (!username) throw new Error('Missing required param: username');
      const gists = await GitlabAPI.getUserGists(
        credentials,
        username,
        Math.min(Number(count) || 20, 100),
      );
      return gists.length
        ? [
            `Snippets by @${username} (${gists.length} shown):`,
            '',
            ...gists.map((g, i) => {
              const files = Object.keys(g.files).join(', ');
              return `${i + 1}. ${g.description || files || 'untitled'} [${g.public ? 'public' : 'private'}]\n   ${g.html_url}`;
            }),
          ].join('\n')
        : `No public snippets found for @${username}.`;
    }
    case 'gitlab_get_gist_details': {
      const { gist_id: gist_id } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const g = await GitlabAPI.getGistDetails(credentials, gist_id),
        files = Object.values(g.files ?? {}),
        preview = files[0]
          ? `\nFirst file (${files[0].filename}):\n${(files[0].content ?? '').slice(0, 500)}${(files[0].content?.length ?? 0) > 500 ? '\n...(truncated)' : ''}`
          : '';
      return [
        `Snippet: ${g.description || gist_id}`,
        `Owner: @${g.owner?.login ?? 'unknown'}`,
        'Visibility: ' + (g.public ? 'public' : 'private'),
        `Files (${files.length}): ${files.map((f) => f.filename).join(', ')}`,
        `Created: ${formatDate(g.created_at)} | Updated: ${formatDate(g.updated_at)}`,
        `Comments: ${g.comments ?? 0}`,
        `URL: ${g.html_url}`,
        preview,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_pr_commits': {
      const { owner: owner, repo: repo, pr_number: pr_number } = params;
      requirePullRequest(owner, repo, pr_number);
      const commits = await GitlabAPI.getPRCommits(credentials, owner, repo, Number(pr_number));
      return commits.length
        ? [
            `Commits in ${owner}/${repo} MR !${pr_number} (${commits.length}):`,
            '',
            ...commits.map(
              (c, i) =>
                `${i + 1}. \`${c.sha?.slice(0, 7) ?? '?'}\` ${String(c.commit?.message ?? '')
                  .split('\n')[0]
                  .slice(0, 80)}\n   by ${c.commit?.author?.name ?? c.author?.login ?? 'unknown'}`,
            ),
          ].join('\n')
        : `No commits found in ${owner}/${repo} MR !${pr_number}.`;
    }
    case 'gitlab_get_commit_statuses': {
      const { owner: owner, repo: repo, ref: ref } = params;
      if (!owner || !repo || !ref) throw new Error('Missing required params: owner, repo, ref');
      const statuses = await GitlabAPI.getCommitStatuses(credentials, owner, repo, ref);
      return statuses.length
        ? [
            `Commit statuses for ${ref} in ${owner}/${repo} (${statuses.length}):`,
            '',
            ...statuses.map(
              (s, i) =>
                `${i + 1}. [${s.status ?? s.state}] ${s.name ?? s.context ?? 'unknown'}\n   ${s.description ?? ''}\n   ${s.target_url ?? ''}`,
            ),
          ]
            .filter(Boolean)
            .join('\n')
        : `No commit statuses found for ${ref} in ${owner}/${repo}.`;
    }
    case 'gitlab_get_repo_pages': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const p = await GitlabAPI.getRepoPages(credentials, owner, repo);
      return p
        ? [
            `GitLab Pages for ${owner}/${repo}:`,
            `URL: ${p.url ?? 'not set'}`,
            p.custom_domain ? `Custom domain: ${p.custom_domain}` : '',
          ]
            .filter(Boolean)
            .join('\n')
        : `No GitLab Pages configuration found for ${owner}/${repo}.`;
    }
    case 'gitlab_get_org_info': {
      const { org: org } = params;
      if (!org) throw new Error('Missing required param: org');
      const o = await GitlabAPI.getOrgInfo(credentials, org);
      return [
        `Group: ${o.login}`,
        o.name ? `Name: ${o.name}` : '',
        o.description ? `Description: ${o.description}` : '',
        o.email ? `Email: ${o.email}` : '',
        o.blog ? `Website: ${o.blog}` : '',
        o.location ? `Location: ${o.location}` : '',
        `Public repos: ${o.public_repos}`,
        `Followers: ${o.followers}`,
        `Created: ${formatDate(o.created_at)}`,
        `URL: ${o.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_search_commits': {
      const { query: query, count: count = 20 } = params;
      if (!query) throw new Error('Missing required param: query');
      const result = await GitlabAPI.searchCommits(
          credentials,
          query,
          Math.min(Number(count) || 20, 50),
        ),
        items = result.items ?? [];
      return items.length
        ? [
            `Commit search results for "${query}" (${result.total_count?.toLocaleString() ?? 0} total):`,
            '',
            ...items.slice(0, 20).map(
              (c, i) =>
                `${i + 1}. \`${c.sha?.slice(0, 7) ?? '?'}\` ${String(c.commit?.message ?? '')
                  .split('\n')[0]
                  .slice(
                    0,
                    80,
                  )}\n   by ${c.commit?.author?.name ?? c.author?.login ?? 'unknown'} in ${c.repository?.full_name ?? 'unknown'}`,
            ),
          ].join('\n')
        : `No commits found for query "${query}".`;
    }
    case 'gitlab_get_deployment_statuses': {
      const { owner: owner, repo: repo, deployment_id: deployment_id } = params;
      if (!owner || !repo || !deployment_id)
        throw new Error('Missing required params: owner, repo, deployment_id');
      const statuses = await GitlabAPI.getDeploymentStatuses(
        credentials,
        owner,
        repo,
        deployment_id,
      );
      return statuses.length
        ? [
            `Statuses for deployment #${deployment_id} in ${owner}/${repo}:`,
            '',
            ...statuses.map(
              (s, i) =>
                `${i + 1}. [${s.state}] ${s.environment ?? 'unknown env'} — ${formatDateTime(s.created_at)}\n   ${s.description ?? ''}${s.log_url ? `\n   Logs: ${s.log_url}` : ''}`,
            ),
          ]
            .filter(Boolean)
            .join('\n')
        : `No statuses found for deployment #${deployment_id} in ${owner}/${repo}.`;
    }
    case 'gitlab_get_repo_invitations': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const invites = await GitlabAPI.getRepoInvitations(credentials, owner, repo);
      return invites.length
        ? [
            `Pending invitations for ${owner}/${repo} (${invites.length}):`,
            '',
            ...invites.map(
              (inv, i) =>
                `${i + 1}. @${inv.invitee?.login ?? 'unknown'} — ${inv.permissions} — invited by @${inv.inviter?.login ?? 'unknown'} on ${formatDate(inv.created_at)}`,
            ),
          ].join('\n')
        : `No pending invitations for ${owner}/${repo}.`;
    }
    case 'gitlab_get_rate_limit': {
      const data = await GitlabAPI.getRateLimit(credentials),
        core = data.resources?.core ?? {},
        search = data.resources?.search ?? {},
        graphql = data.resources?.graphql ?? {},
        formatReset = (ts) => (ts ? new Date(1e3 * ts).toLocaleTimeString() : 'n/a');
      return [
        'GitLab API Rate Limits:',
        '',
        `Core:    ${core.remaining ?? 'n/a'} / ${core.limit ?? 'n/a'} remaining — resets at ${formatReset(core.reset)}`,
        `Search:  ${search.remaining ?? 'n/a'} / ${search.limit ?? 'n/a'} remaining — resets at ${formatReset(search.reset)}`,
        `GraphQL: ${graphql.remaining ?? 'n/a'} / ${graphql.limit ?? 'n/a'} remaining — resets at ${formatReset(graphql.reset)}`,
        'Note: GitLab rate limit details may not be fully exposed via the public API.',
      ].join('\n');
    }
    case 'gitlab_list_workflows': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const workflows = (await GitlabAPI.listWorkflows(credentials, owner, repo)).workflows ?? [];
      return workflows.length
        ? [
            `Pipeline schedules in ${owner}/${repo} (${workflows.length}):`,
            '',
            ...workflows.map(
              (w, i) => `${i + 1}. ${w.name} [${w.state}]\n   File: ${w.path}\n   ID: ${w.id}`,
            ),
          ].join('\n')
        : `No pipeline schedules found in ${owner}/${repo}.`;
    }
    case 'gitlab_get_workflow_details': {
      const { owner: owner, repo: repo, workflow_id: workflow_id } = params;
      if (!owner || !repo || !workflow_id)
        throw new Error('Missing required params: owner, repo, workflow_id');
      const w = await GitlabAPI.getWorkflowDetails(credentials, owner, repo, workflow_id);
      return [
        `Pipeline schedule: ${w.name}`,
        `ID: ${w.id}`,
        `File: ${w.path}`,
        `State: ${w.state}`,
        `Created: ${formatDate(w.created_at)} | Updated: ${formatDate(w.updated_at)}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_actions_runners': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const runners = (await GitlabAPI.getActionsRunners(credentials, owner, repo)).runners ?? [];
      return runners.length
        ? [
            `CI/CD runners in ${owner}/${repo} (${runners.length}):`,
            '',
            ...runners.map((r, i) => {
              const labels = r.labels?.map((l) => l.name).join(', ') || 'none';
              return `${i + 1}. ${r.name} [${r.status}] — OS: ${r.os ?? 'unknown'} | Labels: ${labels}`;
            }),
          ].join('\n')
        : `No CI/CD runners found in ${owner}/${repo}.`;
    }
    case 'gitlab_get_actions_variables': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const vars = (await GitlabAPI.getActionsVariables(credentials, owner, repo)).variables ?? [];
      return vars.length
        ? [
            `CI/CD variables in ${owner}/${repo} (${vars.length}):`,
            '',
            ...vars.map(
              (v, i) =>
                `${i + 1}. ${v.name} = ${v.value}${v.updated_at ? `\n   Updated: ${formatDate(v.updated_at)}` : ''}`,
            ),
          ].join('\n')
        : `No CI/CD variables found in ${owner}/${repo}.`;
    }
    case 'gitlab_get_actions_cache': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const caches =
        (await GitlabAPI.getActionsCache(credentials, owner, repo)).actions_caches ?? [];
      if (!caches.length) return `No CI/CD cache entries found in ${owner}/${repo}.`;
      const totalMB = (caches.reduce((s, c) => s + (c.size_in_bytes ?? 0), 0) / 1e6).toFixed(1);
      return [
        `CI/CD cache for ${owner}/${repo} (${caches.length} entries, ${totalMB} MB total):`,
        '',
        ...caches.slice(0, 20).map((c, i) => {
          const size = ((c.size_in_bytes ?? 0) / 1e6).toFixed(2);
          return `${i + 1}. ${c.key}\n   Branch: ${c.ref ?? 'unknown'} | ${size} MB | Last used: ${formatDate(c.last_accessed_at)}`;
        }),
      ].join('\n');
    }
    case 'gitlab_get_team_repos': {
      const { org: org, team_slug: team_slug, count: count = 30 } = params;
      if (!org || !team_slug) throw new Error('Missing required params: org, team_slug');
      const repos = await GitlabAPI.getTeamRepos(
        credentials,
        org,
        team_slug,
        Math.min(Number(count) || 30, 100),
      );
      return repos.length
        ? [
            `Repos accessible to ${org}/${team_slug} (${repos.length}):`,
            '',
            ...repos.map((r, i) => {
              const perms = Object.entries(r.permissions ?? {})
                .filter(([, v]) => v)
                .map(([k]) => k)
                .join(', ');
              return `${i + 1}. ${r.full_name} [${r.language ?? 'unknown'}] — permissions: ${perms || 'none'}`;
            }),
          ].join('\n')
        : `No repositories found for subgroup "${team_slug}" in group "${org}".`;
    }
    case 'gitlab_get_user_repos': {
      const { username: username, count: count = 30 } = params;
      if (!username) throw new Error('Missing required param: username');
      const repos = await GitlabAPI.getUserRepos(
        credentials,
        username,
        Math.min(Number(count) || 30, 100),
      );
      return repos.length
        ? [
            `Repositories for @${username} (${repos.length} shown):`,
            '',
            ...repos.map(
              (r, i) =>
                `${i + 1}. ${r.name} [${r.language ?? 'unknown'}] ★${r.stargazers_count}${r.description ? ` — ${r.description}` : ''}`,
            ),
          ].join('\n')
        : `No public repositories found for @${username}.`;
    }
    case 'gitlab_get_issue_timeline': {
      const { owner: owner, repo: repo, issue_number: issue_number } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const events = await GitlabAPI.getIssueTimeline(
        credentials,
        owner,
        repo,
        Number(issue_number),
      );
      return events.length
        ? [
            `Timeline for ${owner}/${repo}#${issue_number} (${events.length} events):`,
            '',
            ...events.slice(0, 25).map((e, i) => {
              const actor = e.actor?.login ?? e.user?.login ?? 'unknown',
                date = formatDate(e.created_at ?? e.submitted_at),
                detail = e.label?.name
                  ? `label: ${e.label.name}`
                  : e.body
                    ? String(e.body).slice(0, 80)
                    : '';
              return `${i + 1}. [${e.event}] @${actor} ${date}${detail ? `\n   ${detail}` : ''}`;
            }),
          ].join('\n')
        : `No timeline events found for ${owner}/${repo}#${issue_number}.`;
    }
    case 'gitlab_get_org_secrets': {
      const { org: org } = params;
      if (!org) throw new Error('Missing required param: org');
      const secrets = (await GitlabAPI.getOrgSecrets(credentials, org)).secrets ?? [];
      return secrets.length
        ? [
            `Group-level CI/CD variables for ${org} (${secrets.length}) — names only:`,
            '',
            ...secrets.map(
              (s, i) =>
                `${i + 1}. ${s.name} — visibility: ${s.visibility}${s.updated_at ? ` | updated: ${formatDate(s.updated_at)}` : ''}`,
            ),
          ].join('\n')
        : `No group-level CI/CD variables found in "${org}".`;
    }
    case 'gitlab_get_single_comment': {
      const { owner: owner, repo: repo, comment_id: comment_id } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      const c = await GitlabAPI.getSingleComment(credentials, owner, repo, comment_id);
      return [
        `Comment #${c.id} on ${owner}/${repo}`,
        `Author: @${c.author?.username ?? c.user?.login ?? 'unknown'}`,
        `Created: ${formatDate(c.created_at)} | Updated: ${formatDate(c.updated_at)}`,
        '',
        c.body ?? '(empty)',
      ].join('\n');
    }
    case 'gitlab_get_security_advisories': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const advisories = await GitlabAPI.getRepoSecurityAdvisories(credentials, owner, repo);
      return advisories.length
        ? [
            `Vulnerability findings for ${owner}/${repo} (${advisories.length}):`,
            '',
            ...advisories.slice(0, 20).map((a, i) => {
              const severity = a.severity ?? 'unknown',
                state = a.state ?? 'unknown';
              return `${i + 1}. [${String(severity).toUpperCase()}] ${a.name ?? a.summary ?? 'no summary'}\n   State: ${state}`;
            }),
          ].join('\n')
        : `No security vulnerability findings found for ${owner}/${repo}.`;
    }
    case 'gitlab_get_pr_review_details': {
      const { owner: owner, repo: repo, pr_number: pr_number, review_id: review_id } = params;
      if (!(owner && repo && pr_number && review_id))
        throw new Error('Missing required params: owner, repo, pr_number, review_id');
      const r = await GitlabAPI.getPRReviewDetails(
        credentials,
        owner,
        repo,
        Number(pr_number),
        review_id,
      );
      return [
        `Review #${r.id} on ${owner}/${repo} MR !${pr_number}`,
        `Reviewer: @${r.user?.login ?? 'unknown'}`,
        `State: ${r.state}`,
        `Submitted: ${formatDate(r.submitted_at)}`,
        `URL: ${r.html_url}`,
        '',
        r.body
          ? `Body:\n${r.body.slice(0, 1e3)}${r.body.length > 1e3 ? '\n...(truncated)' : ''}`
          : '(no body)',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_org_variables': {
      const { org: org } = params;
      if (!org) throw new Error('Missing required param: org');
      const vars = (await GitlabAPI.getOrgVariables(credentials, org)).variables ?? [];
      return vars.length
        ? [
            `Group-level CI/CD variables for ${org} (${vars.length}):`,
            '',
            ...vars.map(
              (v, i) =>
                `${i + 1}. ${v.name} = ${v.value}\n   Visibility: ${v.visibility}${v.updated_at ? ` | Updated: ${formatDate(v.updated_at)}` : ''}`,
            ),
          ].join('\n')
        : `No group-level CI/CD variables found in "${org}".`;
    }
    case 'gitlab_get_repo_autolinks': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const links = await GitlabAPI.getRepoAutolinks(credentials, owner, repo);
      return links.length
        ? [
            `Autolinks for ${owner}/${repo} (${links.length}):`,
            '',
            ...links.map((l, i) => `${i + 1}. ${JSON.stringify(l)}`),
          ].join('\n')
        : `No autolinks configured for ${owner}/${repo} (or not supported by GitLab).`;
    }
    case 'gitlab_get_check_run_details': {
      const { owner: owner, repo: repo, check_run_id: check_run_id } = params;
      if (!owner || !repo || !check_run_id)
        throw new Error('Missing required params: owner, repo, check_run_id');
      const c = await GitlabAPI.getCheckRunDetails(credentials, owner, repo, check_run_id);
      return [
        `CI job: ${c.name}`,
        `ID: ${c.id}`,
        `Status: ${c.status} | Conclusion: ${c.conclusion ?? 'pending'}`,
        `Started: ${formatDateTime(c.started_at)} | Completed: ${formatDateTime(c.completed_at)}`,
        c.output?.title ? `Title: ${c.output.title}` : '',
        c.output?.summary ? `Summary: ${c.output.summary.slice(0, 300)}` : '',
        `URL: ${c.html_url}`,
        c.details_url ? `Details: ${c.details_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_create_repo': {
      const {
        name: name,
        description: description = '',
        private: isPrivate = !1,
        auto_init: auto_init = !1,
      } = params;
      if (!name) throw new Error('Missing required param: name');
      const repo = await GitlabAPI.createRepo(credentials, {
        name: name,
        description: description,
        private: Boolean(isPrivate),
        autoInit: Boolean(auto_init),
      });
      return [
        `Repository created: ${repo.full_name}`,
        'Visibility: ' + (repo.private ? 'Private' : 'Public'),
        repo.description ? `Description: ${repo.description}` : '',
        `URL: ${repo.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_update_repo': {
      const {
        owner: owner,
        repo: repo,
        description: description,
        homepage: homepage,
        private: isPrivate,
        default_branch: default_branch,
        has_issues: has_issues,
        has_wiki: has_wiki,
        has_projects: has_projects,
      } = params;
      requireRepo(owner, repo);
      const payload = {};
      if (
        (void 0 !== description && (payload.description = description),
        void 0 !== homepage && (payload.homepage = homepage),
        void 0 !== isPrivate && (payload.private = Boolean(isPrivate)),
        void 0 !== default_branch && (payload.default_branch = default_branch),
        void 0 !== has_issues && (payload.has_issues = Boolean(has_issues)),
        void 0 !== has_wiki && (payload.has_wiki = Boolean(has_wiki)),
        void 0 !== has_projects && (payload.has_projects = Boolean(has_projects)),
        !Object.keys(payload).length)
      )
        throw new Error('At least one field to update must be provided.');
      const updated = await GitlabAPI.updateRepo(credentials, owner, repo, payload);
      return [
        `Repository updated: ${updated.full_name}`,
        'Visibility: ' + (updated.private ? 'Private' : 'Public'),
        updated.description ? `Description: ${updated.description}` : '',
        `URL: ${updated.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_delete_repo': {
      const { owner: owner, repo: repo } = params;
      return (
        requireRepo(owner, repo),
        await GitlabAPI.deleteRepo(credentials, owner, repo),
        `Repository ${owner}/${repo} has been permanently deleted.`
      );
    }
    case 'gitlab_get_repo_contents': {
      const { owner: owner, repo: repo, path: path = '', ref: ref = '' } = params;
      requireRepo(owner, repo);
      const data = await GitlabAPI.getRepoContents(credentials, owner, repo, path, ref);
      return Array.isArray(data)
        ? [
            `Contents of ${owner}/${repo}${path ? `/${path}` : ''}${ref ? ` @ ${ref}` : ''} (${data.length} items):`,
            '',
            ...data.map(
              (item) =>
                `${'dir' === item.type ? '📁' : '📄'} ${item.name}${'file' === item.type ? `  (${item.size} bytes)` : ''}`,
            ),
          ].join('\n')
        : [
            `File: ${data.path}`,
            `Size: ${data.size} bytes`,
            `SHA: ${data.sha}`,
            `URL: ${data.html_url}`,
          ].join('\n');
    }
    case 'gitlab_create_or_update_file': {
      const {
        owner: owner,
        repo: repo,
        file_path: file_path,
        message: message,
        content: content,
        sha: sha = '',
        branch: branch = '',
      } = params;
      if (!(owner && repo && file_path && message && content))
        throw new Error('Missing required params: owner, repo, file_path, message, content');
      const result = await GitlabAPI.createOrUpdateFile(credentials, owner, repo, file_path, {
        message: message,
        content: content,
        sha: sha,
        branch: branch,
      });
      return [
        `File ${sha ? 'updated' : 'created'}: ${file_path} in ${owner}/${repo}`,
        `Commit: ${result?.commit_id?.slice(0, 7) ?? result?.id?.slice(0, 7) ?? '?'}`,
        `Message: ${message}`,
        branch ? `Branch: ${branch}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_delete_file': {
      const {
        owner: owner,
        repo: repo,
        file_path: file_path,
        message: message,
        sha: sha,
        branch: branch = '',
      } = params;
      if (!(owner && repo && file_path && message && sha))
        throw new Error('Missing required params: owner, repo, file_path, message, sha');
      const result = await GitlabAPI.deleteFile(credentials, owner, repo, file_path, {
        message: message,
        sha: sha,
        branch: branch,
      });
      return [
        `File deleted: ${file_path} from ${owner}/${repo}`,
        `Commit: ${result?.commit?.id?.slice(0, 7) ?? '?'}`,
        `Message: ${message}`,
        branch ? `Branch: ${branch}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_commit_comments': {
      const { owner: owner, repo: repo, sha: sha } = params;
      if (!owner || !repo || !sha) throw new Error('Missing required params: owner, repo, sha');
      const comments = await GitlabAPI.getCommitComments(credentials, owner, repo, sha);
      return comments.length
        ? [
            `Comments on ${owner}/${repo}@${sha.slice(0, 7)} (${comments.length}):`,
            '',
            ...comments.map((c, i) => {
              const body = String(c.body || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 200);
              return `${i + 1}. @${c.user?.login ?? 'unknown'} — ${formatDate(c.created_at)}${c.path ? `\n   File: ${c.path}` : ''}\n   ${body}`;
            }),
          ].join('\n')
        : `No comments on commit ${sha.slice(0, 7)} in ${owner}/${repo}.`;
    }
    case 'gitlab_create_commit_comment': {
      const {
        owner: owner,
        repo: repo,
        sha: sha,
        body: body,
        path: path = '',
        position: position,
      } = params;
      if (!(owner && repo && sha && body))
        throw new Error('Missing required params: owner, repo, sha, body');
      const comment = await GitlabAPI.createCommitComment(
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
        `URL: ${comment?.html_url ?? `https://gitlab.com/${owner}/${repo}/-/commit/${sha}`}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_dismiss_pr_review': {
      const {
        owner: owner,
        repo: repo,
        pr_number: pr_number,
        review_id: review_id,
        message: message,
      } = params;
      if (!(owner && repo && pr_number && review_id && message))
        throw new Error('Missing required params: owner, repo, pr_number, review_id, message');
      return (
        await GitlabAPI.dismissPRReview(
          credentials,
          owner,
          repo,
          Number(pr_number),
          review_id,
          message,
        ),
        [
          `Review #${review_id} dismissed on ${owner}/${repo} MR !${pr_number}`,
          `Dismissal message: ${message}`,
        ].join('\n')
      );
    }
    case 'gitlab_cancel_workflow_run': {
      const { owner: owner, repo: repo, run_id: run_id } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      return (
        await GitlabAPI.cancelWorkflowRun(credentials, owner, repo, run_id),
        `Pipeline #${run_id} in ${owner}/${repo} has been cancelled.`
      );
    }
    case 'gitlab_rerun_workflow_run': {
      const { owner: owner, repo: repo, run_id: run_id } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      return (
        await GitlabAPI.rerunWorkflowRun(credentials, owner, repo, run_id),
        `Pipeline #${run_id} in ${owner}/${repo} has been queued for retry.`
      );
    }
    case 'gitlab_list_workflow_run_artifacts': {
      const { owner: owner, repo: repo, run_id: run_id, count: count = 20 } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      const artifacts =
        (
          await GitlabAPI.listWorkflowRunArtifacts(
            credentials,
            owner,
            repo,
            run_id,
            Math.min(Number(count) || 20, 100),
          )
        ).artifacts ?? [];
      return artifacts.length
        ? [
            `Artifacts for pipeline #${run_id} in ${owner}/${repo} (${artifacts.length}):`,
            '',
            ...artifacts.map((a, i) => {
              const size = ((a.size_in_bytes ?? 0) / 1e6).toFixed(2),
                expired = a.expired ? ' [EXPIRED]' : '';
              return `${i + 1}. ${a.name}${expired}  ${size} MB${a.expires_at ? `  expires: ${formatDate(a.expires_at)}` : ''}`;
            }),
          ].join('\n')
        : `No artifacts found for pipeline #${run_id} in ${owner}/${repo}.`;
    }
    case 'gitlab_check_if_starred': {
      const { owner: owner, repo: repo } = params;
      return (
        requireRepo(owner, repo),
        `${owner}/${repo} is ${(await GitlabAPI.checkIfStarred(credentials, owner, repo)) ? '⭐ starred' : 'not starred'} by you.`
      );
    }
    case 'gitlab_follow_user': {
      const { username: username } = params;
      if (!username) throw new Error('Missing required param: username');
      return (
        await GitlabAPI.followUser(credentials, username),
        `You are now following @${username}.`
      );
    }
    case 'gitlab_unfollow_user': {
      const { username: username } = params;
      if (!username) throw new Error('Missing required param: username');
      return (
        await GitlabAPI.unfollowUser(credentials, username),
        `You have unfollowed @${username}.`
      );
    }
    case 'gitlab_get_issue_events': {
      const { owner: owner, repo: repo, issue_number: issue_number, count: count = 30 } = params;
      if (!owner || !repo || !issue_number)
        throw new Error('Missing required params: owner, repo, issue_number');
      const events = await GitlabAPI.getIssueEvents(
        credentials,
        owner,
        repo,
        Number(issue_number),
        Math.min(Number(count) || 30, 100),
      );
      return events.length
        ? [
            `Events for ${owner}/${repo}#${issue_number} (${events.length}):`,
            '',
            ...events.map((e, i) => {
              const actor = e.actor?.login ?? 'unknown',
                date = formatDate(e.created_at);
              return `${i + 1}. [${e.event}] @${actor} — ${date}`;
            }),
          ].join('\n')
        : `No events found for ${owner}/${repo}#${issue_number}.`;
    }
    case 'gitlab_update_gist': {
      const { gist_id: gist_id, description: description, files: files } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const parsedFiles = 'string' == typeof files ? JSON.parse(files) : files,
        gist = await GitlabAPI.updateGist(credentials, gist_id, {
          description: description,
          files: parsedFiles,
        });
      return [
        `Snippet updated: ${gist.description || gist_id}`,
        `Files: ${Object.keys(gist.files ?? {}).join(', ')}`,
        `Updated: ${formatDate(gist.updated_at)}`,
        `URL: ${gist.html_url}`,
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_delete_gist': {
      const { gist_id: gist_id } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      return (
        await GitlabAPI.deleteGist(credentials, gist_id),
        `Snippet ${gist_id} has been deleted.`
      );
    }
    case 'gitlab_transfer_issue': {
      const { owner: owner, repo: repo, issue_number: issue_number, new_owner: new_owner } = params;
      if (!(owner && repo && issue_number && new_owner))
        throw new Error('Missing required params: owner, repo, issue_number, new_owner');
      return (
        await GitlabAPI.transferIssue(credentials, owner, repo, Number(issue_number), new_owner),
        `Issue #${issue_number} transfer initiated from ${owner}/${repo} to ${new_owner}.`
      );
    }
    case 'gitlab_replace_topics': {
      const { owner: owner, repo: repo, topics: topics } = params;
      requireRepo(owner, repo);
      const names =
        'string' == typeof topics
          ? topics
              .split(',')
              .map((t) => t.trim())
              .filter(Boolean)
          : (topics ?? []);
      return [
        `Topics updated for ${owner}/${repo}`,
        `Topics: ${((await GitlabAPI.replaceTopics(credentials, owner, repo, names)).names ?? []).join(', ') || '(none)'}`,
      ].join('\n');
    }
    case 'gitlab_get_authenticated_user': {
      const user = await GitlabAPI.getAuthenticatedUser(credentials);
      return [
        `Authenticated GitLab User: @${user.login}`,
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
    case 'gitlab_update_comment': {
      const { owner: owner, repo: repo, comment_id: comment_id, body: body } = params;
      if (!(owner && repo && comment_id && body))
        throw new Error('Missing required params: owner, repo, comment_id, body');
      const comment = await GitlabAPI.updateIssueComment(
        credentials,
        owner,
        repo,
        comment_id,
        body,
      );
      return [
        `Comment #${comment_id} updated in ${owner}/${repo}`,
        `URL: ${comment?.html_url ?? `https://gitlab.com/${owner}/${repo}`}`,
      ].join('\n');
    }
    case 'gitlab_delete_comment': {
      const { owner: owner, repo: repo, comment_id: comment_id } = params;
      if (!owner || !repo || !comment_id)
        throw new Error('Missing required params: owner, repo, comment_id');
      return (
        await GitlabAPI.deleteIssueComment(credentials, owner, repo, comment_id),
        `Comment #${comment_id} deleted from ${owner}/${repo}.`
      );
    }
    case 'gitlab_add_reaction_to_issue': {
      const { owner: owner, repo: repo, issue_number: issue_number, content: content } = params;
      if (!(owner && repo && issue_number && content))
        throw new Error('Missing required params: owner, repo, issue_number, content');
      const validReactions = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
      if (!validReactions.includes(content))
        throw new Error(`content must be one of: ${validReactions.join(', ')}`);
      const reaction = await GitlabAPI.addReactionToIssue(
        credentials,
        owner,
        repo,
        Number(issue_number),
        content,
      );
      return `Reaction ${{ '+1': '👍', '-1': '👎', laugh: '😄', hooray: '🎉', confused: '😕', heart: '❤️', rocket: '🚀', eyes: '👀' }[content] ?? content} added to ${owner}/${repo}#${issue_number} (reaction ID: ${reaction.id}).`;
    }
    case 'gitlab_add_reaction_to_comment': {
      const { owner: owner, repo: repo, comment_id: comment_id, content: content } = params;
      if (!(owner && repo && comment_id && content))
        throw new Error('Missing required params: owner, repo, comment_id, content');
      const validReactions = ['+1', '-1', 'laugh', 'hooray', 'confused', 'heart', 'rocket', 'eyes'];
      if (!validReactions.includes(content))
        throw new Error(`content must be one of: ${validReactions.join(', ')}`);
      const reaction = await GitlabAPI.addReactionToComment(
        credentials,
        owner,
        repo,
        comment_id,
        content,
      );
      return `Reaction ${{ '+1': '👍', '-1': '👎', laugh: '😄', hooray: '🎉', confused: '😕', heart: '❤️', rocket: '🚀', eyes: '👀' }[content] ?? content} added to comment #${comment_id} in ${owner}/${repo} (reaction ID: ${reaction.id}).`;
    }
    case 'gitlab_get_code_scanning_alerts': {
      const { owner: owner, repo: repo, state: state = 'open' } = params;
      requireRepo(owner, repo);
      const alerts = await GitlabAPI.getCodeScanningAlerts(credentials, owner, repo, state);
      return alerts.length
        ? [
            `SAST alerts for ${owner}/${repo} (${alerts.length} ${state}):`,
            '',
            ...alerts.slice(0, 20).map((a, i) => {
              const severity = a.severity ?? 'unknown',
                name = a.name ?? a.rule?.id ?? 'unknown',
                desc = a.description ?? a.rule?.description ?? '';
              return `${i + 1}. [${String(severity).toUpperCase()}] ${name}\n   ${desc}`;
            }),
          ].join('\n')
        : `No ${state} SAST alerts in ${owner}/${repo}.`;
    }
    case 'gitlab_get_secret_scanning_alerts': {
      const { owner: owner, repo: repo, state: state = 'open' } = params;
      requireRepo(owner, repo);
      const alerts = await GitlabAPI.getSecretScanningAlerts(credentials, owner, repo, state);
      return alerts.length
        ? [
            `Secret scanning alerts for ${owner}/${repo} (${alerts.length} ${state}):`,
            '',
            ...alerts.slice(0, 20).map((a, i) => {
              const type = a.secret_type_display_name ?? a.secret_type ?? a.name ?? 'unknown',
                validity = a.validity ?? 'unknown';
              return `${i + 1}. [${a.state ?? state}] ${type}\n   Validity: ${validity} | Created: ${formatDate(a.created_at)}`;
            }),
          ].join('\n')
        : `No ${state} secret scanning alerts in ${owner}/${repo}.`;
    }
    case 'gitlab_delete_workflow_run': {
      const { owner: owner, repo: repo, run_id: run_id } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      return (
        await GitlabAPI.deleteWorkflowRun(credentials, owner, repo, run_id),
        `Pipeline #${run_id} deleted from ${owner}/${repo}.`
      );
    }
    case 'gitlab_get_workflow_run_jobs': {
      const { owner: owner, repo: repo, run_id: run_id, filter: filter = 'latest' } = params;
      if (!owner || !repo || !run_id)
        throw new Error('Missing required params: owner, repo, run_id');
      const jobs =
        (await GitlabAPI.getWorkflowRunJobs(credentials, owner, repo, run_id, filter)).jobs ?? [];
      return jobs.length
        ? [
            `Jobs for pipeline #${run_id} in ${owner}/${repo} (${jobs.length}):`,
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
          ].join('\n')
        : `No jobs found for pipeline #${run_id} in ${owner}/${repo}.`;
    }
    case 'gitlab_check_team_membership': {
      const { org: org, team_slug: team_slug, username: username } = params;
      if (!org || !team_slug || !username)
        throw new Error('Missing required params: org, team_slug, username');
      const result = await GitlabAPI.checkTeamMembership(credentials, org, team_slug, username);
      return [
        `Team membership for @${username} in ${org}/${team_slug}:`,
        `Role: ${result.role ?? 'unknown'}`,
        `State: ${result.state ?? 'unknown'}`,
      ].join('\n');
    }
    case 'gitlab_list_gist_comments': {
      const { gist_id: gist_id, count: count = 30 } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const comments = await GitlabAPI.listGistComments(
        credentials,
        gist_id,
        Math.min(Number(count) || 30, 100),
      );
      return comments.length
        ? [
            `Comments on snippet ${gist_id} (${comments.length}):`,
            '',
            ...comments.map((c, i) => {
              const body = String(c.body || '')
                .trim()
                .slice(0, 300);
              return `${i + 1}. @${c.user?.login ?? 'unknown'} — ${formatDate(c.created_at)}\n   ${body}${(c.body?.length ?? 0) > 300 ? '...' : ''}`;
            }),
          ].join('\n')
        : `No comments on snippet ${gist_id}.`;
    }
    case 'gitlab_create_gist_comment': {
      const { gist_id: gist_id, body: body } = params;
      if (!gist_id || !body) throw new Error('Missing required params: gist_id, body');
      const comment = await GitlabAPI.createGistComment(credentials, gist_id, body);
      return [
        `Comment posted on snippet ${gist_id}`,
        `Comment ID: ${comment.id}`,
        `URL: ${comment.url ?? `https://gitlab.com/-/snippets/${gist_id}`}`,
      ].join('\n');
    }
    case 'gitlab_get_repo_actions_permissions': {
      const { owner: owner, repo: repo } = params;
      requireRepo(owner, repo);
      const data = await GitlabAPI.getRepoActionsPermissions(credentials, owner, repo);
      return [
        `CI/CD permissions for ${owner}/${repo}:`,
        `Enabled: ${data.enabled ?? !1}`,
        `Allowed actions: ${data.allowed_actions ?? 'unknown'}`,
        data.selected_actions_url ? `Selected actions URL: ${data.selected_actions_url}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    }
    case 'gitlab_get_org_webhooks': {
      const { org: org } = params;
      if (!org) throw new Error('Missing required param: org');
      const hooks = await GitlabAPI.getOrgWebhooks(credentials, org);
      return hooks.length
        ? [
            `Webhooks for group ${org} (${hooks.length}):`,
            '',
            ...hooks.map((h, i) => {
              const events = (h.events ?? []).join(', ') || 'none',
                active = h.active ? 'active' : 'inactive';
              return `${i + 1}. ${h.config?.url ?? 'no url'} [${active}]\n   Events: ${events}${h.created_at ? `\n   Created: ${formatDate(h.created_at)}` : ''}`;
            }),
          ].join('\n')
        : `No webhooks configured for group "${org}".`;
    }
    case 'gitlab_list_user_repo_invitations': {
      const invitations = await GitlabAPI.listUserRepoInvitations(credentials);
      return invitations.length
        ? [
            `Pending repository invitations (${invitations.length}):`,
            '',
            ...invitations.map(
              (inv, i) =>
                `${i + 1}. ${inv.repository?.full_name ?? inv.source?.full_name ?? 'unknown'} — from @${inv.inviter?.login ?? 'unknown'} on ${formatDate(inv.created_at)}\n   ID: ${inv.id}`,
            ),
          ].join('\n')
        : 'No pending repository invitations.';
    }
    case 'gitlab_accept_repo_invitation': {
      const { invitation_id: invitation_id } = params;
      if (!invitation_id) throw new Error('Missing required param: invitation_id');
      return (
        await GitlabAPI.acceptRepoInvitation(credentials, invitation_id),
        `Repository invitation #${invitation_id} accepted.`
      );
    }
    case 'gitlab_decline_repo_invitation': {
      const { invitation_id: invitation_id } = params;
      if (!invitation_id) throw new Error('Missing required param: invitation_id');
      return (
        await GitlabAPI.declineRepoInvitation(credentials, invitation_id),
        `Repository invitation #${invitation_id} declined.`
      );
    }
    case 'gitlab_get_user_public_keys': {
      const { username: username } = params;
      if (!username) throw new Error('Missing required param: username');
      const keys = await GitlabAPI.getUserPublicKeys(credentials, username);
      return keys.length
        ? [
            `Public SSH keys for @${username} (${keys.length}):`,
            '',
            ...keys.map((k, i) => `${i + 1}. ID: ${k.id}\n   ${String(k.key).slice(0, 60)}...`),
          ].join('\n')
        : `@${username} has no public SSH keys.`;
    }
    case 'gitlab_star_gist': {
      const { gist_id: gist_id, action: action = 'star' } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      const shouldUnstar = 'unstar' === String(action).toLowerCase();
      return (
        shouldUnstar
          ? await GitlabAPI.unstarGist(credentials, gist_id)
          : await GitlabAPI.starGist(credentials, gist_id),
        `Snippet ${gist_id} ${shouldUnstar ? 'unstarred' : 'starred'} successfully.`
      );
    }
    case 'gitlab_check_gist_starred': {
      const { gist_id: gist_id } = params;
      if (!gist_id) throw new Error('Missing required param: gist_id');
      return `Snippet ${gist_id} is ${(await GitlabAPI.checkGistStarred(credentials, gist_id)) ? '⭐ starred' : 'not starred'} by you.`;
    }
    default:
      throw new Error(`Unknown GitLab tool: ${toolName}`);
  }
}
export default executeGitlabChatTool;
