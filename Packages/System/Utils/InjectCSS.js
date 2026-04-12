export function injectCSS(href) {
  return document.querySelector(`link[href="${href}"]`)
    ? Promise.resolve()
    : new Promise((resolve) => {
        const link = document.createElement('link');
        ((link.rel = 'stylesheet'),
          (link.href = href),
          (link.onload = () => resolve()),
          (link.onerror = () => resolve()),
          document.head.appendChild(link));
      });
}
