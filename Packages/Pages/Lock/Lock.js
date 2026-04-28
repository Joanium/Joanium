/**
 * Lock page — renderer logic
 *
 * Handles:
 *   • Animated particle background (matches Setup page aesthetic)
 *   • Password show/hide toggle
 *   • App lock password verification via IPC
 *   • Error display with shake animation
 *   • Smooth exit before page navigation
 */

// ─── Particle background ──────────────────────────────────────────────────────

function spawnParticles() {
  const canvas = document.getElementById('lock-canvas');
  if (!canvas) return;

  const COUNT = 18;
  for (let i = 0; i < COUNT; i++) {
    const el = document.createElement('div');
    el.className = `lock-particle lock-particle--${i + 1}`;

    canvas.appendChild(el);
  }
}

// ─── DOM refs ─────────────────────────────────────────────────────────────────

const input = /** @type {HTMLInputElement}  */ (document.getElementById('lock-password'));
const unlockBtn = /** @type {HTMLButtonElement} */ (document.getElementById('lock-unlock-btn'));
const btnText = document.getElementById('lock-btn-text');
const spinner = document.getElementById('lock-spinner');
const errorEl = document.getElementById('lock-error');
const eyeBtn = document.getElementById('lock-eye-btn');
const eyeOpen = document.getElementById('lock-eye-open');
const eyeClosed = document.getElementById('lock-eye-closed');
const card = document.getElementById('lock-card');

// ─── Forgot password / recovery flow ─────────────────────────────────────

const forgotBtn = document.getElementById('lock-forgot-btn');
const recoveryCard = document.getElementById('lock-recovery');
const mainCard = document.getElementById('lock-card');
const backBtn = document.getElementById('lock-back-btn');
const qText = document.getElementById('lock-q-text');
const recAnswer = document.getElementById('lock-recovery-answer');
const recError = document.getElementById('lock-recovery-error');
const verifyAnsBtn = document.getElementById('lock-verify-answer-btn');
const newPwWrap = document.getElementById('lock-newpw-wrap');
const newPw = document.getElementById('lock-new-pw');
const newPw2 = document.getElementById('lock-new-pw2');
const resetPwBtn = document.getElementById('lock-reset-pw-btn');
const APP_LOCK_MIN_PASSWORD_LENGTH = 6;

let _resetToken = null;

function showRecovery() {
  mainCard?.classList.add('lock-card--exit');
  setTimeout(() => {
    if (mainCard) mainCard.hidden = true;
    mainCard?.classList.remove('lock-card--exit');
    if (recoveryCard) recoveryCard.hidden = false;
    recAnswer?.focus();
  }, 280);
}

function showUnlock() {
  if (recoveryCard) recoveryCard.hidden = true;
  if (mainCard) mainCard.hidden = false;
  _resetToken = null;
  if (newPwWrap) newPwWrap.hidden = true;
  if (recAnswer?.parentElement) recAnswer.parentElement.hidden = false;
  if (recAnswer) recAnswer.value = '';
  if (recError) {
    recError.hidden = true;
    recError.textContent = '';
  }
  if (newPw) newPw.value = '';
  if (newPw2) newPw2.value = '';
  if (verifyAnsBtn) {
    verifyAnsBtn.hidden = false;
    verifyAnsBtn.disabled = false;
    verifyAnsBtn.textContent = 'Verify Answer';
  }
  if (resetPwBtn) {
    resetPwBtn.disabled = false;
    resetPwBtn.textContent = 'Set New Password';
  }
}

forgotBtn?.addEventListener('click', async () => {
  const res = await window.electronAPI?.invoke('get-app-lock-question');
  if (res?.question) {
    if (qText) qText.textContent = res.question;
    showRecovery();
  }
});

backBtn?.addEventListener('click', showUnlock);

verifyAnsBtn?.addEventListener('click', async () => {
  const ans = recAnswer?.value ?? '';
  if (!ans.trim()) {
    if (recError) {
      recError.textContent = 'Please enter your answer.';
      recError.hidden = false;
    }
    return;
  }
  if (recError) recError.hidden = true;
  verifyAnsBtn.disabled = true;
  verifyAnsBtn.textContent = 'Verifying…';
  try {
    const res = await window.electronAPI?.invoke('verify-app-lock-answer', ans);
    if (!res?.ok) {
      if (recError) {
        recError.textContent = res?.error ?? 'Incorrect answer.';
        recError.hidden = false;
      }
      verifyAnsBtn.disabled = false;
      verifyAnsBtn.textContent = 'Verify Answer';
      return;
    }
    _resetToken = res.resetToken;
    if (verifyAnsBtn) verifyAnsBtn.hidden = true;
    if (recAnswer?.parentElement) recAnswer.parentElement.hidden = true;
    if (newPwWrap) {
      newPwWrap.hidden = false;
      newPw?.focus();
    }
  } catch (e) {
    if (recError) {
      recError.textContent = e.message ?? 'Failed.';
      recError.hidden = false;
    }
    verifyAnsBtn.disabled = false;
    verifyAnsBtn.textContent = 'Verify Answer';
  }
});

resetPwBtn?.addEventListener('click', async () => {
  const p1 = newPw?.value ?? '';
  const p2 = newPw2?.value ?? '';
  if (p1.length < APP_LOCK_MIN_PASSWORD_LENGTH) {
    if (recError) {
      recError.textContent = `Password must be at least ${APP_LOCK_MIN_PASSWORD_LENGTH} characters.`;
      recError.hidden = false;
    }
    return;
  }
  if (p1 !== p2) {
    if (recError) {
      recError.textContent = 'Passwords do not match.';
      recError.hidden = false;
    }
    return;
  }
  if (recError) recError.hidden = true;
  resetPwBtn.disabled = true;
  resetPwBtn.textContent = 'Saving…';
  try {
    const res = await window.electronAPI?.invoke('reset-app-lock-password', {
      token: _resetToken,
      newPassword: p1,
    });
    if (!res?.ok) {
      if (recError) {
        recError.textContent = res?.error ?? 'Reset failed.';
        recError.hidden = false;
      }
      resetPwBtn.disabled = false;
      resetPwBtn.textContent = 'Set New Password';
      return;
    }
    // Password reset — go back to unlock screen and let them log in with new password
    showUnlock();
  } catch (e) {
    if (recError) {
      recError.textContent = e.message ?? 'Failed.';
      recError.hidden = false;
    }
    resetPwBtn.disabled = false;
    resetPwBtn.textContent = 'Set New Password';
  }
});
// ─── Helpers ──────────────────────────────────────────────────────────────────

function showError(msg) {
  if (!errorEl) return;
  errorEl.textContent = msg;
  errorEl.hidden = false;
}

function clearError() {
  if (!errorEl) return;
  errorEl.textContent = '';
  errorEl.hidden = true;
}

function setLoading(on) {
  if (!unlockBtn || !btnText || !spinner) return;
  unlockBtn.disabled = on;
  btnText.textContent = on ? 'Verifying…' : 'Unlock';
  spinner.hidden = !on;
}

function shakeInput() {
  if (!input) return;
  input.classList.remove('lock-input--shake');
  // Force reflow so the animation restarts even on repeated failures
  void input.offsetWidth;
  input.classList.add('lock-input--shake');
  input.addEventListener('animationend', () => input.classList.remove('lock-input--shake'), {
    once: true,
  });
}

// ─── Eye toggle ───────────────────────────────────────────────────────────────

eyeBtn?.addEventListener('click', () => {
  const isPassword = input?.type === 'password';
  if (input) input.type = isPassword ? 'text' : 'password';
  if (eyeOpen) eyeOpen.hidden = isPassword; // hide when showing text
  if (eyeClosed) eyeClosed.hidden = !isPassword; // show when showing text
  input?.focus();
});

// ─── Unlock flow ──────────────────────────────────────────────────────────────

async function attemptUnlock() {
  const password = input?.value ?? '';

  if (!password) {
    showError('Please enter your password.');
    input?.focus();
    return;
  }

  clearError();
  setLoading(true);

  try {
    const result = await window.electronAPI?.invoke('verify-system-password', password);

    if (result?.ok) {
      // Fade the card out, then tell the main process to swap the page
      card?.classList.add('lock-card--exit');
      await window.electronAPI?.invoke('unlock-app');
      // The main process will navigate to Chat; nothing more to do here
    } else {
      const msg = result?.error ?? 'Incorrect password. Please try again.';
      showError(msg);
      shakeInput();
      // Clear the field so the user can type cleanly
      if (input) {
        input.value = '';
        input.focus();
      }
    }
  } catch (err) {
    showError(err?.message ?? 'Verification failed. Please try again.');
    shakeInput();
    if (input) {
      input.value = '';
      input.focus();
    }
  } finally {
    setLoading(false);
  }
}

// ─── Event wiring ─────────────────────────────────────────────────────────────

unlockBtn?.addEventListener('click', attemptUnlock);

input?.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    attemptUnlock();
  }
  // Clear stale error as the user starts retyping
  if (e.key.length === 1 || e.key === 'Backspace') clearError();
});

// ─── Init ─────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  spawnParticles();
  input?.focus();
});
