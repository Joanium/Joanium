const HANDLED = new Set([
    'github_list_repos', 'github_get_issues', 'github_get_pull_requests',
    'github_get_file', 'github_get_file_tree', 'github_get_notifications',
    'github_get_commits', 'github_create_issue', 'github_close_issue',
    'github_reopen_issue', 'github_comment_on_issue', 'github_list_branches',
    'github_get_releases', 'github_star_repo', 'github_create_gist',
    'github_mark_notifications_read',
]);

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
    switch (toolName) {

        case 'github_list_repos': {
            onStage(`[GITHUB] Connecting to GitHub…`);
            onStage(`[GITHUB] Fetching repositories…`);
            const res = await window.electronAPI?.githubGetRepos?.();
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub not connected');
            const lines = res.repos.slice(0, 20).map(r =>
                `- ${r.full_name}: ${r.description || 'No description'} [${r.language || 'unknown'}] ⭐${r.stargazers_count}`
            ).join('\n');
            return `User has ${res.repos.length} repos (showing top 20):\n\n${lines}`;
        }

        case 'github_get_issues': {
            const { owner, repo } = params;
            if (!owner || !repo) throw new Error('Missing required params: owner, repo');
            onStage(`[GITHUB] Fetching issues from ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubGetIssues?.(owner, repo);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            if (!res.issues?.length) return `No open issues in ${owner}/${repo}.`;
            const lines = res.issues.map(i => `#${i.number}: ${i.title} (by ${i.user?.login})`).join('\n');
            return `${res.issues.length} open issue(s) in ${owner}/${repo}:\n\n${lines}`;
        }

        case 'github_get_pull_requests': {
            const { owner, repo } = params;
            if (!owner || !repo) throw new Error('Missing required params: owner, repo');
            onStage(`[GITHUB] Fetching pull requests from ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubGetPRs?.(owner, repo);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            if (!res.prs?.length) return `No open pull requests in ${owner}/${repo}.`;
            const lines = res.prs.map(p => `#${p.number}: ${p.title} (by ${p.user?.login})`).join('\n');
            return `${res.prs.length} open PR(s) in ${owner}/${repo}:\n\n${lines}`;
        }

        case 'github_get_file': {
            const { owner, repo, filePath } = params;
            if (!owner || !repo || !filePath) throw new Error('Missing required params: owner, repo, filePath');
            onStage(`[GITHUB] Loading ${filePath} from ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubGetFile?.(owner, repo, filePath);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const preview = res.content.length > 4000
                ? res.content.slice(0, 4000) + '\n...(truncated)'
                : res.content;
            return `Contents of ${res.path} from ${owner}/${repo}:\n\`\`\`\n${preview}\n\`\`\``;
        }

        case 'github_get_file_tree': {
            const { owner, repo } = params;
            if (!owner || !repo) throw new Error('Missing required params: owner, repo');
            onStage(`[GITHUB] Reading file tree of ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubGetTree?.(owner, repo);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const blobs = res.tree.filter(f => f.type === 'blob');
            const files = blobs.slice(0, 100).map(f => f.path).join('\n');
            return `File tree of ${owner}/${repo} (${blobs.length} files):\n\n${files}`;
        }

        case 'github_get_notifications': {
            onStage(`[GITHUB] Fetching notifications…`);
            const res = await window.electronAPI?.githubGetNotifications?.();
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const n = res.notifications ?? [];
            if (!n.length) return 'No unread GitHub notifications.';
            const lines = n.slice(0, 10).map((n2, i) =>
                `${i + 1}. ${n2.subject?.title} in ${n2.repository?.full_name}`
            ).join('\n');
            return `${n.length} unread notification(s):\n\n${lines}`;
        }

        case 'github_get_commits': {
            const { owner, repo } = params;
            if (!owner || !repo) throw new Error('Missing required params: owner, repo');
            onStage(`[GITHUB] Fetching commits from ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubGetCommits?.(owner, repo);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const commits = res.commits ?? [];
            if (!commits.length) return `No commits found in ${owner}/${repo}.`;
            const lines = commits.slice(0, 15).map((c, i) => {
                const sha = c.sha?.slice(0, 7) ?? '???????';
                const msg = (c.commit?.message ?? '').split('\n')[0].slice(0, 80);
                const author = c.commit?.author?.name ?? c.author?.login ?? 'unknown';
                const date = c.commit?.author?.date
                    ? new Date(c.commit.author.date).toLocaleDateString()
                    : '';
                return `${i + 1}. \`${sha}\` ${msg}\n   by ${author}${date ? ` on ${date}` : ''}`;
            }).join('\n\n');
            return `Recent commits in ${owner}/${repo}:\n\n${lines}`;
        }

        case 'github_create_issue': {
            const { owner, repo, title, body = '', labels } = params;
            if (!owner || !repo || !title) throw new Error('Missing required params: owner, repo, title');
            onStage(`[GITHUB] Creating issue in ${owner}/${repo}…`);
            const labelArray = labels
                ? labels.split(',').map(l => l.trim()).filter(Boolean)
                : [];
            const res = await window.electronAPI?.githubCreateIssue?.(owner, repo, title, body, labelArray);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const issue = res.issue;
            return [
                `✅ Issue created in ${owner}/${repo}`,
                ``,
                `**#${issue.number}: ${issue.title}**`,
                `URL: ${issue.html_url}`,
                labelArray.length ? `Labels: ${labelArray.join(', ')}` : '',
            ].filter(Boolean).join('\n');
        }

        case 'github_close_issue': {
            const { owner, repo, issue_number } = params;
            if (!owner || !repo || !issue_number) throw new Error('Missing required params: owner, repo, issue_number');
            onStage(`[GITHUB] Closing issue #${issue_number} in ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubCloseIssue?.(owner, repo, Number(issue_number));
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const issue = res.issue;
            return [
                `✅ Issue #${issue_number} closed in ${owner}/${repo}`,
                `Title: ${issue.title}`,
                `URL: ${issue.html_url}`,
            ].join('\n');
        }

        case 'github_reopen_issue': {
            const { owner, repo, issue_number } = params;
            if (!owner || !repo || !issue_number) throw new Error('Missing required params: owner, repo, issue_number');
            onStage(`[GITHUB] Reopening issue #${issue_number} in ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubReopenIssue?.(owner, repo, Number(issue_number));
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const issue = res.issue;
            return [
                `✅ Issue #${issue_number} reopened in ${owner}/${repo}`,
                `Title: ${issue.title}`,
                `URL: ${issue.html_url}`,
            ].join('\n');
        }

        case 'github_comment_on_issue': {
            const { owner, repo, issue_number, body } = params;
            if (!owner || !repo || !issue_number || !body) {
                throw new Error('Missing required params: owner, repo, issue_number, body');
            }
            onStage(`[GITHUB] Posting comment on #${issue_number} in ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubCommentIssue?.(owner, repo, Number(issue_number), body);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const comment = res.comment;
            return [
                `✅ Comment posted on ${owner}/${repo}#${issue_number}`,
                `URL: ${comment?.html_url ?? `https://github.com/${owner}/${repo}/issues/${issue_number}`}`,
            ].join('\n');
        }

        case 'github_list_branches': {
            const { owner, repo } = params;
            if (!owner || !repo) throw new Error('Missing required params: owner, repo');
            onStage(`[GITHUB] Fetching branches from ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubGetBranches?.(owner, repo);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const branches = res.branches ?? [];
            if (!branches.length) return `No branches found in ${owner}/${repo}.`;
            const lines = branches.map((b, i) => {
                const sha = b.commit?.sha?.slice(0, 7) ?? '';
                const protection = b.protected ? ' 🔒' : '';
                return `${i + 1}. \`${b.name}\`${sha ? ` (${sha})` : ''}${protection}`;
            }).join('\n');
            return `${branches.length} branch(es) in ${owner}/${repo}:\n\n${lines}`;
        }

        case 'github_get_releases': {
            const { owner, repo, count = 5 } = params;
            if (!owner || !repo) throw new Error('Missing required params: owner, repo');
            const limit = Math.min(Math.max(1, Number(count) || 5), 20);
            onStage(`[GITHUB] Fetching releases from ${owner}/${repo}…`);
            const res = await window.electronAPI?.githubGetReleases?.(owner, repo, limit);
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const releases = res.releases ?? [];
            if (!releases.length) return `No releases found in ${owner}/${repo}.`;
            const lines = releases.map((r, i) => {
                const published = r.published_at
                    ? new Date(r.published_at).toLocaleDateString()
                    : 'unknown date';
                const tag = r.tag_name ?? 'untagged';
                const name = r.name || tag;
                const prerelease = r.prerelease ? ' [pre-release]' : '';
                const notes = (r.body ?? '').split('\n')[0].slice(0, 80);
                return [
                    `${i + 1}. **${name}** (${tag})${prerelease} — ${published}`,
                    notes ? `   ${notes}` : '',
                    `   ${r.html_url}`,
                ].filter(Boolean).join('\n');
            }).join('\n\n');
            return `Releases for ${owner}/${repo}:\n\n${lines}`;
        }

        case 'github_star_repo': {
            const { owner, repo, action = 'star' } = params;
            if (!owner || !repo) throw new Error('Missing required params: owner, repo');
            const isUnstar = String(action).toLowerCase() === 'unstar';
            onStage(`[GITHUB] ${isUnstar ? 'Unstarring' : 'Starring'} ${owner}/${repo}…`);
            let res;
            if (isUnstar) {
                res = await window.electronAPI?.githubUnstarRepo?.(owner, repo);
            } else {
                res = await window.electronAPI?.githubStarRepo?.(owner, repo);
            }
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            return `${isUnstar ? '⭐ Unstarred' : '⭐ Starred'} ${owner}/${repo} successfully.`;
        }

        case 'github_create_gist': {
            const { description = '', filename, content, public: isPublic = false } = params;
            if (!filename || !content) throw new Error('Missing required params: filename, content');
            onStage(`[GITHUB] Creating gist "${filename}"…`);
            const files = { [filename]: { content } };
            const res = await window.electronAPI?.githubCreateGist?.(description, files, Boolean(isPublic));
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            const gist = res.gist;
            return [
                `✅ Gist created`,
                ``,
                `**${filename}**`,
                description ? `Description: ${description}` : '',
                `Visibility: ${isPublic ? 'Public' : 'Secret'}`,
                `URL: ${gist?.html_url ?? 'https://gist.github.com'}`,
            ].filter(Boolean).join('\n');
        }

        case 'github_mark_notifications_read': {
            onStage(`[GITHUB] Marking all notifications as read…`);
            const res = await window.electronAPI?.githubMarkNotifsRead?.();
            if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
            return '✅ All GitHub notifications marked as read.';
        }

        default:
            throw new Error(`GithubExecutor: unknown tool "${toolName}"`);
    }
}