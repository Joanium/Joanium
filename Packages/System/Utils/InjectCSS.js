/**
 * Lazily inject a CSS file into <head> exactly once.
 * Returns a Promise that resolves only when the stylesheet is fully parsed —
 * so callers can await it before injecting any HTML to prevent FOUC.
 *
 * @param {string} href  Path relative to the HTML file (e.g. 'Assets/Styles/AgentsPage.css')
 * @returns {Promise<void>}
 */
export function injectCSS(href) {
  const existing = document.querySelector(`link[href="${href}"]`);
  if (existing) return Promise.resolve(); // already loaded, no flash possible

  return new Promise((resolve) => {
    const link = document.createElement('link');
    link.rel   = 'stylesheet';
    link.href  = href;
    link.onload  = () => resolve();
    link.onerror = () => resolve(); // don't block render on a missing file
    document.head.appendChild(link);
  });
}

