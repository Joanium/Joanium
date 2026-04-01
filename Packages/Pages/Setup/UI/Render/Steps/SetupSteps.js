/**
 * Controls step-to-step transitions in the Setup wizard.
 *
 * @param {{
 *   state: { step: number, name: string },
 *   STEP_ELS: HTMLElement[],
 *   setupLogo: HTMLElement,
 *   progressTrack: HTMLElement,
 *   progressDots: NodeListOf<HTMLElement>,
 *   nameInput: HTMLInputElement,
 *   doneTitle: HTMLElement,
 * }} ctx
 * @returns {{ goToStep: Function }}
 */
export function initStepController({ state, STEP_ELS, setupLogo, progressTrack, progressDots, nameInput, doneTitle }) {
  function goToStep(n) {
    const fromEl = STEP_ELS[state.step];
    const toEl   = STEP_ELS[n];

    // Animate out
    fromEl.classList.remove('visible');
    fromEl.classList.add('leaving');
    setTimeout(() => {
      fromEl.classList.remove('leaving');
      fromEl.style.display = 'none';
    }, 340);

    // Show logo + progress dots when leaving splash
    if (n >= 1) {
      setupLogo.style.opacity      = '1';
      setupLogo.style.pointerEvents = 'auto';
      progressTrack.style.opacity  = '1';
    }

    // Update dots: done = before current, active = current, rest = idle
    progressDots.forEach((dot, i) => {
      dot.classList.remove('active', 'done');
      if (i < n) dot.classList.add('done');
      if (i === n) dot.classList.add('active');
    });

    // Animate in
    toEl.style.display = 'flex';
    toEl.classList.add('entering');
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toEl.classList.remove('entering');
        toEl.classList.add('visible');
      });
    });

    state.step = n;

    // Step-specific side-effects
    if (n === 1) setTimeout(() => nameInput.focus(), 360);

    if (n === 3) {
      const first = state.name.split(' ')[0];
      doneTitle.textContent = `You're all set, ${first} 🎉`;
      setTimeout(() => window.electronAPI?.launchMain?.(), 2200);
    }
  }

  return { goToStep };
}
