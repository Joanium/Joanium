const HANDLED = new Set([
    'github_list_repos', 'github_get_issues', 'github_get_pull_requests',
    'github_get_file', 'github_get_file_tree', 'github_get_notifications',
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

        default:
            throw new Error(`GithubExecutor: unknown tool "${toolName}"`);
    }
}