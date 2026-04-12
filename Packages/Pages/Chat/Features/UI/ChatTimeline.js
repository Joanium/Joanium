import { chatMessages } from '../../../Shared/Core/DOM.js';
export function buildTokenFooter(usage, provider, modelId) {
  const inp = usage?.inputTokens ?? 0,
    out = usage?.outputTokens ?? 0;
  if (!inp && !out) return null;
  const pricing = provider?.models?.[modelId]?.pricing,
    cost = pricing
      ? (inp / 1e6) * (pricing.input ?? 0) + (out / 1e6) * (pricing.output ?? 0)
      : null,
    fmtN = (n) =>
      n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}K` : String(n),
    el = document.createElement('div');
  var c;
  return (
    (el.className = 'token-footer'),
    (el.innerHTML =
      `\n    <span class="tf-item tf-in">&#8593; ${fmtN(inp)}</span>\n    <span class="tf-sep">&#183;</span>\n    <span class="tf-item tf-out">&#8595; ${fmtN(out)}</span>\n    ${null !== cost ? `<span class="tf-sep">&#183;</span><span class="tf-item tf-cost">${((c = cost), 0 === c ? '$0.000' : c < 0.001 ? '<$0.001' : `~$${c.toFixed(3)}`)}</span>` : ''}\n  `.trim()),
    el
  );
}
let _timelineRafId = null;
export function updateTimeline() {
  const timeline = document.getElementById('chat-timeline');
  timeline &&
    (_timelineRafId && cancelAnimationFrame(_timelineRafId),
    (_timelineRafId = requestAnimationFrame(() => {
      const userRows = Array.from(chatMessages.querySelectorAll('.message-row.user'));
      if (userRows.length < 2) return void timeline.classList.remove('visible');
      (timeline.classList.add('visible'),
        timeline.querySelectorAll('.chat-timeline-tick').forEach((t) => t.remove()));
      const totalHeight = chatMessages.scrollHeight;
      0 !== totalHeight &&
        userRows.forEach((row) => {
          const tick = document.createElement('div');
          tick.className = 'chat-timeline-tick';
          const rowCenter = row.offsetTop + row.offsetHeight / 2,
            pct = Math.min(97, Math.max(2, (rowCenter / totalHeight) * 100));
          tick.style.top = `${pct}%`;
          const textEl = row.querySelector('.bubble-text'),
            attachmentCount = row.querySelectorAll('.bubble-attachment').length;
          let raw = (textEl?.textContent || '').trim();
          !raw &&
            attachmentCount > 0 &&
            (raw = `${attachmentCount} attachment${attachmentCount > 1 ? 's' : ''}`);
          const preview = raw.slice(0, 55) + (raw.length > 55 ? '…' : '');
          ((tick.dataset.preview = preview || 'Message'),
            tick.addEventListener('click', () => {
              (row.scrollIntoView({ behavior: 'smooth', block: 'center' }),
                (row.style.transition = 'background 0.2s ease, border-radius 0.2s ease'),
                (row.style.background = 'color-mix(in srgb, var(--accent) 5%, transparent)'),
                (row.style.borderRadius = '16px'),
                setTimeout(() => {
                  ((row.style.background = ''), (row.style.borderRadius = ''));
                }, 700));
            }),
            timeline.appendChild(tick));
        });
    })));
}
let _newMsgsSinceScrolled = 0,
  _followBottom = !0;
export function isFollowingBottom() {
  return _followBottom;
}
export function setFollowBottom(next) {
  _followBottom = Boolean(next);
}
export function maybeScrollToBottom({
  behavior: behavior = 'smooth',
  thresholdPx: thresholdPx = 36,
} = {}) {
  return !(
    !chatMessages ||
    (!_followBottom &&
      !(function (thresholdPx = 36) {
        return (
          (chatMessages
            ? chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight
            : 1 / 0) <= thresholdPx
        );
      })(thresholdPx)) ||
    (chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: behavior }), 0)
  );
}
export function setupScrollFeatures() {
  const btn = document.getElementById('scroll-to-bottom');
  btn &&
    chatMessages &&
    '1' !== btn.dataset.bound &&
    ((btn.dataset.bound = '1'),
    chatMessages.addEventListener('scroll', () => {
      const distFromBottom =
          chatMessages.scrollHeight - chatMessages.scrollTop - chatMessages.clientHeight,
        shouldShow = distFromBottom > 220;
      if (
        (btn.classList.toggle('visible', shouldShow),
        (_followBottom = distFromBottom <= 36),
        !shouldShow)
      ) {
        _newMsgsSinceScrolled = 0;
        const badge = btn.querySelector('.scroll-to-bottom-badge');
        badge && badge.remove();
      }
    }),
    btn.addEventListener('click', () => {
      ((_followBottom = !0),
        chatMessages.scrollTo({ top: chatMessages.scrollHeight, behavior: 'smooth' }),
        (_newMsgsSinceScrolled = 0));
      const badge = btn.querySelector('.scroll-to-bottom-badge');
      badge && badge.remove();
    }));
}
export function bumpScrollBadge() {
  const btn = document.getElementById('scroll-to-bottom');
  if (!btn || !btn.classList.contains('visible')) return;
  _newMsgsSinceScrolled++;
  let badge = btn.querySelector('.scroll-to-bottom-badge');
  (badge ||
    ((badge = document.createElement('div')),
    (badge.className = 'scroll-to-bottom-badge'),
    btn.appendChild(badge)),
    (badge.textContent = _newMsgsSinceScrolled > 9 ? '9+' : String(_newMsgsSinceScrolled)));
}
