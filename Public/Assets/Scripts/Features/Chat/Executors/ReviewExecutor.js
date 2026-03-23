// openworld — Features/Chat/Executors/ReviewExecutor.js
// Handles PR diff fetching and posting AI-generated code reviews.

const HANDLED = new Set(['github_get_pr_diff', 'github_review_pr', 'github_get_pr_details']);
const MAX_DIFF_CHARS = 28_000; // keep diffs within context window budget

export function handles(toolName) { return HANDLED.has(toolName); }

export async function execute(toolName, params, onStage = () => {}) {
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

    default:
      throw new Error(`ReviewExecutor: unknown tool "${toolName}"`);
  }
}
