import { state } from '../../../Shared/Core/State.js';
import { fetchWithTools } from '../../AI/index.js';

const MEMORY_LEARN_INTERVAL = 5;
export let _userMessagesSinceLastLearn = 0;

export function resetMemoryCounter() {
  _userMessagesSinceLastLearn = 0;
}

export function showMemoryIndicator() {
  const existing = document.getElementById('memory-learn-indicator');
  if (existing) return () => { };

  const el = document.createElement('div');
  el.id = 'memory-learn-indicator';
  el.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
         style="width:12px;height:12px;animation:spin 1.2s linear infinite;flex-shrink:0">
      <path d="M21 12a9 9 0 11-6.219-8.56" stroke-linecap="round"/>
    </svg>
    Learning…
  `;
  el.style.cssText = `
    position:fixed; top:48px; left:calc(var(--sidebar-w, 52px) + 14px); transform:none;
    display:flex; align-items:center; gap:6px;
    background:var(--bg-tertiary); border:1px solid var(--border-subtle);
    border-radius:999px; padding:4px 12px;
    font-size:11px; font-family:var(--font-ui); color:var(--text-muted);
    z-index:50; animation:fadeIn 0.2s ease both;
    pointer-events:none;
  `;

  if (!document.getElementById('mem-spin-style')) {
    const style = document.createElement('style');
    style.id = 'mem-spin-style';
    style.textContent = '@keyframes spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  document.body.appendChild(el);
  return () => {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
  };
}

export async function attemptMemoryUpdate() {
  _userMessagesSinceLastLearn++;
  if (_userMessagesSinceLastLearn < MEMORY_LEARN_INTERVAL) return;
  _userMessagesSinceLastLearn = 0;

  if (!state.selectedProvider || !state.selectedModel) return;

  const userMessages = state.messages.filter(m => m.role === 'user');
  if (userMessages.length < 4) return;

  const hideIndicator = showMemoryIndicator();

  try {
    const existingMemory = (await window.electronAPI?.getMemory?.()) ?? '';

    const recentMessages = state.messages.slice(-20);
    const conversationText = recentMessages
      .map(m => `${m.role === 'user' ? 'User' : 'AI'}: ${m.content.slice(0, 400)}`)
      .join('\n');

    const extractPrompt = [
      'You are a memory extraction assistant. Read this conversation and extract NEW long-term facts about the USER.',
      '',
      'Rules:',
      '- Only extract facts about the USER (not the AI), such as: preferences, projects, goals, tools they use,',
      '  personal context, recurring topics, communication style, domain expertise, etc.',
      '- Do NOT include anything already captured in the existing memory below.',
      '- Do NOT include one-off questions or temporary context.',
      '- If there is nothing new and genuinely useful to remember, respond with exactly: [NOTHING]',
      '- Otherwise respond ONLY with concise bullet points (max 5), each starting with "- ".',
      '- Keep each bullet under 20 words. Be specific, not generic.',
      '',
      `Existing memory:\n${existingMemory.trim() || '(empty)'}`,
      '',
      `Recent conversation:\n${conversationText}`,
    ].join('\n');

    const result = await fetchWithTools(
      state.selectedProvider,
      state.selectedModel,
      [{ role: 'user', content: extractPrompt, attachments: [] }],
      'You are a concise memory extraction assistant. Output only what is asked — bullet points or [NOTHING].',
      [],
    );

    if (result.type !== 'text') return;
    const text = result.text?.trim() ?? '';
    if (!text || text === '[NOTHING]' || text.toUpperCase().includes('[NOTHING]')) return;

    const bullets = text.split('\n').filter(l => l.trim().startsWith('- ')).join('\n');
    if (!bullets) return;

    const timestamp = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const updated = (existingMemory.trim() ? existingMemory.trim() + '\n\n' : '') +
      `--- Auto-learned ${timestamp} ---\n${bullets}`;

    await window.electronAPI?.saveMemory?.(updated);

  } catch (err) {
    console.warn('[Chat] Memory update failed (non-fatal):', err.message);
  } finally {
    hideIndicator();
  }
}
