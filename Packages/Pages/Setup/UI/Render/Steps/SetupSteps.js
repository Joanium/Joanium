export function initStepController({
  state: state,
  STEP_ELS: STEP_ELS,
  setupLogo: setupLogo,
  progressTrack: progressTrack,
  progressDots: progressDots,
  nameInput: nameInput,
  doneTitle: doneTitle,
}) {
  return {
    goToStep: function (n) {
      const fromEl = STEP_ELS[state.step],
        toEl = STEP_ELS[n];
      if (
        (fromEl.classList.remove('visible'),
        fromEl.classList.add('leaving'),
        setTimeout(() => {
          (fromEl.classList.remove('leaving'), (fromEl.style.display = 'none'));
        }, 340),
        n >= 1 &&
          ((setupLogo.style.opacity = '1'),
          (setupLogo.style.pointerEvents = 'auto'),
          (progressTrack.style.opacity = '1')),
        progressDots.forEach((dot, i) => {
          (dot.classList.remove('active', 'done'),
            i < n && dot.classList.add('done'),
            i === n && dot.classList.add('active'));
        }),
        (toEl.style.display = 'flex'),
        toEl.classList.add('entering'),
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            (toEl.classList.remove('entering'), toEl.classList.add('visible'));
          });
        }),
        (state.step = n),
        1 === n && setTimeout(() => nameInput.focus(), 360),
        3 === n)
      ) {
        const first = state.name.split(' ')[0];
        ((doneTitle.textContent = `You're all set, ${first} 🎉`),
          setTimeout(() => window.electronAPI?.invoke?.('launch-main'), 2200));
      }
    },
  };
}
