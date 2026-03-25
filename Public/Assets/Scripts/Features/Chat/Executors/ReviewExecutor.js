const HANDLED = new Set([
  'github_get_pr_diff',
  'github_review_pr',
  'github_get_pr_details',
  'github_get_pr_checks',
  'github_get_pr_comments',
  'github_get_workflow_runs',
]);
const MAX_DIFF_CHARS = 28_000; // keep diffs within context window budget

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => { }) {
  switch (toolName) {

    case 'github_get_pr_diff': {
      const { owner, repo, pr_number } = params;
      if (!owner || !repo || !pr_number) throw new Error('Missing required params: owner, repo, pr_number');

      onStage(`[GITHUB] Fetching diff for ${owner}/${repo}#${pr_number}…`);

      const result = await window.electronAPI?.githubGetPRDiff?.(owner, repo, Number(pr_number));
      if (!result?.ok) throw new Error(result?.error ?? 'GitHub not connected');

      const diff = result.diff ?? '';

      if (!diff.trim()) {
        return `PR #${pr_number} in ${owner}/${repo} has no diff (empty or binary-only changes).`;
      }

      // Truncate very large diffs to keep them usable
      const truncated = diff.length > MAX_DIFF_CHARS
        ? diff.slice(0, MAX_DIFF_CHARS) + `\n\n…(diff truncated — showing first ${MAX_DIFF_CHARS} chars of ${diff.length} total)`
        : diff;

      return [
        `Diff for ${owner}/${repo} PR #${pr_number}:`,
        '',
        '```diff',
        truncated,
        '```',
      ].join('\n');
    }

    case 'github_review_pr': {
      const { owner, repo, pr_number, body, verdict, inline_comments } = params;
      if (!owner || !repo || !pr_number) throw new Error('Missing required params: owner, repo, pr_number');
      if (!body?.trim()) throw new Error('Missing required param: body (review summary)');

      const event = (['APPROVE', 'REQUEST_CHANGES', 'COMMENT'].includes(verdict?.toUpperCase()))
        ? verdict.toUpperCase()
        : 'COMMENT';

      // Parse inline comments if provided as JSON string
      let comments = [];
      if (inline_comments) {
        try {
          comments = typeof inline_comments === 'string'
            ? JSON.parse(inline_comments)
            : inline_comments;
          if (!Array.isArray(comments)) comments = [];
        } catch {
          comments = [];
        }
      }

      onStage(`[GITHUB] Posting ${event} review on PR #${pr_number}…`);

      const result = await window.electronAPI?.githubCreatePRReview?.(
        owner, repo, Number(pr_number),
        { body, event, comments },
      );

      if (!result?.ok) throw new Error(result?.error ?? 'GitHub review failed');

      const verdictEmoji = { APPROVE: '✅', REQUEST_CHANGES: '🔴', COMMENT: '💬' }[event] ?? '💬';

      return [
        `${verdictEmoji} Review posted on ${owner}/${repo} PR #${pr_number}`,
        `Verdict: **${event}**`,
        `Review ID: ${result.id ?? '—'}`,
        inline_comments?.length
          ? `Inline comments: ${Array.isArray(comments) ? comments.length : 0}`
          : '',
        `View: ${result.html_url ?? `https://github.com/${owner}/${repo}/pull/${pr_number}`}`,
      ].filter(Boolean).join('\n');
    }

    case 'github_get_pr_details': {
      const { owner, repo, pr_number } = params;
      if (!owner || !repo || !pr_number) throw new Error('Missing required params: owner, repo, pr_number');

      onStage(`[GITHUB] Loading PR #${pr_number} details…`);

      const result = await window.electronAPI?.githubGetPRDetails?.(owner, repo, Number(pr_number));
      if (!result?.ok) throw new Error(result?.error ?? 'GitHub error');

      const pr = result.pr;
      return [
        `**PR #${pr.number}: ${pr.title}**`,
        `Author: @${pr.user?.login}`,
        `Branch: \`${pr.head?.ref}\` → \`${pr.base?.ref}\``,
        `State: ${pr.state} | Mergeable: ${pr.mergeable ?? 'unknown'}`,
        `Commits: ${pr.commits} | Changed files: ${pr.changed_files}`,
        `+${pr.additions} −${pr.deletions}`,
        '',
        pr.body ? `**Description:**\n${pr.body.slice(0, 1000)}${pr.body.length > 1000 ? '…' : ''}` : '*(no description)*',
        '',
        `URL: ${pr.html_url}`,
      ].join('\n');
    }

    case 'github_get_pr_checks': {
      const { owner, repo, pr_number } = params;
      if (!owner || !repo || !pr_number) throw new Error('Missing required params: owner, repo, pr_number');

      onStage(`[GITHUB] Loading checks for PR #${pr_number}…`);

      const result = await window.electronAPI?.githubGetPRChecks?.(owner, repo, Number(pr_number));
      if (!result?.ok) throw new Error(result?.error ?? 'GitHub error');

      const checks = result.checks ?? {};
      const checkRuns = checks.checkRuns ?? [];
      const statuses = checks.statuses ?? [];

      const lines = [
        `Checks for ${owner}/${repo} PR #${pr_number}`,
        `Head SHA: \`${checks.sha ?? 'unknown'}\``,
        `Combined status: **${checks.state ?? 'unknown'}**`,
        '',
      ];

      if (checkRuns.length) {
        lines.push('Check runs:');
        lines.push(...checkRuns.slice(0, 15).map(run =>
          `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''}`,
        ));
        lines.push('');
      }

      if (statuses.length) {
        lines.push('Commit statuses:');
        lines.push(...statuses.slice(0, 15).map(status =>
          `- ${status.context || 'status'}: ${status.state}${status.description ? ` — ${status.description}` : ''}`,
        ));
      }

      if (!checkRuns.length && !statuses.length) {
        lines.push('No CI checks or commit statuses were returned.');
      }

      return lines.join('\n');
    }

    case 'github_get_pr_comments': {
      const { owner, repo, pr_number } = params;
      if (!owner || !repo || !pr_number) throw new Error('Missing required params: owner, repo, pr_number');

      onStage(`[GITHUB] Loading review comments for PR #${pr_number}…`);

      const result = await window.electronAPI?.githubGetPRComments?.(owner, repo, Number(pr_number));
      if (!result?.ok) throw new Error(result?.error ?? 'GitHub error');

      const comments = result.comments ?? [];
      if (!comments.length) return `No inline review comments found for ${owner}/${repo} PR #${pr_number}.`;

      return [
        `Inline review comments for ${owner}/${repo} PR #${pr_number}:`,
        '',
        ...comments.slice(0, 25).map((comment, index) => [
          `${index + 1}. ${comment.path}:${comment.line ?? comment.original_line ?? '?'}`,
          `   ${comment.user?.login ? `@${comment.user.login}` : 'Reviewer'}: ${String(comment.body ?? '').replace(/\s+/g, ' ').trim()}`,
        ].join('\n')),
      ].join('\n');
    }

    case 'github_get_workflow_runs': {
      const { owner, repo, branch = '', event = '', per_page = 20 } = params;
      if (!owner || !repo) throw new Error('Missing required params: owner, repo');

      onStage(`[GITHUB] Loading workflow runs for ${owner}/${repo}…`);

      const result = await window.electronAPI?.githubGetWorkflowRuns?.(
        owner,
        repo,
        branch,
        event,
        Number(per_page) || 20,
      );
      if (!result?.ok) throw new Error(result?.error ?? 'GitHub error');

      const runs = result.runs ?? [];
      if (!runs.length) {
        const filters = [branch ? `branch=${branch}` : '', event ? `event=${event}` : '']
          .filter(Boolean)
          .join(', ');
        return `No workflow runs found for ${owner}/${repo}${filters ? ` (${filters})` : ''}.`;
      }

      return [
        `Workflow runs for ${owner}/${repo} (${result.total_count ?? runs.length} total):`,
        '',
        ...runs.slice(0, 20).map(run =>
          `- ${run.name}: ${run.status}${run.conclusion ? ` / ${run.conclusion}` : ''} [${run.event}] (${run.head_branch || 'unknown branch'})`,
        ),
      ].join('\n');
    }

    default:
      throw new Error(`ReviewExecutor: unknown tool "${toolName}"`);
  }
}
