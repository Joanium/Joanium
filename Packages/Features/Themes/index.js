!(function () {
  const theme = localStorage.getItem('ow-theme') || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  const font = localStorage.getItem('ow-font') || 'Sora';
  document.documentElement.style.setProperty('--font-ui', `'${font}', sans-serif`);
})();
