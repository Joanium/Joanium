const CONFIRM_STYLE_ID = 'skills-confirm-style';
let _confirmResolve = null;

export function injectConfirmDialog() {
  if (document.getElementById('skills-confirm-backdrop')) return;

  const el = document.createElement('div');
  el.innerHTML = `
    <div id="skills-confirm-backdrop">
      <div class="skills-confirm-box">
        <div class="skills-confirm-icon" id="skills-confirm-icon"></div>
        <h3 id="skills-confirm-title"></h3>
        <p id="skills-confirm-body"></p>
        <div class="skills-confirm-actions">
          <button class="skills-confirm-btn skills-confirm-btn--cancel" id="skills-confirm-cancel">Cancel</button>
          <button class="skills-confirm-btn skills-confirm-btn--ok" id="skills-confirm-ok"></button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(el.firstElementChild);

  if (!document.getElementById(CONFIRM_STYLE_ID)) {
    const style = document.createElement('style');
    style.id = CONFIRM_STYLE_ID;
    style.textContent = `
      #skills-confirm-backdrop {
        position: fixed; inset: 0;
        display: flex; align-items: center; justify-content: center;
        padding: 32px;
        background: rgba(8,11,18,0.55);
        backdrop-filter: blur(12px);
        z-index: 500;
        opacity: 0; pointer-events: none;
        transition: opacity 0.22s ease;
      }
      #skills-confirm-backdrop.open { opacity: 1; pointer-events: auto; }
      .skills-confirm-box {
        background: var(--bg-secondary);
        border: 1px solid var(--border);
        border-radius: 24px;
        padding: 32px 28px 26px;
        width: min(400px, calc(100vw - 48px));
        box-shadow: 0 32px 96px rgba(0,0,0,0.32);
        transform: translateY(16px) scale(0.95);
        transition: transform 0.28s var(--ease-spring);
        display: flex; flex-direction: column; align-items: center;
        text-align: center; gap: 0;
      }
      #skills-confirm-backdrop.open .skills-confirm-box { transform: translateY(0) scale(1); }
      .skills-confirm-icon {
        width: 52px; height: 52px; border-radius: 15px;
        display: flex; align-items: center; justify-content: center;
        margin-bottom: 16px; flex-shrink: 0;
      }
      .skills-confirm-icon--enable {
        background: var(--accent-dim);
        border: 1px solid color-mix(in srgb, var(--accent) 25%, transparent);
        color: var(--accent);
      }
      .skills-confirm-icon--disable {
        background: var(--bg-tertiary);
        border: 1px solid var(--border);
        color: var(--text-muted);
      }
      #skills-confirm-title { font-size: 17px; font-weight: 600; color: var(--text-primary); margin: 0 0 10px; }
      #skills-confirm-body { font-size: 13px; color: var(--text-secondary); line-height: 1.6; margin: 0 0 26px; max-width: 300px; }
      .skills-confirm-actions { display: flex; gap: 10px; width: 100%; }
      .skills-confirm-btn {
        flex: 1; padding: 10px; border-radius: 12px;
        font-family: var(--font-ui); font-size: 13px; font-weight: 600;
        cursor: pointer; border: none;
        transition: opacity 0.15s, transform 0.1s, background 0.15s;
      }
      .skills-confirm-btn:hover { opacity: 0.88; }
      .skills-confirm-btn:active { transform: scale(0.97); }
      .skills-confirm-btn--cancel { background: var(--bg-tertiary); color: var(--text-secondary); border: 1px solid var(--border); }
      .skills-confirm-btn--cancel:hover { background: var(--bg-hover); opacity: 1; }
      .skills-confirm-btn--ok--enable { background: var(--accent); color: #fff; box-shadow: 0 4px 14px var(--accent-glow); }
      .skills-confirm-btn--ok--disable { background: var(--bg-hover); color: var(--text-primary); border: 1px solid var(--border); }
    `;
    document.head.appendChild(style);
  }

  document.getElementById('skills-confirm-cancel')?.addEventListener('click', closeConfirm);
  document.getElementById('skills-confirm-backdrop')?.addEventListener('click', event => {
    if (event.target.id === 'skills-confirm-backdrop') closeConfirm();
  });
}

export function closeConfirm() {
  document.getElementById('skills-confirm-backdrop')?.classList.remove('open');
  document.body.classList.remove('modal-open');
  _confirmResolve?.(false);
  _confirmResolve = null;
}

export function openConfirm({ type, totalCount, enabledCount }) {
  injectConfirmDialog();

  const backdrop = document.getElementById('skills-confirm-backdrop');
  const iconEl   = document.getElementById('skills-confirm-icon');
  const titleEl  = document.getElementById('skills-confirm-title');
  const bodyEl   = document.getElementById('skills-confirm-body');
  const okBtn    = document.getElementById('skills-confirm-ok');

  if (!backdrop || !iconEl || !titleEl || !bodyEl || !okBtn) return Promise.resolve(false);

  if (type === 'enable') {
    iconEl.className = 'skills-confirm-icon skills-confirm-icon--enable';
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    titleEl.textContent = 'Enable all skills?';
    bodyEl.textContent = `This will activate all ${totalCount} skill${totalCount !== 1 ? 's' : ''} and inject them into every AI conversation.`;
    okBtn.className = 'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--enable';
    okBtn.textContent = 'Enable all';
  } else {
    iconEl.className = 'skills-confirm-icon skills-confirm-icon--disable';
    iconEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="26" height="26"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14" stroke-linecap="round"/></svg>`;
    titleEl.textContent = 'Disable all skills?';
    bodyEl.textContent = `This will deactivate all ${enabledCount} active skill${enabledCount !== 1 ? 's' : ''}. The AI will no longer use them.`;
    okBtn.className = 'skills-confirm-btn skills-confirm-btn--ok skills-confirm-btn--ok--disable';
    okBtn.textContent = 'Disable all';
  }

  backdrop.classList.add('open');
  document.body.classList.add('modal-open');

  return new Promise(resolve => {
    _confirmResolve = resolve;
    const newOkBtn = okBtn.cloneNode(true);
    okBtn.replaceWith(newOkBtn);
    newOkBtn.addEventListener('click', () => {
      _confirmResolve = null;
      closeConfirm();
      resolve(true);
    });
  });
}
