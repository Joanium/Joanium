!(function () {
  const theme = localStorage.getItem('ow-theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const font = localStorage.getItem('ow-font') || 'Sora';
  document.documentElement.style.setProperty('--font-ui', `'${font}', sans-serif`);
  if (localStorage.getItem('ow-animations') === 'off') {
    document.documentElement.setAttribute('data-animations', 'off');
  }

  // Strip native browser `title` tooltips — they look out of place in an
  // Electron app. Any element that needs a tooltip uses `data-tip` or
  // `data-tooltip` instead, which is styled via CSS `::after` pseudo-elements.
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('[title]').forEach((el) => {
      const tip = el.getAttribute('title');
      if (tip) {
        // Preserve value in data-tip if nothing is already set there
        if (!el.dataset.tip && !el.dataset.tooltip) {
          el.dataset.tip = tip;
        }
      }
      el.removeAttribute('title');
    });

    // Also intercept dynamically-added title attrs via MutationObserver
    const observer = new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'attributes' && m.attributeName === 'title') {
          const el = m.target;
          const tip = el.getAttribute('title');
          if (tip) {
            if (!el.dataset.tip && !el.dataset.tooltip) el.dataset.tip = tip;
            el.removeAttribute('title');
          }
        }
      }
    });
    observer.observe(document.body, {
      attributes: true,
      subtree: true,
      attributeFilter: ['title'],
    });
  });
})();
