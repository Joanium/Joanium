import { chatMessages } from '../../../Shared/Core/DOM.js';

/* ── Token footer ── */
export function buildTokenFooter(usage, provider, modelId) {
  const inp = usage?.inputTokens ?? 0;
  const out = usage?.outputTokens ?? 0;
  if (!inp && !out) return null;

  const pricing = provider?.models?.[modelId]?.pricing;
  const cost = pricing
    ? (inp / 1_000_000 * (pricing.input ?? 0)) + (out / 1_000_000 * (pricing.output ?? 0))
    : null;

  const fmtN = n => n >= 1_000_000
    ? `${(n / 1_000_000).toFixed(2)}M`
    : n >= 1_000
      ? `${(n / 1_000).toFixed(1)}K`
      : String(n);
  const fmtCost = c => c === 0 ? '$0.000' : c < 0.001 ? '<$0.001' : `~$${c.toFixed(3)}`;

  const el = document.createElement('div');
  el.className = 'token-footer';
  el.innerHTML = `
    <span class="tf-item tf-in">&#8593; ${fmtN(inp)}</span>
    <span class="tf-sep">&#183;</span>
    <span class="tf-item tf-out">&#8595; ${fmtN(out)}</span>
    ${cost !== null
      ? `<span class="tf-sep">&#183;</span><span class="tf-item tf-cost">${fmtCost(cost)}</span>`
      : ''}
  `.trim();
  return el;
}

/* ── Timeline ── */
let _timelineRafId = null;

export function updateTimeline() {
  const timeline = document.getElementById('chat-timeline');
  if (!timeline) return;

  if (_timelineRafId) cancelAnimationFrame(_timelineRafId);
  _timelineRafId = requestAnimationFrame(() => {
    const userRows = Array.from(chatMessages.querySelectorAll('.message-row.user'));

    if (userRows.length < 2) {
      timeline.classList.remove('visible');
      return;
    }

    timeline.classList.add('visible');
    timeline.querySelectorAll('.chat-timeline-tick').forEach(t => t.remove());

    const totalHeight = chatMessages.scrollHeight;
    if (totalHeight === 0) return;

    userRows.forEach((row) => {
      const tick = document.createElement('div');
      tick.className = 'chat-timeline-tick';

      const rowCenter = row.offsetTop + row.offsetHeight / 2;
      const pct = Math.min(97, Math.max(2, (rowCenter / totalHeight) * 100));
      tick.style.top = `${pct}%`;

      const textEl = row.querySelector('.bubble-text');
      const attachmentCount = row.querySelectorAll('.bubble-attachment').length;
      let raw = (textEl?.textContent || '').trim();
      if (!raw && attachmentCount > 0) raw = `${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''}`;
      const preview = raw.slice(0, 55) + (raw.length > 55 ? '…' : '');
      tick.dataset.preview = preview || 'Message';

      tick.addEventListener('click', () => {
        row.scrollIntoView({ behavior: 'smooth', block: 'center' });
        row.style.transition = 'background 0.2s ease, border-radius 0.2s ease';
        row.style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)';
        row.style.borderRadius = '16px';
        setTimeout(() => { row.style.background = ''; row.style.borderRadius = ''; }, 700);
      });

      timeline.appendChild(tick);
    });
  });
}

/* ── Scroll-to-bottom button ── */
let _newMsgsSinceScrolled = 0;

export function setupScrollFeatures() {
  const btn = document.getElementById('scroll-to-bottom');
  if (!btn || !chatMessages) return;
  if (btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  chatMessages.addEventListener('scroll', () => {
    const distFromBottom =
      chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight;

    const shouldShow = distFromBottom > 220;
    btn.classList.toggle('visible', shouldShow);

    if (!shouldShow) {
      _newMsgsSinceScrolled = 0;
      const badge = btn.querySelector('.scroll-to-bottom-badge');
      if (badge) badge.remove();
    }
  });

  btn.addEventListener('click', () => {
    chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' });
    _newMsgsSinceScrolled = 0;
    const badge = btn.querySelector('.scroll-to-bottom-badge');
    if (badge) badge.remove();
  });
}

export function bumpScrollBadge() {
  const btn = document.getElementById('scroll-to-bottom');
  if (!btn || !btn.classList.contains('visible')) return;

  _newMsgsSinceScrolled++;
  let badge = btn.querySelector('.scroll-to-bottom-badge');
  if (!badge) {
    badge = document.createElement('div');
    badge.className = 'scroll-to-bottom-badge';
    btn.appendChild(badge);
  }
  badge.textContent = _newMsgsSinceScrolled > 9 ? '9+' : String(_newMsgsSinceScrolled);
}
