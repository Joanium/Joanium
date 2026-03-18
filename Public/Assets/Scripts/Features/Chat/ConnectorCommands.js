// ─────────────────────────────────────────────
//  openworld — Public/Assets/Scripts/Features/Chat/ConnectorCommands.js
//  Intercepts natural-language commands that target Gmail or GitHub
//  before they reach the AI provider, handling them directly via IPC.
//
//  Returns true if the command was handled, false if the AI should respond.
// ─────────────────────────────────────────────

import { render as renderMarkdown } from '../../Shared/Markdown.js';

/**
 * Replace the last assistant message bubble content with rendered markdown.
 * Falls back to appending a new message if none exists.
 *
 * @param {HTMLElement} chatMessages
 * @param {function}    appendMessage
 * @param {string}      markdown
 */
function replaceLastAssistant(chatMessages, appendMessage, markdown) {
  const rows = chatMessages.querySelectorAll('.message-row.assistant');
  const last = rows[rows.length - 1];
  if (last) {
    const content = last.querySelector('.content');
    if (content) content.innerHTML = renderMarkdown(markdown);
  } else {
    appendMessage('assistant', markdown, false, true);
  }
}

/**
 * Try to handle the user's message as a connector command.
 *
 * @param {string}      text           – raw user message
 * @param {object}      deps
 * @param {HTMLElement} deps.chatMessages
 * @param {function}    deps.appendMessage
 * @param {function}    deps.callAIWithContext
 * @param {object[]}    deps.messages         – current conversation state (for context)
 * @returns {Promise<boolean>}  true = handled, false = let AI respond
 */
export async function tryConnectorCommand(text, { chatMessages, appendMessage, callAIWithContext, messages }) {
  const lower = text.toLowerCase().trim();

  function replace(md) { replaceLastAssistant(chatMessages, appendMessage, md); }

  /* ────────────────────────────────────────────────────────
     GMAIL
  ──────────────────────────────────────────────────────── */

  // Read unread / inbox brief
  if (/unread email|email brief|check.*inbox|read.*email/i.test(lower)) {
    appendMessage('assistant', '📬 Fetching your unread emails…', false, true);
    try {
      const res = await window.electronAPI?.gmailGetBrief?.(15);
      if (!res?.ok) throw new Error(res?.error ?? 'Gmail not connected');

      messages.push({ role: 'user', content: text, attachments: [] });

      const prompt = res.count === 0
        ? 'The user checked their inbox. Tell them it is clear — no unread emails.'
        : `The user asked to read their unread emails. Here are the raw results:\n\n${res.text}\n\nWrite a concise, friendly summary. Highlight anything urgent. Keep it scannable.`;

      await callAIWithContext(prompt);
    } catch (err) {
      replace(`❌ Gmail error: ${err.message}\n\nMake sure Gmail is connected in **Settings → Connectors**.`);
    }
    return true;
  }

  // Search inbox
  const searchMatch = lower.match(/search (?:emails?|inbox|mail)\s+(.+)/);
  if (searchMatch) {
    const query = searchMatch[1];
    appendMessage('assistant', `🔍 Searching Gmail for "${query}"…`, false, true);
    try {
      const res = await window.electronAPI?.gmailSearch?.(query, 10);
      if (!res?.ok) throw new Error(res?.error ?? 'Gmail error');
      const lines = res.emails.length === 0
        ? 'No emails found matching that query.'
        : res.emails.map((e, i) =>
            `${i + 1}. **${e.subject}** — from ${e.from}\n   ${e.snippet}`
          ).join('\n\n');
      replace(lines);
    } catch (err) { replace(`❌ ${err.message}`); }
    return true;
  }

  // Send email
  const sendMatch = lower.match(/send (?:an )?email to ([^\s,]+)(?: saying (.+))?/i);
  if (sendMatch) {
    const to      = sendMatch[1];
    const body    = sendMatch[2] || 'Hello from openworld';
    appendMessage('assistant', `📤 Sending email to ${to}…`, false, true);
    try {
      const res = await window.electronAPI?.gmailSend?.(to, 'Message from openworld', body);
      if (!res?.ok) throw new Error(res?.error);
      replace(`✅ Email sent to **${to}**`);
    } catch (err) { replace(`❌ Failed to send email: ${err.message}`); }
    return true;
  }

  /* ────────────────────────────────────────────────────────
     GITHUB
  ──────────────────────────────────────────────────────── */

  // List repos
  if (/list.*repos?|show.*repos?|my github repos?/i.test(lower)) {
    appendMessage('assistant', '🐙 Fetching your GitHub repositories…', false, true);
    try {
      const res = await window.electronAPI?.githubGetRepos?.();
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub not connected');
      const lines = res.repos.slice(0, 20)
        .map((r, i) =>
          `${i + 1}. **${r.full_name}** — ${r.description || 'No description'} _(${r.language || 'unknown'}, ⭐ ${r.stargazers_count})_`
        ).join('\n');
      replace(`You have ${res.repos.length} repos (showing top 20):\n\n${lines}`);
    } catch (err) {
      replace(`❌ ${err.message}\n\nMake sure GitHub is connected in **Settings → Connectors**.`);
    }
    return true;
  }

  // Load file
  const loadFileMatch = text.match(/load (?:file\s+)?(.+?)\s+from\s+([\w.-]+)\/([\w.-]+)/i);
  if (loadFileMatch) {
    const [, filePath, owner, repo] = loadFileMatch;
    appendMessage('assistant', `📂 Loading \`${filePath}\` from **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetFile?.(owner, repo, filePath.trim());
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const ext     = filePath.split('.').pop() || '';
      const preview = res.content.length > 4000
        ? res.content.slice(0, 4000) + '\n\n…(truncated)'
        : res.content;
      replace(`Here is \`${res.path}\` from **${owner}/${repo}**:\n\n\`\`\`${ext}\n${preview}\n\`\`\``);
      messages.push({
        role:        'assistant',
        content:     `File \`${res.path}\` loaded from GitHub (${res.size} bytes).`,
        attachments: [],
      });
    } catch (err) { replace(`❌ ${err.message}`); }
    return true;
  }

  // File tree
  const treeMatch = text.match(/(?:file\s+)?tree\s+(?:of\s+)?([\w.-]+)\/([\w.-]+)/i);
  if (treeMatch) {
    const [, owner, repo] = treeMatch;
    appendMessage('assistant', `🌲 Fetching file tree of **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetTree?.(owner, repo);
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const files = res.tree.filter(f => f.type === 'blob').slice(0, 80).map(f => f.path).join('\n');
      replace(`File tree for **${owner}/${repo}** (${res.tree.filter(f => f.type === 'blob').length} files):\n\n\`\`\`\n${files}\n\`\`\``);
    } catch (err) { replace(`❌ ${err.message}`); }
    return true;
  }

  // Issues
  const issueMatch = text.match(/(?:check|show|list)\s+issues?\s+(?:for\s+|in\s+)?([\w.-]+)\/([\w.-]+)/i);
  if (issueMatch) {
    const [, owner, repo] = issueMatch;
    appendMessage('assistant', `🐛 Fetching issues from **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetIssues?.(owner, repo);
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const lines = res.issues.length === 0
        ? 'No open issues.'
        : res.issues.map((i, n) => `${n + 1}. **#${i.number} ${i.title}** — ${i.user?.login ?? ''}`).join('\n');
      replace(`**${owner}/${repo}** has ${res.issues.length} open issue${res.issues.length !== 1 ? 's' : ''}:\n\n${lines}`);
    } catch (err) { replace(`❌ ${err.message}`); }
    return true;
  }

  // Pull requests
  const prMatch = text.match(/(?:check|show|list)\s+(?:pr|pull request)s?\s+(?:for\s+|in\s+)?([\w.-]+)\/([\w.-]+)/i);
  if (prMatch) {
    const [, owner, repo] = prMatch;
    appendMessage('assistant', `🔀 Fetching pull requests from **${owner}/${repo}**…`, false, true);
    try {
      const res = await window.electronAPI?.githubGetPRs?.(owner, repo);
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const lines = res.prs.length === 0
        ? 'No open pull requests.'
        : res.prs.map((p, n) => `${n + 1}. **#${p.number} ${p.title}** by ${p.user?.login ?? ''}`).join('\n');
      replace(`**${owner}/${repo}** has ${res.prs.length} open PR${res.prs.length !== 1 ? 's' : ''}:\n\n${lines}`);
    } catch (err) { replace(`❌ ${err.message}`); }
    return true;
  }

  // Notifications
  if (/github\s+notification|my\s+notification/i.test(lower)) {
    appendMessage('assistant', '🔔 Fetching GitHub notifications…', false, true);
    try {
      const res = await window.electronAPI?.githubGetNotifications?.();
      if (!res?.ok) throw new Error(res?.error ?? 'GitHub error');
      const n = res.notifications ?? [];
      const lines = n.length === 0
        ? 'No unread notifications.'
        : n.slice(0, 10).map((n2, i) => `${i + 1}. **${n2.subject?.title}** — ${n2.repository?.full_name}`).join('\n');
      replace(`GitHub — ${n.length} unread notification${n.length !== 1 ? 's' : ''}:\n\n${lines}`);
    } catch (err) { replace(`❌ ${err.message}`); }
    return true;
  }

  return false; // not a connector command — let the AI handle it
}
